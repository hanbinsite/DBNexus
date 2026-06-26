package main

import (
	"testing"
)

// Benchmark sanitizeIdentifier — hot path, called on every query
func BenchmarkSanitizeIdentifier(b *testing.B) {
	tests := []struct {
		name  string
		input string
	}{
		{"simple", "users"},
		{"dotted", "public.users"},
		{"quoted", `"users"`},
		{"complex", "schema.table_name_123"},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				sanitizeIdentifier(tt.input)
			}
		})
	}
}

// Benchmark escapeHtml — hot path, called on every cell render
func BenchmarkEscapeHtml(b *testing.B) {
	tests := []struct {
		name  string
		input string
	}{
		{"plain", "Hello World"},
		{"special", `<script>alert("xss")</script>`},
		{"mixed", `O'Brien said "Hello" & <goodbye>`},
		{"empty", ""},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				escapeHtmlString(tt.input)
			}
		})
	}
}

// Benchmark splitQueries — called on every multi-query execution
func BenchmarkSplitQueries(b *testing.B) {
	tests := []struct {
		name  string
		input string
	}{
		{"single", "SELECT * FROM users"},
		{"two", "SELECT * FROM users; SELECT * FROM orders"},
		{"five", "SELECT 1; SELECT 2; SELECT 3; SELECT 4; SELECT 5"},
		{"with_string", `SELECT 'hello;world'; SELECT 'foo'`},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				splitQueries(tt.input)
			}
		})
	}
}

// Benchmark encryptPassword — called on every connection save
func BenchmarkEncryptPassword(b *testing.B) {
	for i := 0; i < b.N; i++ {
		encryptPassword("test-password-12345")
	}
}

// Benchmark decryptPassword — called on every connection load
func BenchmarkDecryptPassword(b *testing.B) {
	encrypted, _ := encryptPassword("test-password-12345")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		decryptPassword(encrypted)
	}
}

// Benchmark makeQueryCacheKey — called on every cached query
func BenchmarkMakeQueryCacheKey(b *testing.B) {
	config := Connection{Type: "postgresql", Host: "localhost"}
	for i := 0; i < b.N; i++ {
		makeQueryCacheKey(config, "testdb", "SELECT * FROM users WHERE id = 1")
	}
}

// Benchmark extractTableNames — called on AI optimization
func BenchmarkExtractTableNames(b *testing.B) {
	sql := `SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE u.active = true`
	for i := 0; i < b.N; i++ {
		extractTableNames(sql)
	}
}

// Benchmark isValidColumnName — called in index analysis
func BenchmarkIsValidColumnName(b *testing.B) {
	for i := 0; i < b.N; i++ {
		isValidColumnName("users.table_name_123")
	}
}

// helper for escapeHtml benchmark
func escapeHtmlString(s string) string {
	var sb []byte
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '&':
			sb = append(sb, '&', 'a', 'm', 'p', ';')
		case '<':
			sb = append(sb, '&', 'l', 't', ';')
		case '>':
			sb = append(sb, '&', 'g', 't', ';')
		case '"':
			sb = append(sb, '&', 'q', 'u', 'o', 't', ';')
		case '\'':
			sb = append(sb, '&', '#', '3', '9', ';')
		default:
			sb = append(sb, s[i])
		}
	}
	return string(sb)
}
