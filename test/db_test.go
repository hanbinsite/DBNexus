package test

import (
	"context"
	"database/sql"
	"db-client/db"
	"fmt"
	"os"
	"time"
)

// TestDatabaseConnection tests a database connection
func TestDatabaseConnection(config db.ConnectionConfig) (bool, string) {
	dm := db.NewDriverManager()

	driver, err := dm.Connect(config)
	if err != nil {
		return false, fmt.Sprintf("连接失败: %v", err)
	}
	defer driver.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = driver.Ping(ctx)
	if err != nil {
		return false, fmt.Sprintf("Ping 失败: %v", err)
	}

	return true, "连接成功"
}

// TestGetTables tests fetching tables from a database
func TestGetTables(config db.ConnectionConfig) ([]string, error) {
	dm := db.NewDriverManager()

	driver, err := dm.Connect(config)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return driver.GetTables(ctx)
}

// TestGetDatabases tests fetching databases
func TestGetDatabases(config db.ConnectionConfig) ([]string, error) {
	dm := db.NewDriverManager()

	driver, err := dm.Connect(config)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return driver.GetDatabases(ctx)
}

// TestExecuteQuery tests executing a query
func TestExecuteQuery(config db.ConnectionConfig, query string) (*sql.Rows, error) {
	dm := db.NewDriverManager()

	driver, err := dm.Connect(config)
	if err != nil {
		return nil, err
	}
	defer driver.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return driver.Query(ctx, query)
}

// GetTestConfigs returns test configurations for different databases
func GetTestConfigs() []db.ConnectionConfig {
	return []db.ConnectionConfig{
		{
			Type:     db.PostgreSQL,
			Host:     "localhost",
			Port:     5432,
			Username: "postgres",
			Password: "",
			Database: "postgres",
			SSLMode:  "disable",
		},
		{
			Type:     db.MySQL,
			Host:     "localhost",
			Port:     3306,
			Username: "root",
			Password: "",
			Database: "mysql",
		},
		{
			Type:     db.SQLite,
			Database: ":memory:",
		},
		{
			Type:     db.Redis,
			Host:     "localhost",
			Port:     6379,
			Username: "",
			Password: "",
		},
	}
}

// RunAllTests runs all database driver tests
func RunAllTests() map[string]bool {
	results := make(map[string]bool)

	for _, config := range GetTestConfigs() {
		name := string(config.Type)
		ok, _ := TestDatabaseConnection(config)
		results[name] = ok
	}

	return results
}

// CreateTestSQLiteDB creates a test SQLite database in memory
func CreateTestSQLiteDB() (*sql.DB, error) {
	dbPath := os.TempDir() + "/db-client-test.db"

	sqlDB, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	// Create test tables
	_, err = sqlDB.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			status TEXT DEFAULT 'active'
		);
		
		CREATE TABLE IF NOT EXISTS orders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			total REAL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id)
		);
		
		INSERT OR IGNORE INTO users (name, email, status) VALUES 
			('张三', 'zhangsan@example.com', 'active'),
			('李四', 'lisi@example.com', 'active'),
			('王五', 'wangwu@example.com', 'inactive');
		
		INSERT OR IGNORE INTO orders (user_id, total) VALUES 
			(1, 99.99),
			(1, 149.50),
			(2, 299.00);
	`)

	if err != nil {
		sqlDB.Close()
		return nil, err
	}

	return sqlDB, nil
}
