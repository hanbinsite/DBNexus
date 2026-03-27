package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
)

// MySQLDriver implements the DatabaseDriver interface for MySQL
type MySQLDriver struct {
	sqlDB *sql.DB
}

// NewMySQLDriver creates a new MySQLDriver
func NewMySQLDriver() DatabaseDriver {
	return &MySQLDriver{}
}

// Connect establishes a connection to MySQL
func (d *MySQLDriver) Connect(config ConnectionConfig) error {
	connStr := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		config.Username, config.Password, config.Host, config.Port, config.Database)

	sqlDB, err := sql.Open("mysql", connStr)
	if err != nil {
		return err
	}

	d.sqlDB = sqlDB
	return nil
}

// Close closes the MySQL connection
func (d *MySQLDriver) Close() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

// Ping tests the MySQL connection
func (d *MySQLDriver) Ping(ctx context.Context) error {
	return d.sqlDB.PingContext(ctx)
}

// Query executes a query that returns rows
func (d *MySQLDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return d.sqlDB.QueryContext(ctx, query, args...)
}

// Exec executes a query that doesn't return rows
func (d *MySQLDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return d.sqlDB.ExecContext(ctx, query, args...)
}

// GetTables returns a list of tables in MySQL
func (d *MySQLDriver) GetTables(ctx context.Context) ([]string, error) {
	query := "SHOW TABLES"
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

// GetTableStructure returns the structure of a MySQL table
func (d *MySQLDriver) GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error) {
	query := "DESCRIBE " + tableName
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var null string
		var key string
		var defaultValue *string
		var extra string

		if err := rows.Scan(&col.Name, &col.Type, &null, &key, &defaultValue, &extra); err != nil {
			return nil, err
		}

		col.Nullable = null == "YES"
		col.PrimaryKey = key == "PRI"
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}

		columns = append(columns, col)
	}

	return columns, nil
}

// GetDatabases returns a list of databases in MySQL
func (d *MySQLDriver) GetDatabases(ctx context.Context) ([]string, error) {
	query := "SHOW DATABASES"
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
