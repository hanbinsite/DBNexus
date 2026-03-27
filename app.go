package main

import (
	"context"
	"db-client/db"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx           context.Context
	driverManager *db.DriverManager
	connections   []Connection
	configPath    string
}

// Connection represents a saved database connection
type Connection struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	Database      string `json:"database"`
	SSLMode       string `json:"ssl_mode,omitempty"`
	Color         string `json:"color"`
	SavePassword  bool   `json:"save_password"`
	AutoConnect   bool   `json:"auto_connect"`
	LastConnected string `json:"last_connected,omitempty"`
}

// QueryResult represents the result of a query execution
type QueryResult struct {
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
}

// TableInfo represents table information
type TableInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Schema  string `json:"schema"`
	Comment string `json:"comment,omitempty"`
}

// DatabaseInfo represents database information
type DatabaseInfo struct {
	Name    string `json:"name"`
	Owner   string `json:"owner,omitempty"`
	Comment string `json:"comment,omitempty"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".db-client", "connections.json")

	return &App{
		driverManager: db.NewDriverManager(),
		connections:   make([]Connection, 0),
		configPath:    configPath,
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.loadConnections()
}

// shutdown is called when the app closes
func (a *App) shutdown(ctx context.Context) {
	// Save any pending data
	a.saveConnections()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, Welcome to DB Client!", name)
}

// ==========================================================================
// Language / i18n
// ==========================================================================

// GetLanguage returns the current language setting
func (a *App) GetLanguage() string {
	// Read from config
	lang := os.Getenv("DB_CLIENT_LANG")
	if lang == "" {
		lang = "zh" // Default to Chinese
	}
	return lang
}

// SetLanguage sets the application language
func (a *App) SetLanguage(lang string) error {
	// Save to config file
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".db-client")
	os.MkdirAll(configDir, 0755)

	configFile := filepath.Join(configDir, "config.json")

	// Read existing config
	config := make(map[string]interface{})
	data, err := os.ReadFile(configFile)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	// Update language
	config["language"] = lang

	// Save config
	data, _ = json.MarshalIndent(config, "", "  ")
	return os.WriteFile(configFile, data, 0644)
}

// ==========================================================================
// Window Controls
// ==========================================================================

// WindowMinimize minimizes the window
func (a *App) WindowMinimize() {
	runtime.WindowMinimise(a.ctx)
}

// WindowMaximize maximizes/restores the window
func (a *App) WindowMaximize() {
	if runtime.WindowIsMaximised(a.ctx) {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
}

// WindowClose closes the window
func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

// WindowIsMaximized returns whether the window is maximized
func (a *App) WindowIsMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

// ==========================================================================
// Connection Management
// ==========================================================================

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

	// Find existing or add new
	found := false
	for i, c := range a.connections {
		if c.ID == conn.ID {
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
		return false, fmt.Sprintf("Connection failed: %v", err)
	}

	err = driver.Ping(a.ctx)
	if err != nil {
		driver.Close()
		return false, fmt.Sprintf("Ping failed: %v", err)
	}

	driver.Close()
	return true, "Connection successful!"
}

// ConnectToDatabase connects to a database and returns connection status
func (a *App) ConnectToDatabase(config Connection) (bool, string) {
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
		return false, fmt.Sprintf("Connection failed: %v", err)
	}

	err = driver.Ping(a.ctx)
	if err != nil {
		driver.Close()
		return false, fmt.Sprintf("Connection failed: %v", err)
	}

	return true, "Connected successfully"
}

// DisconnectFromDatabase disconnects from a database
func (a *App) DisconnectFromDatabase(config Connection) error {
	// In a real implementation, you'd close the specific connection
	return nil
}

// ==========================================================================
// Database Operations
// ==========================================================================

// GetDatabases returns a list of databases
func (a *App) GetDatabases(config Connection) ([]DatabaseInfo, error) {
	dbConfig := a.connectionToDBConfig(config)

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	databases, err := driver.GetDatabases(a.ctx)
	if err != nil {
		return nil, err
	}

	result := make([]DatabaseInfo, len(databases))
	for i, db := range databases {
		result[i] = DatabaseInfo{Name: db}
	}

	return result, nil
}

// GetTables returns a list of tables
func (a *App) GetTables(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	tables, err := driver.GetTables(a.ctx)
	if err != nil {
		return nil, err
	}

	result := make([]TableInfo, len(tables))
	for i, table := range tables {
		result[i] = TableInfo{Name: table, Type: "table"}
	}

	return result, nil
}

// GetViews returns a list of views
func (a *App) GetViews(config Connection, database string) ([]TableInfo, error) {
	// Views are typically returned with tables in most databases
	// This is a simplified implementation
	return []TableInfo{}, nil
}

// GetFunctions returns a list of stored functions/procedures
func (a *App) GetFunctions(config Connection, database string) ([]TableInfo, error) {
	// Simplified implementation
	return []TableInfo{}, nil
}

// GetTableColumns returns column information for a table
func (a *App) GetTableColumns(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	return driver.GetTableStructure(a.ctx, table)
}

// ==========================================================================
// Query Execution
// ==========================================================================

// ExecuteQuery executes a SQL query and returns results
func (a *App) ExecuteQuery(config Connection, database string, query string) QueryResult {
	startTime := time.Now()

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Connection failed: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}
	defer driver.Close()

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Query failed: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Failed to get columns: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}

	// Prepare result rows
	var resultRows [][]interface{}

	// Create slice of interface{} to hold each row's values
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	// Scan rows
	for rows.Next() {
		err = rows.Scan(valuePtrs...)
		if err != nil {
			return QueryResult{
				Error:    fmt.Sprintf("Failed to scan row: %v", err),
				Duration: time.Since(startTime).String(),
			}
		}

		// Convert row values to interface{} slice
		row := make([]interface{}, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = nil
			} else {
				// Convert []byte to string for display
				if b, ok := v.([]byte); ok {
					row[i] = string(b)
				} else {
					row[i] = v
				}
			}
		}
		resultRows = append(resultRows, row)
	}

	return QueryResult{
		Columns:  columns,
		Rows:     resultRows,
		RowCount: len(resultRows),
		Duration: time.Since(startTime).String(),
	}
}

// ExecuteNonQuery executes a non-query SQL statement
func (a *App) ExecuteNonQuery(config Connection, database string, query string) (int64, string, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return 0, "", fmt.Errorf("connection failed: %v", err)
	}
	defer driver.Close()

	result, err := driver.Exec(a.ctx, query)
	if err != nil {
		return 0, "", fmt.Errorf("execution failed: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, fmt.Sprintf("%d rows affected", rowsAffected), nil
}

// ==========================================================================
// File Dialogs
// ==========================================================================

// OpenFileDialog opens a file dialog
func (a *App) OpenFileDialog(title string, filters string) string {
	result, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return ""
	}
	return result
}

// SaveFileDialog opens a save dialog
func (a *App) SaveFileDialog(title string, defaultName string) string {
	result, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultName,
	})
	if err != nil {
		return ""
	}
	return result
}

// ==========================================================================
// Helper Methods
// ==========================================================================

func (a *App) connectionToDBConfig(conn Connection) db.ConnectionConfig {
	return db.ConnectionConfig{
		Type:     db.DBType(conn.Type),
		Host:     conn.Host,
		Port:     conn.Port,
		Username: conn.Username,
		Password: conn.Password,
		Database: conn.Database,
		SSLMode:  conn.SSLMode,
	}
}

func (a *App) loadConnections() error {
	// Create config directory if not exists
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	// Read config file
	data, err := os.ReadFile(a.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			a.connections = []Connection{}
			return nil
		}
		return err
	}

	// Parse JSON
	if err := json.Unmarshal(data, &a.connections); err != nil {
		return err
	}

	return nil
}

func (a *App) saveConnections() error {
	// Create config directory if not exists
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(a.connections, "", "  ")
	if err != nil {
		return err
	}

	// Write to file
	return os.WriteFile(a.configPath, data, 0644)
}

// getDriverForConnection returns a driver for the given connection config
func (a *App) getDriverForConnection(config Connection) (db.DatabaseDriver, error) {
	dbConfig := a.connectionToDBConfig(config)
	return a.driverManager.Connect(dbConfig)
}
