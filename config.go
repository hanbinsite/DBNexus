package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"db-server/db"
)

func (a *App) connectionToDBConfig(conn Connection) db.ConnectionConfig {
	password := conn.Password
	if conn.SavePassword && conn.Password != "" {
		decrypted, err := decryptPassword(conn.Password)
		if err == nil {
			password = decrypted
		}
	}

	return db.ConnectionConfig{
		Type:     db.DBType(conn.Type),
		Host:     conn.Host,
		Port:     conn.Port,
		Username: conn.Username,
		Password: password,
		Database: conn.Database,
		SSLMode:  conn.SSLMode,
	}
}

// getDriverForConfig gets a driver from pool or creates a new one
// Uses buildKey (includes database name) for consistent connection pooling
func (a *App) getDriverForConfig(dbConfig db.ConnectionConfig) (db.DatabaseDriver, error) {
	key := buildKey(dbConfig)

	a.poolMutex.RLock()
	if pooled, exists := a.pool.get(key); exists {
		a.poolMutex.RUnlock()
		return pooled.driver, nil
	}
	a.poolMutex.RUnlock()

	a.poolMutex.Lock()
	defer a.poolMutex.Unlock()

	// Double check
	if pooled, exists := a.pool.get(key); exists {
		return pooled.driver, nil
	}

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}

	a.pool.set(key, driver)
	return driver, nil
}

// getDriverForConnection returns a driver for the given connection config
func (a *App) getDriverForConnection(config Connection) (db.DatabaseDriver, error) {
	dbConfig := a.connectionToDBConfig(config)
	return a.driverManager.Connect(dbConfig)
}

func (a *App) loadConnections() error {
	configDir := filepath.Dir(a.configPath)

	// 创建配置目录（使用更严格的权限）
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("无法创建配置目录 '%s': %w (请检查目录权限)", configDir, err)
	}

	data, err := os.ReadFile(a.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// 配置文件不存在是正常情况，初始化空连接列表
			a.connections = []Connection{}
			return nil
		}
		return fmt.Errorf("无法读取配置文件 '%s': %w (请检查文件权限或文件是否被占用)", a.configPath, err)
	}

	// 检查文件是否为空
	if len(data) == 0 {
		a.connections = []Connection{}
		return nil
	}

	if err := json.Unmarshal(data, &a.connections); err != nil {
		// 提供更详细的错误信息
		if syntaxErr, ok := err.(*json.SyntaxError); ok {
			return fmt.Errorf("配置文件 '%s' JSON 格式错误: 位置 %d 处语法错误 - %w (请检查JSON格式是否正确)",
				a.configPath, syntaxErr.Offset, err)
		}
		if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
			return fmt.Errorf("配置文件 '%s' 类型错误: 字段 '%s' 期望类型 %s 但得到 %s - %w",
				a.configPath, typeErr.Field, typeErr.Type, typeErr.Value, err)
		}
		return fmt.Errorf("无法解析配置文件 '%s': %w (请确保文件包含有效的连接配置JSON)", a.configPath, err)
	}

	return nil
}

func (a *App) saveConnections() error {
	configDir := filepath.Dir(a.configPath)

	// 创建配置目录（使用更严格的权限）
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("无法创建配置目录 '%s': %w (请检查目录权限)", configDir, err)
	}

	data, err := json.MarshalIndent(a.connections, "", " ")
	if err != nil {
		return fmt.Errorf("无法序列化连接配置: %w", err)
	}

	if err := os.WriteFile(a.configPath, data, 0600); err != nil {
		return fmt.Errorf("无法写入配置文件 '%s': %w (请检查文件权限或磁盘空间)", a.configPath, err)
	}

	return nil
}
