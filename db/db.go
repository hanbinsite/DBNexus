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
	// Connect establishes a connection to the database
	Connect(config ConnectionConfig) error

	// Close closes the database connection
	Close() error

	// Ping tests the database connection
	Ping(ctx context.Context) error

	// UseDatabase switches the current database context
	UseDatabase(ctx context.Context, database string) error

	// Query executes a query that returns rows
	Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)

	// Exec executes a query that doesn't return rows
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)

	// GetTables returns a list of tables in the database
	GetTables(ctx context.Context) ([]string, error)

	// GetTableStructure returns the structure of a table
	GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error)

	// GetDatabases returns a list of databases
	GetDatabases(ctx context.Context) ([]string, error)
}

// DriverManager manages database drivers
type DriverManager struct {
	drivers map[DBType]DatabaseDriver
}

// NewDriverManager creates a new DriverManager with all available drivers
func NewDriverManager() *DriverManager {
	dm := &DriverManager{
		drivers: make(map[DBType]DatabaseDriver),
	}

	// Register all available drivers
	dm.RegisterDriver(PostgreSQL, NewPostgreSQLDriver())
	dm.RegisterDriver(PolarDB, NewPostgreSQLDriver()) // PolarDB is compatible with PostgreSQL
	dm.RegisterDriver(GaussDB, NewPostgreSQLDriver()) // GaussDB is compatible with PostgreSQL
	dm.RegisterDriver(MySQL, NewMySQLDriver())
	dm.RegisterDriver(SQLite, NewSQLiteDriver())
	dm.RegisterDriver(Redis, NewRedisDriver())

	return dm
}

// RegisterDriver registers a database driver
func (dm *DriverManager) RegisterDriver(dbType DBType, driver DatabaseDriver) {
	dm.drivers[dbType] = driver
}

// GetDriver returns the driver for the given database type
func (dm *DriverManager) GetDriver(dbType DBType) (DatabaseDriver, error) {
	driver, exists := dm.drivers[dbType]
	if !exists {
		return nil, fmt.Errorf("driver not found for database type: %s", dbType)
	}
	return driver, nil
}

// Connect connects to a database using the appropriate driver
func (dm *DriverManager) Connect(config ConnectionConfig) (DatabaseDriver, error) {
	driver, err := dm.GetDriver(config.Type)
	if err != nil {
		return nil, err
	}

	err = driver.Connect(config)
	if err != nil {
		return nil, err
	}

	return driver, nil
}
