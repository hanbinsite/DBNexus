package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
)

// OracleDriver implements the DatabaseDriver interface for Oracle Database
type OracleDriver struct {
	sqlDB  *sql.DB
	config ConnectionConfig
	mu     sync.Mutex
}

// NewOracleDriver creates a new OracleDriver
func NewOracleDriver() DatabaseDriver {
	return &OracleDriver{}
}

// Connect establishes a connection to Oracle Database
func (d *OracleDriver) Connect(config ConnectionConfig) error {
	// Build Oracle connection string (godror format)
	// connectString = host:port/service_name
	connectString := fmt.Sprintf("%s:%d/%s", config.Host, config.Port, config.Database)

	// Build connection string with optional SSL
	connStr := fmt.Sprintf(`user="%s" password="%s" connectString="%s"`,
		config.Username, config.Password, connectString)

	// Add SSL/TLS if configured
	if config.SSLMode != "" {
		switch config.SSLMode {
		case "required", "verify-ca", "verify-full":
			connStr += ` configDir=""`
		case "disabled", "preferred":
			// No SSL
		}
	}

	sqlDB, err := sql.Open("godror", connStr)
	if err != nil {
		return fmt.Errorf("oracle connection failed: %w", err)
	}

	// Set reasonable pool limits
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(2)

	d.sqlDB = sqlDB
	d.config = config
	return nil
}

// UseDatabase switches the current schema in Oracle
// Oracle uses ALTER SESSION SET CURRENT_SCHEMA to switch schema
func (d *OracleDriver) UseDatabase(ctx context.Context, database string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.config.Database == database {
		return nil
	}

	// Oracle switches schema via ALTER SESSION
	safeSchema := sanitizeIdentifier(database)
	_, err := d.sqlDB.ExecContext(ctx,
		fmt.Sprintf("ALTER SESSION SET CURRENT_SCHEMA = %s", safeSchema))
	if err != nil {
		return fmt.Errorf("failed to switch schema to %s: %w", database, err)
	}

	d.config.Database = database
	return nil
}

// Close closes the Oracle connection
func (d *OracleDriver) Close() error {
	if d.sqlDB != nil {
		return d.sqlDB.Close()
	}
	return nil
}

// Ping tests the Oracle connection
func (d *OracleDriver) Ping(ctx context.Context) error {
	if d.sqlDB == nil {
		return fmt.Errorf("database connection is nil")
	}
	return d.sqlDB.PingContext(ctx)
}

// Query executes a query that returns rows
func (d *OracleDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return d.sqlDB.QueryContext(ctx, query, args...)
}

// Exec executes a query that doesn't return rows
func (d *OracleDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return d.sqlDB.ExecContext(ctx, query, args...)
}

// GetTables returns a list of tables accessible by the current user in Oracle
func (d *OracleDriver) GetTables(ctx context.Context) ([]string, error) {
	query := `
		SELECT table_name FROM user_tables
		UNION ALL
		SELECT view_name FROM user_views
		ORDER BY 1
	`
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
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

// GetTableStructure returns the structure of an Oracle table
func (d *OracleDriver) GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error) {
	// Use bind variable :1 for Oracle
	query := `
		SELECT
			c.column_name,
			c.data_type ||
			CASE WHEN c.data_precision IS NOT NULL
                     THEN '(' || TO_CHAR(c.data_precision) ||
                          CASE WHEN c.data_scale > 0 THEN ',' || TO_CHAR(c.data_scale) ELSE '' END || ')'
                 WHEN c.char_length > 0 AND c.data_type IN ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR')
                     THEN '(' || TO_CHAR(c.char_length) || ')'
                 ELSE ''
            END as full_data_type,
			c.nullable,
			c.data_default,
			NVL2(pk.column_name, '1', '0') as is_pk
		FROM user_tab_columns c
		LEFT JOIN (
			SELECT cc.column_name
			FROM user_constraints uc
			JOIN user_cons_columns cc
				ON uc.constraint_name = cc.constraint_name
			WHERE uc.constraint_type = 'P'
				AND cc.table_name = UPPER(:1)
		) pk ON pk.column_name = c.column_name
		WHERE c.table_name = UPPER(:1)
		ORDER BY c.column_id
	`

	rows, err := d.Query(ctx, query, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table structure: %w", err)
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var nullable string
		var defaultValue *string
		var isPK string

		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &isPK); err != nil {
			return nil, err
		}

		col.Nullable = nullable == "Y"
		col.PrimaryKey = isPK == "1"
		if defaultValue != nil {
			col.DefaultValue = strings.TrimSpace(*defaultValue)
		}

		columns = append(columns, col)
	}

	return columns, nil
}

// GetDatabases returns a list of schemas/users in Oracle
func (d *OracleDriver) GetDatabases(ctx context.Context) ([]string, error) {
	query := `
		SELECT username
		FROM all_users
		ORDER BY username
	`
	rows, err := d.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get schemas: %w", err)
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var schema string
		if err := rows.Scan(&schema); err != nil {
			return nil, err
		}
		databases = append(databases, schema)
	}
	return databases, nil
}

// BeginTx begins a transaction
func (d *OracleDriver) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return d.sqlDB.BeginTx(ctx, opts)
}
