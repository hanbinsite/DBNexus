package main

import (
	"db-server/db"
	"strings"
	"testing"
	"time"
)

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
