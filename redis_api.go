package main

import (
	"context"
	"fmt"

	"db-server/db"
)

// ========== Redis专用API ==========

// GetRedisKeyInfo 获取Redis键的详细信息
func (a *App) GetRedisKeyInfo(config Connection, key string) (*db.RedisKeyInfo, error) {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, err
	}

	// 获取键信息
	ctx := context.Background()
	return driver.GetRedisKeyInfo(ctx, key)
}

// SetRedisKeyValue 设置Redis键值
func (a *App) SetRedisKeyValue(config Connection, key string, value interface{}, ttl int64) error {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return err
	}

	// 设置键值
	ctx := context.Background()
	return driver.SetRedisKeyValue(ctx, key, value, ttl)

	// 记录审计日志
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

// DeleteRedisKey 删除Redis键
func (a *App) DeleteRedisKey(config Connection, keys ...string) error {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return err
	}

	// 删除键
	ctx := context.Background()
	if err := driver.DeleteRedisKey(ctx, keys...); err != nil {
		return err
	}

	// 记录审计日志
	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("删除Redis键: %v", keys),
		map[string]interface{}{
			"keys": keys,
		},
	)
	return nil
}

// ExecuteRedisCommand 执行Redis命令
func (a *App) ExecuteRedisCommand(config Connection, cmd string, args ...interface{}) (interface{}, error) {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, err
	}

	// 执行命令
	ctx := context.Background()
	result, err := driver.ExecuteRedisCommand(ctx, cmd, args...)
	if err != nil {
		return nil, err
	}

	// 记录审计日志
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

// GetRedisInfo 获取Redis服务器信息
func (a *App) GetRedisInfo(config Connection, section string) (string, error) {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return "", err
	}

	// 获取信息
	ctx := context.Background()
	return driver.GetRedisInfo(ctx, section)
}

// GetRedisDBSize 获取当前数据库的键数量
func (a *App) GetRedisDBSize(config Connection) (int64, error) {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return 0, err
	}

	// 获取键数量
	ctx := context.Background()
	return driver.GetRedisDBSize(ctx)
}

// ScanRedisKeys 扫描匹配的键（分页）
func (a *App) ScanRedisKeys(config Connection, pattern string, cursor uint64, count int64) ([]string, uint64, error) {
	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取Redis驱动
	driver, err := a.getRedisDriver(config)
	if err != nil {
		return nil, 0, err
	}

	// 扫描键
	ctx := context.Background()
	return driver.ScanRedisKeys(ctx, pattern, cursor, count)
}

// getRedisDriver 获取Redis驱动
func (a *App) getRedisDriver(config Connection) (*db.RedisDriver, error) {
	dbConfig := a.connectionToDBConfig(config)
	database := config.Database
	if database == "" {
		database = "db0"
	}
	dbConfig.Database = database

	// 从连接池获取或创建连接
	key := buildKey(dbConfig)
	pooled, err := a.pool.getOrCreate(key, func() (db.DatabaseDriver, error) {
		return a.driverManager.Connect(dbConfig)
	})
	if err != nil {
		return nil, fmt.Errorf("连接Redis失败: %v", err)
	}

	// 类型断言获取Redis驱动
	redisDriver, ok := pooled.driver.(*db.RedisDriver)
	if !ok {
		return nil, fmt.Errorf("不是Redis连接")
	}

	return redisDriver, nil
}
