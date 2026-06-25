package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// S10-1: 查询性能历史追踪
type QueryPerformanceRecord struct {
	ID         int64   `json:"id"`
	Query      string  `json:"query"`
	Database   string  `json:"database"`
	Duration   float64 `json:"duration_ms"`
	Rows       int     `json:"rows"`
	Success    bool    `json:"success"`
	Timestamp  string  `json:"timestamp"`
}

var (
	perfHistoryMu     sync.RWMutex
	perfHistory       []QueryPerformanceRecord
	perfHistoryLoaded bool
)

func getPerfHistoryPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".db-client", "query_history.json")
}

func loadPerfHistory() {
	perfHistoryMu.Lock()
	defer perfHistoryMu.Unlock()
	if perfHistoryLoaded {
		return
	}
	perfHistoryLoaded = true
	data, err := os.ReadFile(getPerfHistoryPath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &perfHistory)
}

func savePerfHistory() error {
	perfHistoryMu.RLock()
	// Keep only last 1000 records
	if len(perfHistory) > 1000 {
		perfHistory = perfHistory[len(perfHistory)-1000:]
	}
	data, err := json.Marshal(perfHistory)
	perfHistoryMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getPerfHistoryPath())
	os.MkdirAll(dir, 0700)
	return os.WriteFile(getPerfHistoryPath(), data, 0600)
}

func recordQueryPerformance(query string, database string, durationMs float64, rows int, success bool) {
	loadPerfHistory()
	perfHistoryMu.Lock()
	defer perfHistoryMu.Unlock()

	record := QueryPerformanceRecord{
		ID:        time.Now().UnixNano(),
		Query:     truncateQuery(query, 500),
		Database:  database,
		Duration:  durationMs,
		Rows:      rows,
		Success:   success,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
	}
	perfHistory = append(perfHistory, record)
	savePerfHistory()
}

func (a *App) GetQueryPerformanceHistory(limit int) ([]QueryPerformanceRecord, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	loadPerfHistory()
	perfHistoryMu.RLock()
	defer perfHistoryMu.RUnlock()

	// Return most recent records
	start := len(perfHistory) - limit
	if start < 0 {
		start = 0
	}
	result := make([]QueryPerformanceRecord, len(perfHistory)-start)
	copy(result, perfHistory[start:])
	// Reverse to show newest first
	sort.Slice(result, func(i, j int) bool {
		return result[i].Timestamp > result[j].Timestamp
	})
	return result, nil
}

func (a *App) GetSlowQueryHistory(thresholdMs float64) ([]QueryPerformanceRecord, error) {
	if thresholdMs <= 0 {
		thresholdMs = 1000 // default 1 second
	}

	loadPerfHistory()
	perfHistoryMu.RLock()
	defer perfHistoryMu.RUnlock()

	var result []QueryPerformanceRecord
	for _, r := range perfHistory {
		if r.Duration >= thresholdMs {
			result = append(result, r)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Duration > result[j].Duration
	})
	if result == nil {
		result = []QueryPerformanceRecord{}
	}
	return result, nil
}

func (a *App) ClearQueryPerformanceHistory() error {
	perfHistoryMu.Lock()
	defer perfHistoryMu.Unlock()
	perfHistory = nil
	return savePerfHistory()
}

// S10-2: 多表JOIN列补全
type JoinSuggestion struct {
	Table1     string   `json:"table_1"`
	Table2     string   `json:"table_2"`
	JoinColumns []string `json:"join_columns"` // columns that can be used for JOIN
	FKInfo     []ForeignKeyInfo `json:"fk_info,omitempty"`
}

func (a *App) GetJoinSuggestions(config Connection, database string, table1 string, table2 string) ([]JoinSuggestion, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return []JoinSuggestion{}, nil
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	var suggestions []JoinSuggestion

	// Check foreign keys from table1 to table2
	fks1, err := a.GetTableForeignKeys(config, database, table1)
	if err == nil {
		for _, fk := range fks1 {
			if fk.RefTable == table2 {
				suggestions = append(suggestions, JoinSuggestion{
					Table1:      table1,
					Table2:      table2,
					JoinColumns: []string{fk.ColumnName + " = " + fk.RefColumn},
					FKInfo:      []ForeignKeyInfo{fk},
				})
			}
		}
	}

	// Check foreign keys from table2 to table1
	fks2, err := a.GetTableForeignKeys(config, database, table2)
	if err == nil {
		for _, fk := range fks2 {
			if fk.RefTable == table1 {
				suggestions = append(suggestions, JoinSuggestion{
					Table1:      table1,
					Table2:      table2,
					JoinColumns: []string{fk.RefColumn + " = " + fk.ColumnName},
					FKInfo:      []ForeignKeyInfo{fk},
				})
			}
		}
	}

	// Check for matching column names
	cols1, err1 := driver.GetTableStructure(ctx, table1)
	cols2, err2 := driver.GetTableStructure(ctx, table2)
	if err1 == nil && err2 == nil {
		for _, c1 := range cols1 {
			for _, c2 := range cols2 {
				if c1.Name == c2.Name && c1.PrimaryKey {
					suggestions = append(suggestions, JoinSuggestion{
						Table1:      table1,
						Table2:      table2,
						JoinColumns: []string{c1.Name + " = " + c2.Name},
					})
				}
				// Also check common naming patterns (table1_id, etc.)
				if c1.Name == table2+"_id" || c1.Name == table2+"ID" {
					suggestions = append(suggestions, JoinSuggestion{
						Table1:      table1,
						Table2:      table2,
						JoinColumns: []string{c1.Name + " = " + c2.Name},
					})
				}
			}
		}
	}

	if suggestions == nil {
		suggestions = []JoinSuggestion{}
	}
	return suggestions, nil
}

// S10-3: 参数化查询支持
type ParameterizedQuery struct {
	Query      string                 `json:"query"`
	Parameters map[string]interface{} `json:"parameters"`
}

func (a *App) ExecuteParameterizedQuery(config Connection, database string, query string, params map[string]interface{}) (*QueryResult, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	// Replace :param_name with ? (MySQL) or $N (PG)
	argIdx := 1
	var args []interface{}
	processedQuery := query

	for paramName, paramValue := range params {
		placeholder := ":" + paramName
		var replacement string
		if config.Type == "mysql" {
			replacement = "?"
		} else {
			replacement = fmt.Sprintf("$%d", argIdx)
		}
		processedQuery = stringReplace(processedQuery, placeholder, replacement)
		args = append(args, paramValue)
		argIdx++
	}

	rows, err := driver.Query(ctx, processedQuery, args...)
	if err != nil {
		return &QueryResult{Error: fmt.Sprintf("查询失败: %v", err)}, nil
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

	result := &QueryResult{
		Columns:  columns,
		Rows:     resultRows,
		RowCount: len(resultRows),
		Duration: "0s",
	}

	recordQueryPerformance(query, database, 0, result.RowCount, true)
	return result, nil
}

func stringReplace(s, old, new string) string {
	result := ""
	for {
		idx := indexOf(s, old)
		if idx < 0 {
			result += s
			break
		}
		result += s[:idx] + new
		s = s[idx+len(old):]
	}
	return result
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// S10-4: 行级锁编辑
func (a *App) EditWithRowLock(config Connection, database string, table string, primaryKey map[string]interface{}, data map[string]interface{}, lockType string) (EditResult, error) {
	if lockType == "" {
		lockType = "EXCLUSIVE"
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return EditResult{Success: false, Error: "connection failed"}, nil
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(table)

	// Lock the row (SELECT ... FOR UPDATE)
	var lockQuery string
	var whereArgs []interface{}
	var whereParts []string
	argIdx := 1

	for pkName, pkVal := range primaryKey {
		safeCol := sanitizeIdentifier(pkName)
		if config.Type == "mysql" {
			whereParts = append(whereParts, fmt.Sprintf("`%s` = ?", safeCol))
		} else {
			whereParts = append(whereParts, fmt.Sprintf("%s = $%d", safeCol, argIdx))
			argIdx++
		}
		whereArgs = append(whereArgs, pkVal)
	}

	lockSuffix := " FOR UPDATE"
	if strings.ToUpper(lockType) == "SHARE" {
		lockSuffix = " FOR SHARE"
	}

	lockQuery = fmt.Sprintf("SELECT * FROM %s WHERE %s LIMIT 1%s",
		safeTable, joinStringsGeneric(whereParts, " AND "), lockSuffix)

	_, err = driver.Query(ctx, lockQuery, whereArgs...)
	if err != nil {
		return EditResult{Success: false, Error: fmt.Sprintf("row lock failed: %v", err)}, nil
	}

	// Now perform the update
	var setParts []string
	var setArgs []interface{}
	for colName, colVal := range data {
		safeCol := sanitizeIdentifier(colName)
		if config.Type == "mysql" {
			setParts = append(setParts, fmt.Sprintf("`%s` = ?", safeCol))
		} else {
			setParts = append(setParts, fmt.Sprintf("%s = $%d", safeCol, argIdx))
			argIdx++
		}
		setArgs = append(setArgs, colVal)
	}

	allArgs := append(setArgs, whereArgs...)
	updateQuery := fmt.Sprintf("UPDATE %s SET %s WHERE %s",
		safeTable, joinStringsGeneric(setParts, ", "), joinStringsGeneric(whereParts, " AND "))

	result, err := driver.Exec(ctx, updateQuery, allArgs...)
	if err != nil {
		return EditResult{Success: false, Error: fmt.Sprintf("update failed: %v", err)}, nil
	}

	rowsAffected, _ := result.RowsAffected()
	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("行级锁编辑: %s.%s (lock=%s, rows=%d)", database, table, lockType, rowsAffected),
		map[string]interface{}{"table": table, "lock": lockType, "rows": rowsAffected},
	)

	return EditResult{Success: true, RowsAffected: rowsAffected}, nil
}

func joinStringsGeneric(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}

// S10-5: 编辑冲突检测
type ConflictCheckResult struct {
	HasConflict    bool   `json:"has_conflict"`
	CurrentHash    string `json:"current_hash,omitempty"`
	ExpectedHash   string `json:"expected_hash,omitempty"`
	LastModified   string `json:"last_modified,omitempty"`
	Message        string `json:"message,omitempty"`
}

func (a *App) CheckEditConflict(config Connection, database string, table string, primaryKey map[string]interface{}, expectedHash string) (*ConflictCheckResult, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return &ConflictCheckResult{HasConflict: true, Message: "connection failed"}, nil
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(table)
	var whereParts []string
	var args []interface{}
	argIdx := 1

	for pkName, pkVal := range primaryKey {
		safeCol := sanitizeIdentifier(pkName)
		if config.Type == "mysql" {
			whereParts = append(whereParts, fmt.Sprintf("`%s` = ?", safeCol))
		} else {
			whereParts = append(whereParts, fmt.Sprintf("%s = $%d", safeCol, argIdx))
			argIdx++
		}
		args = append(args, pkVal)
	}

	query := fmt.Sprintf("SELECT * FROM %s WHERE %s LIMIT 1",
		safeTable, joinStringsGeneric(whereParts, " AND "))

	rows, err := driver.Query(ctx, query, args...)
	if err != nil {
		return &ConflictCheckResult{HasConflict: true, Message: fmt.Sprintf("query failed: %v", err)}, nil
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	if !rows.Next() {
		return &ConflictCheckResult{HasConflict: true, Message: "行不存在（可能已被删除）"}, nil
	}

	values := make([]interface{}, len(columns))
	ptrs := make([]interface{}, len(columns))
	for i := range values {
		ptrs[i] = &values[i]
	}
	rows.Scan(ptrs...)

	// Compute hash of current row data
	currentHash := hashRowData(columns, values)

	result := &ConflictCheckResult{
		CurrentHash:  currentHash,
		ExpectedHash: expectedHash,
	}

	if expectedHash != "" && currentHash != expectedHash {
		result.HasConflict = true
		result.Message = "行数据已被其他用户修改，请刷新后重试"
	} else {
		result.HasConflict = false
	}

	return result, nil
}

func hashRowData(columns []string, values []interface{}) string {
	var data string
	for i, col := range columns {
		data += col + "=" + fmt.Sprintf("%v", values[i]) + "|"
	}
	return fmt.Sprintf("%x", simpleHash(data))
}

func simpleHash(s string) uint64 {
	var h uint64 = 14695981039346656037
	for _, c := range s {
		h ^= uint64(c)
		h *= 1099511628211
	}
	return h
}
