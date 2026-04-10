package main

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
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

// 预编译的正则表达式，用于解析 PostgreSQL EXPLAIN 输出
var (
	costRegex       = regexp.MustCompile(`cost=(\d+\.?\d*)\.\.(\d+\.?\d*)`)
	rowsRegex       = regexp.MustCompile(`rows=(\d+)`)
	timeRegex       = regexp.MustCompile(`actual time=(\d+\.?\d*)\.\.(\d+\.?\d*)`)
	actualRowsRegex = regexp.MustCompile(`rows=(\d+)\s+loops`)
	onMatchRegex    = regexp.MustCompile(`on\s+([^\s]+)`)
	indexMatchRegex = regexp.MustCompile(`Index.*?on\s+([^\s]+)`)
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
	result := ExplainResult{
		Success: true,
		RootNode: &ExplainNode{
			ID:      1,
			Type:    "QUERY",
			Details: make(map[string]string),
		},
		Warnings:    []string{},
		Suggestions: []string{},
	}

	// 类型断言获取 Rows 接口
	type Rows interface {
		Columns() ([]string, error)
		Next() bool
		Scan(dest ...interface{}) error
		Close() error
	}

	var dbRows Rows
	switch r := rows.(type) {
	case Rows:
		dbRows = r
	default:
		// 尝试其他类型
		result.Success = false
		result.Error = fmt.Sprintf("不支持的 rows 类型: %T", rows)
		return result
	}

	columns, err := dbRows.Columns()
	if err != nil {
		result.Success = false
		result.Error = fmt.Sprintf("获取列信息失败: %v", err)
		return result
	}

	// 根据数据库类型解析
	switch dbType {
	case "mysql":
		result = a.parseMySQLExplain(dbRows, columns, result)
	case "postgresql", "polardb", "gaussdb":
		result = a.parsePostgresExplain(dbRows, columns, result)
	default:
		result = a.parseGenericExplain(dbRows, columns, result)
	}

	return result
}

// parseMySQLExplain 解析 MySQL EXPLAIN 结果
func (a *App) parseMySQLExplain(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}, columns []string, result ExplainResult) ExplainResult {
	var nodes []*ExplainNode
	totalRows := int64(0)
	totalCost := float64(0)

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		node := &ExplainNode{
			ID:      len(nodes) + 1,
			Details: make(map[string]string),
		}

		// 解析列
		for i, col := range columns {
			val := values[i]
			var strVal string
			switch v := val.(type) {
			case []byte:
				strVal = string(v)
			case string:
				strVal = v
			case int64:
				strVal = fmt.Sprintf("%d", v)
			case float64:
				strVal = fmt.Sprintf("%.2f", v)
			case nil:
				strVal = ""
			default:
				strVal = fmt.Sprintf("%v", v)
			}

			colUpper := strings.ToUpper(col)
			switch colUpper {
			case "ID":
				if id, err := strconv.Atoi(strVal); err == nil {
					node.ID = id
				}
			case "SELECT_TYPE", "SELECT TYPE":
				node.Details["select_type"] = strVal
			case "TABLE":
				node.Relation = strVal
			case "TYPE":
				node.Type = strVal
			case "POSSIBLE_KEYS":
				node.Details["possible_keys"] = strVal
			case "KEY":
				node.Index = strVal
			case "KEY_LEN", "KEY_LENGTH":
				node.Details["key_length"] = strVal
			case "REF":
				node.Details["ref"] = strVal
			case "ROWS":
				if rows, err := strconv.ParseInt(strVal, 10, 64); err == nil {
					node.Rows = rows
					totalRows += rows
				}
			case "FILTERED":
				if filtered, err := strconv.ParseFloat(strVal, 64); err == nil {
					node.Details["filtered"] = fmt.Sprintf("%.1f%%", filtered)
				}
			case "EXTRA":
				node.Details["extra"] = strVal
				// 检查警告
				if strings.Contains(strVal, "Using filesort") {
					result.Warnings = append(result.Warnings, "使用了文件排序(filesort)，可能影响性能")
				}
				if strings.Contains(strVal, "Using temporary") {
					result.Warnings = append(result.Warnings, "使用了临时表，可能影响性能")
				}
				if strings.Contains(strVal, "Using join buffer") {
					result.Warnings = append(result.Warnings, "使用了连接缓冲区，建议添加索引")
				}
			default:
				node.Details[strings.ToLower(col)] = strVal
			}
		}

		// 检查全表扫描
		if node.Type == "ALL" && node.Relation != "" {
			result.Warnings = append(result.Warnings, fmt.Sprintf("表 '%s' 使用了全表扫描，建议添加索引", node.Relation))
		}

		nodes = append(nodes, node)
	}

	// 构建树结构
	if len(nodes) > 0 {
		result.RootNode = nodes[0]
		if len(nodes) > 1 {
			result.RootNode.Children = nodes[1:]
		}
	}

	result.TotalRows = totalRows
	result.TotalCost = totalCost

	return result
}

// parsePostgresExplain 解析 PostgreSQL EXPLAIN ANALYZE 结果
func (a *App) parsePostgresExplain(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}, columns []string, result ExplainResult) ExplainResult {
	var explainText strings.Builder

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		// PostgreSQL 通常返回单列的 TEXT 格式
		if len(values) > 0 {
			switch v := values[0].(type) {
			case []byte:
				explainText.WriteString(string(v))
				explainText.WriteString("\n")
			case string:
				explainText.WriteString(v)
				explainText.WriteString("\n")
			}
		}
	}

	// 解析文本格式的 EXPLAIN 输出
	text := explainText.String()
	result = a.parsePostgresExplainText(text, result)

	return result
}

// parsePostgresExplainText 解析 PostgreSQL EXPLAIN 文本输出
func (a *App) parsePostgresExplainText(text string, result ExplainResult) ExplainResult {
	lines := strings.Split(text, "\n")

	var currentNode *ExplainNode
	var nodeStack []*ExplainNode
	totalCost := float64(0)
	totalRows := int64(0)
	totalTime := float64(0)

	for _, line := range lines {
		indent := len(line) - len(strings.TrimLeft(line, " "))
		level := indent / 2

		// 调整栈深度
		for len(nodeStack) > level {
			nodeStack = nodeStack[:len(nodeStack)-1]
		}

		// 创建新节点
		node := &ExplainNode{
			ID:      len(result.Warnings) + 1,
			Details: make(map[string]string),
		}

		// 提取节点类型
		trimmedLine := strings.TrimSpace(line)
		if idx := strings.Index(trimmedLine, "  "); idx > 0 {
			node.Type = trimmedLine[:idx]
		} else if idx := strings.Index(trimmedLine, " "); idx > 0 {
			node.Type = trimmedLine[:idx]
		} else {
			node.Type = trimmedLine
		}

		// 解析成本
		if matches := costRegex.FindStringSubmatch(line); len(matches) > 2 {
			if startCost, err := strconv.ParseFloat(matches[1], 64); err == nil {
				node.Details["start_cost"] = fmt.Sprintf("%.2f", startCost)
			}
			if endCost, err := strconv.ParseFloat(matches[2], 64); err == nil {
				node.Cost = endCost
				if endCost > totalCost {
					totalCost = endCost
				}
			}
		}

		// 解析估计行数
		if matches := rowsRegex.FindStringSubmatch(line); len(matches) > 1 {
			if rows, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
				node.Rows = rows
			}
		}

		// 解析实际执行时间
		if matches := timeRegex.FindStringSubmatch(line); len(matches) > 2 {
			if startTime, err := strconv.ParseFloat(matches[1], 64); err == nil {
				node.Details["actual_start_time"] = fmt.Sprintf("%.3f", startTime)
			}
			if endTime, err := strconv.ParseFloat(matches[2], 64); err == nil {
				node.Time = endTime
				if endTime > totalTime {
					totalTime = endTime
				}
			}
		}

		// 解析实际行数
		if matches := actualRowsRegex.FindStringSubmatch(line); len(matches) > 1 {
			if rows, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
				node.Details["actual_rows"] = fmt.Sprintf("%d", rows)
				totalRows += rows
			}
		}

		// 检查关系名
		onMatch := onMatchRegex.FindStringSubmatch(line)
		if len(onMatch) > 1 {
			node.Relation = onMatch[1]
		}

		// 检查索引扫描
		if strings.Contains(line, "Index Scan") || strings.Contains(line, "Index Only Scan") {
			idxMatch := indexMatchRegex.FindStringSubmatch(line)
			if len(idxMatch) > 1 {
				node.Index = idxMatch[1]
			}
		}

		// 检查 Seq Scan（全表扫描）
		if strings.Contains(line, "Seq Scan") {
			if node.Relation != "" {
				result.Warnings = append(result.Warnings, fmt.Sprintf("表 '%s' 使用了顺序扫描(Seq Scan)，建议添加索引", node.Relation))
			}
		}

		// 添加到树结构
		if len(nodeStack) == 0 {
			result.RootNode = node
		} else {
			parent := nodeStack[len(nodeStack)-1]
			parent.Children = append(parent.Children, node)
			node.ParentID = parent.ID
		}

		currentNode = node
		nodeStack = append(nodeStack, currentNode)
	}

	result.TotalCost = totalCost
	result.TotalRows = totalRows
	result.TotalTime = totalTime

	return result
}

// parseGenericExplain 解析通用 EXPLAIN 结果
func (a *App) parseGenericExplain(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}, columns []string, result ExplainResult) ExplainResult {
	var nodes []*ExplainNode

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		node := &ExplainNode{
			ID:      len(nodes) + 1,
			Details: make(map[string]string),
		}

		for i, col := range columns {
			var strVal string
			switch v := values[i].(type) {
			case []byte:
				strVal = string(v)
			case string:
				strVal = v
			case int64:
				strVal = fmt.Sprintf("%d", v)
			case float64:
				strVal = fmt.Sprintf("%.2f", v)
			case nil:
				strVal = ""
			default:
				strVal = fmt.Sprintf("%v", v)
			}
			node.Details[strings.ToLower(col)] = strVal
		}

		nodes = append(nodes, node)
	}

	if len(nodes) > 0 {
		result.RootNode = nodes[0]
		if len(nodes) > 1 {
			result.RootNode.Children = nodes[1:]
		}
	}

	return result
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
