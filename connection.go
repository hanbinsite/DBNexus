package main

import (
	"db-server/db"
	"fmt"
	"strings"
	"time"
)

// GetSupportedDatabases returns a list of supported database types
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

// GetConnections returns all saved connections
func (a *App) GetConnections() []Connection {
	return a.connections
}

// SaveConnection saves a connection
func (a *App) SaveConnection(conn Connection) error {
	// Generate ID if new
	if conn.ID == "" {
		conn.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	// Encrypt password before saving
	if conn.SavePassword && conn.Password != "" {
		encrypted, err := encryptPassword(conn.Password)
		if err != nil {
			return fmt.Errorf("failed to encrypt password: %w", err)
		}
		conn.Password = encrypted
	} else if !conn.SavePassword {
		conn.Password = ""
	}

	// Find existing or add new
	found := false
	for i, c := range a.connections {
		if c.ID == conn.ID {
			// Preserve encrypted password if not changed
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

	return a.saveConnections()
}

// DeleteConnection deletes a connection
func (a *App) DeleteConnection(id string) error {
	for i, c := range a.connections {
		if c.ID == id {
			a.connections = append(a.connections[:i], a.connections[i+1:]...)
			break
		}
	}
	return a.saveConnections()
}

// TestConnection tests a database connection
func (a *App) TestConnection(config Connection) (bool, string) {
	lang := a.getCurrentLang()

	// Decrypt password if it's saved encrypted
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
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

// formatError formats error message with helpful hints
func (a *App) formatError(prefix string, err error, dbType string, lang string) string {
	errMsg := err.Error()

	// Add specific hints based on error type
	hint := ""
	switch {
	case contains(errMsg, "connection refused"):
		hint = a.t(MsgHintConnection, lang)
	case contains(errMsg, "authentication failed"):
		hint = a.t(MsgHintAuth, lang)
	case contains(errMsg, "no such host"):
		hint = a.t(MsgHintHost, lang)
	case contains(errMsg, "timeout"):
		hint = a.t(MsgHintTimeout, lang)
	case contains(errMsg, "Unknown database"):
		hint = a.t(MsgHintDatabase, lang)
	case dbType == "mysql" && contains(errMsg, "Access denied"):
		hint = a.t(MsgHintMySQLAccess, lang)
	case dbType == "postgresql" && contains(errMsg, "no password supplied"):
		hint = a.t(MsgHintPGPassword, lang)
	}

	return fmt.Sprintf("%s: %s%s", prefix, errMsg, hint)
}

// contains checks if string contains substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

// getDefaultDatabase returns the default database for connection
func (a *App) getDefaultDatabase(dbType string) string {
	switch dbType {
	case "postgresql", "polardb", "gaussdb":
		return "postgres"
	case "mysql":
		return "mysql"
	case "redis":
		return "0"
	case "sqlite":
		return "" // SQLite requires a path
	default:
		return ""
	}
}

// ConnectToDatabase connects to a database and returns connection status
func (a *App) ConnectToDatabase(config Connection) (bool, string) {
	// Decrypt password if it's saved encrypted
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// Use default database if not specified
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

	// We use a simplified key for the connection pool that doesn't depend on the database name,
	// allowing us to reuse the same physical connection for different databases in the same server.
	key := buildConnectionKey(dbConfig)

	// Check if we already have a valid connection in pool
	a.poolMutex.RLock()
	existingPooled, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if exists {
		// Test existing connection with retry
		err := existingPooled.driver.Ping(a.ctx)
		if err == nil {
			return true, "Connected successfully"
		}
		// Connection is stale, remove it
		a.pool.remove(key)
	}

	// Create fresh connection
	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return false, fmt.Sprintf("连接失败: %v", err)
	}

	// Ping with retry logic (up to 3 attempts)
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
		return false, fmt.Sprintf("连接失败: %v", pingErr)
	}

	a.pool.set(key, driver)
	return true, "Connected successfully"
}

// DisconnectFromDatabase disconnects from a database
func (a *App) DisconnectFromDatabase(config Connection) error {
	key := buildKey(a.connectionToDBConfig(config))
	a.pool.remove(key)
	return nil
}
