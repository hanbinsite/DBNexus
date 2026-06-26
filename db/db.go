package db

import (
	"context"
	"database/sql"
	"fmt"
)

// DBType represents the type of database
type DBType string

const (
	PostgreSQL DBType = "postgresql"
	PolarDB    DBType = "polardb"
	GaussDB    DBType = "gaussdb"
	MySQL      DBType = "mysql"
	Redis      DBType = "redis"
	SQLite     DBType = "sqlite"
)

// ConnectionConfig represents database connection configuration
type ConnectionConfig struct {
	Type     DBType `json:"type"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Database string `json:"database"`
	SSLMode  string `json:"ssl_mode,omitempty"`
}

// ColumnInfo represents information about a table column
type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value"`
	PrimaryKey   bool   `json:"primary_key"`
}

// DatabaseDriver defines the interface for database operations
type DatabaseDriver interface {
	Connect(config ConnectionConfig) error
	Close() error
	Ping(ctx context.Context) error
	UseDatabase(ctx context.Context, database string) error
	Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	GetTables(ctx context.Context) ([]string, error)
	GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error)
	GetDatabases(ctx context.Context) ([]string, error)
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
}

// DriverManager manages database drivers
type DriverManager struct{}

// NewDriverManager creates a new DriverManager
func NewDriverManager() *DriverManager {
	return &DriverManager{}
}

// newDriver creates a fresh driver instance for the given database type.
// Each call returns a new instance so that concurrent connections never share state.
func (dm *DriverManager) newDriver(dbType DBType) (DatabaseDriver, error) {
	switch dbType {
	case PostgreSQL, PolarDB, GaussDB:
		return NewPostgreSQLDriver(), nil
	case MySQL:
		return NewMySQLDriver(), nil
	case SQLite:
		return NewSQLiteDriver(), nil
	case Redis:
		return NewRedisDriver(), nil
	default:
		return nil, fmt.Errorf("driver not found for database type: %s", dbType)
	}
}

// Connect creates a new driver instance and connects to the database
func (dm *DriverManager) Connect(config ConnectionConfig) (DatabaseDriver, error) {
	driver, err := dm.newDriver(config.Type)
	if err != nil {
		return nil, err
	}

	if err := driver.Connect(config); err != nil {
		return nil, err
	}

	return driver, nil
}

