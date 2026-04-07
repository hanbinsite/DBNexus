package main

import (
	"db-server/db"
	"testing"
)

func TestSanitizeIdentifier(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"users", "users"},
		{"user_data", "user_data"},
		{"Table123", "Table123"},
		{"public.users", "public.users"},
		{"users123", "users123"},
		{"table`name", "tablename"},
		{"table'name", "tablename"},
		{`table"name`, "tablename"},
		{"normal_table", "normal_table"},
	}

	for _, tt := range tests {
		result := sanitizeIdentifier(tt.input)
		if result != tt.expected {
			t.Errorf("sanitizeIdentifier(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSanitizeIdentifierBlocksDangerous(t *testing.T) {
	dangerous := []string{
		"; DROP TABLE",
		"-- comment",
		"/* attack */",
		"users; DROP",
		"table' OR '1'='1",
		"users UNION SELECT",
		"table\x00name",
		"table\nname",
		"table\rname",
		"table name",
	}

	for _, input := range dangerous {
		result := sanitizeIdentifier(input)
		if result == input || result == "" {
			t.Errorf("sanitizeIdentifier(%q) was not properly sanitized, got %q", input, result)
		}
	}
}

func TestParsePostgresArray(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"{a,b,c}", []string{"a", "b", "c"}},
		{"{single}", []string{"single"}},
		{"{}", []string{}},
		{`{"a,b",c}`, []string{"a,b", "c"}},
		{"", []string{}},
		{"invalid", []string{}},
	}

	for _, tt := range tests {
		result := parsePostgresArray(tt.input)
		if len(result) != len(tt.expected) {
			t.Errorf("parsePostgresArray(%q) length = %d, want %d", tt.input, len(result), len(tt.expected))
			continue
		}
		for i, v := range result {
			if v != tt.expected[i] {
				t.Errorf("parsePostgresArray(%q)[%d] = %q, want %q", tt.input, i, v, tt.expected[i])
			}
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
		result := contains(tt.s, tt.substr)
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

	pooled, exists := pool.get("nonexistent")
	if exists {
		t.Error("get on empty pool should return false")
	}
	if pooled != nil {
		t.Error("get on empty pool should return nil pooled driver")
	}
}

func TestConnectionPoolSetAndGet(t *testing.T) {
	pool := newConnectionPool()
	pool.set("test-key", nil)

	pooled, exists := pool.get("test-key")
	if !exists {
		t.Error("expected driver to exist after set")
	}
	if pooled == nil {
		t.Error("expected pooled driver to not be nil")
	}
}

func TestConnectionPoolRemove(t *testing.T) {
	pool := newConnectionPool()
	pool.set("test-key", nil)

	pool.remove("test-key")

	_, exists := pool.get("test-key")
	if exists {
		t.Error("expected driver to be removed after remove")
	}
}

func TestConnectionPoolCloseAll(t *testing.T) {
	pool := newConnectionPool()
	pool.set("key1", nil)
	pool.set("key2", nil)

	pool.closeAll()

	if len(pool.connections) != 0 {
		t.Errorf("expected 0 connections after closeAll, got %d", len(pool.connections))
	}
}

func TestBuildKey(t *testing.T) {
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
		key := buildKey(config)
		if key != tt.expectedKey {
			t.Errorf("buildKey() = %q, want %q", key, tt.expectedKey)
		}
	}
}

func TestBuildConnectionKey(t *testing.T) {
	config := db.ConnectionConfig{
		Type:     db.DBType("postgresql"),
		Host:     "localhost",
		Port:     5432,
		Username: "postgres",
		Database: "mydb",
	}
	key := buildConnectionKey(config)
	expected := "postgresql:localhost:5432:postgres"
	if key != expected {
		t.Errorf("buildConnectionKey() = %q, want %q", key, expected)
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
		{"   ", []string{}},
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

	// Delete by ID
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
	features := app.GetSupportedFeatures()

	expectedTypes := []string{"postgresql", "mysql", "polardb", "gaussdb", "sqlite", "redis"}
	for _, dbType := range expectedTypes {
		if _, exists := features[dbType]; !exists {
			t.Errorf("expected features for %q, but not found", dbType)
		}
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
