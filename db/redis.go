package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ErrRedisUnsupportedOperation is returned when a SQL operation is attempted on Redis
var ErrRedisUnsupportedOperation = errors.New("query operation not supported for Redis")

// RedisDriver implements the DatabaseDriver interface for Redis
type RedisDriver struct {
	client *redis.Client
}

// NewRedisDriver creates a new RedisDriver
func NewRedisDriver() DatabaseDriver {
	return &RedisDriver{}
}

// Connect establishes a connection to Redis
func (d *RedisDriver) Connect(config ConnectionConfig) error {
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	// 解析数据库编号（Redis有16个库：0-15）
	dbNum := 0
	if config.Database != "" {
		fmt.Sscanf(config.Database, "db%d", &dbNum)
	}

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: config.Username,
		Password: config.Password,
		DB:       dbNum,
	})

	d.client = client
	return nil
}

// UseDatabase switches the current database context
func (d *RedisDriver) UseDatabase(ctx context.Context, database string) error {
	// Redis uses numeric DBs (0-15). If "db0", extract 0.
	var dbNum int
	fmt.Sscanf(database, "db%d", &dbNum)
	_, err := d.client.Do(ctx, "SELECT", dbNum).Result()
	return err
}

// Close closes the Redis connection
func (d *RedisDriver) Close() error {
	if d.client != nil {
		return d.client.Close()
	}
	return nil
}

// Ping tests the Redis connection
func (d *RedisDriver) Ping(ctx context.Context) error {
	return d.client.Ping(ctx).Err()
}

// Query executes a query that returns rows (Redis does not support SQL)
func (d *RedisDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return nil, ErrRedisUnsupportedOperation
}

// Exec executes a query that doesn't return rows (Redis does not support SQL)
func (d *RedisDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return nil, ErrRedisUnsupportedOperation
}

const (
	MaxRedisKeys = 10000 // Redis 最大返回键数量
)

// GetTables returns a list of keys in Redis (uses SCAN instead of KEYS for safety)
func (d *RedisDriver) GetTables(ctx context.Context) ([]string, error) {
	var keys []string
	var cursor uint64

	for len(keys) < MaxRedisKeys {
		var scannedKeys []string
		var err error
		scannedKeys, cursor, err = d.client.Scan(ctx, cursor, "*", 100).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, scannedKeys...)
		if cursor == 0 {
			break
		}
	}

	// 限制返回的键数量，防止内存耗尽
	if len(keys) > MaxRedisKeys {
		keys = keys[:MaxRedisKeys]
	}

	return keys, nil
}

// GetTableStructure returns the type and structure of a Redis key
func (d *RedisDriver) GetTableStructure(ctx context.Context, keyName string) ([]ColumnInfo, error) {
	keyType, err := d.client.Type(ctx, keyName).Result()
	if err != nil {
		return nil, err
	}

	return []ColumnInfo{
		{
			Name:         "key",
			Type:         "string",
			Nullable:     false,
			DefaultValue: "",
			PrimaryKey:   true,
		},
		{
			Name:         "type",
			Type:         keyType,
			Nullable:     false,
			DefaultValue: "",
			PrimaryKey:   false,
		},
	}, nil
}

func (d *RedisDriver) GetDatabases(ctx context.Context) ([]string, error) {
	databases := make([]string, 16)
	for i := 0; i < 16; i++ {
		databases[i] = fmt.Sprintf("db%d", i)
	}
	return databases, nil
}

func (d *RedisDriver) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return nil, ErrRedisUnsupportedOperation
}

// ========== 新增：Redis专用功能 ==========

// RedisKeyInfo Redis键的详细信息
type RedisKeyInfo struct {
	Key      string      `json:"key"`
	Type     string      `json:"type"`     // string, list, set, zset, hash, stream
	TTL      int64       `json:"ttl"`      // 过期时间（秒），-1表示永不过期，-2表示已过期
	Size     int64       `json:"size"`     // 元素数量
	Value    interface{} `json:"value"`    // 键值（根据类型不同）
	Encoding string      `json:"encoding"` // Redis内部编码
}

// GetRedisKeyInfo 获取Redis键的详细信息
func (d *RedisDriver) GetRedisKeyInfo(ctx context.Context, key string) (*RedisKeyInfo, error) {
	// 获取键类型
	keyType, err := d.client.Type(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	// 获取TTL
	ttl, err := d.client.TTL(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	// 获取值
	var value interface{}
	var size int64

	switch keyType {
	case "string":
		strVal, err2 := d.client.Get(ctx, key).Result()
		value, err = strVal, err2
		size = 1
	case "list":
		listVal, err2 := d.client.LRange(ctx, key, 0, -1).Result()
		value, err = listVal, err2
		if err == nil {
			size = int64(len(listVal))
		}
	case "set":
		setVal, err2 := d.client.SMembers(ctx, key).Result()
		value, err = setVal, err2
		if err == nil {
			size = int64(len(setVal))
		}
	case "zset":
		zsetVal, err2 := d.client.ZRangeWithScores(ctx, key, 0, -1).Result()
		value, err = zsetVal, err2
		if err == nil {
			size = int64(len(zsetVal))
		}
	case "hash":
		hashVal, err2 := d.client.HGetAll(ctx, key).Result()
		value, err = hashVal, err2
		if err == nil {
			size = int64(len(hashVal))
		}
	case "stream":
		streamVal, err2 := d.client.XRange(ctx, key, "-", "+").Result()
		value, err = streamVal, err2
		if err == nil {
			size = int64(len(streamVal))
		}
	default:
		return nil, fmt.Errorf("unsupported key type: %s", keyType)
	}

	if err != nil && err != redis.Nil {
		return nil, err
	}

	// 获取编码信息
	encoding, _ := d.client.ObjectEncoding(ctx, key).Result()

	return &RedisKeyInfo{
		Key:      key,
		Type:     keyType,
		TTL:      int64(ttl.Seconds()),
		Size:     size,
		Value:    value,
		Encoding: encoding,
	}, nil
}

// SetRedisKeyValue 设置Redis键值
func (d *RedisDriver) SetRedisKeyValue(ctx context.Context, key string, value interface{}, ttl int64) error {
	// 设置值
	if err := d.client.Set(ctx, key, value, 0).Err(); err != nil {
		return err
	}

	// 设置过期时间（如果指定）
	if ttl > 0 {
		if err := d.client.Expire(ctx, key, time.Duration(ttl)*time.Second).Err(); err != nil {
			return err
		}
	}

	return nil
}

// DeleteRedisKey 删除Redis键
func (d *RedisDriver) DeleteRedisKey(ctx context.Context, keys ...string) error {
	return d.client.Del(ctx, keys...).Err()
}

// ExecuteRedisCommand 执行Redis命令
func (d *RedisDriver) ExecuteRedisCommand(ctx context.Context, cmd string, args ...interface{}) (interface{}, error) {
	// 构建参数：将cmd和args合并
	allArgs := make([]interface{}, len(args)+1)
	allArgs[0] = cmd
	for i, arg := range args {
		allArgs[i+1] = arg
	}
	return d.client.Do(ctx, allArgs...).Result()
}

// GetRedisInfo 获取Redis服务器信息
func (d *RedisDriver) GetRedisInfo(ctx context.Context, section string) (string, error) {
	return d.client.Info(ctx, section).Result()
}

// GetRedisDBSize 获取当前数据库的键数量
func (d *RedisDriver) GetRedisDBSize(ctx context.Context) (int64, error) {
	return d.client.DBSize(ctx).Result()
}

// ScanRedisKeys 扫描匹配的键（分页）
func (d *RedisDriver) ScanRedisKeys(ctx context.Context, pattern string, cursor uint64, count int64) ([]string, uint64, error) {
	return d.client.Scan(ctx, cursor, pattern, count).Result()
}
