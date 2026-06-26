package db

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	_ "github.com/lib/pq"
)

// PostgreSQLDriver implements the DatabaseDriver interface for PostgreSQL
type PostgreSQLDriver struct {
	sqlDB  *sql.DB
	config ConnectionConfig // 保存配置以便重新连接
	mu     sync.Mutex       // 保护 UseDatabase 期间的连接切换
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
	d.config = config // 保存配置
	return nil
}

// UseDatabase switches the current database context
// PostgreSQL doesn't have a 'USE' command, so we need to reconnect to the new database
func (d *PostgreSQLDriver) UseDatabase(ctx context.Context, database string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	// 如果已经是同一个数据库，无需切换
	if d.config.Database == database {
		return nil
	}

	// 创建新的连接配置
	newConfig := d.config
	newConfig.Database = database

	// 重新连接到新数据库
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		newConfig.Host, newConfig.Port, newConfig.Username, newConfig.Password, newConfig.Database, newConfig.SSLMode)

	newSqlDB, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to connect to database %s: %w", database, err)
	}

	// 测试新连接
	if err := newSqlDB.PingContext(ctx); err != nil {
		newSqlDB.Close()
		return fmt.Errorf("failed to ping database %s: %w", database, err)
	}

	// 先准备好新连接，再关闭旧连接
	oldSqlDB := d.sqlDB
	d.sqlDB = newSqlDB
	d.config = newConfig

	if oldSqlDB != nil {
		oldSqlDB.Close()
	}
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
	if d.sqlDB == nil {
		return fmt.Errorf("database connection is nil")
	}
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

func (d *PostgreSQLDriver) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return d.sqlDB.BeginTx(ctx, opts)
}

