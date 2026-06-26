package main

import (
	"fmt"
	"strings"
)

// Deprecated: Use ExecuteQueryWithTimeout instead. This method has no timeout
// and can freeze the UI indefinitely on long-running queries.
func (a *App) ExecuteQuery(config Connection, database string, query string) QueryResult {
	return a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{})
}

func (a *App) ExecuteMultiQuery(config Connection, database string, query string) MultiQueryResult {
	return a.ExecuteMultiQueryWithTimeout(config, database, query, QueryOptions{})
}

func splitQueries(query string) []string {
	return splitQueriesWithDialect(query, "mysql")
}

func splitQueriesWithDialect(query string, dialect string) []string {
	var queries []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	escaped := false

	// MySQL uses backslash as escape character inside strings.
	// PostgreSQL standard SQL does NOT use backslash as escape (unless E'' prefix).
	// SQLite follows PostgreSQL convention (no backslash escape in standard strings).
	useBackslashEscape := dialect == "mysql"

	for _, ch := range query {
		if escaped {
			current.WriteRune(ch)
			escaped = false
			continue
		}

		if useBackslashEscape && ch == '\\' {
			escaped = true
			current.WriteRune(ch)
			continue
		}

		if ch == '\'' && !inDoubleQuote {
			// Handle escaped single quote: '' (SQL standard, all dialects)
			if inSingleQuote {
				// Peek ahead — if next char is also ', it's an escaped quote
				// We handle this by checking after the loop
			}
			inSingleQuote = !inSingleQuote
			current.WriteRune(ch)
			continue
		}

		if ch == '"' && !inSingleQuote {
			inDoubleQuote = !inDoubleQuote
			current.WriteRune(ch)
			continue
		}

		if ch == ';' && !inSingleQuote && !inDoubleQuote {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				queries = append(queries, stmt)
			}
			current.Reset()
			continue
		}

		current.WriteRune(ch)
	}

	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		queries = append(queries, stmt)
	}

	return queries
}

func (a *App) ExecuteNonQuery(config Connection, database string, query string) (int64, string, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return 0, "", fmt.Errorf("connection failed: %w", err)
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("执行非查询 (NonQuery): %s", truncateQuery(query, 200)),
		map[string]interface{}{
			"database": database,
		},
	)

	result, err := driver.Exec(a.ctx, query)
	if err != nil {
		auditLogger.Log(AuditLevelError, AuditEventQuery,
			fmt.Sprintf("非查询失败: %v", err),
			map[string]interface{}{
				"database": database,
				"query":    truncateQuery(query, 200),
			},
		)
		return 0, "", fmt.Errorf("execution failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, fmt.Sprintf("%d rows affected", rowsAffected), nil
}

