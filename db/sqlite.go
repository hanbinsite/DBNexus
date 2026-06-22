package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

func sanitizeIdentifier(identifier string) string {
	if identifier == "" {
		return "invalid_identifier"
	}
	if strings.Contains(identifier, "..") {
		return "invalid_identifier"
	}
	if strings.ContainsAny(identifier, ";--/*\\=(){}[]&|!<>") {
		return "invalid_identifier"
	}
	cleaned := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '.' {
			return r
		}
		return -1
	}, identifier)
	if cleaned == "" {
		return "invalid_identifier"
	}
	if len(cleaned) > 64 {
		return cleaned[:64]
	}
	return cleaned
}

// SQLiteDriver implements the DatabaseDriver interface for SQLite
type SQLiteDriver struct {
	sqlDB *sql.DB
}

// NewSQLiteDriver creates a new SQLiteDriver
func NewSQLiteDriver() DatabaseDriver {
	return &SQLiteDriver{}
}

// Connect establishes a connection to SQLite
func (d *SQLiteDriver) Connect(config ConnectionConfig) error {
	dbPath := config.Database
	if dbPath == "" {
		return fmt.Errorf("database path is required for SQLite")
	}

	sqlDB, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	d.sqlDB = sqlDB
	return nil
}

// UseDatabase switches the current database context
func (d *SQLiteDriver) UseDatabase(ctx context.Context, database string) error {
	// SQLite usually uses a single file.
	return nil
}

// Close closes the SQLite connection
func (d *SQLiteDriver) Close() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

// Ping tests the SQLite connection
func (d *SQLiteDriver) Ping(ctx context.Context) error {
	if d.sqlDB == nil {
		return fmt.Errorf("database connection is nil")
	}
	return d.sqlDB.PingContext(ctx)
}

// Query executes a query that returns rows
func (d *SQLiteDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return d.sqlDB.QueryContext(ctx, query, args...)
}

// Exec executes a query that doesn't return rows
func (d *SQLiteDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return d.sqlDB.ExecContext(ctx, query, args...)
}

// GetTables returns a list of tables in SQLite
func (d *SQLiteDriver) GetTables(ctx context.Context) ([]string, error) {
	query := "SELECT name FROM sqlite_master WHERE type='table'"
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			return nil, err
		}
		tables = append(tables, table)
	}

	return tables, nil
}

// GetTableStructure returns the structure of a SQLite table
func (d *SQLiteDriver) GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error) {
	safeTableName := sanitizeIdentifier(tableName)
	query := fmt.Sprintf("PRAGMA table_info(\"%s\")", safeTableName)
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var cid int
		var notnull int
		var dfltValue *string
		var pk int

		if err := rows.Scan(&cid, &col.Name, &col.Type, &notnull, &dfltValue, &pk); err != nil {
			return nil, err
		}

		col.Nullable = notnull == 0
		col.PrimaryKey = pk == 1
		if dfltValue != nil {
			col.DefaultValue = *dfltValue
		}

		columns = append(columns, col)
	}

	return columns, nil
}

func (d *SQLiteDriver) GetDatabases(ctx context.Context) ([]string, error) {
	return []string{"main"}, nil
}

func (d *SQLiteDriver) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return d.sqlDB.BeginTx(ctx, opts)
}
