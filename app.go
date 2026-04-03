package main

import (
	"context"
	"database/sql"
	"db-client/db"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	driverManager *db.DriverManager
	connections   []Connection
	configPath    string
	pool          *connectionPool
	poolMutex     sync.RWMutex
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

type SingleQueryResult struct {
	Query    string          `json:"query"`
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
	Status   string          `json:"status"` // "success", "error"
}

type MultiQueryResult struct {
	Results       []SingleQueryResult `json:"results"`
	TotalCount    int                 `json:"total_count"`
	SuccessCount  int                 `json:"success_count"`
	ErrorCount    int                 `json:"error_count"`
	TotalDuration string              `json:"total_duration"`
	StartTime     string              `json:"start_time"`
	EndTime       string              `json:"end_time"`
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
	// Read from config
	lang := os.Getenv("DB_CLIENT_LANG")
	if lang == "" {
		lang = "zh" // Default to Chinese
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
	existingDriver, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if exists {
		// Test existing connection with retry
		err := existingDriver.Ping(a.ctx)
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

// ==========================================================================
// Database Operations
// ==========================================================================

// GetDatabases returns a list of databases
func (a *App) GetDatabases(config Connection) ([]DatabaseInfo, error) {
	dbConfig := a.connectionToDBConfig(config)

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	databases, err := driver.GetDatabases(a.ctx)
	if err != nil {
		return nil, err
	}

	result := make([]DatabaseInfo, len(databases))
	for i, d := range databases {
		result[i] = DatabaseInfo{Name: d}
	}

	return result, nil
}

// GetTables returns a list of tables
func (a *App) GetTables(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)

	// IMPORTANT: Set the database for this operation
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	// Ensure the driver is actually pointing to the requested database
	if err := driver.UseDatabase(a.ctx, database); err != nil {
		return nil, fmt.Errorf("切换数据库 %s 失败: %v", database, err)
	}

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
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	switch config.Type {
	case "mysql":
		query = `
			SELECT TABLE_NAME 
			FROM information_schema.VIEWS 
			WHERE TABLE_SCHEMA = '` + dbConfig.Database + `'
		`
	case "postgresql", "polardb", "gaussdb":
		query = `
			SELECT viewname 
			FROM pg_views 
			WHERE schemaname = 'public'
		`
	case "sqlite":
		query = `
			SELECT name 
			FROM sqlite_master 
			WHERE type='view'
		`
	default:
		return []TableInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return []TableInfo{}, nil
	}
	defer rows.Close()

	var views []TableInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			views = append(views, TableInfo{Name: name, Type: "view"})
		}
	}

	return views, nil
}

// GetFunctions returns a list of stored functions/procedures
func (a *App) GetFunctions(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	switch config.Type {
	case "mysql":
		query = `
			SELECT ROUTINE_NAME 
			FROM information_schema.ROUTINES 
			WHERE ROUTINE_TYPE = 'FUNCTION' 
			AND ROUTINE_SCHEMA = '` + dbConfig.Database + `'
		`
	case "postgresql", "polardb", "gaussdb":
		query = `
			SELECT proname 
			FROM pg_proc 
			JOIN pg_namespace n ON pg_proc.pronamespace = n.oid 
			WHERE n.nspname = 'public' 
			AND pg_proc.prokind = 'f'
			LIMIT 100
		`
	case "sqlite":
		query = `
			SELECT name 
			FROM sqlite_master 
			WHERE type='view' AND name LIKE 'func_%'
		`
	default:
		return []TableInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return []TableInfo{}, nil
	}
	defer rows.Close()

	var functions []TableInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			functions = append(functions, TableInfo{Name: name, Type: "function"})
		}
	}

	return functions, nil
}

// GetTableColumns returns column information for a table
func (a *App) GetTableColumns(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	// Decrypt password if stored encrypted
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	return driver.GetTableStructure(a.ctx, table)
}

// IndexInfo represents index information
type IndexInfo struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // PRIMARY, UNIQUE, INDEX, FULLTEXT
	Columns     []string `json:"columns"`
	Unique      bool     `json:"unique"`
	PrimaryKey  bool     `json:"primary_key"`
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

// sanitizeIdentifier sanitizes a SQL identifier (table/column name) to prevent SQL injection
func sanitizeIdentifier(identifier string) string {
	// Block dangerous characters
	if strings.ContainsAny(identifier, ";--/*\\=(){}[]&|!<>") {
		return "invalid_identifier"
	}
	// Only allow alphanumeric characters, underscores, and dots (for schema.table)
	cleaned := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '.' {
			return r
		}
		return -1
	}, identifier)
	if cleaned == "" {
		return "invalid_identifier"
	}
	return cleaned
}

// GetTableIndexes returns indexes for a table
func (a *App) GetTableIndexes(config Connection, database string, table string) ([]IndexInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	var indexes []IndexInfo

	switch config.Type {
	case "mysql":
		safeTable := sanitizeIdentifier(table)
		query = fmt.Sprintf("SHOW INDEX FROM `%s`", safeTable)
	case "postgresql", "polardb", "gaussdb":
		safeTable := sanitizeIdentifier(table)
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
		`, safeTable)
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

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string

	safeTable := sanitizeIdentifier(table)
	safeDatabase := sanitizeIdentifier(database)

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
		`, safeTable, safeDatabase)
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
		`, safeTable)
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

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return TableStats{}, err
	}

	var stats TableStats

	safeTable := sanitizeIdentifier(table)

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", safeTable)
	if config.Type == "postgresql" || config.Type == "polardb" || config.Type == "gaussdb" {
		countQuery = fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", safeTable)
	}

	rows, err := driver.Query(a.ctx, countQuery)
	if err == nil && rows.Next() {
		rows.Scan(&stats.RowCount)
		rows.Close()
	}

	var infoQuery string
	switch config.Type {
	case "mysql":
		infoQuery = fmt.Sprintf("SHOW TABLE STATUS LIKE '%s'", safeTable)
	case "postgresql", "polardb", "gaussdb":
		infoQuery = fmt.Sprintf(`
			SELECT
				pg_relation_size('%s') as data_length,
				pg_indexes_size('%s') as index_length
		`, safeTable, safeTable)
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

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	key := buildKey(dbConfig)
	a.poolMutex.RLock()
	driver, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if driver, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return QueryResult{
					Error:    fmt.Sprintf("Connection failed: %v", err),
					Duration: time.Since(startTime).String(),
				}
			}
			driver = newDriver
			a.pool.set(key, driver)
		}
		a.poolMutex.Unlock()
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Query failed: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Failed to get columns: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}

	var resultRows [][]interface{}
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		err = rows.Scan(valuePtrs...)
		if err != nil {
			return QueryResult{
				Error:    fmt.Sprintf("Failed to scan row: %v", err),
				Duration: time.Since(startTime).String(),
			}
		}

		row := make([]interface{}, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = "NULL"
			} else if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
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

func (a *App) ExecuteMultiQuery(config Connection, database string, query string) MultiQueryResult {
	startTime := time.Now()

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	key := buildKey(dbConfig)
	a.poolMutex.RLock()
	driver, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if driver, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return MultiQueryResult{TotalDuration: time.Since(startTime).String()}
			}
			driver = newDriver
			a.pool.set(key, driver)
		}
		a.poolMutex.Unlock()
	}

	// Split queries by semicolon (handling multi-line queries)
	queries := splitQueries(query)

	var results []SingleQueryResult
	var totalDuration time.Duration

	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}

		queryStart := time.Now()
		result := SingleQueryResult{
			Query:  q,
			Status: "success",
		}

		// Check if it's a SELECT query
		upperQuery := strings.ToUpper(strings.TrimSpace(q))
		isSelect := strings.HasPrefix(upperQuery, "SELECT") ||
			strings.HasPrefix(upperQuery, "SHOW") ||
			strings.HasPrefix(upperQuery, "DESCRIBE") ||
			strings.HasPrefix(upperQuery, "EXPLAIN") ||
			strings.HasPrefix(upperQuery, "WITH")

		if isSelect {
			rows, err := driver.Query(a.ctx, q)
			if err != nil {
				result.Error = err.Error()
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}

			columns, err := rows.Columns()
			if err == nil {
				result.Columns = columns
				values := make([]interface{}, len(columns))
				valuePtrs := make([]interface{}, len(columns))
				for i := range values {
					valuePtrs[i] = &values[i]
				}

				for rows.Next() {
					if err := rows.Scan(valuePtrs...); err != nil {
						break
					}
					row := make([]interface{}, len(columns))
					for i, v := range values {
						if v == nil {
							row[i] = "NULL"
						} else if b, ok := v.([]byte); ok {
							row[i] = string(b)
						} else {
							row[i] = v
						}
					}
					result.Rows = append(result.Rows, row)
				}
				result.RowCount = len(result.Rows)
			}
			rows.Close()
		} else {
			// Non-SELECT: INSERT, UPDATE, DELETE, etc.
			sqlResult, err := driver.Exec(a.ctx, q)
			if err != nil {
				result.Error = err.Error()
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}
			if sqlResult != nil {
				if affected, err := sqlResult.RowsAffected(); err == nil {
					result.RowCount = int(affected)
				}
			}
		}

		result.Duration = time.Since(queryStart).String()
		results = append(results, result)
	}

	totalDuration = time.Since(startTime)
	successCount := 0
	errorCount := 0
	for _, r := range results {
		if r.Status == "success" {
			successCount++
		} else {
			errorCount++
		}
	}

	return MultiQueryResult{
		Results:       results,
		TotalCount:    len(results),
		SuccessCount:  successCount,
		ErrorCount:    errorCount,
		TotalDuration: totalDuration.String(),
		StartTime:     time.Now().Format("15:04:05"),
		EndTime:       time.Now().Add(totalDuration).Format("15:04:05"),
	}
}

func splitQueries(query string) []string {
	var queries []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	escaped := false

	for _, ch := range query {
		if escaped {
			current.WriteRune(ch)
			escaped = false
			continue
		}

		if ch == '\\' {
			escaped = true
			current.WriteRune(ch)
			continue
		}

		if ch == '\'' && !inDoubleQuote {
			inSingleQuote = !inSingleQuote
			current.WriteRune(ch)
			continue
		}

		if ch == '"' && !inSingleQuote {
			inDoubleQuote = !inDoubleQuote
			current.WriteRune(ch)
			continue
		}

		if ch == ';' && !inSingleQuote && !inDoubleQuote {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				queries = append(queries, stmt)
			}
			current.Reset()
			continue
		}

		current.WriteRune(ch)
	}

	// Handle remaining text (last statement without semicolon)
	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		queries = append(queries, stmt)
	}

	return queries
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
	// Decrypt password if it's saved encrypted
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
func (a *App) getDriverForConfig(dbConfig db.ConnectionConfig) (db.DatabaseDriver, error) {
	key := buildConnectionKey(dbConfig)

	a.poolMutex.RLock()
	if driver, exists := a.pool.get(key); exists {
		a.poolMutex.RUnlock()
		return driver, nil
	}
	a.poolMutex.RUnlock()

	a.poolMutex.Lock()
	defer a.poolMutex.Unlock()

	// Double check
	if driver, exists := a.pool.get(key); exists {
		return driver, nil
	}

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return nil, err
	}

	a.pool.set(key, driver)
	return driver, nil
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
	lang := a.getCurrentLang()

	// Decrypt password if it's saved encrypted
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

	// Decrypt password if it's saved encrypted
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
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
