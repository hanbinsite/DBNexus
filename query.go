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
	var queries []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	escaped := false

	for _, ch := range query {
		if escaped {
			current.WriteRune(ch)
			escaped = false
			continue
		}

		if ch == '\\' {
			escaped = true
			current.WriteRune(ch)
			continue
		}

		if ch == '\'' && !inDoubleQuote {
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
		return 0, "", fmt.Errorf("connection failed: %v", err)
	}

	result, err := driver.Exec(a.ctx, query)
	if err != nil {
		return 0, "", fmt.Errorf("execution failed: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, fmt.Sprintf("%d rows affected", rowsAffected), nil
}
