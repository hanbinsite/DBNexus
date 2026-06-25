package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// S9-1: PostgreSQL EXPLAIN ANALYZE 安全警告
func (a *App) GetExplainPlanSafe(config Connection, database string, query string, analyze bool) (*QueryResult, error) {
	upperQuery := strings.ToUpper(strings.TrimSpace(query))

	// Warn if EXPLAIN ANALYZE on non-SELECT
	if analyze {
		if !strings.HasPrefix(upperQuery, "SELECT") {
			return nil, fmt.Errorf("EXPLAIN ANALYZE 仅建议用于 SELECT 语句，避免对 INSERT/UPDATE/DELETE 产生副作用")
		}
	}

	// Build EXPLAIN query
	var explainQuery string
	if analyze {
		switch config.Type {
		case "postgresql", "polardb", "gaussdb":
			explainQuery = "EXPLAIN (ANALYZE, FORMAT TEXT) " + query
		case "mysql":
			explainQuery = "EXPLAIN ANALYZE " + query
		default:
			return nil, fmt.Errorf("EXPLAIN ANALYZE not supported for %s", config.Type)
		}
	} else {
		explainQuery = "EXPLAIN " + query
	}

	// Use regular ExecuteQueryWithTimeout
	result := a.ExecuteQueryWithTimeout(config, database, explainQuery, QueryOptions{Timeout: 60})
	if result.Error != "" {
		return nil, fmt.Errorf("%s", result.Error)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("EXPLAIN%s: %s", map[bool]string{true: " ANALYZE", false: ""}[analyze], truncateQuery(query, 100)),
		map[string]interface{}{"analyze": analyze, "database": database},
	)

	return &result, nil
}

// S9-2: 任务失败通知
type TaskNotification struct {
	TaskID    string `json:"task_id"`
	TaskName  string `json:"task_name"`
	Type      string `json:"type"` // "success", "failure", "timeout"
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

var taskNotificationChan = make(chan TaskNotification, 50)

func emitTaskNotification(taskID string, taskName string, notifType string, message string) {
	notif := TaskNotification{
		TaskID:    taskID,
		TaskName:  taskName,
		Type:      notifType,
		Message:   message,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
	}
	select {
	case taskNotificationChan <- notif:
	default:
	}
}

func (a *App) GetTaskNotifications() []TaskNotification {
	var notifications []TaskNotification
	for {
		select {
		case notif := <-taskNotificationChan:
			notifications = append(notifications, notif)
		default:
			if notifications == nil {
				notifications = []TaskNotification{}
			}
			return notifications
		}
	}
}

// S9-3: 数据校验 (跨数据库迁移前后)
type ValidationResult struct {
	Valid         bool   `json:"valid"`
	SourceCount   int64  `json:"source_count"`
	TargetCount   int64  `json:"target_count"`
	MismatchCount int64  `json:"mismatch_count"`
	MissingCount  int64  `json:"missing_count"`
	ExtraCount    int64  `json:"extra_count"`
	Errors        []string `json:"errors,omitempty"`
}

func (a *App) ValidateDataMigration(config Connection, sourceDB string, sourceTable string, targetDB string, targetTable string) (*ValidationResult, error) {
	result := &ValidationResult{Valid: true}

	// Get source count
	sourceStats, err := a.GetTableStatsFast(config, sourceDB, sourceTable)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("source stats failed: %v", err))
		return result, nil
	}
	result.SourceCount = sourceStats.RowCount

	// Get target count
	targetStats, err := a.GetTableStatsFast(config, targetDB, targetTable)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("target stats failed: %v", err))
		return result, nil
	}
	result.TargetCount = targetStats.RowCount

	// Compare counts
	if result.SourceCount != result.TargetCount {
		result.Valid = false
		diff := result.SourceCount - result.TargetCount
		if diff > 0 {
			result.MissingCount = diff
			result.Errors = append(result.Errors, fmt.Sprintf("目标表缺少 %d 行数据", diff))
		} else {
			result.ExtraCount = -diff
			result.Errors = append(result.Errors, fmt.Sprintf("目标表多出 %d 行数据", -diff))
		}
	}

	// Compare structures
	structDiff, err := a.CompareTableStructures(config, sourceDB, sourceTable, targetTable)
	if err == nil && structDiff != nil {
		if len(structDiff.OnlyIn1) > 0 {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("目标表缺少列: %v", structDiff.OnlyIn1))
		}
		if len(structDiff.OnlyIn2) > 0 {
			result.Errors = append(result.Errors, fmt.Sprintf("目标表多出列: %v", structDiff.OnlyIn2))
		}
		if len(structDiff.TypeMismatches) > 0 {
			result.Valid = false
			for _, tm := range structDiff.TypeMismatches {
				result.Errors = append(result.Errors, fmt.Sprintf("列 %s 类型不匹配: %s vs %s", tm.Column, tm.Type1, tm.Type2))
			}
		}
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("数据校验: %s.%s -> %s.%s (valid=%v)", sourceDB, sourceTable, targetDB, targetTable, result.Valid),
		map[string]interface{}{"source": sourceTable, "target": targetTable, "valid": result.Valid},
	)

	return result, nil
}

// S9-4: 导出进度回调
type ExportProgress struct {
	TotalRows    int    `json:"total_rows"`
	ExportedRows int    `json:"exported_rows"`
	Percentage   int    `json:"percentage"`
	Status       string `json:"status"` // "running", "completed", "failed"
	Message      string `json:"message,omitempty"`
}

var exportProgressChan = make(chan ExportProgress, 10)

func emitExportProgress(total int, exported int, status string, message string) {
	pct := 0
	if total > 0 {
		pct = exported * 100 / total
	}
	prog := ExportProgress{
		TotalRows:    total,
		ExportedRows: exported,
		Percentage:   pct,
		Status:       status,
		Message:      message,
	}
	select {
	case exportProgressChan <- prog:
	default:
	}
}

func (a *App) GetExportProgress() []ExportProgress {
	var progress []ExportProgress
	for {
		select {
		case prog := <-exportProgressChan:
			progress = append(progress, prog)
		default:
			if progress == nil {
				progress = []ExportProgress{}
			}
			return progress
		}
	}
}

// S9-5: 智能提示 (上下文相关)
type SmartSuggestion struct {
	Type        string `json:"type"` // "table", "column", "function", "keyword", "snippet"
	Label       string `json:"label"`
	InsertText  string `json:"insert_text"`
	Detail      string `json:"detail,omitempty"`
	Documentation string `json:"documentation,omitempty"`
}

func (a *App) GetSmartSuggestions(config Connection, database string, query string, cursorPos int) ([]SmartSuggestion, error) {
	if query == "" {
		return getDefaultSmartSuggestions(), nil
	}

	// Analyze context around cursor
	beforeCursor := query[:cursorPos]
	upperBefore := strings.ToUpper(beforeCursor)

	var suggestions []SmartSuggestion

	// After FROM — suggest tables
	if strings.Contains(upperBefore, "FROM") && !strings.Contains(upperBefore, "WHERE") {
		tables, err := a.GetTables(config, database)
		if err == nil {
			for _, table := range tables {
				suggestions = append(suggestions, SmartSuggestion{
					Type:       "table",
					Label:      table.Name,
					InsertText: table.Name,
					Detail:     "表",
				})
			}
		}
		return suggestions, nil
	}

	// After SELECT — suggest columns or *
	if strings.HasPrefix(upperBefore, "SELECT") && !strings.Contains(upperBefore, "FROM") {
		suggestions = append(suggestions, SmartSuggestion{
			Type:       "keyword",
			Label:      "*",
			InsertText: "*",
			Detail:     "所有列",
		})
		return suggestions, nil
	}

	// After JOIN — suggest tables
	if strings.Contains(upperBefore, "JOIN") {
		tables, err := a.GetTables(config, database)
		if err == nil {
			for _, table := range tables {
				suggestions = append(suggestions, SmartSuggestion{
					Type:       "table",
					Label:      table.Name,
					InsertText: table.Name,
					Detail:     "表 (JOIN)",
				})
			}
		}
		return suggestions, nil
	}

	// After WHERE/AND/OR — suggest columns
	if strings.Contains(upperBefore, "WHERE") || strings.Contains(upperBefore, "AND") || strings.Contains(upperBefore, "OR") {
		// Try to extract table name from query
		fromIdx := strings.Index(upperBefore, "FROM")
		if fromIdx >= 0 {
			afterFrom := strings.TrimSpace(beforeCursor[fromIdx+4:])
			// Simple extraction — first word after FROM
			parts := strings.Fields(afterFrom)
			if len(parts) > 0 {
				tableName := strings.Trim(parts[0], "`\"'")
				ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
				defer cancel()

				dbConfig := a.connectionToDBConfig(config)
				dbConfig.Database = database
				driver, err := a.getDriverForConfig(dbConfig)
				if err == nil {
					cols, err := driver.GetTableStructure(ctx, tableName)
					if err == nil {
						for _, col := range cols {
							suggestions = append(suggestions, SmartSuggestion{
								Type:       "column",
								Label:      col.Name,
								InsertText: col.Name,
								Detail:     fmt.Sprintf("%s (%s)", col.Type, tableName),
							})
						}
					}
				}
			}
		}
		return suggestions, nil
	}

	// Default — keywords + snippets
	return getDefaultSmartSuggestions(), nil
}

func getDefaultSmartSuggestions() []SmartSuggestion {
	return []SmartSuggestion{
		{Type: "keyword", Label: "SELECT", InsertText: "SELECT ", Detail: "查询"},
		{Type: "keyword", Label: "INSERT", InsertText: "INSERT INTO ", Detail: "插入"},
		{Type: "keyword", Label: "UPDATE", InsertText: "UPDATE ", Detail: "更新"},
		{Type: "keyword", Label: "DELETE", InsertText: "DELETE FROM ", Detail: "删除"},
		{Type: "snippet", Label: "SELECT *", InsertText: "SELECT * FROM ${1:table};", Detail: "查询全表"},
		{Type: "snippet", Label: "COUNT", InsertText: "SELECT COUNT(*) FROM ${1:table};", Detail: "统计行数"},
		{Type: "snippet", Label: "JOIN", InsertText: "SELECT a.* FROM ${1:table_a} a JOIN ${2:table_b} b ON a.${3:id} = b.${4:a_id};", Detail: "内连接"},
	}
}

// S9-6: 流式对比 (大数据量)
func (a *App) CompareTablesStreaming(config Connection, database string, table1 string, table2 string, keyColumn string, batchSize int) (*CompareResult, error) {
	if batchSize <= 0 {
		batchSize = 1000
	}

	result := &CompareResult{
		Success:     true,
		Message:     fmt.Sprintf("流式对比: %s vs %s", table1, table2),
		Differences: []DifferenceItem{},
	}

	offset := 0
	totalMatched := int64(0)
	totalDiff := int64(0)

	for {
		safeTable1 := sanitizeIdentifier(table1)
		safeKey := sanitizeIdentifier(keyColumn)

		query := fmt.Sprintf("SELECT * FROM %s ORDER BY %s LIMIT %d OFFSET %d",
			safeTable1, safeKey, batchSize, offset)

		sourceResult := a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{Timeout: 30})
		if sourceResult.Error != "" {
			break
		}
		if len(sourceResult.Rows) == 0 {
			break
		}

		for _, srcRow := range sourceResult.Rows {
			keyIdx := -1
			for i, col := range sourceResult.Columns {
				if col == keyColumn {
					keyIdx = i
					break
				}
			}
			if keyIdx < 0 {
				continue
			}

			keyVal := srcRow[keyIdx]
			safeTable2 := sanitizeIdentifier(table2)

			targetQuery := fmt.Sprintf("SELECT * FROM %s WHERE %s = ? LIMIT 1",
				safeTable2, safeKey)

			if config.Type != "mysql" {
				targetQuery = fmt.Sprintf("SELECT * FROM %s WHERE %s = $1 LIMIT 1",
					safeTable2, safeKey)
			}

			targetResult := a.ExecuteQueryWithTimeout(config, database, targetQuery, QueryOptions{Timeout: 10})
			if targetResult.Error != "" || len(targetResult.Rows) == 0 {
				totalDiff++
				result.Differences = append(result.Differences, DifferenceItem{
					RowKey:      map[string]interface{}{keyColumn: keyVal},
					ColumnName:  "__row__",
					SourceValue: "exists",
					TargetValue: "missing",
				})
			} else {
				totalMatched++
			}
		}

		offset += batchSize
	}

	totalRows := totalMatched + totalDiff
	matchPct := float64(0)
	if totalRows > 0 {
		matchPct = float64(totalMatched) * 100 / float64(totalRows)
	}
	result.Summary = &CompareSummary{
		SourceRowCount:       totalMatched,
		TargetRowCount:       totalMatched,
		MatchPercentage:      matchPct,
		DifferenceCount:      int(totalDiff),
		MissingInSourceCount: 0,
		MissingInTargetCount: int(totalDiff),
	}
	result.IdenticalRows = totalMatched
	result.DifferentRows = totalDiff

	return result, nil
}
