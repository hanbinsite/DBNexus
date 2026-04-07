package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"db-server/db"
)

type App struct {
	ctx           context.Context
	driverManager *db.DriverManager
	connections   []Connection
	configPath    string
	pool          *connectionPool
	poolMutex     sync.RWMutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".db-client", "connections.json")

	return &App{
		driverManager: db.NewDriverManager(),
		connections:   make([]Connection, 0),
		configPath:    configPath,
		pool:          newConnectionPool(),
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	initEncryptionKey()
	a.loadConnections()
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	a.pool.closeAll()
	a.saveConnections()
}

// ==========================================================================
// Language / i18n
// ==========================================================================

// GetLanguage returns the current language setting
func (a *App) GetLanguage() string {
	lang := os.Getenv("DB_CLIENT_LANG")
	if lang == "" {
		lang = "zh"
	}
	return lang
}

// SetLanguage sets the application language
func (a *App) SetLanguage(lang string) error {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".db-client")
	os.MkdirAll(configDir, 0755)

	configFile := filepath.Join(configDir, "config.json")

	config := make(map[string]interface{})
	data, err := os.ReadFile(configFile)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	config["language"] = lang

	data, err = json.MarshalIndent(config, "", " ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	return os.WriteFile(configFile, data, 0644)
}
