package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/xuri/excelize/v2"
)

// S5-5: 流式导出 (大数据量)
func (a *App) ExportDataStreaming(config Connection, database string, query string, format string, filePath string) (int, error) {
	if query == "" || filePath == "" {
		return 0, fmt.Errorf("query and file path are required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return 0, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 300*time.Second) // 5 min for large exports
	defer cancel()

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return 0, fmt.Errorf("failed to get columns: %w", err)
	}

	f, err := os.Create(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to create file: %w", err)
	}
	defer f.Close()

	rowCount := 0

	switch format {
	case "csv":
		w := csv.NewWriter(f)
		w.Write(columns)

		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}

		for rows.Next() {
			if err := rows.Scan(ptrs...); err != nil {
				continue
			}
			record := make([]string, len(columns))
			for i, v := range values {
				if v == nil {
					record[i] = ""
				} else if b, ok := v.([]byte); ok {
					record[i] = string(b)
				} else {
					record[i] = fmt.Sprintf("%v", v)
				}
			}
			w.Write(record)
			rowCount++
		}
		w.Flush()

	case "json":
		_, err := f.WriteString("[")
		if err != nil {
			return 0, err
		}

		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}

		first := true
		for rows.Next() {
			if err := rows.Scan(ptrs...); err != nil {
				continue
			}
			if !first {
				f.WriteString(",")
			}
			first = false

			obj := make(map[string]interface{})
			for i, col := range columns {
				if values[i] == nil {
					obj[col] = nil
				} else if b, ok := values[i].([]byte); ok {
					obj[col] = string(b)
				} else {
					obj[col] = values[i]
				}
			}
			data, _ := json.Marshal(obj)
			f.Write(data)
			rowCount++
		}
		f.WriteString("]")

	default:
		return 0, fmt.Errorf("streaming export not supported for format: %s", format)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("流式导出: %d rows -> %s", rowCount, filePath),
		map[string]interface{}{"rows": rowCount, "format": format, "path": filePath},
	)

	return rowCount, nil
}

// S5-6: Excel 导入
func (a *App) ImportFromExcel(config Connection, database string, table string, filePath string, hasHeader bool) (int, error) {
	if table == "" || filePath == "" {
		return 0, fmt.Errorf("table and file path are required")
	}

	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return 0, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return 0, fmt.Errorf("failed to read rows: %w", err)
	}

	if len(rows) == 0 {
		return 0, fmt.Errorf("no data in Excel file")
	}

	startIdx := 0
	var headers []string
	if hasHeader {
		headers = rows[0]
		startIdx = 1
	} else {
		// Use column names from table structure
		dbConfig := a.connectionToDBConfig(config)
		dbConfig.Database = database
		driver, err := a.getDriverForConfig(dbConfig)
		if err != nil {
			return 0, fmt.Errorf("connection failed: %w", err)
		}
		ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
		defer cancel()
		cols, err := driver.GetTableStructure(ctx, table)
		if err != nil {
			return 0, fmt.Errorf("failed to get table structure: %w", err)
		}
		for _, c := range cols {
			headers = append(headers, c.Name)
		}
	}

	if len(headers) == 0 {
		return 0, fmt.Errorf("no columns found")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return 0, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 120*time.Second)
	defer cancel()

	importedCount := 0
	for i := startIdx; i < len(rows); i++ {
		row := rows[i]
		if len(row) == 0 {
			continue
		}

		// Build INSERT
		var placeholders []string
		var args []interface{}
		for j := range headers {
			if j < len(row) {
				args = append(args, row[j])
			} else {
				args = append(args, nil)
			}
			if config.Type == "mysql" {
				placeholders = append(placeholders, "?")
			} else {
				placeholders = append(placeholders, fmt.Sprintf("$%d", j+1))
			}
		}

		safeTable := sanitizeIdentifier(table)
		var colNames []string
		for _, h := range headers {
			if config.Type == "mysql" {
				colNames = append(colNames, fmt.Sprintf("`%s`", sanitizeIdentifier(h)))
			} else {
				colNames = append(colNames, sanitizeIdentifier(h))
			}
		}

		query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
			safeTable,
			joinStrings(colNames, ", "),
			joinStrings(placeholders, ", "))

		_, err := driver.Exec(ctx, query, args...)
		if err != nil {
			continue // Skip failed rows
		}
		importedCount++
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("Excel导入: %s -> %s.%s (%d rows)", filePath, database, table, importedCount),
		map[string]interface{}{"table": table, "rows": importedCount, "file": filePath},
	)

	return importedCount, nil
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}
