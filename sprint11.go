package main

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"db-server/db"
)

// S11-1: 数据库级别全量对比
type DatabaseCompareResult struct {
	SourceDatabase string              `json:"source_database"`
	TargetDatabase string              `json:"target_database"`
	TableCount     int                 `json:"table_count"`
	TableResults   []TableCompareEntry `json:"table_results"`
	Summary        DatabaseCompareSummary `json:"summary"`
}

type TableCompareEntry struct {
	TableName     string `json:"table_name"`
	SourceExists  bool   `json:"source_exists"`
	TargetExists  bool   `json:"target_exists"`
	SourceRows    int64  `json:"source_rows"`
	TargetRows    int64  `json:"target_rows"`
	RowDifference int64  `json:"row_difference"`
	Status        string `json:"status"` // "match", "mismatch", "only_source", "only_target"
}

type DatabaseCompareSummary struct {
	TotalTables    int `json:"total_tables"`
	MatchedTables  int `json:"matched_tables"`
	MismatchedTables int `json:"mismatched_tables"`
	OnlyInSource   int `json:"only_in_source"`
	OnlyInTarget   int `json:"only_in_target"`
}

func (a *App) CompareDatabases(config Connection, sourceDB string, targetDB string) (*DatabaseCompareResult, error) {
	result := &DatabaseCompareResult{
		SourceDatabase: sourceDB,
		TargetDatabase: targetDB,
	}

	// Get tables from both databases
	sourceTables, err := a.GetTables(config, sourceDB)
	if err != nil {
		return nil, fmt.Errorf("failed to get source tables: %w", err)
	}
	targetTables, err := a.GetTables(config, targetDB)
	if err != nil {
		return nil, fmt.Errorf("failed to get target tables: %w", err)
	}

	sourceMap := make(map[string]bool)
	for _, t := range sourceTables {
		sourceMap[t.Name] = true
	}
	targetMap := make(map[string]bool)
	for _, t := range targetTables {
		targetMap[t.Name] = true
	}

	// Get all unique table names
	allTables := make(map[string]bool)
	for _, t := range sourceTables {
		allTables[t.Name] = true
	}
	for _, t := range targetTables {
		allTables[t.Name] = true
	}

	for tableName := range allTables {
		entry := TableCompareEntry{TableName: tableName}

		entry.SourceExists = sourceMap[tableName]
		entry.TargetExists = targetMap[tableName]

		if entry.SourceExists && entry.TargetExists {
			// Get row counts using fast stats
			srcStats, _ := a.GetTableStatsFast(config, sourceDB, tableName)
			tgtStats, _ := a.GetTableStatsFast(config, targetDB, tableName)
			entry.SourceRows = srcStats.RowCount
			entry.TargetRows = tgtStats.RowCount
			entry.RowDifference = entry.SourceRows - entry.TargetRows

			if entry.RowDifference == 0 {
				entry.Status = "match"
				result.Summary.MatchedTables++
			} else {
				entry.Status = "mismatch"
				result.Summary.MismatchedTables++
			}
		} else if entry.SourceExists {
			entry.Status = "only_source"
			result.Summary.OnlyInSource++
		} else {
			entry.Status = "only_target"
			result.Summary.OnlyInTarget++
		}

		result.TableResults = append(result.TableResults, entry)
		result.Summary.TotalTables++
	}

	result.TableCount = len(result.TableResults)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("数据库全量对比: %s vs %s (%d tables)", sourceDB, targetDB, result.TableCount),
		map[string]interface{}{"source": sourceDB, "target": targetDB, "tables": result.TableCount},
	)

	return result, nil
}

// S11-2: 对比结果同步
type SyncResult struct {
	TableName    string `json:"table_name"`
	Action       string `json:"action"` // "insert", "update", "delete"
	RowsAffected int64  `json:"rows_affected"`
	Success      bool   `json:"success"`
	Error        string `json:"error,omitempty"`
}

func (a *App) SyncCompareResult(config Connection, database string, compareResult *CompareResult, targetTable string, direction string) ([]SyncResult, error) {
	if compareResult == nil {
		return []SyncResult{}, fmt.Errorf("compare result is required")
	}

	direction = strings.ToUpper(strings.TrimSpace(direction))
	if direction != "SOURCE_TO_TARGET" && direction != "TARGET_TO_SOURCE" {
		direction = "SOURCE_TO_TARGET"
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return []SyncResult{}, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 120*time.Second)
	defer cancel()

	var results []SyncResult
	safeTarget := sanitizeIdentifier(targetTable)

	for _, diff := range compareResult.Differences {
		sync := SyncResult{TableName: targetTable}

		if direction == "SOURCE_TO_TARGET" {
			if fmt.Sprintf("%v", diff.TargetValue) == "missing" {
				sync.Action = "insert"
				// Would need full row data to insert — this is a simplified version
				sync.Success = false
				sync.Error = "full row data required for insert sync"
			} else if fmt.Sprintf("%v", diff.SourceValue) != fmt.Sprintf("%v", diff.TargetValue) {
				sync.Action = "update"
				// Build UPDATE for the differing column
				safeCol := sanitizeIdentifier(diff.ColumnName)
				var pkWhere []string
				var args []interface{}
				argIdx := 1
				for pkName, pkVal := range diff.RowKey {
					safePK := sanitizeIdentifier(pkName)
					if config.Type == "mysql" {
						pkWhere = append(pkWhere, fmt.Sprintf("`%s` = ?", safePK))
					} else {
						pkWhere = append(pkWhere, fmt.Sprintf("%s = $%d", safePK, argIdx))
						argIdx++
					}
					args = append(args, pkVal)
				}

				var setClause string
				if config.Type == "mysql" {
					setClause = fmt.Sprintf("`%s` = ?", safeCol)
				} else {
					setClause = fmt.Sprintf("%s = $%d", safeCol, argIdx)
					argIdx++
				}
				args = append(args, diff.SourceValue)

				query := fmt.Sprintf("UPDATE %s SET %s WHERE %s",
					safeTarget, setClause, strings.Join(pkWhere, " AND "))

				res, err := driver.Exec(ctx, query, args...)
				if err != nil {
					sync.Success = false
					sync.Error = err.Error()
				} else {
					sync.Success = true
					sync.RowsAffected, _ = res.RowsAffected()
				}
			}
		}

		if sync.Action != "" {
			results = append(results, sync)
		}
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("对比结果同步: %s → %s (%d ops)", database, targetTable, len(results)),
		map[string]interface{}{"table": targetTable, "direction": direction, "ops": len(results)},
	)

	if results == nil {
		results = []SyncResult{}
	}
	return results, nil
}

// S11-3: PERF-001 — 查询结果流式处理
func (a *App) ExecuteQueryStreaming(config Connection, database string, query string, batchSize int, callback func(rows [][]interface{}) bool) (int, error) {
	if batchSize <= 0 {
		batchSize = 1000
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return 0, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 300*time.Second)
	defer cancel()

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	_ = columns

	totalRows := 0
	var batch [][]interface{}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		batch = append(batch, values)
		totalRows++

		if len(batch) >= batchSize {
			if !callback(batch) {
				return totalRows, nil
			}
			batch = batch[:0]
		}
	}

	// Process remaining
	if len(batch) > 0 {
		callback(batch)
	}

	return totalRows, nil
}

// S11-4: PERF-004 — 懒加载（表结构缓存）
type TableStructureCache struct {
	cache    map[string][]db.ColumnInfo
	mu       sync.RWMutex
	maxAge   time.Duration
	loadedAt map[string]time.Time
}

var tableStructCache = &TableStructureCache{
	cache:    make(map[string][]db.ColumnInfo),
	loadedAt: make(map[string]time.Time),
	maxAge:   5 * time.Minute,
}

func (c *TableStructureCache) Get(key string) ([]db.ColumnInfo, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cols, exists := c.cache[key]
	if !exists {
		return nil, false
	}
	loadedAt := c.loadedAt[key]
	if time.Since(loadedAt) > c.maxAge {
		return nil, false
	}
	return cols, true
}

func (c *TableStructureCache) Set(key string, cols []db.ColumnInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = cols
	c.loadedAt[key] = time.Now()
}

func (c *TableStructureCache) Invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
	delete(c.loadedAt, key)
}

func (c *TableStructureCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string][]db.ColumnInfo)
	c.loadedAt = make(map[string]time.Time)
}

func (a *App) GetTableStructureCached(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	cacheKey := fmt.Sprintf("%s:%s:%s", config.Type, database, table)

	if cols, ok := tableStructCache.Get(cacheKey); ok {
		return cols, nil
	}

	// Cache miss — fetch from DB
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	cols, err := driver.GetTableStructure(ctx, table)
	if err != nil {
		return nil, fmt.Errorf("failed to get structure: %w", err)
	}

	tableStructCache.Set(cacheKey, cols)
	return cols, nil
}

func (a *App) InvalidateTableStructureCache(database string, table string) {
	cacheKey := fmt.Sprintf(":%s:%s", database, table)
	tableStructCache.Invalidate(cacheKey)
}

func (a *App) ClearTableStructureCache() {
	tableStructCache.Clear()
}
