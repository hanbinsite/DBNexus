package main

import (
	"context"
	"fmt"
	"strings"

	"db-server/db"
)

func (a *App) GetRedisKeyInfo(config Connection, key string) (*db.RedisKeyInfo, error) {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	return driver.GetRedisKeyInfo(ctx, key)
}

func (a *App) SetRedisKeyValue(config Connection, key string, value interface{}, ttl int64) error {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return err
	}

	ctx := context.Background()
	err = driver.SetRedisKeyValue(ctx, key, value, ttl)
	if err != nil {
		return err
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("设置Redis键: %s", key),
		map[string]interface{}{
			"key": key,
			"ttl": ttl,
		},
	)
	return nil
}

func (a *App) DeleteRedisKey(config Connection, keys ...string) error {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return err
	}

	ctx := context.Background()
	if err := driver.DeleteRedisKey(ctx, keys...); err != nil {
		return err
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("删除Redis键: %v", keys),
		map[string]interface{}{
			"keys": keys,
		},
	)
	return nil
}

func (a *App) ExecuteRedisCommand(config Connection, cmd string, args ...interface{}) (interface{}, error) {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, err
	}

	cmdUpper := strings.ToUpper(cmd)

	redisSafeCommands := map[string]bool{
		"GET": true, "SET": true, "MGET": true, "MSET": true, "GETSET": true,
		"DEL": true, "EXISTS": true, "TYPE": true, "TTL": true, "PTTL": true,
		"EXPIRE": true, "EXPIREAT": true, "PEXPIRE": true, "PEXPIREAT": true,
		"PERSIST": true, "RENAME": true, "RENAMENX": true, "DUMP": true, "RESTORE": true,
		"KEYS": true, "SCAN": true, "RANDOMKEY": true,
		"STRLEN": true, "APPEND": true, "GETRANGE": true, "SETRANGE": true,
		"INCR": true, "INCRBY": true, "DECR": true, "DECRBY": true, "INCRBYFLOAT": true,
		"LPUSH": true, "LPOP": true, "RPUSH": true, "RPOP": true,
		"LLEN": true, "LRANGE": true, "LINDEX": true, "LSET": true, "LREM": true,
		"SADD": true, "SREM": true, "SMEMBERS": true, "SISMEMBER": true,
		"SCARD": true, "SINTER": true, "SUNION": true, "SDIFF": true,
		"ZADD": true, "ZREM": true, "ZRANGE": true, "ZREVRANGE": true,
		"ZRANGEBYSCORE": true, "ZCARD": true, "ZSCORE": true, "ZRANK": true, "ZREVRANK": true,
		"HSET": true, "HGET": true, "HMSET": true, "HMGET": true, "HGETALL": true,
		"HDEL": true, "HEXISTS": true, "HLEN": true, "HKEYS": true, "HVALS": true,
		"PUBLISH": true, "SUBSCRIBE": true, "UNSUBSCRIBE": true,
		"INFO": true, "PING": true, "ECHO": true, "DBSIZE": true,
		"CLIENT": true, "CLUSTER": true, "COMMAND": true,
		"SELECT": true, "AUTH": true,
	}

	if !redisSafeCommands[cmdUpper] {
		auditLogger := GetAuditLogger()
		auditLogger.Log(AuditLevelError, AuditEventQuery,
			fmt.Sprintf("拒绝危险Redis命令: %s", cmd),
			map[string]interface{}{
				"command": cmd,
				"args":    args,
			},
		)
		return nil, fmt.Errorf("危险命令拒绝: %s 不在允许列表内", cmd)
	}

	ctx := context.Background()
	result, err := driver.ExecuteRedisCommand(ctx, cmd, args...)
	if err != nil {
		return nil, err
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("执行Redis命令: %s", cmd),
		map[string]interface{}{
			"command": cmd,
			"args":    args,
		},
	)
	return result, nil
}

func (a *App) GetRedisInfo(config Connection, section string) (string, error) {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return "", err
	}

	ctx := context.Background()
	return driver.GetRedisInfo(ctx, section)
}

func (a *App) GetRedisDBSize(config Connection) (int64, error) {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return 0, err
	}

	ctx := context.Background()
	return driver.GetRedisDBSize(ctx)
}

func (a *App) ScanRedisKeys(config Connection, pattern string, cursor uint64, count int64) ([]string, uint64, error) {
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, 0, err
	}

	ctx := context.Background()
	return driver.ScanRedisKeys(ctx, pattern, cursor, count)
}

func (a *App) getRedisDriver(config Connection) (*db.RedisDriver, error) {
	dbConfig := a.connectionToDBConfig(config)
	database := config.Database
	if database == "" {
		database = "db0"
	}
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("连接Redis失败: %v", err)
	}

	redisDriver, ok := driver.(*db.RedisDriver)
	if !ok {
		return nil, fmt.Errorf("不是Redis连接")
	}

	return redisDriver, nil
}
