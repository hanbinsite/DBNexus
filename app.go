package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"db-server/db"
)

type App struct {
	ctx           context.Context
	driverManager *db.DriverManager
	connections   []Connection
	configPath    string
	pool          *connectionPool
}

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

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	initEncryptionKey()
	a.loadConnections()

	GetAuditLogger().Log(AuditLevelInfo, AuditEventLogin, "应用程序启动", nil)
}

func (a *App) shutdown(ctx context.Context) {
	a.pool.closeAll()
	a.saveConnections()

	GetAuditLogger().Log(AuditLevelInfo, AuditEventLogout, "应用程序关闭", nil)
}

func (a *App) GetLanguage() string {
	homeDir, _ := os.UserHomeDir()
	configFile := filepath.Join(homeDir, ".db-client", "config.json")

	data, err := os.ReadFile(configFile)
	if err == nil {
		config := make(map[string]interface{})
		if json.Unmarshal(data, &config) == nil {
			if lang, ok := config["language"].(string); ok {
				return lang
			}
		}
	}

	lang := os.Getenv("DB_CLIENT_LANG")
	if lang == "" {
		lang = "zh"
	}
	return lang
}

func (a *App) SetLanguage(lang string) error {
	if lang != "zh" && lang != "en" {
		return fmt.Errorf("unsupported language: %s, only zh/en allowed", lang)
	}

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
	return os.WriteFile(configFile, data, 0600)
}

func (a *App) getCurrentLang() string {
	return a.GetLanguage()
}

func (a *App) GetServerInfo() map[string]interface{} {
	return map[string]interface{}{
		"version":      "1.0.0",
		"wailsVersion": "2.12.0",
		"goVersion":    "1.24.0",
		"poolSize":     len(a.pool.connections),
		"maxPoolSize":  MaxPoolSize,
	}
}
