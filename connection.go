package main

import (
	"fmt"
	"strings"
	"time"

	"db-server/db"
)

func (a *App) GetSupportedDatabases() []map[string]string {
	return []map[string]string{
		{"id": "postgresql", "name": "PostgreSQL", "default_port": "5432"},
		{"id": "mysql", "name": "MySQL", "default_port": "3306"},
		{"id": "polardb", "name": "PolarDB", "default_port": "5432"},
		{"id": "gaussdb", "name": "GaussDB", "default_port": "5432"},
		{"id": "sqlite", "name": "SQLite", "default_port": ""},
		{"id": "redis", "name": "Redis", "default_port": "6379"},
	}
}

func (a *App) GetConnections() []Connection {
	a.connectionsMu.RLock()
	defer a.connectionsMu.RUnlock()
	safe := make([]Connection, len(a.connections))
	copy(safe, a.connections)
	for i := range safe {
		safe[i].Password = ""
	}
	return safe
}

func (a *App) SaveConnection(conn Connection) error {
	if conn.ID == "" {
		conn.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	if conn.SavePassword && conn.Password != "" {
		encrypted, err := encryptPassword(conn.Password)
		if err != nil {
			return fmt.Errorf("failed to encrypt password: %w", err)
		}
		conn.Password = encrypted
	} else if !conn.SavePassword {
		conn.Password = ""
	}

	a.connectionsMu.Lock()
	defer a.connectionsMu.Unlock()

	found := false
	for i, c := range a.connections {
		if c.ID == conn.ID {
			if conn.Password == "" && c.Password != "" && !conn.SavePassword {
				conn.Password = c.Password
			}
			a.connections[i] = conn
			found = true
			break
		}
	}

	if !found {
		a.connections = append(a.connections, conn)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConnectionSave,
		fmt.Sprintf("保存连接配置: %s", conn.Name),
		map[string]interface{}{
			"connection_id":   conn.ID,
			"connection_name": conn.Name,
			"database_type":   conn.Type,
		})

	return a.saveConnections()
}

func (a *App) DeleteConnection(id string) error {
	var connName string
	for i, c := range a.connections {
		if c.ID == id {
			connName = c.Name
			a.connections = append(a.connections[:i], a.connections[i+1:]...)
			break
		}
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConnectionDelete,
		fmt.Sprintf("删除连接配置: %s", connName),
		map[string]interface{}{"connection_id": id})

	return a.saveConnections()
}

func (a *App) TestConnection(config Connection) (bool, string) {
	lang := a.getCurrentLang()

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err != nil {
			return false, fmt.Sprintf("%s: password decrypt failed", a.t(MsgConnectionFailed, lang))
		}
		config.Password = decrypted
	}

	if config.Host == "" && config.Type != "sqlite" {
		return false, a.t(MsgHostRequired, lang)
	}
	if config.Username == "" && config.Type != "redis" && config.Type != "sqlite" {
		return false, a.t(MsgUsernameRequired, lang)
	}
	if config.Type == "sqlite" && config.Database == "" {
		return false, a.t(MsgSQLiteFileRequired, lang)
	}

	database := config.Database
	if database == "" {
		database = a.getDefaultDatabase(config.Type)
	}

	dbConfig := db.ConnectionConfig{
		Type:     db.DBType(config.Type),
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		Database: database,
		SSLMode:  config.SSLMode,
	}

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return false, a.formatError(a.t(MsgConnectionFailed, lang), err, config.Type, lang)
	}

	err = driver.Ping(a.ctx)
	if err != nil {
		driver.Close()
		return false, a.formatError(a.t(MsgConnectionTimeout, lang), err, config.Type, lang)
	}

	driver.Close()
	return true, fmt.Sprintf(a.t(MsgConnectionSuccess, lang), database)
}

func (a *App) formatError(prefix string, err error, dbType string, lang string) string {
	errMsg := err.Error()
	hint := ""
	switch {
	case strings.Contains(errMsg, "connection refused"):
		hint = a.t(MsgHintConnection, lang)
	case strings.Contains(errMsg, "authentication failed"):
		hint = a.t(MsgHintAuth, lang)
	case strings.Contains(errMsg, "no such host"):
		hint = a.t(MsgHintHost, lang)
	case strings.Contains(errMsg, "timeout"):
		hint = a.t(MsgHintTimeout, lang)
	case strings.Contains(errMsg, "Unknown database"):
		hint = a.t(MsgHintDatabase, lang)
	case dbType == "mysql" && strings.Contains(errMsg, "Access denied"):
		hint = a.t(MsgHintMySQLAccess, lang)
	case dbType == "postgresql" && strings.Contains(errMsg, "no password supplied"):
		hint = a.t(MsgHintPGPassword, lang)
	}
	return fmt.Sprintf("%s: %s%s", prefix, errMsg, hint)
}

func (a *App) getDefaultDatabase(dbType string) string {
	switch dbType {
	case "postgresql", "polardb", "gaussdb":
		return "postgres"
	case "mysql":
		return "mysql"
	case "redis":
		return "0"
	case "sqlite":
		return ""
	default:
		return ""
	}
}

func (a *App) ConnectToDatabase(config Connection) (bool, string) {
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	database := config.Database
	if database == "" {
		database = a.getDefaultDatabase(config.Type)
	}

	dbConfig := db.ConnectionConfig{
		Type:     db.DBType(config.Type),
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		Database: database,
		SSLMode:  config.SSLMode,
	}

	key := a.pool.buildKey(dbConfig)

	_, err := a.pool.getOrCreate(key, func() (db.DatabaseDriver, error) {
		driver, err := a.driverManager.Connect(dbConfig)
		if err != nil {
			return nil, err
		}

		var pingErr error
		for i := 0; i < 3; i++ {
			pingErr = driver.Ping(a.ctx)
			if pingErr == nil {
				break
			}
			time.Sleep(200 * time.Millisecond)
		}

		if pingErr != nil {
			driver.Close()
			return nil, pingErr
		}

		return driver, nil
	})

	if err != nil {
		return false, fmt.Sprintf("连接失败: %v", err)
	}

	return true, "Connected successfully"
}

func (a *App) DisconnectFromDatabase(config Connection) error {
	key := a.pool.buildKey(a.connectionToDBConfig(config))
	a.pool.remove(key)
	return nil
}

func (a *App) GetSupportedFeatures(dbType string) map[string]bool {
	features := map[string]bool{
		"query":        true,
		"multi_query":  true,
		"schema":       true,
		"data_edit":    true,
		"export":       true,
		"import":       true,
		"transaction":  true,
		"autocomplete": true,
	}

	switch dbType {
	case "redis":
		features["schema"] = false
		features["data_edit"] = false
		features["export"] = false
		features["import"] = false
		features["transaction"] = false
		features["autocomplete"] = false
		features["redis_commands"] = true
	case "sqlite":
		features["transaction"] = false
	}

	return features
}
