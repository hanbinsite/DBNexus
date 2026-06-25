package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type SearchResult struct {
	TableName  string        `json:"table_name"`
	ColumnName string        `json:"column_name"`
	RowCount   int           `json:"row_count"`
	Duration   string        `json:"duration"`
	Columns    []string      `json:"columns"`
	Rows       [][]interface{} `json:"rows"`
}

func (a *App) SearchTableData(config Connection, database string, table string, searchText string, limit int) (*SearchResult, error) {
	if table == "" || searchText == "" {
		return nil, fmt.Errorf("table and search text are required")
	}
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	startTime := time.Now()

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	columns, err := driver.GetTableStructure(ctx, table)
	if err != nil {
		return nil, fmt.Errorf("failed to get table structure: %w", err)
	}

	var whereParts []string
	var args []interface{}
	for _, col := range columns {
		if config.Type == "postgresql" || config.Type == "polardb" || config.Type == "gaussdb" {
			whereParts = append(whereParts, fmt.Sprintf("CAST(%s AS TEXT) ILIKE $%d", sanitizeIdentifier(col.Name), len(args)+1))
		} else {
			whereParts = append(whereParts, fmt.Sprintf("CAST(`%s` AS CHAR) LIKE ?", sanitizeIdentifier(col.Name)))
		}
		args = append(args, "%"+searchText+"%")
	}

	if len(whereParts) == 0 {
		return nil, fmt.Errorf("no searchable columns found in table %s", table)
	}

	query := fmt.Sprintf("SELECT * FROM `%s` WHERE %s LIMIT %d",
		sanitizeIdentifier(table),
		strings.Join(whereParts, " OR "),
		limit)

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %w", err)
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var resultRows [][]interface{}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		resultRows = append(resultRows, values)
	}

	result := &SearchResult{
		TableName:  table,
		RowCount:   len(resultRows),
		Duration:   time.Since(startTime).String(),
		Columns:    cols,
		Rows:       resultRows,
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("全文搜索: %s.%s (text=%s, rows=%d)", database, table, truncateQuery(searchText, 100), len(resultRows)),
		map[string]interface{}{"table": table, "search": searchText, "rows": len(resultRows)},
	)

	return result, nil
}

func (a *App) SearchAllTables(config Connection, database string, searchText string, limit int) ([]SearchResult, error) {
	if searchText == "" {
		return nil, fmt.Errorf("search text is required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 60*time.Second)
	defer cancel()

	tables, err := driver.GetTables(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
	}

	var results []SearchResult
	for _, table := range tables {
		result, err := a.SearchTableData(config, database, table, searchText, limit)
		if err != nil {
			continue
		}
		if result.RowCount > 0 {
			results = append(results, *result)
		}
	}

	return results, nil
}
