package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ExplainType EXPLAIN 类型
type ExplainType string

const (
	ExplainTypeRows     ExplainType = "rows"
	ExplainTypeCost     ExplainType = "cost"
	ExplainTypeTime     ExplainType = "time"
	ExplainTypeIndex    ExplainType = "index"
	ExplainTypeSequence ExplainType = "sequence"
)

// ExplainNode EXPLAIN 结果节点
type ExplainNode struct {
	ID       int               `json:"id"`
	ParentID int               `json:"parentId,omitempty"`
	Type     string            `json:"type"`
	Relation string            `json:"relation,omitempty"`
	Alias    string            `json:"alias,omitempty"`
	Rows     int64             `json:"rows,omitempty"`
	Cost     float64           `json:"cost,omitempty"`
	Time     float64           `json:"time,omitempty"`
	Index    string            `json:"index,omitempty"`
	Filter   string            `json:"filter,omitempty"`
	Children []*ExplainNode    `json:"children,omitempty"`
	Details  map[string]string `json:"details,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
}

// ExplainResult EXPLAIN 结果
type ExplainResult struct {
	Success     bool         `json:"success"`
	RootNode    *ExplainNode `json:"rootNode,omitempty"`
	TotalCost   float64      `json:"totalCost,omitempty"`
	TotalRows   int64        `json:"totalRows,omitempty"`
	TotalTime   float64      `json:"totalTime,omitempty"`
	Query       string       `json:"query"`
	Warnings    []string     `json:"warnings,omitempty"`
	Suggestions []string     `json:"suggestions,omitempty"`
	Error       string       `json:"error,omitempty"`
}

// QueryAnalysis 查询分析结果
type QueryAnalysis struct {
	QueryType       string              `json:"queryType"`
	Tables          []string            `json:"tables"`
	Indexes         map[string][]string `json:"indexes"`
	JoinCount       int                 `json:"joinCount"`
	SubqueryCount   int                 `json:"subqueryCount"`
	HasAggregate    bool                `json:"hasAggregate"`
	HasOrderBy      bool                `json:"hasOrderBy"`
	HasGroupBy      bool                `json:"hasGroupBy"`
	HasDistinct     bool                `json:"hasDistinct"`
	HasLimit        bool                `json:"hasLimit"`
	HasUnion        bool                `json:"hasUnion"`
	HasSubquery     bool                `json:"hasSubquery"`
	EstimatedCost   float64             `json:"estimatedCost"`
	EstimatedRows   int64               `json:"estimatedRows"`
	Complexity      string              `json:"complexity"`
	Recommendations []string            `json:"recommendations"`
}

// GetExplainPlan 获取查询执行计划
func (a *App) GetExplainPlan(config Connection, database string, query string) ExplainResult {
	startTime := time.Now()
	auditLogger := GetAuditLogger()

	// 验证查询
	upperQuery := strings.ToUpper(strings.TrimSpace(query))
	if !strings.HasPrefix(upperQuery, "SELECT") {
		return ExplainResult{
			Success: false,
			Error:   "只能分析 SELECT 查询",
			Query:   query,
		}
	}

	// 获取数据库连接
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
				return ExplainResult{
					Success: false,
					Error:   fmt.Sprintf("连接失败: %v", err),
					Query:   query,
				}
			}
			a.pool.set(key, newDriver)
			pooledDriver, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
	}

	// 执行 EXPLAIN
	explainQuery := ""
	switch config.Type {
	case "mysql":
		explainQuery = "EXPLAIN " + query
	case "postgresql", "polardb", "gaussdb":
		explainQuery = "EXPLAIN ANALYZE " + query
	default:
		explainQuery = "EXPLAIN " + query
	}

	ctx := context.Background()
	rows, err := pooledDriver.driver.Query(ctx, explainQuery)
	if err != nil {
		return ExplainResult{
			Success: false,
			Error:   fmt.Sprintf("执行 EXPLAIN 失败: %v", err),
			Query:   query,
		}
	}
	defer rows.Close()

	// 解析 EXPLAIN 结果
	result := a.parseExplainResult(config.Type, rows)

	// 生成优化建议
	if result.Success {
		result.Suggestions = a.generateOptimizationSuggestions(result)
	}

	// 记录审计日志
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("查询分析: %s", truncateQuery(query, 50)),
		map[string]interface{}{
			"database":       database,
			"query_type":     "EXPLAIN",
			"execution_time": time.Since(startTime).String(),
		})

	return result
}

// parseExplainResult 解析 EXPLAIN 结果
func (a *App) parseExplainResult(dbType string, rows interface{}) ExplainResult {
	// 简化版本，实际需要根据不同数据库类型解析
	// 这里返回一个基础结构
	rootNode := &ExplainNode{
		ID:      1,
		Type:    "QUERY",
		Details: make(map[string]string),
	}

	return ExplainResult{
		Success:  true,
		RootNode: rootNode,
		Query:    "",
	}
}

// AnalyzeQuery 分析查询
func (a *App) AnalyzeQuery(query string) QueryAnalysis {
	upperQuery := strings.ToUpper(query)

	analysis := QueryAnalysis{
		Tables:    extractTables(query),
		JoinCount: countKeyword(upperQuery, "JOIN"),
		HasAggregate: strings.Contains(upperQuery, "GROUP BY") ||
			strings.Contains(upperQuery, "COUNT(") ||
			strings.Contains(upperQuery, "SUM(") ||
			strings.Contains(upperQuery, "AVG(") ||
			strings.Contains(upperQuery, "MAX(") ||
			strings.Contains(upperQuery, "MIN("),
		HasOrderBy:  strings.Contains(upperQuery, "ORDER BY"),
		HasGroupBy:  strings.Contains(upperQuery, "GROUP BY"),
		HasDistinct: strings.Contains(upperQuery, "DISTINCT"),
		HasLimit:    strings.Contains(upperQuery, "LIMIT"),
		HasUnion:    strings.Contains(upperQuery, "UNION"),
		HasSubquery: countKeyword(upperQuery, "SELECT") > 1,
	}

	// 确定查询类型
	if strings.HasPrefix(upperQuery, "SELECT") {
		analysis.QueryType = "SELECT"
	} else if strings.HasPrefix(upperQuery, "INSERT") {
		analysis.QueryType = "INSERT"
	} else if strings.HasPrefix(upperQuery, "UPDATE") {
		analysis.QueryType = "UPDATE"
	} else if strings.HasPrefix(upperQuery, "DELETE") {
		analysis.QueryType = "DELETE"
	}

	// 计算复杂度
	analysis.Complexity = calculateComplexity(analysis)

	// 生成推荐
	analysis.Recommendations = generateRecommendations(analysis, query)

	return analysis
}

// extractTables 提取表名
func extractTables(query string) []string {
	var tables []string
	upperQuery := strings.ToUpper(query)

	// 简化版本：从 FROM 和 JOIN 后提取表名
	// 实际需要更复杂的解析逻辑

	fromIdx := strings.Index(upperQuery, "FROM ")
	if fromIdx != -1 {
		afterFrom := query[fromIdx+5:]
		words := strings.Fields(afterFrom)
		if len(words) > 0 {
			tables = append(tables, words[0])
		}
	}

	return tables
}

// countKeyword 计算关键字出现次数
func countKeyword(query, keyword string) int {
	return strings.Count(query, " "+keyword+" ") +
		strings.Count(query, " "+keyword+"\n") +
		strings.Count(query, "\n"+keyword+" ")
}

// calculateComplexity 计算查询复杂度
func calculateComplexity(analysis QueryAnalysis) string {
	score := 0

	if analysis.JoinCount > 0 {
		score += analysis.JoinCount * 2
	}
	if analysis.HasSubquery {
		score += 5
	}
	if analysis.HasAggregate {
		score += 3
	}
	if analysis.HasOrderBy {
		score += 2
	}
	if analysis.HasGroupBy {
		score += 3
	}
	if analysis.HasUnion {
		score += 4
	}

	switch {
	case score <= 3:
		return "LOW"
	case score <= 8:
		return "MEDIUM"
	default:
		return "HIGH"
	}
}

// generateRecommendations 生成优化建议
func generateRecommendations(analysis QueryAnalysis, query string) []string {
	var recommendations []string

	if analysis.JoinCount > 3 {
		recommendations = append(recommendations, "考虑拆分多表连接查询以提高性能")
	}

	if analysis.HasSubquery {
		recommendations = append(recommendations, "子查询可能影响性能，建议使用 JOIN 或临时表替代")
	}

	if analysis.HasOrderBy && !analysis.HasLimit {
		recommendations = append(recommendations, "使用 ORDER BY 但没有 LIMIT，可能消耗大量资源")
	}

	if analysis.HasDistinct {
		recommendations = append(recommendations, "DISTINCT 操作可能较慢，考虑使用 GROUP BY 替代")
	}

	if analysis.HasGroupBy && analysis.HasOrderBy {
		recommendations = append(recommendations, "同时使用 GROUP BY 和 ORDER BY，确保索引覆盖")
	}

	if strings.Contains(strings.ToUpper(query), "SELECT *") {
		recommendations = append(recommendations, "避免使用 SELECT *，明确指定需要的列")
	}

	if strings.Contains(strings.ToUpper(query), "LIKE '%") {
		recommendations = append(recommendations, "LIKE 以通配符开头会导致索引失效")
	}

	return recommendations
}

// generateOptimizationSuggestions 生成优化建议
func (a *App) generateOptimizationSuggestions(result ExplainResult) []string {
	var suggestions []string

	// 基于执行计划生成建议
	// 这里是简化版本，实际需要深入分析执行计划

	if result.TotalCost > 1000 {
		suggestions = append(suggestions, "查询成本较高，建议添加适当的索引")
	}

	if result.TotalRows > 10000 {
		suggestions = append(suggestions, "扫描行数较多，考虑添加 WHERE 条件限制")
	}

	if result.TotalTime > 1000 {
		suggestions = append(suggestions, "执行时间较长，建议优化查询结构")
	}

	return suggestions
}

// GetSlowQueries 获取慢查询列表
func (a *App) GetSlowQueries(config Connection, database string, thresholdSeconds int) ([]map[string]interface{}, error) {
	// 简化版本，实际需要查询数据库的慢查询日志
	// 这里返回空列表
	return []map[string]interface{}{}, nil
}

// GetTableStatistics 获取表统计信息
func (a *App) GetTableStatistics(config Connection, database string, table string) (map[string]interface{}, error) {
	stats, err := a.GetTableStats(config, database, table)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"row_count":    stats.RowCount,
		"data_length":  stats.DataLength,
		"index_length": stats.IndexLength,
		"engine":       stats.Engine,
		"charset":      stats.Charset,
		"collation":    stats.Collation,
		"comment":      stats.Comment,
	}

	// 计算索引使用率
	if stats.DataLength > 0 {
		result["index_ratio"] = float64(stats.IndexLength) / float64(stats.DataLength)
	}

	return result, nil
}

// AnalyzeTableUsage 分析表使用情况
func (a *App) AnalyzeTableUsage(config Connection, database string) ([]map[string]interface{}, error) {
	// 获取所有表
	tables, err := a.GetTables(config, database)
	if err != nil {
		return nil, err
	}

	var usage []map[string]interface{}

	for _, table := range tables {
		stats, err := a.GetTableStats(config, database, table.Name)
		if err != nil {
			continue
		}

		tableUsage := map[string]interface{}{
			"table_name": table.Name,
			"row_count":  stats.RowCount,
			"data_size":  stats.DataLength,
			"index_size": stats.IndexLength,
			"total_size": stats.DataLength + stats.IndexLength,
		}

		usage = append(usage, tableUsage)
	}

	return usage, nil
}
