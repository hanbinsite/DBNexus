package main

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type ExplainType string

const (
	ExplainTypeRows     ExplainType = "rows"
	ExplainTypeCost     ExplainType = "cost"
	ExplainTypeTime     ExplainType = "time"
	ExplainTypeIndex    ExplainType = "index"
	ExplainTypeSequence ExplainType = "sequence"
)

var (
	costRegex       = regexp.MustCompile(`cost=(\d+\.?\d*)\.\.(\d+\.?\d*)`)
	rowsRegex       = regexp.MustCompile(`rows=(\d+)`)
	timeRegex       = regexp.MustCompile(`actual time=(\d+\.?\d*)\.\.(\d+\.?\d*)`)
	actualRowsRegex = regexp.MustCompile(`rows=(\d+)\s+loops`)
	onMatchRegex    = regexp.MustCompile(`on\s+([^\s]+)`)
	indexMatchRegex = regexp.MustCompile(`Index.*?on\s+([^\s]+)`)
)

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

func (a *App) GetExplainPlan(config Connection, database string, query string) ExplainResult {
	startTime := time.Now()
	auditLogger := GetAuditLogger()

	upperQuery := strings.ToUpper(strings.TrimSpace(query))
	if !strings.HasPrefix(upperQuery, "SELECT") {
		return ExplainResult{
			Success: false,
			Error:   "只能分析 SELECT 查询",
			Query:   query,
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return ExplainResult{
			Success: false,
			Error:   fmt.Sprintf("连接失败: %v", err),
			Query:   query,
		}
	}

	explainQuery := ""
	switch config.Type {
	case "mysql":
		explainQuery = "EXPLAIN " + query
	case "postgresql", "polardb", "gaussdb":
		explainQuery = "EXPLAIN ANALYZE " + query
	case "oracle":
		explainQuery = "EXPLAIN PLAN FOR " + query
	default:
		explainQuery = "EXPLAIN " + query
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	rows, err := driver.Query(ctx, explainQuery)
	if err != nil {
		return ExplainResult{
			Success: false,
			Error:   fmt.Sprintf("执行 EXPLAIN 失败: %v", err),
			Query:   query,
		}
	}
	defer rows.Close()

	result := a.parseExplainResult(config.Type, rows)

	if result.Success {
		result.Suggestions = a.generateOptimizationSuggestions(result)
	}

	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("查询分析: %s", truncateQuery(query, 50)),
		map[string]interface{}{
			"database":       database,
			"query_type":     "EXPLAIN",
			"execution_time": time.Since(startTime).String(),
		})

	return result
}

func (a *App) parseExplainResult(dbType string, rows *sql.Rows) ExplainResult {
	result := ExplainResult{
		Success:     true,
		RootNode:    &ExplainNode{ID: 1, Type: "QUERY", Details: make(map[string]string), Children: []*ExplainNode{}},
		Warnings:    []string{},
		Suggestions: []string{},
	}

	if rows == nil {
		result.Success = false
		result.Warnings = append(result.Warnings, "EXPLAIN 返回空结果")
		return result
	}

	switch dbType {
	case "mysql":
		root, warnings := parseMySQLExplain(rows)
		if root != nil {
			result.RootNode = root
		}
		result.Warnings = warnings
	case "postgresql", "polardb", "gaussdb":
		root, warnings := parsePostgresExplain(rows)
		if root != nil {
			result.RootNode = root
		}
		result.Warnings = warnings
	default:
		result.Warnings = append(result.Warnings, "不支持的数据库类型 EXPLAIN 解析")
	}

	return result
}

func parseMySQLExplain(rows *sql.Rows) (*ExplainNode, []string) {
	var warnings []string
	var root *ExplainNode
	nodeID := 1

	if rows == nil {
		return &ExplainNode{ID: 1, Type: "QUERY", Details: make(map[string]string), Children: []*ExplainNode{}}, warnings
	}

	for rows.Next() {
		var id int
		var selectType, table, type_ string
		var possibleKeys, key_ sql.NullString
		var keyLen, ref sql.NullString
		var rows_ sql.NullInt64
		var extra sql.NullString

		err := rows.Scan(&id, &selectType, &table, &type_, &possibleKeys, &key_, &keyLen, &ref, &rows_, &extra)
		if err != nil {
			continue
		}

		node := &ExplainNode{
			ID:      nodeID,
			Type:    type_,
			Details: map[string]string{
				"select_type":   selectType,
				"table":         table,
				"type":          type_,
				"possible_keys": possibleKeys.String,
				"key":           key_.String,
				"rows":          fmt.Sprintf("%d", rows_.Int64),
				"extra":         extra.String,
			},
			Children: []*ExplainNode{},
		}
		nodeID++

		if type_ == "ALL" {
			warnings = append(warnings, fmt.Sprintf("表 %s: 全表扫描 (type=ALL)", table))
		}
		if extra.String != "" && strings.Contains(extra.String, "Using filesort") {
			warnings = append(warnings, fmt.Sprintf("表 %s: 使用文件排序 (filesort)", table))
		}
		if extra.String != "" && strings.Contains(extra.String, "Using temporary") {
			warnings = append(warnings, fmt.Sprintf("表 %s: 使用临时表", table))
		}

		if root == nil {
			root = node
		} else {
			root.Children = append(root.Children, node)
		}
	}

	if root == nil {
		root = &ExplainNode{ID: 1, Type: "QUERY", Details: make(map[string]string), Children: []*ExplainNode{}}
	}
	return root, warnings
}

func parsePostgresExplain(rows *sql.Rows) (*ExplainNode, []string) {
	var warnings []string
	var fullText strings.Builder

	if rows == nil {
		return &ExplainNode{ID: 1, Type: "QUERY", Details: make(map[string]string), Children: []*ExplainNode{}}, warnings
	}

	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			continue
		}
		fullText.WriteString(line)
		fullText.WriteString("\n")
	}

	root := &ExplainNode{ID: 1, Type: "QUERY", Details: make(map[string]string), Children: []*ExplainNode{}}
	root.Details["plan"] = fullText.String()

	if strings.Contains(fullText.String(), "Seq Scan") {
		warnings = append(warnings, "检测到顺序扫描 (Seq Scan)")
	}
	if strings.Contains(fullText.String(), "Hash Join") {
		warnings = append(warnings, "使用 Hash Join")
	}
	if strings.Contains(fullText.String(), "Sort") {
		warnings = append(warnings, "需要排序操作 (Sort)")
	}

	return root, warnings
}

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

	if strings.HasPrefix(upperQuery, "SELECT") {
		analysis.QueryType = "SELECT"
	} else if strings.HasPrefix(upperQuery, "INSERT") {
		analysis.QueryType = "INSERT"
	} else if strings.HasPrefix(upperQuery, "UPDATE") {
		analysis.QueryType = "UPDATE"
	} else if strings.HasPrefix(upperQuery, "DELETE") {
		analysis.QueryType = "DELETE"
	}

	analysis.Complexity = calculateComplexity(analysis)
	analysis.Recommendations = generateRecommendations(analysis, query)

	return analysis
}

func extractTables(query string) []string {
	var tables []string
	upperQuery := strings.ToUpper(query)

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

func countKeyword(query, keyword string) int {
	return strings.Count(query, " "+keyword+" ") +
		strings.Count(query, " "+keyword+"\n") +
		strings.Count(query, "\n"+keyword+" ")
}

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

func (a *App) generateOptimizationSuggestions(result ExplainResult) []string {
	var suggestions []string

	for _, w := range result.Warnings {
		suggestions = append(suggestions, w)
	}

	if result.TotalCost > 1000 {
		suggestions = append(suggestions, "查询成本较高，建议添加适当的索引")
	}

	if result.TotalRows > 10000 {
		suggestions = append(suggestions, "扫描行数较多，考虑添加 WHERE 条件限制")
	}

	if result.TotalTime > 1000 {
		suggestions = append(suggestions, "执行时间较长，建议优化查询结构")
	}

	if len(suggestions) == 0 {
		suggestions = append(suggestions, "未检测到明显性能问题")
	}

	return suggestions
}

func (a *App) GetSlowQueries(config Connection, database string, thresholdSeconds int) ([]map[string]interface{}, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	switch config.Type {
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT
				queryid AS query_id,
				left(query, 200) AS query_sql,
				calls,
				mean_exec_time AS avg_time_ms,
				total_exec_time AS total_time_ms,
				rows
			FROM pg_stat_statements
			WHERE mean_exec_time > %d
			ORDER BY mean_exec_time DESC
			LIMIT 50
		`, thresholdSeconds*1000)
	case "mysql":
		query = fmt.Sprintf(`
			SELECT
				sql_text AS query_sql,
				query_time AS avg_time_ms,
				lock_time,
				rows_sent,
				rows_examined
			FROM mysql.slow_log
			WHERE query_time > %d
			ORDER BY query_time DESC
			LIMIT 50
	`, thresholdSeconds)
	case "oracle":
		query = fmt.Sprintf(`
			SELECT
				sql_text AS query_sql,
				elapsed_time AS avg_time_ms,
				0 AS lock_time,
				rows_processed AS rows_sent,
				0 AS rows_examined
			FROM v$sql
			WHERE elapsed_time > %d
			ORDER BY elapsed_time DESC
			FETCH FIRST 50 ROWS ONLY
		`, thresholdSeconds*1000)
	default:
		return []map[string]interface{}{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return []map[string]interface{}{}, nil
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return []map[string]interface{}{}, nil
	}

	var results []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		results = append(results, row)
	}

	return results, nil
}

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

	if stats.DataLength > 0 {
		result["index_ratio"] = float64(stats.IndexLength) / float64(stats.DataLength)
	}

	return result, nil
}

func (a *App) AnalyzeTableUsage(config Connection, database string) ([]map[string]interface{}, error) {
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

// Keep the parsing methods for MySQL/PostgreSQL/Generic EXPLAIN results
// These work with *sql.Rows but are adapted for the driver interface

func (a *App) parseMySQLExplainFromRows(rows *sql.Rows, columns []string, result ExplainResult) ExplainResult {
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
				if r, err := strconv.ParseInt(strVal, 10, 64); err == nil {
					node.Rows = r
					totalRows += r
				}
			case "FILTERED":
				if filtered, err := strconv.ParseFloat(strVal, 64); err == nil {
					node.Details["filtered"] = fmt.Sprintf("%.1f%%", filtered)
				}
			case "EXTRA":
				node.Details["extra"] = strVal
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

		if node.Type == "ALL" && node.Relation != "" {
			result.Warnings = append(result.Warnings, fmt.Sprintf("表 '%s' 使用了全表扫描，建议添加索引", node.Relation))
		}

		nodes = append(nodes, node)
	}

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

		for len(nodeStack) > level {
			nodeStack = nodeStack[:len(nodeStack)-1]
		}

		node := &ExplainNode{
			ID:      len(result.Warnings) + 1,
			Details: make(map[string]string),
		}

		trimmedLine := strings.TrimSpace(line)
		if idx := strings.Index(trimmedLine, "  "); idx > 0 {
			node.Type = trimmedLine[:idx]
		} else if idx := strings.Index(trimmedLine, " "); idx > 0 {
			node.Type = trimmedLine[:idx]
		} else {
			node.Type = trimmedLine
		}

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

		if matches := rowsRegex.FindStringSubmatch(line); len(matches) > 1 {
			if r, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
				node.Rows = r
			}
		}

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

		if matches := actualRowsRegex.FindStringSubmatch(line); len(matches) > 1 {
			if r, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
				node.Details["actual_rows"] = fmt.Sprintf("%d", r)
				totalRows += r
			}
		}

		onMatch := onMatchRegex.FindStringSubmatch(line)
		if len(onMatch) > 1 {
			node.Relation = onMatch[1]
		}

		if strings.Contains(line, "Index Scan") || strings.Contains(line, "Index Only Scan") {
			idxMatch := indexMatchRegex.FindStringSubmatch(line)
			if len(idxMatch) > 1 {
				node.Index = idxMatch[1]
			}
		}

		if strings.Contains(line, "Seq Scan") {
			if node.Relation != "" {
				result.Warnings = append(result.Warnings, fmt.Sprintf("表 '%s' 使用了顺序扫描(Seq Scan)，建议添加索引", node.Relation))
			}
		}

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

