package test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// MockServer provides mock API endpoints for testing
type MockServer struct {
	port int
}

// NewMockServer creates a new mock server
func NewMockServer(port int) *MockServer {
	return &MockServer{port: port}
}

// Connection represents a mock connection
type Connection struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Status   string `json:"status"`
}

// QueryResult represents a query result
type QueryResult struct {
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
}

// Start starts the mock server
func (s *MockServer) Start() error {
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("/api/connections", s.handleConnections)
	mux.HandleFunc("/api/databases", s.handleDatabases)
	mux.HandleFunc("/api/tables", s.handleTables)
	mux.HandleFunc("/api/query", s.handleQuery)
	mux.HandleFunc("/api/health", s.handleHealth)

	addr := fmt.Sprintf(":%d", s.port)
	fmt.Printf("Mock server starting on http://localhost%s\n", addr)

	return http.ListenAndServe(addr, mux)
}

func (s *MockServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func (s *MockServer) handleConnections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	connections := []Connection{
		{ID: "1", Name: "PostgreSQL 本地", Type: "postgresql", Host: "localhost", Port: 5432, Database: "mydb", Status: "connected"},
		{ID: "2", Name: "MySQL 测试", Type: "mysql", Host: "localhost", Port: 3306, Database: "testdb", Status: "connected"},
		{ID: "3", Name: "Redis 缓存", Type: "redis", Host: "localhost", Port: 6379, Database: "0", Status: "connected"},
	}

	json.NewEncoder(w).Encode(connections)
}

func (s *MockServer) handleDatabases(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	databases := []map[string]string{
		{"name": "postgres", "owner": "postgres"},
		{"name": "mydb", "owner": "postgres"},
		{"name": "testdb", "owner": "postgres"},
	}

	json.NewEncoder(w).Encode(databases)
}

func (s *MockServer) handleTables(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	tables := []map[string]string{
		{"name": "users", "type": "table"},
		{"name": "orders", "type": "table"},
		{"name": "products", "type": "table"},
		{"name": "categories", "type": "table"},
		{"name": "user_stats", "type": "view"},
	}

	json.NewEncoder(w).Encode(tables)
}

func (s *MockServer) handleQuery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	result := QueryResult{
		Columns: []string{"id", "name", "email", "created_at", "status"},
		Rows: [][]interface{}{
			{1, "张三", "zhangsan@example.com", "2024-01-15 10:30:00", "active"},
			{2, "李四", "lisi@example.com", "2024-01-16 11:45:00", "active"},
			{3, "王五", "wangwu@example.com", "2024-01-17 14:20:00", "inactive"},
			{4, "赵六", "zhaoliu@example.com", "2024-01-18 09:15:00", "active"},
			{5, "钱七", "qianqi@example.com", "2024-01-19 16:30:00", "pending"},
		},
		RowCount: 5,
		Duration: "0.023s",
	}

	json.NewEncoder(w).Encode(result)
}

// StartMockServer starts the mock server in a goroutine
func StartMockServer(port int) {
	server := NewMockServer(port)
	go func() {
		if err := server.Start(); err != nil {
			fmt.Printf("Mock server error: %v\n", err)
		}
	}()
}
