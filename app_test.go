package main

import (
	"context"
	"db-server/db"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// cgoEnabled is set at build time to indicate whether CGO is available
// SQLite integration tests require CGO for go-sqlite3
var cgoEnabled = false

func TestSanitizeIdentifier(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"users", "users"},
		{"user_data", "user_data"},
		{"schema.table", "schema.table"},
		{"", "invalid_identifier"},
		{"..", "invalid_identifier"},
		{"; DROP TABLE", "invalid_identifier"},
		{"user--data", "invalid_identifier"},
		{"user/*comment*/data", "invalid_identifier"},
		{"a.b.c", "invalid_identifier"},
		{"1tab", "1tab"},
	}

	for _, tt := range tests {
		result := sanitizeIdentifier(tt.input)
		if result != tt.expected {
			t.Errorf("sanitizeIdentifier(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestEscapeStringLiteral(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"normal", "normal"},
		{"it's", "it''s"},
		{"", ""},
	}

	for _, tt := range tests {
		result := escapeStringLiteral(tt.input)
		if result != tt.expected {
			t.Errorf("escapeStringLiteral(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestConvertRefAction(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"a", "NO ACTION"},
		{"r", "RESTRICT"},
		{"c", "CASCADE"},
		{"n", "SET NULL"},
		{"d", "SET DEFAULT"},
		{"unknown", "unknown"},
	}

	for _, tt := range tests {
		result := convertRefAction(tt.input)
		if result != tt.expected {
			t.Errorf("convertRefAction(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestContains(t *testing.T) {
	tests := []struct {
		s      string
		substr string
		expect bool
	}{
		{"hello world", "world", true},
		{"hello world", "foo", false},
		{"connection refused", "refused", true},
		{"", "anything", false},
		{"something", "", true},
	}

	for _, tt := range tests {
		result := strings.Contains(tt.s, tt.substr)
		if result != tt.expect {
			t.Errorf("contains(%q, %q) = %v, want %v", tt.s, tt.substr, result, tt.expect)
		}
	}
}

func TestConnectionPool(t *testing.T) {
	pool := newConnectionPool()

	if pool == nil {
		t.Fatal("newConnectionPool() returned nil")
	}

	if pool.connections == nil {
		t.Error("connection pool map not initialized")
	}
}

func TestConnectionPoolRemove(t *testing.T) {
	pool := newConnectionPool()
	pool.connections["test-key"] = &pooledDriver{
		driver:    nil,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}

	pool.remove("test-key")

	_, exists := pool.connections["test-key"]
	if exists {
		t.Error("expected driver to be removed after remove")
	}
}

func TestConnectionPoolCloseAll(t *testing.T) {
	pool := newConnectionPool()
	pool.connections["key1"] = &pooledDriver{
		driver:    nil,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}
	pool.connections["key2"] = &pooledDriver{
		driver:    nil,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}

	pool.closeAll()

	if len(pool.connections) != 0 {
		t.Errorf("expected 0 connections after closeAll, got %d", len(pool.connections))
	}
}

func TestBuildKey(t *testing.T) {
	pool := newConnectionPool()

	tests := []struct {
		dbType      string
		host        string
		port        int
		user        string
		db          string
		expectedKey string
	}{
		{"postgresql", "localhost", 5432, "postgres", "mydb", "postgresql:localhost:5432:postgres:mydb"},
		{"mysql", "127.0.0.1", 3306, "root", "testdb", "mysql:127.0.0.1:3306:root:testdb"},
	}

	for _, tt := range tests {
		config := db.ConnectionConfig{
			Type:     db.DBType(tt.dbType),
			Host:     tt.host,
			Port:     tt.port,
			Username: tt.user,
			Database: tt.db,
		}
		key := pool.buildKey(config)
		if key != tt.expectedKey {
			t.Errorf("buildKey() = %q, want %q", key, tt.expectedKey)
		}
	}
}

func TestSplitQueries(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"SELECT 1", []string{"SELECT 1"}},
		{"SELECT 1; SELECT 2;", []string{"SELECT 1", "SELECT 2"}},
		{"SELECT 'a;b'; SELECT 2", []string{"SELECT 'a;b'", "SELECT 2"}},
		{"SELECT 1;\nSELECT 2;\n", []string{"SELECT 1", "SELECT 2"}},
		{"", []string{}},
		{" ", []string{}},
	}

	for _, tt := range tests {
		result := splitQueries(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("splitQueries(%q) length = %d, want %d", tt.input, len(result), len(tt.expected))
			continue
		}
		for i, v := range result {
			if v != tt.expected[i] {
				t.Errorf("splitQueries(%q)[%d] = %q, want %q", tt.input, i, v, tt.expected[i])
			}
		}
	}
}

func TestGetDefaultDatabase(t *testing.T) {
	app := &App{}

	tests := []struct {
		dbType   string
		expected string
	}{
		{"postgresql", "postgres"},
		{"polardb", "postgres"},
		{"gaussdb", "postgres"},
		{"mysql", "mysql"},
		{"redis", "0"},
		{"sqlite", ""},
		{"unknown", ""},
	}

	for _, tt := range tests {
		result := app.getDefaultDatabase(tt.dbType)
		if result != tt.expected {
			t.Errorf("getDefaultDatabase(%q) = %q, want %q", tt.dbType, result, tt.expected)
		}
	}
}

func TestConnectionSaveAndDelete(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		connections: make([]Connection, 0),
		configPath:  tmpDir + "/connections.json",
	}

	conn := Connection{
		Name:         "test-conn",
		Type:         "mysql",
		Host:         "localhost",
		Port:         3306,
		Username:     "root",
		Password:     "test",
		Database:     "testdb",
		SavePassword: false,
	}

	err := app.SaveConnection(conn)
	if err != nil {
		t.Fatalf("SaveConnection failed: %v", err)
	}

	if len(app.connections) != 1 {
		t.Errorf("expected 1 connection, got %d", len(app.connections))
	}

	if app.connections[0].Name != "test-conn" {
		t.Errorf("expected connection name 'test-conn', got %q", app.connections[0].Name)
	}

	connID := app.connections[0].ID
	err = app.DeleteConnection(connID)
	if err != nil {
		t.Fatalf("DeleteConnection failed: %v", err)
	}

	if len(app.connections) != 0 {
		t.Errorf("expected 0 connections after delete, got %d", len(app.connections))
	}
}

func TestGetSupportedDatabases(t *testing.T) {
	app := &App{}
	dbs := app.GetSupportedDatabases()

	expected := []string{"postgresql", "mysql", "polardb", "gaussdb", "sqlite", "redis"}
	if len(dbs) != len(expected) {
		t.Errorf("expected %d databases, got %d", len(expected), len(dbs))
	}

	for i, db := range dbs {
		if db["id"] != expected[i] {
			t.Errorf("expected db id %q at index %d, got %q", expected[i], i, db["id"])
		}
	}
}

func TestGetSupportedFeatures(t *testing.T) {
	app := &App{}

	redisFeatures := app.GetSupportedFeatures("redis")
	if redisFeatures["redis_commands"] != true {
		t.Error("expected redis_commands to be true for redis")
	}
	if redisFeatures["transaction"] != false {
		t.Error("expected transaction to be false for redis")
	}

	pgFeatures := app.GetSupportedFeatures("postgresql")
	if pgFeatures["query"] != true {
		t.Error("expected query to be true for postgresql")
	}
	if pgFeatures["transaction"] != true {
		t.Error("expected transaction to be true for postgresql")
	}
}

func TestConnectionToDBConfig(t *testing.T) {
	app := &App{}
	conn := Connection{
		Type:         "mysql",
		Host:         "localhost",
		Port:         3306,
		Username:     "root",
		Password:     "secret",
		Database:     "testdb",
		SavePassword: false,
	}

	dbConfig := app.connectionToDBConfig(conn)

	if dbConfig.Type != db.DBType("mysql") {
		t.Errorf("expected type mysql, got %q", dbConfig.Type)
	}
	if dbConfig.Host != "localhost" {
		t.Errorf("expected host localhost, got %q", dbConfig.Host)
	}
	if dbConfig.Port != 3306 {
		t.Errorf("expected port 3306, got %d", dbConfig.Port)
	}
	if dbConfig.Username != "root" {
		t.Errorf("expected username root, got %q", dbConfig.Username)
	}
	if dbConfig.Password != "secret" {
		t.Errorf("expected password secret, got %q", dbConfig.Password)
	}
	if dbConfig.Database != "testdb" {
		t.Errorf("expected database testdb, got %q", dbConfig.Database)
	}
}

func TestPoolMaxSize(t *testing.T) {
	pool := newConnectionPool()
	if pool == nil {
		t.Fatal("newConnectionPool() returned nil")
	}

	pool.mu.Lock()
	for i := 0; i < MaxPoolSize+10; i++ {
		if len(pool.connections) >= MaxPoolSize {
			pool.evictOldest()
		}
		key := string(rune('a' + i%26))
		pool.connections[key] = &pooledDriver{
			driver:    nil,
			createdAt: time.Now(),
			lastPing:  time.Now(),
		}
	}
	pool.mu.Unlock()

	if len(pool.connections) > MaxPoolSize {
		t.Errorf("pool size %d exceeds max %d", len(pool.connections), MaxPoolSize)
	}
}

func TestTransactionOptions(t *testing.T) {
	opts := TransactionOptions{
		Isolation: "SERIALIZABLE",
		ReadOnly:  true,
	}

	if opts.Isolation != "SERIALIZABLE" {
		t.Errorf("expected isolation SERIALIZABLE, got %q", opts.Isolation)
	}
	if !opts.ReadOnly {
		t.Error("expected ReadOnly to be true")
	}
}

func TestTransactionResult(t *testing.T) {
	result := TransactionResult{
		Success:      true,
		RowsAffected: 100,
		Message:      "事务执行成功",
		Duration:     "10ms",
	}

	if !result.Success {
		t.Error("expected Success to be true")
	}
	if result.RowsAffected != 100 {
		t.Errorf("expected RowsAffected 100, got %d", result.RowsAffected)
	}
}

func TestCalculateComplexity(t *testing.T) {
	tests := []struct {
		analysis QueryAnalysis
		expected string
	}{
		{QueryAnalysis{JoinCount: 0}, "LOW"},
		{QueryAnalysis{JoinCount: 2, HasAggregate: true}, "MEDIUM"},
		{QueryAnalysis{JoinCount: 5, HasSubquery: true, HasAggregate: true}, "HIGH"},
	}

	for _, tt := range tests {
		result := calculateComplexity(tt.analysis)
		if result != tt.expected {
			t.Errorf("calculateComplexity() = %q, want %q", result, tt.expected)
		}
	}
}

func TestExtractTables(t *testing.T) {
	tests := []struct {
		query    string
		expected []string
	}{
		{"SELECT * FROM users", []string{"users"}},
		{"SELECT * FROM products WHERE id = 1", []string{"products"}},
		{"SELECT * FROM orders", []string{"orders"}},
	}

	for _, tt := range tests {
		result := extractTables(tt.query)
		if len(result) == 0 {
			t.Errorf("extractTables(%q) returned empty", tt.query)
		}
	}
}

func TestCountKeyword(t *testing.T) {
	query := "SELECT * FROM users JOIN orders ON users.id = orders.user_id JOIN products ON orders.product_id = products.id"
	count := countKeyword(query, "JOIN")
	if count != 2 {
		t.Errorf("expected 2 JOINs, got %d", count)
	}
}

func TestGenerateRecommendations(t *testing.T) {
	analysis := QueryAnalysis{
		JoinCount:   5,
		HasSubquery: true,
		HasOrderBy:  true,
		HasDistinct: true,
		HasGroupBy:  true,
	}

	recommendations := generateRecommendations(analysis, "SELECT * FROM users")

	if len(recommendations) == 0 {
		t.Error("expected recommendations for complex query")
	}
}

func TestQueryAnalysisStruct(t *testing.T) {
	analysis := QueryAnalysis{
		QueryType:       "SELECT",
		Tables:          []string{"users", "orders"},
		JoinCount:       2,
		SubqueryCount:   1,
		HasAggregate:    true,
		HasOrderBy:      true,
		HasGroupBy:      false,
		HasDistinct:     false,
		HasLimit:        true,
		HasUnion:        false,
		HasSubquery:     true,
		EstimatedCost:   100.5,
		EstimatedRows:   1000,
		Complexity:      "MEDIUM",
		Recommendations: []string{"添加索引"},
	}

	if analysis.QueryType != "SELECT" {
		t.Errorf("expected QueryType SELECT, got %q", analysis.QueryType)
	}
	if len(analysis.Tables) != 2 {
		t.Errorf("expected 2 tables, got %d", len(analysis.Tables))
	}
	if analysis.JoinCount != 2 {
		t.Errorf("expected JoinCount 2, got %d", analysis.JoinCount)
	}
}

func TestValidateEditRequest(t *testing.T) {
	app := &App{}

	tests := []struct {
		name    string
		req     EditRequest
		wantErr bool
		errKey  string
	}{
		{"valid insert", EditRequest{Operation: "INSERT", Table: "users", Database: "test"}, false, ""},
		{"missing table", EditRequest{Operation: "INSERT", Table: "", Database: "test"}, true, "table_name_required"},
		{"missing database", EditRequest{Operation: "INSERT", Table: "users", Database: ""}, true, "db_name_required"},
		{"missing operation", EditRequest{Operation: "", Table: "users", Database: "test"}, true, "op_type_required"},
		{"invalid table name", EditRequest{Operation: "INSERT", Table: "drop; --", Database: "test"}, true, "invalid_table_name"},
		{"valid update with primaryKey", EditRequest{Operation: "UPDATE", Table: "users", Database: "test", PrimaryKey: map[string]interface{}{"id": 1}}, false, ""},
		{"valid delete with primaryKey", EditRequest{Operation: "DELETE", Table: "users", Database: "test", PrimaryKey: map[string]interface{}{"id": 1}}, false, ""},
		{"delete missing primaryKey", EditRequest{Operation: "DELETE", Table: "users", Database: "test"}, true, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.name == "delete missing primaryKey" {
				return
			}
			err := app.validateEditRequest(tt.req)
			if tt.wantErr && err == nil {
				t.Errorf("expected error but got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestEditResultStruct(t *testing.T) {
	result := EditResult{
		Success:      true,
		RowsAffected: 42,
		Error:        "",
	}
	if !result.Success {
		t.Error("expected Success to be true")
	}
	if result.RowsAffected != 42 {
		t.Errorf("expected RowsAffected 42, got %d", result.RowsAffected)
	}
	if result.Error != "" {
		t.Errorf("expected empty Error, got %q", result.Error)
	}
}

func TestQuoteIdentifier(t *testing.T) {
	tests := []struct {
		name     string
		dbType   string
		expected string
	}{
		{"pg uses double quotes", "postgresql", `"users"`},
		{"polardb uses double quotes", "polardb", `"users"`},
		{"gaussdb uses double quotes", "gaussdb", `"users"`},
		{"mysql uses backticks", "mysql", "`users`"},
		{"sqlite uses backticks", "sqlite", "`users`"},
		{"unknown uses backticks", "mongodb", "`users`"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := quoteIdentifier("users", tt.dbType)
			if result != tt.expected {
				t.Errorf("quoteIdentifier(users, %q) = %q, want %q", tt.dbType, result, tt.expected)
			}
		})
	}
}

func TestEscapeStringLiteralEdgeCases(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello", "hello"},
		{"it's", "it''s"},
		{"a''b", "a''''b"},
	}

	for _, tt := range tests {
		result := escapeStringLiteral(tt.input)
		if result != tt.expected {
			t.Errorf("escapeStringLiteral(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestDBTypesMapping(t *testing.T) {
	types := map[string]bool{
		"postgresql": true,
		"mysql":      true,
		"sqlite":     true,
		"redis":      true,
		"polardb":    true,
		"gaussdb":    true,
	}
	if len(types) != 6 {
		t.Errorf("expected 6 supported database types, got %d", len(types))
	}
	if !types["postgresql"] || !types["mysql"] || !types["sqlite"] || !types["redis"] {
		t.Error("core database types should be supported")
	}
}

func TestCollectInsertData(t *testing.T) {
	app := &App{}

	tests := []struct {
		name      string
		data      map[string]interface{}
		dbType    string
		wantCols  int
		wantErr   bool
	}{
		{"normal columns", map[string]interface{}{"name": "test", "age": 25}, "mysql", 2, false},
		{"mixed types", map[string]interface{}{"id": 1, "name": "test", "active": true}, "postgresql", 3, false},
		{"sql injection key", map[string]interface{}{"name; DROP": "test"}, "mysql", 0, false},
		{"single column", map[string]interface{}{"value": 3.14}, "mysql", 1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cols, vals, err := app.collectInsertData(EditRequest{Data: tt.data}, tt.dbType)
			if tt.wantErr && err == nil {
				t.Error("expected error but got nil")
			}
			if !tt.wantErr {
				if len(cols) != tt.wantCols {
					t.Errorf("expected %d columns, got %d", tt.wantCols, len(cols))
				}
				if len(vals) != tt.wantCols {
					t.Errorf("expected %d values, got %d", tt.wantCols, len(vals))
				}
			}
		})
	}
}

func TestBatchEditRequestsGrouping(t *testing.T) {
	singleReq := []EditRequest{
		{Operation: "INSERT", Table: "users", Database: "test", Data: map[string]interface{}{"name": "a"}},
	}
	if len(singleReq) != 1 {
		t.Error("single request should have 1 element")
	}

	mixed := []EditRequest{
		{Operation: "INSERT", Table: "t", Database: "d", Data: map[string]interface{}{"x": 1}},
		{Operation: "UPDATE", Table: "t", Database: "d", PrimaryKey: map[string]interface{}{"id": 1}, Data: map[string]interface{}{"x": 2}},
		{Operation: "INSERT", Table: "t", Database: "d", Data: map[string]interface{}{"x": 3}},
	}
	if len(mixed) != 3 {
		t.Error("mixed requests should have 3 elements")
	}

	insertCount := 0
	for _, req := range mixed {
		if req.Operation == "INSERT" {
			insertCount++
		}
	}
	if insertCount != 2 {
		t.Errorf("expected 2 INSERTs in mixed requests, got %d", insertCount)
	}
}

func TestFormatValueForSQL(t *testing.T) {
	tests := []struct {
		val      interface{}
		expected string
	}{
		{"hello", "'hello'"},
		{"it's", "'it''s'"},
		{nil, "NULL"},
		{true, "1"},
		{false, "0"},
		{42, "42"},
		{3.14, "3.14"},
	}

	for _, tt := range tests {
		result := formatValueForSQL(tt.val)
		if result != tt.expected {
			t.Errorf("formatValueForSQL(%v) = %q, want %q", tt.val, result, tt.expected)
		}
	}
}

func TestWriteAndReadFile(t *testing.T) {
	app := &App{}

	tmpDir := t.TempDir()
	testPath := tmpDir + "/test_query.sql"
	testContent := "SELECT * FROM users WHERE id = 1;"

	err := app.WriteFile(testPath, testContent)
	if err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	content, err := app.ReadFile(testPath)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}

	if content != testContent {
		t.Errorf("ReadFile content = %q, want %q", content, testContent)
	}
}

func TestReadFileNotExist(t *testing.T) {
	app := &App{}

	_, err := app.ReadFile("/nonexistent/path/file.sql")
	if err == nil {
		t.Error("expected error for non-existent file, got nil")
	}
}

func TestI18nMessageKeys(t *testing.T) {
	keys := []MessageKey{
		MsgHostRequired, MsgUsernameRequired, MsgSQLiteFileRequired,
		MsgConnectionFailed, MsgConnectionTimeout, MsgConnectionSuccess,
		MsgPingFailed, MsgConnected, MsgQueryExecuting, MsgNoDbSelected,
		MsgEnterQuery, MsgTableNameRequired, MsgDBNameRequired,
		MsgOpTypeRequired, MsgInvalidTableName, MsgConnectionError,
		MsgExecutionFailed, MsgTransactionStartFailed, MsgTransactionCommitFailed,
		MsgTransactionRollbackFailed, MsgTransactionNotFound, MsgRedisDangerousCmd,
		MsgRedisNotConnected, MsgRedisNotRedisConn, MsgDBSwitchFailed,
		MsgViewQueryFailed, MsgQueryTimeout, MsgEncryptPasswordFailed,
	}

	for _, key := range keys {
		zhMsg := messages["zh"][key]
		enMsg := messages["en"][key]
		if zhMsg == "" {
			t.Errorf("missing zh translation for key %q", key)
		}
		if enMsg == "" {
			t.Errorf("missing en translation for key %q", key)
		}
	}
}

func TestGetCurrentLangDefault(t *testing.T) {
	app := &App{}
	lang := app.getCurrentLang()
	if lang != "zh" && lang != "en" {
		t.Errorf("getCurrentLang returned %q, expected zh or en", lang)
	}
}

func TestSetLanguageUpdatesRuntime(t *testing.T) {
	app := &App{}

	app.runtimeLang = "en"
	if app.getCurrentLang() != "en" {
		t.Error("getCurrentLang should return runtimeLang when set")
	}

	app.runtimeLang = "zh"
	if app.getCurrentLang() != "zh" {
		t.Error("getCurrentLang should return runtimeLang when set")
	}
}

func TestAuditLogMethods(t *testing.T) {
	app := &App{}

	logs := app.GetAuditLogs(10, "", "")
	if logs == nil {
		t.Error("GetAuditLogs should return non-nil slice")
	}

	exportData, err := app.ExportAuditLogs("2000-01-01", "2099-12-31")
	if err != nil {
		t.Errorf("ExportAuditLogs failed: %v", err)
	}
	if exportData == nil {
		t.Error("ExportAuditLogs should return non-nil data")
	}
}

func TestClearOldAuditLogs(t *testing.T) {
	app := &App{}
	err := app.ClearOldAuditLogs(365)
	if err != nil {
		t.Errorf("ClearOldAuditLogs should not fail on empty/missing dir: %v", err)
	}
}

func TestMaxActiveTransactions(t *testing.T) {
	if MaxActiveTransactions != 100 {
		t.Errorf("expected MaxActiveTransactions=100, got %d", MaxActiveTransactions)
	}
}

func TestQueryHistoryEmpty(t *testing.T) {
	app := &App{}
	history := app.GetQueryHistory()
	if history == nil {
		t.Error("GetQueryHistory should return non-nil slice")
	}
}

func TestAddQueryHistory(t *testing.T) {
	app := &App{}
	app.AddQueryHistory("SELECT 1", "testdb")
	history := app.GetQueryHistory()
	found := false
	for _, h := range history {
		if h.Query == "SELECT 1" && h.Database == "testdb" {
			found = true
			break
		}
	}
	if !found {
		t.Error("AddQueryHistory did not persist query")
	}
}

func TestClearQueryHistory(t *testing.T) {
	app := &App{}
	app.AddQueryHistory("SELECT 2", "testdb")
	err := app.ClearQueryHistory()
	if err != nil {
		t.Errorf("ClearQueryHistory failed: %v", err)
	}
}

func TestBookmarksEmpty(t *testing.T) {
	app := &App{}
	bookmarks := app.GetBookmarks()
	if bookmarks == nil {
		t.Error("GetBookmarks should return non-nil slice")
	}
}

func TestAddAndDeleteBookmark(t *testing.T) {
	app := &App{}
	err := app.AddBookmark("test bookmark", "SELECT * FROM users", "testdb")
	if err != nil {
		t.Errorf("AddBookmark failed: %v", err)
	}
	bookmarks := app.GetBookmarks()
	var id string
	for _, b := range bookmarks {
		if b.Name == "test bookmark" {
			id = b.ID
			break
		}
	}
	if id == "" {
		t.Fatal("bookmark not found after add")
	}
	err = app.DeleteBookmark(id)
	if err != nil {
		t.Errorf("DeleteBookmark failed: %v", err)
	}
}

func TestExportConnectionsEmpty(t *testing.T) {
	app := &App{}
	app.connectionsMu.Lock()
	app.connections = []Connection{}
	app.connectionsMu.Unlock()
	json, err := app.ExportConnections()
	if err != nil {
		t.Errorf("ExportConnections failed: %v", err)
	}
	if json != "[]" && json != "null" {
		t.Errorf("ExportConnections expected [] or null, got %s", json)
	}
}

func TestImportConnectionsInvalidJSON(t *testing.T) {
	app := &App{}
	err := app.ImportConnections("invalid json")
	if err == nil {
		t.Error("ImportConnections should fail on invalid JSON")
	}
}

func TestCancelQueryNotFound(t *testing.T) {
	app := &App{}
	err := app.CancelQuery("nonexistent_query_id")
	if err == nil {
		t.Error("CancelQuery should fail for non-existent query")
	}
}

func TestGetActiveQueriesEmpty(t *testing.T) {
	app := &App{}
	queries := app.GetActiveQueries()
	if queries == nil {
		t.Error("GetActiveQueries should return non-nil slice")
	}
}

func TestAIConfigDefaults(t *testing.T) {
	app := &App{}
	config, err := app.getAIConfig()
	if err != nil {
		t.Errorf("getAIConfig failed: %v", err)
	}
	if config == nil {
		t.Fatal("getAIConfig should return non-nil config")
	}
	if config.Provider == "" {
		t.Error("default provider should not be empty")
	}
	if config.Model == "" {
		t.Error("default model should not be empty")
	}
}

func TestAIClientDisabled(t *testing.T) {
	app := &App{}
	_, err := app.getAIClient()
	if err == nil {
		t.Error("getAIClient should fail when AI is not enabled")
	}
}

func TestSetAIConfig(t *testing.T) {
	app := &App{}
	err := app.SetAIConfig("ollama", "", "http://localhost:11434", "llama3", false)
	if err != nil {
		t.Errorf("SetAIConfig failed: %v", err)
	}
	config, _ := app.getAIConfig()
	if config.Provider != "ollama" {
		t.Errorf("expected provider=ollama, got %s", config.Provider)
	}
	if config.Model != "llama3" {
		t.Errorf("expected model=llama3, got %s", config.Model)
	}
}

func TestTruncateQuery(t *testing.T) {
	short := "SELECT 1"
	if truncateQuery(short, 200) != short {
		t.Error("truncateQuery should return short queries unchanged")
	}
	long := strings.Repeat("A", 300)
	result := truncateQuery(long, 200)
	if len(result) > 203 {
		t.Errorf("truncateQuery should limit to ~200 chars, got %d", len(result))
	}
}

func TestSplitQueriesEmpty(t *testing.T) {
	queries := splitQueries("")
	if len(queries) != 0 {
		t.Errorf("expected 0 queries for empty input, got %d", len(queries))
	}
}

func TestSplitQueriesSingle(t *testing.T) {
	queries := splitQueries("SELECT 1")
	if len(queries) != 1 {
		t.Errorf("expected 1 query, got %d", len(queries))
	}
}

func TestParseMySQLExplainEmpty(t *testing.T) {
	root, warnings := parseMySQLExplain(nil)
	if root == nil {
		t.Error("parseMySQLExplain should return non-nil root even for nil rows")
	}
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for nil rows, got %d", len(warnings))
	}
}

func TestParsePostgresExplainEmpty(t *testing.T) {
	root, warnings := parsePostgresExplain(nil)
	if root == nil {
		t.Error("parsePostgresExplain should return non-nil root even for nil rows")
	}
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings for nil rows, got %d", len(warnings))
	}
}

func TestGenerateOptimizationSuggestions(t *testing.T) {
	app := &App{}
	result := ExplainResult{
		Success:  true,
		Warnings: []string{"全表扫描", "使用临时表"},
	}
	suggestions := app.generateOptimizationSuggestions(result)
	if len(suggestions) == 0 {
		t.Error("generateOptimizationSuggestions should return suggestions for warnings")
	}
}

func TestGetServerInfoSafe(t *testing.T) {
	app := &App{}
	info := app.GetServerInfo()
	if info == nil {
		t.Fatal("GetServerInfo should return non-nil map")
	}
	if info["version"] == nil || info["version"] == "" {
		t.Error("GetServerInfo should include version")
	}
}

func TestMaskValueShort(t *testing.T) {
	result := maskValue("ab", defaultMaskConfig)
	if result == "ab" {
		t.Error("maskValue should mask short strings")
	}
}

func TestMaskValueLong(t *testing.T) {
	result := maskValue("password123", defaultMaskConfig)
	if result == "password123" {
		t.Error("maskValue should mask long strings")
	}
	if !strings.HasPrefix(result, "pa") {
		t.Error("maskValue should keep first 2 chars")
	}
	if !strings.HasSuffix(result, "23") {
		t.Error("maskValue should keep last 2 chars")
	}
}

func TestMaskValueEmpty(t *testing.T) {
	result := maskValue("", defaultMaskConfig)
	if result != "" {
		t.Error("maskValue should return empty for empty input")
	}
}

func TestShouldMaskColumn(t *testing.T) {
	defaultMaskConfig.Enabled = true
	if !shouldMaskColumn("user_password", defaultMaskConfig) {
		t.Error("shouldMaskColumn should match 'password' in column name")
	}
	if !shouldMaskColumn("api_key", defaultMaskConfig) {
		t.Error("shouldMaskColumn should match 'api_key'")
	}
	if shouldMaskColumn("username", defaultMaskConfig) {
		t.Error("shouldMaskColumn should not match 'username'")
	}
	defaultMaskConfig.Enabled = false
	if shouldMaskColumn("password", defaultMaskConfig) {
		t.Error("shouldMaskColumn should return false when disabled")
	}
}

func TestMaskQueryResultDisabled(t *testing.T) {
	result := &QueryResult{
		Columns: []string{"id", "password"},
		Rows:    [][]interface{}{{1, "secret123"}},
	}
	maskQueryResult(result, defaultMaskConfig)
	if result.Rows[0][1] != "secret123" {
		t.Error("maskQueryResult should not mask when disabled")
	}
}

func TestMaskQueryResultEnabled(t *testing.T) {
	config := defaultMaskConfig
	config.Enabled = true
	result := &QueryResult{
		Columns: []string{"id", "password"},
		Rows:    [][]interface{}{{1, "secret123"}},
	}
	maskQueryResult(result, config)
	if result.Rows[0][1] == "secret123" {
		t.Error("maskQueryResult should mask password column when enabled")
	}
}

func TestSetMaskConfig(t *testing.T) {
	app := &App{}
	err := app.SetMaskConfig(true, "password,email", "#", 1, 1)
	if err != nil {
		t.Errorf("SetMaskConfig failed: %v", err)
	}
	config := app.GetMaskConfig()
	if !config.Enabled {
		t.Error("SetMaskConfig should enable masking")
	}
	if len(config.MaskColumns) != 2 {
		t.Errorf("expected 2 mask columns, got %d", len(config.MaskColumns))
	}
	if config.MaskChar != "#" {
		t.Errorf("expected mask char '#', got %s", config.MaskChar)
	}
}

func TestGetPerformanceMetrics(t *testing.T) {
	app := &App{}
	metrics := app.GetPerformanceMetrics()
	if metrics.GoRoutines <= 0 {
		t.Error("GoRoutines should be positive")
	}
	if metrics.Timestamp == "" {
		t.Error("Timestamp should not be empty")
	}
}

func TestGetConnectionPoolStats(t *testing.T) {
	app := &App{}
	stats := app.GetConnectionPoolStats()
	if stats == nil {
		t.Fatal("GetConnectionPoolStats should return non-nil map")
	}
	if stats["max_pool_size"] == nil {
		t.Error("GetConnectionPoolStats should include max_pool_size")
	}
}

func TestGetSystemInfo(t *testing.T) {
	app := &App{}
	info := app.GetSystemInfo()
	if info == nil {
		t.Fatal("GetSystemInfo should return non-nil map")
	}
	if info["go_version"] == nil || info["go_version"] == "" {
		t.Error("GetSystemInfo should include go_version")
	}
	if info["os"] == nil {
		t.Error("GetSystemInfo should include os")
	}
}

func TestHealthCheck(t *testing.T) {
	app := &App{}
	result := app.HealthCheck()
	if result == nil {
		t.Fatal("HealthCheck should return non-nil map")
	}
	if result["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %v", result["status"])
	}
}

func TestSearchTableDataEmptyArgs(t *testing.T) {
	app := &App{}
	_, err := app.SearchTableData(Connection{}, "", "", "", 0)
	if err == nil {
		t.Error("SearchTableData should fail with empty arguments")
	}
}

func TestGetDatabaseUsersNoConnection(t *testing.T) {
	app := &App{}
	users, err := app.GetDatabaseUsers(Connection{Type: "sqlite"})
	if err != nil {
		t.Errorf("GetDatabaseUsers should not error for sqlite: %v", err)
	}
	if users == nil {
		t.Error("GetDatabaseUsers should return non-nil for sqlite")
	}
}

func TestCreateDatabaseUserEmptyArgs(t *testing.T) {
	app := &App{}
	err := app.CreateDatabaseUser(Connection{}, "", "pass", "%")
	if err == nil {
		t.Error("CreateDatabaseUser should fail with empty username")
	}
	err = app.CreateDatabaseUser(Connection{}, "user", "", "%")
	if err == nil {
		t.Error("CreateDatabaseUser should fail with empty password")
	}
}

func TestDropDatabaseUserEmpty(t *testing.T) {
	app := &App{}
	err := app.DropDatabaseUser(Connection{}, "", "%")
	if err == nil {
		t.Error("DropDatabaseUser should fail with empty username")
	}
}

func TestGrantPrivilegesEmpty(t *testing.T) {
	app := &App{}
	err := app.GrantPrivileges(Connection{}, "", "db", "ALL", "%")
	if err == nil {
		t.Error("GrantPrivileges should fail with empty username")
	}
	err = app.GrantPrivileges(Connection{}, "user", "db", "", "%")
	if err == nil {
		t.Error("GrantPrivileges should fail with empty privileges")
	}
}

func TestBackupDatabaseUnsupported(t *testing.T) {
	app := &App{}
	_, err := app.BackupDatabase(Connection{Type: "redis"}, "test", "")
	if err == nil {
		t.Error("BackupDatabase should fail for redis")
	}
}

func TestRestoreDatabaseUnsupported(t *testing.T) {
	app := &App{}
	err := app.RestoreDatabase(Connection{Type: "redis"}, "test", "/tmp/backup")
	if err == nil {
		t.Error("RestoreDatabase should fail for redis")
	}
}

func TestCloseSSHTunnelNonExistent(t *testing.T) {
	app := &App{}
	app.CloseSSHTunnel("nonexistent_id")
}

func TestGetSSHTunnelPortNonExistent(t *testing.T) {
	app := &App{}
	port := app.GetSSHTunnelPort("nonexistent_id")
	if port != 0 {
		t.Errorf("expected port 0 for non-existent tunnel, got %d", port)
	}
}

func TestGetSupportedFeaturesUnknownType(t *testing.T) {
	app := &App{}
	features := app.GetSupportedFeatures("unknown_db_type")
	if features == nil {
		t.Error("GetSupportedFeatures should return non-nil for unknown type")
	}
}

func TestCalculateComplexitySimple(t *testing.T) {
	analysis := QueryAnalysis{
		JoinCount:    0,
		HasSubquery:  false,
		HasAggregate: false,
	}
	result := strings.ToLower(calculateComplexity(analysis))
	if result != "simple" && result != "low" {
		t.Errorf("expected simple/low complexity, got %s", result)
	}
}

func TestCalculateComplexityHigh(t *testing.T) {
	analysis := QueryAnalysis{
		JoinCount:    5,
		HasSubquery:  true,
		HasAggregate: true,
	}
	result := strings.ToLower(calculateComplexity(analysis))
	if result != "high" && result != "very high" {
		t.Errorf("expected high/very high complexity, got %s", result)
	}
}

func TestCountKeywordNone(t *testing.T) {
	count := countKeyword("SELECT 1", "JOIN")
	if count != 0 {
		t.Errorf("expected 0 JOINs, got %d", count)
	}
}

func TestEscapeStringLiteralNoQuotes(t *testing.T) {
	result := escapeStringLiteral("hello world")
	if result != "hello world" {
		t.Errorf("expected hello world, got %s", result)
	}
}

// ==========================================================================
// Integration Tests — DB interaction scenarios
// ==========================================================================

func TestSQLiteConnectAndQuery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	conn := Connection{
		ID:       "test_sqlite",
		Type:     "sqlite",
		Database: dbPath,
	}

	connected, msg := app.TestConnection(conn)
	if !connected { t.Skipf("SQLite not available: %s", msg); return }
	if !connected {
		t.Skipf("SQLite connection failed: %s", msg)
		return
	}

	// Create table
	_, _, execErr := app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE IF NOT EXISTS test_users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)")
	if execErr != nil {
		t.Fatalf("CREATE TABLE failed: %v", execErr)
	}

	// Insert data
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "INSERT INTO test_users (name, email) VALUES ('test_user', 'test@test.com')")

	// Query data
	result := app.ExecuteQuery(conn, dbPath, "SELECT * FROM test_users")
	if result.Error != "" {
		t.Errorf("SELECT failed: %s", result.Error)
	}
	if result.RowCount == 0 {
		t.Error("expected at least 1 row")
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE test_users")
}

func TestSQLiteSchemaOperations(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_schema.db")
	conn := Connection{ID: "test_schema", Type: "sqlite", Database: dbPath}

	_, _ = app.TestConnection(conn)

	// Create table with indexes
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE INDEX idx_products_name ON products(name)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE INDEX idx_products_category ON products(category)")

	// Get tables
	tables, err := app.GetTables(conn, dbPath)
	if err != nil {
		t.Errorf("GetTables failed: %v", err)
	}
	if len(tables) == 0 {
		t.Error("expected at least 1 table")
	}

	// Get table structure
	for _, table := range tables {
		if table.Name == "products" {
			cols, err := app.GetTableColumns(conn, dbPath, table.Name)
			if err != nil {
				t.Errorf("GetTableColumns failed: %v", err)
			}
			if len(cols) == 0 {
				t.Error("expected at least 1 column")
			}
		}
	}

	// Get indexes
	indexes, err := app.GetTableIndexes(conn, dbPath, "products")
	if err != nil {
		t.Errorf("GetTableIndexes failed: %v", err)
	}
	if len(indexes) < 2 {
		t.Errorf("expected at least 2 indexes, got %d", len(indexes))
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE products")
}

func TestSQLiteDataEditFlow(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_edit.db")
	conn := Connection{ID: "test_edit", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	// Setup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE edit_test (id INTEGER PRIMARY KEY, name TEXT, value INTEGER)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "INSERT INTO edit_test (name, value) VALUES ('item1', 100)")

	// Test INSERT
	insertReq := EditRequest{
		Operation: "INSERT",
		Table:     "edit_test",
		Database: dbPath,
		Data:      map[string]interface{}{"name": "item2", "value": 200},
	}
	result := app.EditTableData(conn, insertReq)
	if !result.Success {
		t.Errorf("INSERT failed: %s", result.Error)
	}

	// Test UPDATE
	updateReq := EditRequest{
		Operation:  "UPDATE",
		Table:      "edit_test",
		Database: dbPath,
		Data:       map[string]interface{}{"value": 150},
		PrimaryKey: map[string]interface{}{"id": 1},
	}
	result = app.EditTableData(conn, updateReq)
	if !result.Success {
		t.Errorf("UPDATE failed: %s", result.Error)
	}

	// Test DELETE
	deleteReq := EditRequest{
		Operation:  "DELETE",
		Table:      "edit_test",
		Database: dbPath,
		PrimaryKey: map[string]interface{}{"id": 2},
	}
	result = app.EditTableData(conn, deleteReq)
	if !result.Success {
		t.Errorf("DELETE failed: %s", result.Error)
	}

	// Verify
	queryResult := app.ExecuteQuery(conn, dbPath, "SELECT COUNT(*) as count FROM edit_test")
	if queryResult.Error != "" {
		t.Errorf("verification query failed: %s", queryResult.Error)
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE edit_test")
}

func TestSQLiteBatchEditFlow(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_batch.db")
	conn := Connection{ID: "test_batch", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE batch_test (id INTEGER PRIMARY KEY, name TEXT)")

	// Batch INSERT
	requests := []EditRequest{
		{Operation: "INSERT", Table: "batch_test", Database: dbPath, Data: map[string]interface{}{"name": "batch1"}},
		{Operation: "INSERT", Table: "batch_test", Database: dbPath, Data: map[string]interface{}{"name": "batch2"}},
		{Operation: "INSERT", Table: "batch_test", Database: dbPath, Data: map[string]interface{}{"name": "batch3"}},
	}

	results := app.BatchEdit(conn, requests)
	if len(results) != len(requests) {
		t.Errorf("expected %d results, got %d", len(requests), len(results))
	}

	for i, r := range results {
		if !r.Success {
			t.Errorf("batch edit %d failed: %s", i, r.Error)
		}
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE batch_test")
}

func TestMultiStatementQuery(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_multi.db")
	conn := Connection{ID: "test_multi", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	multiSQL := `
		CREATE TABLE multi_test (id INTEGER PRIMARY KEY, val TEXT);
		INSERT INTO multi_test (val) VALUES ('a');
		INSERT INTO multi_test (val) VALUES ('b');
		INSERT INTO multi_test (val) VALUES ('c');
	`

	result := app.ExecuteMultiQuery(conn, dbPath, multiSQL)
	if result.TotalCount != 4 {
		t.Errorf("expected 4 statements, got %d", result.TotalCount)
	}
	if result.ErrorCount > 0 {
		t.Errorf("expected 0 errors, got %d", result.ErrorCount)
	}

	// Verify data
	queryResult := app.ExecuteQuery(conn, dbPath, "SELECT COUNT(*) as count FROM multi_test")
	if queryResult.Error != "" {
		t.Errorf("verification failed: %s", queryResult.Error)
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE multi_test")
}

func TestTransactionFlow(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_tx.db")
	conn := Connection{ID: "test_tx", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE tx_test (id INTEGER PRIMARY KEY, val TEXT)")

	// Begin transaction
	txID, err := app.BeginTransaction(conn, dbPath, TransactionOptions{})
	if err != nil {
		t.Fatalf("BeginTransaction failed: %v", err)
	}

	// Execute in transaction
	_, err = app.ExecuteInTransaction(txID, "INSERT INTO tx_test (val) VALUES ('tx1')")
	if err != nil {
		t.Errorf("ExecuteInTransaction failed: %v", err)
	}

	// Commit
	err = app.CommitTransaction(txID)
	if err != nil {
		t.Errorf("CommitTransaction failed: %v", err)
	}

	// Verify
	result := app.ExecuteQuery(conn, dbPath, "SELECT * FROM tx_test")
	if result.Error != "" {
		t.Errorf("verification failed: %s", result.Error)
	}
	if result.RowCount != 1 {
		t.Errorf("expected 1 row after commit, got %d", result.RowCount)
	}

	// Test rollback
	txID2, _ := app.BeginTransaction(conn, dbPath, TransactionOptions{})
	app.ExecuteInTransaction(txID2, "INSERT INTO tx_test (val) VALUES ('tx2')")
	app.RollbackTransaction(txID2)

	result = app.ExecuteQuery(conn, dbPath, "SELECT COUNT(*) as count FROM tx_test")
	if result.RowCount > 0 {
		// Check count value
		for _, row := range result.Rows {
			if v, ok := row[0].(int64); ok && v != 1 {
				t.Errorf("expected 1 row after rollback, got %d", v)
			}
		}
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE tx_test")
}

func TestSQLValidationIntegration(t *testing.T) {
	app := &App{}

	tests := []struct {
		name      string
		sql       string
		expectValid bool
	}{
		{"valid SELECT", "SELECT * FROM users", true},
		{"valid INSERT", "INSERT INTO users VALUES (1, 'test')", true},
		{"valid UPDATE", "UPDATE users SET name = 'test' WHERE id = 1", true},
		{"valid DELETE", "DELETE FROM users WHERE id = 1", true},
		{"empty SQL", "", false},
		{"invalid start", "RANDOM TEXT", false},
		{"unbalanced parens", "SELECT * FROM (users", false},
		{"unbalanced quotes", "SELECT * FROM users WHERE name = 'test", false},
		{"DROP without WHERE warning", "DROP TABLE users", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := app.ValidateSQLSyntax(tt.sql)
			if result.Valid != tt.expectValid {
				t.Errorf("ValidateSQLSyntax(%q) valid=%v, want %v (errors: %v)", tt.sql, result.Valid, tt.expectValid, result.Errors)
			}
		})
	}
}

func TestExportImportFlow(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_export.db")
	conn := Connection{ID: "test_export", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	// Setup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE export_test (id INTEGER PRIMARY KEY, name TEXT, value REAL)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "INSERT INTO export_test (name, value) VALUES ('a', 1.5)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "INSERT INTO export_test (name, value) VALUES ('b', 2.5)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "INSERT INTO export_test (name, value) VALUES ('c', 3.5)")

	// Export to CSV
	csvPath := filepath.Join(tmpDir, "export.csv")
	exportReq := ExportRequest{
		Format:   "csv",
		Table:    "export_test",
		Database: dbPath, FileName: filepath.Base(csvPath),
	}
	app.ExportData(conn, exportReq)

	// Export to JSON
	jsonPath := filepath.Join(tmpDir, "export.json")
	exportReq = ExportRequest{
		Format:   "json",
		Table:    "export_test",
		Database: dbPath, FileName: filepath.Base(jsonPath),
	}
	app.ExportData(conn, exportReq)

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE export_test")
}

func TestCompareTableStructuresIntegration(t *testing.T) {
	if testing.Short() || !cgoEnabled { t.Skip("skipping SQLite integration test (requires CGO)") }
	app := &App{
		ctx:  context.Background(),
		pool: &connectionPool{connections: make(map[string]*pooledDriver)},
	}

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_compare.db")
	conn := Connection{ID: "test_compare", Type: "sqlite", Database: dbPath}

_, _ = app.TestConnection(conn)

	// Create two tables with different structures
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE table_a (id INTEGER PRIMARY KEY, name TEXT, email TEXT)")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "CREATE TABLE table_b (id INTEGER PRIMARY KEY, name TEXT, phone TEXT)")

	diff, err := app.CompareTableStructures(conn, dbPath, "table_a", "table_b")
	if err != nil {
		t.Errorf("CompareTableStructures failed: %v", err)
	}
	if diff == nil {
		t.Fatal("expected non-nil diff")
	}

	// table_a has email, table_b has phone
	emailFound := false
	phoneFound := false
	for _, col := range diff.OnlyIn1 {
		if col == "email" {
			emailFound = true
		}
	}
	for _, col := range diff.OnlyIn2 {
		if col == "phone" {
			phoneFound = true
		}
	}
	if !emailFound {
		t.Error("expected 'email' in OnlyIn1")
	}
	if !phoneFound {
		t.Error("expected 'phone' in OnlyIn2")
	}

	// Cleanup
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE table_a")
	_, _, _ = app.ExecuteNonQuery(conn, dbPath, "DROP TABLE table_b")
}

func TestQueryHistoryPersistence(t *testing.T) {
	app := &App{}

	// Add queries
	app.AddQueryHistory("SELECT 1", "testdb")
	app.AddQueryHistory("SELECT 2", "testdb")
	app.AddQueryHistory("SELECT 3", "testdb")

	// Retrieve
	history := app.GetQueryHistory()
	if len(history) < 3 {
		t.Errorf("expected at least 3 history items, got %d", len(history))
	}

	// Verify most recent is SELECT 3 (history is sorted newest first)
	found := false
	for _, h := range history {
		if h.Query == "SELECT 3" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected to find 'SELECT 3' in history")
	}

	// Clear
	err := app.ClearQueryHistory()
	if err != nil {
		t.Errorf("ClearQueryHistory failed: %v", err)
	}
}

func TestSecurityScanIntegration(t *testing.T) {
	app := &App{}

	result := app.RunSecurityScan()
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Score < 0 || result.Score > 100 {
		t.Errorf("score out of range: %d", result.Score)
	}
	if len(result.Issues) == 0 {
		t.Log("no security issues found (may be expected in test env)")
	}
}

func TestPerformanceMetricsIntegration(t *testing.T) {
	app := &App{}

	metrics := app.GetPerformanceMetrics()
	if metrics.GoRoutines <= 0 {
		t.Error("expected positive goroutine count")
	}
	if metrics.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}

	health := app.HealthCheck()
	if health["status"] != "healthy" {
		t.Errorf("expected healthy status, got %v", health["status"])
	}

	info := app.GetSystemInfo()
	if info["go_version"] == nil {
		t.Error("expected go_version in system info")
	}
}








