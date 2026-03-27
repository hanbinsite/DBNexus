package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
)

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

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: config.Username,
		Password: config.Password,
		DB:       0,
	})

	d.client = client
	return nil
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

// Query executes a query that returns rows (not applicable for Redis)
func (d *RedisDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return nil, fmt.Errorf("query operation not supported for Redis")
}

// Exec executes a query that doesn't return rows (not applicable for Redis)
func (d *RedisDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return nil, fmt.Errorf("exec operation not supported for Redis")
}

// GetTables returns a list of keys in Redis
func (d *RedisDriver) GetTables(ctx context.Context) ([]string, error) {
	keys, err := d.client.Keys(ctx, "*").Result()
	if err != nil {
		return nil, err
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

// GetDatabases returns a list of databases in Redis
func (d *RedisDriver) GetDatabases(ctx context.Context) ([]string, error) {
	databases := make([]string, 16)
	for i := 0; i < 16; i++ {
		databases[i] = fmt.Sprintf("db%d", i)
	}
	return databases, nil
}
