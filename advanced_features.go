package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"
)

// S6-1: 高级筛选 (多条件组合)
type FilterCondition struct {
	Column    string `json:"column"`
	Operator  string `json:"operator"`  // =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL
	Value     interface{} `json:"value,omitempty"`
}

type AdvancedFilter struct {
	Conditions []FilterCondition `json:"conditions"`
	Logic      string `json:"logic"` // "AND" or "OR"
	OrderBy    string `json:"order_by,omitempty"`
	OrderDir   string `json:"order_dir,omitempty"` // ASC or DESC
	Limit      int    `json:"limit,omitempty"`
	Offset     int    `json:"offset,omitempty"`
}

func (a *App) QueryWithFilter(config Connection, database string, table string, filter AdvancedFilter) (*QueryResult, error) {
	if table == "" {
		return nil, fmt.Errorf("table name is required")
	}
	if len(filter.Conditions) == 0 {
		return nil, fmt.Errorf("at least one filter condition is required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(table)
	logic := strings.ToUpper(strings.TrimSpace(filter.Logic))
	if logic != "OR" {
		logic = "AND"
	}

	var whereParts []string
	var args []interface{}
	argIdx := 1

	for _, cond := range filter.Conditions {
		safeCol := sanitizeIdentifier(cond.Column)
		op := strings.ToUpper(strings.TrimSpace(cond.Operator))

		switch op {
		case "=", "!=", ">", "<", ">=", "<=":
			if config.Type == "mysql" {
				whereParts = append(whereParts, fmt.Sprintf("`%s` %s ?", safeCol, op))
			} else {
				whereParts = append(whereParts, fmt.Sprintf("%s %s $%d", safeCol, op, argIdx))
				argIdx++
			}
			args = append(args, cond.Value)

		case "LIKE", "NOT LIKE":
			if config.Type == "mysql" {
				whereParts = append(whereParts, fmt.Sprintf("`%s` %s ?", safeCol, op))
			} else {
				whereParts = append(whereParts, fmt.Sprintf("%s %s $%d", safeCol, op, argIdx))
				argIdx++
			}
			args = append(args, cond.Value)

		case "IN":
			if config.Type == "mysql" {
				placeholders := make([]string, 0)
				if vals, ok := cond.Value.([]interface{}); ok {
					for range vals {
						placeholders = append(placeholders, "?")
						args = append(args, vals)
					}
				}
				if len(placeholders) > 0 {
					whereParts = append(whereParts, fmt.Sprintf("`%s` IN (%s)", safeCol, strings.Join(placeholders, ",")))
				}
			}

		case "IS NULL":
			whereParts = append(whereParts, fmt.Sprintf("%s IS NULL", safeCol))

		case "IS NOT NULL":
			whereParts = append(whereParts, fmt.Sprintf("%s IS NOT NULL", safeCol))

		default:
			return nil, fmt.Errorf("unsupported operator: %s", op)
		}
	}

	query := fmt.Sprintf("SELECT * FROM %s WHERE %s", safeTable, strings.Join(whereParts, " "+logic+" "))

	if filter.OrderBy != "" {
		safeOrder := sanitizeIdentifier(filter.OrderBy)
		dir := strings.ToUpper(strings.TrimSpace(filter.OrderDir))
		if dir != "DESC" {
			dir = "ASC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", safeOrder, dir)
	}

	if filter.Limit > 0 && filter.Limit <= 10000 {
		query += fmt.Sprintf(" LIMIT %d", filter.Limit)
	} else {
		query += " LIMIT 1000"
	}

	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", filter.Offset)
	}

	rows, err := driver.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	var resultRows [][]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		resultRows = append(resultRows, values)
	}

	return &QueryResult{
		Columns:  columns,
		Rows:     resultRows,
		RowCount: len(resultRows),
		Duration: "0s",
	}, nil
}

// S6-2: SQL语法检查 (实时)
type SQLValidationResult struct {
	Valid       bool     `json:"valid"`
	Errors      []string `json:"errors,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
}

func (a *App) ValidateSQLSyntax(sql string) *SQLValidationResult {
	result := &SQLValidationResult{Valid: true}

	if strings.TrimSpace(sql) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "SQL语句不能为空")
		return result
	}

	upperSQL := strings.ToUpper(strings.TrimSpace(sql))

	// Check for valid starting keyword
	validStarts := []string{"SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "WITH", "BEGIN", "COMMIT", "ROLLBACK", "USE", "SET", "EXPLAIN", "TRUNCATE", "GRANT", "REVOKE"}
	hasValidStart := false
	for _, kw := range validStarts {
		if strings.HasPrefix(upperSQL, kw) {
			hasValidStart = true
			break
		}
	}
	if !hasValidStart {
		result.Valid = false
		result.Errors = append(result.Errors, "SQL语句必须以有效关键字开头 (SELECT/INSERT/UPDATE/DELETE/CREATE等)")
	}

	// Check balanced parentheses
	parenCount := 0
	inSingleQuote := false
	inDoubleQuote := false
	for _, ch := range sql {
		if ch == '\'' && !inDoubleQuote {
			inSingleQuote = !inSingleQuote
		} else if ch == '"' && !inSingleQuote {
			inDoubleQuote = !inDoubleQuote
		} else if !inSingleQuote && !inDoubleQuote {
			if ch == '(' {
				parenCount++
			} else if ch == ')' {
				parenCount--
			}
		}
	}
	if parenCount != 0 {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("括号不匹配 (差 %d 个)", parenCount))
	}

	// Check balanced single quotes
	if inSingleQuote {
		result.Valid = false
		result.Errors = append(result.Errors, "单引号未闭合")
	}

	// Check balanced double quotes
	if inDoubleQuote {
		result.Valid = false
		result.Errors = append(result.Errors, "双引号未闭合")
	}

	// Warnings for dangerous operations
	if strings.Contains(upperSQL, "DROP TABLE") {
		result.Warnings = append(result.Warnings, "此操作将删除表，请谨慎执行")
	}
	if strings.Contains(upperSQL, "TRUNCATE") {
		result.Warnings = append(result.Warnings, "TRUNCATE将清空表数据，不可回滚")
	}
	if strings.Contains(upperSQL, "DELETE FROM") && !strings.Contains(upperSQL, "WHERE") {
		result.Warnings = append(result.Warnings, "DELETE语句没有WHERE条件，将删除所有数据")
	}
	if strings.Contains(upperSQL, "UPDATE") && !strings.Contains(upperSQL, "WHERE") {
		result.Warnings = append(result.Warnings, "UPDATE语句没有WHERE条件，将更新所有行")
	}

	// Check for missing semicolon (informational)
	if !strings.HasSuffix(strings.TrimSpace(sql), ";") {
		result.Warnings = append(result.Warnings, "SQL语句建议以分号结尾")
	}

	return result
}

// S6-3: 代码片段 (Snippet) 库
type Snippet struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	SQL      string `json:"sql"`
	Category string `json:"category"`
}

var defaultSnippets = []Snippet{
	{"select_all", "查询全表", "SELECT * FROM ${1:table_name};", "查询"},
	{"select_count", "统计行数", "SELECT COUNT(*) FROM ${1:table_name};", "查询"},
	{"select_distinct", "去重查询", "SELECT DISTINCT ${1:column} FROM ${2:table_name};", "查询"},
	{"select_order", "排序查询", "SELECT * FROM ${1:table_name} ORDER BY ${2:column} ${3:ASC|DESC};", "查询"},
	{"select_limit", "分页查询", "SELECT * FROM ${1:table_name} LIMIT ${2:10} OFFSET ${3:0};", "查询"},
	{"select_join", "内连接", "SELECT a.*, b.* FROM ${1:table_a} a INNER JOIN ${2:table_b} b ON a.${3:id} = b.${4:a_id};", "查询"},
	{"select_left_join", "左连接", "SELECT a.*, b.* FROM ${1:table_a} a LEFT JOIN ${2:table_b} b ON a.${3:id} = b.${4:a_id};", "查询"},
	{"select_group", "分组统计", "SELECT ${1:column}, COUNT(*) as count FROM ${2:table_name} GROUP BY ${1:column};", "查询"},
	{"select_having", "分组过滤", "SELECT ${1:column}, COUNT(*) as count FROM ${2:table_name} GROUP BY ${1:column} HAVING COUNT(*) > ${3:1};", "查询"},
	{"insert", "插入数据", "INSERT INTO ${1:table_name} (${2:column1}, ${3:column2}) VALUES (${4:value1}, ${5:value2});", "修改"},
	{"insert_select", "插入查询结果", "INSERT INTO ${1:target_table} SELECT * FROM ${2:source_table} WHERE ${3:condition};", "修改"},
	{"update", "更新数据", "UPDATE ${1:table_name} SET ${2:column} = ${3:value} WHERE ${4:condition};", "修改"},
	{"delete", "删除数据", "DELETE FROM ${1:table_name} WHERE ${2:condition};", "修改"},
	{"create_table", "创建表", "CREATE TABLE ${1:table_name} (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  ${2:column_name} VARCHAR(255) NOT NULL\n);", "DDL"},
	{"create_index", "创建索引", "CREATE INDEX ${1:index_name} ON ${2:table_name}(${3:column});", "DDL"},
	{"drop_table", "删除表", "DROP TABLE IF EXISTS ${1:table_name};", "DDL"},
	{"alter_add", "添加列", "ALTER TABLE ${1:table_name} ADD COLUMN ${2:column_name} ${3:VARCHAR(255)};", "DDL"},
	{"alter_drop", "删除列", "ALTER TABLE ${1:table_name} DROP COLUMN ${2:column_name};", "DDL"},
	{"create_view", "创建视图", "CREATE VIEW ${1:view_name} AS SELECT ${2:columns} FROM ${3:table_name} WHERE ${4:condition};", "DDL"},
	{"transaction", "事务", "BEGIN;\n  ${1:-- SQL statements here}\nCOMMIT;", "事务"},
}

func (a *App) GetSnippets() []Snippet {
	return defaultSnippets
}

func (a *App) GetSnippetsByCategory(category string) []Snippet {
	var result []Snippet
	for _, s := range defaultSnippets {
		if s.Category == category {
			result = append(result, s)
		}
	}
	return result
}

// S6-5: 慢查询分析 (MySQL slow_log)
type SlowQueryLog struct {
	Query      string  `json:"query"`
	Time       string  `json:"time"`
	LockTime   string  `json:"lock_time"`
	RowsSent   int     `json:"rows_sent"`
	RowsExamined int   `json:"rows_examined"`
	Database   string  `json:"database"`
}

func (a *App) GetMySQLSlowQueries(config Connection, limit int) ([]SlowQueryLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	dbConfig := a.connectionToDBConfig(config)
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	// Check if slow_log table exists and is enabled
	query := fmt.Sprintf(`
		SELECT sql_text, query_time, lock_time, rows_sent, rows_examined, db
		FROM mysql.slow_log
		ORDER BY query_time DESC
		LIMIT %d
	`, limit)

	rows, err := driver.Query(ctx, query)
	if err != nil {
		// Fallback: try performance_schema
		query = fmt.Sprintf(`
			SELECT DIGEST_TEXT as sql_text, AVG_TIMER_WAIT/1000000000 as query_time,
				0 as lock_time, SUM_ROWS_SENT as rows_sent, SUM_ROWS_EXAMINED as rows_examined,
				SCHEMA_NAME as db
			FROM performance_schema.events_statements_summary_by_digest
			WHERE SCHEMA_NAME IS NOT NULL
			ORDER BY AVG_TIMER_WAIT DESC
			LIMIT %d
		`, limit)
		rows, err = driver.Query(ctx, query)
		if err != nil {
			return []SlowQueryLog{}, nil
		}
	}
	defer rows.Close()

	var logs []SlowQueryLog
	for rows.Next() {
		var l SlowQueryLog
		var queryTime, lockTime interface{}
		if err := rows.Scan(&l.Query, &queryTime, &lockTime, &l.RowsSent, &l.RowsExamined, &l.Database); err != nil {
			continue
		}
		l.Time = fmt.Sprintf("%v", queryTime)
		l.LockTime = fmt.Sprintf("%v", lockTime)
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []SlowQueryLog{}
	}
	return logs, nil
}

// S6-8: 大文件SQL导入执行
func (a *App) ExecuteSQLFile(config Connection, database string, filePath string) (MultiQueryResult, error) {
	if filePath == "" {
		return MultiQueryResult{}, fmt.Errorf("file path is required")
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return MultiQueryResult{}, fmt.Errorf("failed to read file: %w", err)
	}
	content := string(data)

	// Execute as multi-query (returns MultiQueryResult directly, no error)
	result := a.ExecuteMultiQueryWithTimeout(config, database, content, QueryOptions{Timeout: 300})
	return result, nil
}

