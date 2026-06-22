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

func (a *App) getDriverForConfig(dbConfig db.ConnectionConfig) (db.DatabaseDriver, error) {
	key := a.pool.buildKey(dbConfig)

	pooled, err := a.pool.getOrCreate(key, func() (db.DatabaseDriver, error) {
		return a.driverManager.Connect(dbConfig)
	})
	if err != nil {
		return nil, err
	}
	return pooled.driver, nil
}

func (a *App) loadConnections() error {
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}

	data, err := os.ReadFile(a.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			a.connections = []Connection{}
			return nil
		}
		return fmt.Errorf("failed to read config: %w", err)
	}

	if len(data) == 0 {
		a.connections = []Connection{}
		return nil
	}

	if err := json.Unmarshal(data, &a.connections); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	return nil
}

func (a *App) saveConnections() error {
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}

	data, err := json.MarshalIndent(a.connections, "", " ")
	if err != nil {
		return fmt.Errorf("failed to marshal connections: %w", err)
	}

	if err := os.WriteFile(a.configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}
