package main

import (
	"db-client/db"
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

	driver, exists := pool.get("nonexistent")
	if exists {
		t.Error("get on empty pool should return false")
	}
	if driver != nil {
		t.Error("get on empty pool should return nil driver")
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
