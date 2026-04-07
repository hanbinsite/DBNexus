package main

import (
	"fmt"
	"strings"
	"time"
)

// ExecuteQuery executes a SQL query and returns results
func (a *App) ExecuteQuery(config Connection, database string, query string) QueryResult {
	startTime := time.Now()

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	key := buildKey(dbConfig)
	a.poolMutex.RLock()
	pooledDriver, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if pooledDriver, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return QueryResult{
					Error:    fmt.Sprintf("Connection failed: %v", err),
					Duration: time.Since(startTime).String(),
				}
			}
			a.pool.set(key, newDriver)
			pooledDriver, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
	}

	rows, err := pooledDriver.driver.Query(a.ctx, query)
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Query failed: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("Failed to get columns: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}

	var resultRows [][]interface{}
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		err = rows.Scan(valuePtrs...)
		if err != nil {
			return QueryResult{
				Error:    fmt.Sprintf("Failed to scan row: %v", err),
				Duration: time.Since(startTime).String(),
			}
		}

		row := make([]interface{}, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = "NULL"
			} else if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		resultRows = append(resultRows, row)
	}

	return QueryResult{
		Columns:  columns,
		Rows:     resultRows,
		RowCount: len(resultRows),
		Duration: time.Since(startTime).String(),
	}
}

func (a *App) ExecuteMultiQuery(config Connection, database string, query string) MultiQueryResult {
	startTime := time.Now()

	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	key := buildKey(dbConfig)
	a.poolMutex.RLock()
	pooled, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if pooled, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return MultiQueryResult{TotalDuration: time.Since(startTime).String()}
			}
			a.pool.set(key, newDriver)
			pooled, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
	}

	// Split queries by semicolon (handling multi-line queries)
	queries := splitQueries(query)

	var results []SingleQueryResult
	var totalDuration time.Duration

	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}

		queryStart := time.Now()
		result := SingleQueryResult{
			Query:  q,
			Status: "success",
		}

		// Check if it's a SELECT query
		upperQuery := strings.ToUpper(strings.TrimSpace(q))
		isSelect := strings.HasPrefix(upperQuery, "SELECT") ||
			strings.HasPrefix(upperQuery, "SHOW") ||
			strings.HasPrefix(upperQuery, "DESCRIBE") ||
			strings.HasPrefix(upperQuery, "EXPLAIN") ||
			strings.HasPrefix(upperQuery, "WITH")

		if isSelect {
			rows, err := pooled.driver.Query(a.ctx, q)
			if err != nil {
				result.Error = err.Error()
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}

			columns, err := rows.Columns()
			if err == nil {
				result.Columns = columns
				values := make([]interface{}, len(columns))
				valuePtrs := make([]interface{}, len(columns))
				for i := range values {
					valuePtrs[i] = &values[i]
				}

				for rows.Next() {
					if err := rows.Scan(valuePtrs...); err != nil {
						break
					}
					row := make([]interface{}, len(columns))
					for i, v := range values {
						if v == nil {
							row[i] = "NULL"
						} else if b, ok := v.([]byte); ok {
							row[i] = string(b)
						} else {
							row[i] = v
						}
					}
					result.Rows = append(result.Rows, row)
				}
				result.RowCount = len(result.Rows)
			}
			rows.Close()
		} else {
			// Non-SELECT: INSERT, UPDATE, DELETE, etc.
			sqlResult, err := pooled.driver.Exec(a.ctx, q)
			if err != nil {
				result.Error = err.Error()
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}
			if sqlResult != nil {
				if affected, err := sqlResult.RowsAffected(); err == nil {
					result.RowCount = int(affected)
				}
			}
		}

		result.Duration = time.Since(queryStart).String()
		results = append(results, result)
	}

	totalDuration = time.Since(startTime)
	successCount := 0
	errorCount := 0
	for _, r := range results {
		if r.Status == "success" {
			successCount++
		} else {
			errorCount++
		}
	}

	return MultiQueryResult{
		Results:       results,
		TotalCount:    len(results),
		SuccessCount:  successCount,
		ErrorCount:    errorCount,
		TotalDuration: totalDuration.String(),
		StartTime:     time.Now().Format("15:04:05"),
		EndTime:       time.Now().Add(totalDuration).Format("15:04:05"),
	}
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

	// Handle remaining text (last statement without semicolon)
	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		queries = append(queries, stmt)
	}

	return queries
}

// ExecuteNonQuery executes a non-query SQL statement
func (a *App) ExecuteNonQuery(config Connection, database string, query string) (int64, string, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.driverManager.Connect(dbConfig)
	if err != nil {
		return 0, "", fmt.Errorf("connection failed: %v", err)
	}
	defer driver.Close()

	result, err := driver.Exec(a.ctx, query)
	if err != nil {
		return 0, "", fmt.Errorf("execution failed: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, fmt.Sprintf("%d rows affected", rowsAffected), nil
}
