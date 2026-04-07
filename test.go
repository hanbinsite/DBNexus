package main

import (
	"fmt"
	"time"

	"db-server/db"
)

// RunConnectionTest runs a connection test
func (a *App) RunConnectionTest(config Connection) TestResult {
	startTime := time.Now()
	lang := a.getCurrentLang()

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := db.ConnectionConfig{
		Type:     db.DBType(config.Type),
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		Database: config.Database,
		SSLMode:  config.SSLMode,
	}

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return TestResult{
			Name:    config.Name,
			Success: false,
			Message: fmt.Sprintf("%s: %v", a.t(MsgConnectionFailed, lang), err),
			Time:    time.Since(startTime).String(),
		}
	}
	defer driver.Close()

	err = driver.Ping(a.ctx)
	if err != nil {
		return TestResult{
			Name:    config.Name,
			Success: false,
			Message: fmt.Sprintf(a.t(MsgPingFailed, lang), err),
			Time:    time.Since(startTime).String(),
		}
	}

	return TestResult{
		Name:    config.Name,
		Success: true,
		Message: a.t(MsgConnected, lang),
		Time:    time.Since(startTime).String(),
	}
}

// RunAllTests runs tests for all saved connections
func (a *App) RunAllTests() []TestResult {
	var results []TestResult

	for _, conn := range a.connections {
		result := a.RunConnectionTest(conn)
		results = append(results, result)
	}

	return results
}

// GetSupportedFeatures returns supported features for each database type
func (a *App) GetSupportedFeatures() map[string][]string {
	return map[string][]string{
		"postgresql": {"查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"},
		"mysql":      {"查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"},
		"polardb":    {"查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"},
		"gaussdb":    {"查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"},
		"sqlite":     {"查询", "插入", "更新", "删除", "事务", "视图", "索引"},
		"redis":      {"GET", "SET", "DEL", "EXISTS", "EXPIRE", "KEYS", "TYPE", "TTL"},
	}
}

// GetServerInfo returns server information
func (a *App) GetServerInfo(config Connection) map[string]string {
	info := map[string]string{
		"type":     config.Type,
		"host":     config.Host,
		"port":     fmt.Sprintf("%d", config.Port),
		"database": config.Database,
	}

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := db.ConnectionConfig{
		Type:     db.DBType(config.Type),
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		Database: config.Database,
		SSLMode:  config.SSLMode,
	}

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		info["error"] = err.Error()
		return info
	}
	defer driver.Close()

	if config.Type == "postgresql" {
		rows, err := driver.Query(a.ctx, "SELECT version()")
		if err == nil && rows.Next() {
			var version string
			rows.Scan(&version)
			info["version"] = version
		}
		if rows != nil {
			rows.Close()
		}
	}

	tables, err := driver.GetTables(a.ctx)
	if err == nil {
		info["table_count"] = fmt.Sprintf("%d", len(tables))
	}

	return info
}
