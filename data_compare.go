package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// CompareType 对比类型
type CompareType string

const (
	CompareTypeTable    CompareType = "table"
	CompareTypeQuery    CompareType = "query"
	CompareTypeDatabase CompareType = "database"
)

// CompareMode 对比模式
type CompareMode string

const (
	CompareModeStructure CompareMode = "structure"
	CompareModeData      CompareMode = "data"
	CompareModeAll       CompareMode = "all"
)

// CompareRequest 对比请求
type CompareRequest struct {
	Type           CompareType `json:"type"`
	Mode           CompareMode `json:"mode"`
	SourceDB       string      `json:"sourceDB"`
	TargetDB       string      `json:"targetDB"`
	SourceTable    string      `json:"sourceTable,omitempty"`
	TargetTable    string      `json:"targetTable,omitempty"`
	SourceQuery    string      `json:"sourceQuery,omitempty"`
	TargetQuery    string      `json:"targetQuery,omitempty"`
	KeyColumns     []string    `json:"keyColumns,omitempty"`
	CompareColumns []string    `json:"compareColumns,omitempty"`
}

// CompareResult 对比结果
type CompareResult struct {
	Success         bool                     `json:"success"`
	Message         string                   `json:"message"`
	Summary         *CompareSummary          `json:"summary,omitempty"`
	Differences     []DifferenceItem         `json:"differences,omitempty"`
	MissingInSource []map[string]interface{} `json:"missingInSource,omitempty"`
	MissingInTarget []map[string]interface{} `json:"missingInTarget,omitempty"`
	IdenticalRows   int64                    `json:"identicalRows"`
	DifferentRows   int64                    `json:"differentRows"`
	Error           string                   `json:"error,omitempty"`
}

// CompareSummary 对比摘要
type CompareSummary struct {
	SourceRowCount       int64   `json:"sourceRowCount"`
	TargetRowCount       int64   `json:"targetRowCount"`
	MatchPercentage      float64 `json:"matchPercentage"`
	DifferenceCount      int     `json:"differenceCount"`
	MissingInSourceCount int     `json:"missingInSourceCount"`
	MissingInTargetCount int     `json:"missingInTargetCount"`
}

// DifferenceItem 差异项
type DifferenceItem struct {
	RowKey      map[string]interface{} `json:"rowKey"`
	ColumnName  string                 `json:"columnName"`
	SourceValue interface{}            `json:"sourceValue"`
	TargetValue interface{}            `json:"targetValue"`
}

// CompareTables 对比两个表
func (a *App) CompareTables(config Connection, req CompareRequest) CompareResult {
	auditLogger := GetAuditLogger()

	// 验证请求
	if req.SourceTable == "" || req.TargetTable == "" {
		return CompareResult{
			Success: false,
			Message: "必须指定源表和目标表",
			Error:   "缺少表名",
		}
	}

	if len(req.KeyColumns) == 0 {
		return CompareResult{
			Success: false,
			Message: "必须指定对比的键列",
			Error:   "缺少键列",
		}
	}

	// 获取源表数据
	sourceQuery := buildCompareQuery(req.SourceTable, req.KeyColumns, req.CompareColumns)
	sourceResult := a.ExecuteQuery(config, req.SourceDB, sourceQuery)
	if sourceResult.Error != "" {
		return CompareResult{
			Success: false,
			Message: "查询源表失败",
			Error:   sourceResult.Error,
		}
	}

	// 获取目标表数据
	targetResult := a.ExecuteQuery(config, req.TargetDB, sourceQuery)
	if targetResult.Error != "" {
		return CompareResult{
			Success: false,
			Message: "查询目标表失败",
			Error:   targetResult.Error,
		}
	}

	// 对比数据
	result := a.performComparison(sourceResult, targetResult, req)

	// 记录审计日志
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("数据对比: %s.%s vs %s.%s", req.SourceDB, req.SourceTable, req.TargetDB, req.TargetTable),
		map[string]interface{}{
			"type":             string(req.Type),
			"mode":             string(req.Mode),
			"source_table":     req.SourceTable,
			"target_table":     req.TargetTable,
			"difference_count": len(result.Differences),
		})

	return result
}

// buildCompareQuery 构建对比查询
func buildCompareQuery(table string, keyColumns, compareColumns []string) string {
	safeTable := sanitizeIdentifier(table)

	var selectColumns []string
	selectColumns = append(selectColumns, keyColumns...)

	if len(compareColumns) > 0 {
		selectColumns = append(selectColumns, compareColumns...)
	} else {
		selectColumns = append(selectColumns, "*")
	}

	return fmt.Sprintf("SELECT %s FROM `%s`", strings.Join(selectColumns, ", "), safeTable)
}

// performComparison 执行对比
func (a *App) performComparison(sourceResult, targetResult QueryResult, req CompareRequest) CompareResult {
	result := CompareResult{
		Success:         true,
		Differences:     []DifferenceItem{},
		MissingInSource: []map[string]interface{}{},
		MissingInTarget: []map[string]interface{}{},
	}

	// 构建数据映射
	sourceMap := buildDataMap(sourceResult, req.KeyColumns)
	targetMap := buildDataMap(targetResult, req.KeyColumns)

	// 查找差异
	for key, sourceRow := range sourceMap {
		targetRow, exists := targetMap[key]
		if !exists {
			// 在目标中不存在
			result.MissingInTarget = append(result.MissingInTarget, sourceRow)
			continue
		}

		// 对比每列
		diffFound := false
		for _, col := range sourceResult.Columns {
			// 跳过键列
			if sliceContains(req.KeyColumns, col) {
				continue
			}

			sourceVal := sourceRow[col]
			targetVal := targetRow[col]

			if !compareValues(sourceVal, targetVal) {
				result.Differences = append(result.Differences, DifferenceItem{
					RowKey:      extractKeyValues(sourceRow, sourceResult.Columns, req.KeyColumns),
					ColumnName:  col,
					SourceValue: sourceVal,
					TargetValue: targetVal,
				})
				diffFound = true
			}
		}

		if diffFound {
			result.DifferentRows++
		} else {
			result.IdenticalRows++
		}
	}

	// 查找在源中不存在的行
	for key, targetRow := range targetMap {
		if _, exists := sourceMap[key]; !exists {
			result.MissingInSource = append(result.MissingInSource, targetRow)
		}
	}

	// 计算摘要
	result.Summary = &CompareSummary{
		SourceRowCount:       int64(len(sourceMap)),
		TargetRowCount:       int64(len(targetMap)),
		DifferenceCount:      len(result.Differences),
		MissingInSourceCount: len(result.MissingInSource),
		MissingInTargetCount: len(result.MissingInTarget),
	}

	// 计算匹配百分比
	if result.Summary.SourceRowCount > 0 {
		result.Summary.MatchPercentage = float64(result.IdenticalRows) / float64(result.Summary.SourceRowCount) * 100
	}

	result.Message = fmt.Sprintf("对比完成：匹配 %d 行，差异 %d 行，源表缺少 %d 行，目标表缺少 %d 行",
		result.IdenticalRows, result.DifferentRows, len(result.MissingInSource), len(result.MissingInTarget))

	return result
}

// buildDataMap 构建数据映射
func buildDataMap(result QueryResult, keyColumns []string) map[string]map[string]interface{} {
	dataMap := make(map[string]map[string]interface{})

	// 找到键列的索引
	keyIndexes := make([]int, len(keyColumns))
	foundAll := true
	for i, keyCol := range keyColumns {
		found := false
		for colIdx, col := range result.Columns {
			if col == keyCol {
				keyIndexes[i] = colIdx
				found = true
				break
			}
		}
		if !found {
			foundAll = false
			break
		}
	}

	// 如果未找到所有键列，直接返回空映射
	if !foundAll {
		return dataMap
	}

	for _, row := range result.Rows {
		// 构建键
		var keyParts []string
		for _, keyIdx := range keyIndexes {
			keyParts = append(keyParts, fmt.Sprintf("%v", row[keyIdx]))
		}
		key := strings.Join(keyParts, "|")

		// 存储行数据
		dataMap[key] = make(map[string]interface{})
		for i, val := range row {
			dataMap[key][result.Columns[i]] = val
		}
	}

	return dataMap
}

// compareValues 对比值
func compareValues(val1, val2 interface{}) bool {
	// 处理 NULL
	if val1 == nil && val2 == nil {
		return true
	}
	if val1 == nil || val2 == nil {
		return false
	}

	// 转换为字符串比较
	return fmt.Sprintf("%v", val1) == fmt.Sprintf("%v", val2)
}

// extractKeyValues 提取键值
func extractKeyValues(row map[string]interface{}, columns []string, keyColumns []string) map[string]interface{} {
	keyValues := make(map[string]interface{})
	for _, keyCol := range keyColumns {
		if val, exists := row[keyCol]; exists {
			keyValues[keyCol] = val
		}
	}
	return keyValues
}

// sliceContains checks if a string exists in a slice
func sliceContains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}
	return false
}

// CompareQueries 对比两个查询结果
func (a *App) CompareQueries(config Connection, req CompareRequest) CompareResult {
	if req.SourceQuery == "" || req.TargetQuery == "" {
		return CompareResult{
			Success: false,
			Message: "必须指定源查询和目标查询",
			Error:   "缺少查询",
		}
	}

	// 执行查询
	sourceResult := a.ExecuteQuery(config, req.SourceDB, req.SourceQuery)
	if sourceResult.Error != "" {
		return CompareResult{
			Success: false,
			Message: "执行源查询失败",
			Error:   sourceResult.Error,
		}
	}

	targetResult := a.ExecuteQuery(config, req.TargetDB, req.TargetQuery)
	if targetResult.Error != "" {
		return CompareResult{
			Success: false,
			Message: "执行目标查询失败",
			Error:   targetResult.Error,
		}
	}

	// 自动检测键列（使用第一列）
	if len(req.KeyColumns) == 0 && len(sourceResult.Columns) > 0 {
		req.KeyColumns = []string{sourceResult.Columns[0]}
	}

	// 对比数据
	return a.performComparison(sourceResult, targetResult, req)
}

// GetCompareReport 生成对比报告
func (a *App) GetCompareReport(result CompareResult) string {
	var report strings.Builder

	report.WriteString("=== 数据对比报告 ===\n\n")

	if result.Summary != nil {
		report.WriteString(fmt.Sprintf("源表行数: %d\n", result.Summary.SourceRowCount))
		report.WriteString(fmt.Sprintf("目标表行数: %d\n", result.Summary.TargetRowCount))
		report.WriteString(fmt.Sprintf("匹配百分比: %.2f%%\n", result.Summary.MatchPercentage))
		report.WriteString(fmt.Sprintf("差异数量: %d\n", result.Summary.DifferenceCount))
		report.WriteString(fmt.Sprintf("源表缺少: %d 行\n", result.Summary.MissingInSourceCount))
		report.WriteString(fmt.Sprintf("目标表缺少: %d 行\n\n", result.Summary.MissingInTargetCount))
	}

	if len(result.Differences) > 0 {
		report.WriteString("--- 差异详情 ---\n")
		for i, diff := range result.Differences {
			report.WriteString(fmt.Sprintf("%d. 键: %v, 列: %s\n", i+1, diff.RowKey, diff.ColumnName))
			report.WriteString(fmt.Sprintf("   源值: %v\n", diff.SourceValue))
			report.WriteString(fmt.Sprintf("   目标值: %v\n\n", diff.TargetValue))
		}
	}

	return report.String()
}

// ExportCompareResult 导出对比结果
func (a *App) ExportCompareResult(result CompareResult, format string) ([]byte, error) {
	switch format {
	case "json":
		return a.exportCompareToJSON(result)
	case "csv":
		return a.exportCompareToCSV(result)
	case "txt":
		return []byte(a.GetCompareReport(result)), nil
	default:
		return nil, fmt.Errorf("不支持的格式: %s", format)
	}
}

// exportCompareToJSON 导出对比结果为 JSON
func (a *App) exportCompareToJSON(result CompareResult) ([]byte, error) {
	return json.MarshalIndent(result, "", "  ")
}

// exportCompareToCSV 导出对比结果为 CSV
func (a *App) exportCompareToCSV(result CompareResult) ([]byte, error) {
	var csv strings.Builder

	// 写入差异
	csv.WriteString("RowKey,ColumnName,SourceValue,TargetValue\n")
	for _, diff := range result.Differences {
		csv.WriteString(fmt.Sprintf("%v,%s,%v,%v\n",
			diff.RowKey, diff.ColumnName, diff.SourceValue, diff.TargetValue))
	}

	return []byte(csv.String()), nil
}
