package main

import (
	"encoding/json"
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
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	data, err := os.ReadFile(a.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			a.connections = []Connection{}
			return nil
		}
		return err
	}

	if err := json.Unmarshal(data, &a.connections); err != nil {
		return err
	}

	return nil
}

func (a *App) saveConnections() error {
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(a.connections, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(a.configPath, data, 0600)
}
