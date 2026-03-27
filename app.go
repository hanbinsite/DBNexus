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
	// Validate config
	if config.Host == "" && config.Type != "sqlite" {
		return false, "请输入主机地址"
	}
	if config.Username == "" && config.Type != "redis" && config.Type != "sqlite" {
		return false, "请输入用户名"
	}
	if config.Type == "sqlite" && config.Database == "" {
		return false, "请选择 SQLite 数据库文件"
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

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return false, a.formatError("连接失败", err, config.Type)
	}

	err = driver.Ping(a.ctx)
	if err != nil {
		driver.Close()
		return false, a.formatError("连接超时或认证失败", err, config.Type)
	}

	driver.Close()
	return true, fmt.Sprintf("连接成功！数据库: %s", database)
}

// formatError formats error message with helpful hints
func (a *App) formatError(prefix string, err error, dbType string) string {
	errMsg := err.Error()

	// Add specific hints based on error type
	hint := ""
	switch {
	case contains(errMsg, "connection refused"):
		hint = "\n\n💡 提示: 请检查主机地址和端口是否正确，以及数据库服务是否正在运行"
	case contains(errMsg, "authentication failed"):
		hint = "\n\n💡 提示: 用户名或密码错误，请检查凭据"
	case contains(errMsg, "no such host"):
		hint = "\n\n💡 提示: 无法解析主机地址，请检查网络连接和主机名"
	case contains(errMsg, "timeout"):
		hint = "\n\n💡 提示: 连接超时，请检查防火墙设置和网络连接"
	case contains(errMsg, "Unknown database"):
		hint = "\n\n💡 提示: 数据库不存在，请检查数据库名称或留空以自动获取"
	case dbType == "mysql" && contains(errMsg, "Access denied"):
		hint = "\n\n💡 提示: MySQL 访问被拒绝，请检查用户名和密码，以及用户是否有远程连接权限"
	case dbType == "postgresql" && contains(errMsg, "no password supplied"):
		hint = "\n\n💡 提示: PostgreSQL 需要密码认证，请提供密码"
	}

	return fmt.Sprintf("%s: %s%s", prefix, errMsg, hint)
}

// contains checks if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			len(s) > len(substr)+1 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
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

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return false, fmt.Sprintf("连接失败: %v", err)
	}

	err = driver.Ping(a.ctx)
	if err != nil {
		driver.Close()
		return false, fmt.Sprintf("连接失败: %v", err)
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

// IndexInfo represents index information
type IndexInfo struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // PRIMARY, UNIQUE, INDEX, FULLTEXT
	Columns     []string `json:"columns"`
	Unique      bool     `json:"unique"`
	Nullable    bool     `json:"nullable"`
	Cardinality int64    `json:"cardinality"`
	Comment     string   `json:"comment,omitempty"`
}

// ForeignKeyInfo represents foreign key information
type ForeignKeyInfo struct {
	Name        string `json:"name"`
	ColumnName  string `json:"column_name"`
	RefTable    string `json:"ref_table"`
	RefColumn   string `json:"ref_column"`
	OnUpdate    string `json:"on_update"`
	OnDelete    string `json:"on_delete"`
	MatchOption string `json:"match_option,omitempty"`
}

// TableStats represents table statistics
type TableStats struct {
	RowCount    int64  `json:"row_count"`
	DataLength  int64  `json:"data_length"`
	IndexLength int64  `json:"index_length"`
	Engine      string `json:"engine"`
	Charset     string `json:"charset"`
	Collation   string `json:"collation"`
	Comment     string `json:"comment,omitempty"`
}

// GetTableIndexes returns indexes for a table
func (a *App) GetTableIndexes(config Connection, database string, table string) ([]IndexInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	var query string
	var indexes []IndexInfo

	switch config.Type {
	case "mysql":
		query = fmt.Sprintf("SHOW INDEX FROM `%s`", table)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT 
				i.relname as index_name,
				ix.indisunique as is_unique,
				ix.indisprimary as is_primary,
				array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
			FROM pg_index ix
			JOIN pg_class i ON i.oid = ix.indexrelid
			JOIN pg_class t ON t.oid = ix.indrelid
			JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
			WHERE t.relname = '%s'
			GROUP BY i.relname, ix.indisunique, ix.indisprimary
		`, table)
	default:
		return []IndexInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if config.Type == "mysql" {
		// MySQL format: Table, Non_unique, Key_name, Seq_in_index, Column_name, ...
		type mysqlIndex struct {
			Table        string
			NonUnique    int
			KeyName      string
			SeqInIndex   int
			ColumnName   string
			Collation    sql.NullString
			Cardinality  sql.NullInt64
			SubPart      sql.NullInt64
			Packed       sql.NullString
			Null         sql.NullString
			IndexType    sql.NullString
			Comment      sql.NullString
			IndexComment sql.NullString
		}

		indexMap := make(map[string]*IndexInfo)
		for rows.Next() {
			var idx mysqlIndex
			err := rows.Scan(&idx.Table, &idx.NonUnique, &idx.KeyName, &idx.SeqInIndex,
				&idx.ColumnName, &idx.Collation, &idx.Cardinality, &idx.SubPart,
				&idx.Packed, &idx.Null, &idx.IndexType, &idx.Comment, &idx.IndexComment)
			if err != nil {
				return nil, err
			}

			if _, exists := indexMap[idx.KeyName]; !exists {
				indexType := "INDEX"
				if idx.KeyName == "PRIMARY" {
					indexType = "PRIMARY"
				} else if idx.NonUnique == 0 {
					indexType = "UNIQUE"
				}

				indexMap[idx.KeyName] = &IndexInfo{
					Name:    idx.KeyName,
					Type:    indexType,
					Unique:  idx.NonUnique == 0,
					Columns: []string{},
				}
				if idx.Cardinality.Valid {
					indexMap[idx.KeyName].Cardinality = idx.Cardinality.Int64
				}
			}
			indexMap[idx.KeyName].Columns = append(indexMap[idx.KeyName].Columns, idx.ColumnName)
		}

		for _, idx := range indexMap {
			indexes = append(indexes, *idx)
		}
	} else {
		// PostgreSQL format
		for rows.Next() {
			var idx IndexInfo
			var columnsArray string
			err := rows.Scan(&idx.Name, &idx.Unique, &idx.PrimaryKey, &columnsArray)
			if err != nil {
				return nil, err
			}

			if idx.PrimaryKey {
				idx.Type = "PRIMARY"
			} else if idx.Unique {
				idx.Type = "UNIQUE"
			} else {
				idx.Type = "INDEX"
			}

			// Parse PostgreSQL array format
			idx.Columns = parsePostgresArray(columnsArray)
			indexes = append(indexes, idx)
		}
	}

	return indexes, nil
}

// GetTableForeignKeys returns foreign keys for a table
func (a *App) GetTableForeignKeys(config Connection, database string, table string) ([]ForeignKeyInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	var query string

	switch config.Type {
	case "mysql":
		query = fmt.Sprintf(`
			SELECT 
				CONSTRAINT_NAME,
				COLUMN_NAME,
				REFERENCED_TABLE_NAME,
				REFERENCED_COLUMN_NAME,
				UPDATE_RULE,
				DELETE_RULE
			FROM information_schema.KEY_COLUMN_USAGE kcu
			JOIN information_schema.REFERENTIAL_CONSTRAINTS rc 
				ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
				AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
			WHERE kcu.TABLE_NAME = '%s' 
				AND kcu.TABLE_SCHEMA = '%s'
				AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
		`, table, database)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT
				conname as constraint_name,
				a.attname as column_name,
				ref.relname as ref_table,
				af.attname as ref_column,
				confdeltype as on_delete,
				confupdtype as on_update
			FROM pg_constraint c
			JOIN pg_class t ON t.oid = c.conrelid
			JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
			JOIN pg_class ref ON ref.oid = c.confrelid
			JOIN pg_attribute af ON af.attrelid = ref.oid AND af.attnum = ANY(c.confkey)
			WHERE c.contype = 'f' AND t.relname = '%s'
		`, table)
	default:
		return []ForeignKeyInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var foreignKeys []ForeignKeyInfo
	for rows.Next() {
		var fk ForeignKeyInfo
		var onUpdate, onDelete string

		if config.Type == "mysql" {
			err := rows.Scan(&fk.Name, &fk.ColumnName, &fk.RefTable, &fk.RefColumn, &onUpdate, &onDelete)
			if err != nil {
				return nil, err
			}
		} else {
			err := rows.Scan(&fk.Name, &fk.ColumnName, &fk.RefTable, &fk.RefColumn, &onDelete, &onUpdate)
			if err != nil {
				return nil, err
			}
		}

		fk.OnUpdate = convertRefAction(onUpdate)
		fk.OnDelete = convertRefAction(onDelete)
		foreignKeys = append(foreignKeys, fk)
	}

	return foreignKeys, nil
}

// GetTableStats returns table statistics
func (a *App) GetTableStats(config Connection, database string, table string) (TableStats, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return TableStats{}, err
	}
	defer driver.Close()

	var stats TableStats

	// Get row count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", table)
	if config.Type == "postgresql" || config.Type == "polardb" || config.Type == "gaussdb" {
		countQuery = fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", table)
	}

	rows, err := driver.Query(a.ctx, countQuery)
	if err == nil && rows.Next() {
		rows.Scan(&stats.RowCount)
		rows.Close()
	}

	// Get table info
	var infoQuery string
	switch config.Type {
	case "mysql":
		infoQuery = fmt.Sprintf("SHOW TABLE STATUS LIKE '%s'", table)
	case "postgresql", "polardb", "gaussdb":
		infoQuery = fmt.Sprintf(`
			SELECT 
				pg_relation_size('%s') as data_length,
				pg_indexes_size('%s') as index_length
		`, table, table)
	}

	rows2, err := driver.Query(a.ctx, infoQuery)
	if err == nil && rows2.Next() {
		if config.Type == "mysql" {
			var name, version, rowFormat, collation, createOptions, tableType sql.NullString
			var avgRowLength, dataLength, maxDataLength, indexLength, dataFree, autoIncrement sql.NullInt64
			var engine, checkTime, checksum, createOptions2 sql.NullString
			var rows sql.NullInt64

			rows2.Scan(&name, &version, &rowFormat, &rows, &avgRowLength, &dataLength,
				&maxDataLength, &indexLength, &dataFree, &autoIncrement, &createOptions,
				&collation, &checkTime, &checksum, &tableType, &createOptions2)

			if dataLength.Valid {
				stats.DataLength = dataLength.Int64
			}
			if indexLength.Valid {
				stats.IndexLength = indexLength.Int64
			}
			if engine.Valid {
				stats.Engine = engine.String
			}
			if collation.Valid {
				stats.Collation = collation.String
			}
		} else {
			rows2.Scan(&stats.DataLength, &stats.IndexLength)
		}
		rows2.Close()
	}

	return stats, nil
}

// parsePostgresArray parses PostgreSQL array string like "{a,b,c}"
func parsePostgresArray(arr string) []string {
	if len(arr) < 2 || arr[0] != '{' || arr[len(arr)-1] != '}' {
		return []string{}
	}

	content := arr[1 : len(arr)-1]
	if content == "" {
		return []string{}
	}

	var result []string
	current := ""
	inQuote := false

	for i := 0; i < len(content); i++ {
		c := content[i]
		if c == '"' {
			inQuote = !inQuote
		} else if c == ',' && !inQuote {
			result = append(result, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}

	return result
}

// convertRefAction converts reference action codes
func convertRefAction(action string) string {
	switch action {
	case "a":
		return "NO ACTION"
	case "r":
		return "RESTRICT"
	case "c":
		return "CASCADE"
	case "n":
		return "SET NULL"
	case "d":
		return "SET DEFAULT"
	default:
		return action
	}
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

// ==========================================================================
// Test Services
// ==========================================================================

// TestResult represents a test result
type TestResult struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message"`
	Time    string `json:"time"`
}

// RunConnectionTest runs a connection test
func (a *App) RunConnectionTest(config Connection) TestResult {
	startTime := time.Now()

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
			Message: fmt.Sprintf("连接失败: %v", err),
			Time:    time.Since(startTime).String(),
		}
	}
	defer driver.Close()

	err = driver.Ping(a.ctx)
	if err != nil {
		return TestResult{
			Name:    config.Name,
			Success: false,
			Message: fmt.Sprintf("Ping 失败: %v", err),
			Time:    time.Since(startTime).String(),
		}
	}

	return TestResult{
		Name:    config.Name,
		Success: true,
		Message: "连接成功",
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

	// Try to get version info
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

	// For PostgreSQL, get version
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

	// Get table count
	tables, err := driver.GetTables(a.ctx)
	if err == nil {
		info["table_count"] = fmt.Sprintf("%d", len(tables))
	}

	return info
}
