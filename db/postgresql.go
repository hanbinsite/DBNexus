package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

// PostgreSQLDriver implements the DatabaseDriver interface for PostgreSQL
type PostgreSQLDriver struct {
	sqlDB *sql.DB
}

// NewPostgreSQLDriver creates a new PostgreSQLDriver
func NewPostgreSQLDriver() DatabaseDriver {
	return &PostgreSQLDriver{}
}

// Connect establishes a connection to PostgreSQL
func (d *PostgreSQLDriver) Connect(config ConnectionConfig) error {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		config.Host, config.Port, config.Username, config.Password, config.Database, config.SSLMode)

	sqlDB, err := sql.Open("postgres", connStr)
	if err != nil {
		return err
	}

	d.sqlDB = sqlDB
	return nil
}

// UseDatabase switches the current database context
func (d *PostgreSQLDriver) UseDatabase(ctx context.Context, database string) error {
	// PostgreSQL doesn't have a 'USE' command.
	// Connection is established to a specific DB.
	// For a real client, we would need to re-connect or use a different connection from the pool.
	// For now, we return nil as PostgreSQL usually handles this via connection string.
	return nil
}

// Close closes the PostgreSQL connection
func (d *PostgreSQLDriver) Close() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

// Ping tests the PostgreSQL connection
func (d *PostgreSQLDriver) Ping(ctx context.Context) error {
	return d.sqlDB.PingContext(ctx)
}

// Query executes a query that returns rows
func (d *PostgreSQLDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return d.sqlDB.QueryContext(ctx, query, args...)
}

// Exec executes a query that doesn't return rows
func (d *PostgreSQLDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return d.sqlDB.ExecContext(ctx, query, args...)
}

// GetTables returns a list of tables in PostgreSQL
func (d *PostgreSQLDriver) GetTables(ctx context.Context) ([]string, error) {
	query := "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
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

// GetTableStructure returns the structure of a PostgreSQL table
func (d *PostgreSQLDriver) GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error) {
	query := `
		SELECT 
			column_name,
			data_type,
			is_nullable,
			column_default,
			CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
		FROM information_schema.columns
		LEFT JOIN (
			SELECT ku.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage ku
				ON tc.constraint_name = ku.constraint_name
				AND tc.table_schema = ku.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_name = $1
		) pk ON pk.column_name = columns.column_name
		WHERE table_name = $1
		ORDER BY ordinal_position
	`

	rows, err := d.Query(ctx, query, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var isNullable string
		var defaultValue *string

		if err := rows.Scan(&col.Name, &col.Type, &isNullable, &defaultValue, &col.PrimaryKey); err != nil {
			return nil, err
		}

		col.Nullable = isNullable == "YES"
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}

		columns = append(columns, col)
	}

	return columns, nil
}

// GetDatabases returns a list of databases in PostgreSQL
func (d *PostgreSQLDriver) GetDatabases(ctx context.Context) ([]string, error) {
	query := "SELECT datname FROM pg_database WHERE datistemplate = false"
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var db string
		if err := rows.Scan(&db); err != nil {
			return nil, err
		}
		databases = append(databases, db)
	}

	return databases, nil
}
