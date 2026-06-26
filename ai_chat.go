package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// AIChatMessage represents a single message in the AI conversation
type AIChatMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type AIChatContext struct {
	CurrentTable   string   `json:"currentTable,omitempty"`
	CurrentQuery   string   `json:"currentQuery,omitempty"`
	RecentQueries  []string `json:"recentQueries,omitempty"`
	TableStructure string   `json:"tableStructure,omitempty"`
}

type AIChatRequest struct {
	SessionID string         `json:"sessionId"`
	Message   string         `json:"message"`
	Config    Connection     `json:"config"`
	Database  string         `json:"database"`
	Context   *AIChatContext `json:"context,omitempty"`
}

type AIChatResponse struct {
	Success     bool     `json:"success"`
	Message     string   `json:"message"`
	SQL         string   `json:"sql,omitempty"`
	Action      string   `json:"action,omitempty"`
	Suggestions []string `json:"suggestions,omitempty"`
	Error       string   `json:"error,omitempty"`
}

type IndexRecommendation struct {
	TableName       string `json:"tableName"`
	ColumnName      string `json:"columnName"`
	IndexType       string `json:"indexType"`
	Reason          string `json:"reason"`
	Priority        string `json:"priority"`
	CreateSQL       string `json:"createSql"`
	EstimatedImpact string `json:"estimatedImpact,omitempty"`
}

type IndexAnalysisResult struct {
	Recommendations []IndexRecommendation `json:"recommendations"`
	ExistingIndexes []string              `json:"existingIndexes"`
	Summary         string                `json:"summary"`
}

// S17-1: AI Chat — Schema-aware conversation
func (a *App) AIChat(req AIChatRequest) AIChatResponse {
	client, err := a.getAIClient()
	if err != nil {
		return AIChatResponse{Error: "AI 功能未启用，请在设置中配置 AI Provider"}
	}

	// Build schema context using existing method
	schemaContext := ""
	if req.Config.ID != "" {
		schemaContext = a.buildSchemaContext(req.Config, req.Database, 10)
	}

	// Determine action based on message content
	action := "chat"
	msgLower := strings.ToLower(req.Message)

	if strings.Contains(msgLower, "查询") || strings.Contains(msgLower, "select") ||
		strings.Contains(msgLower, "find") || strings.Contains(msgLower, "search") ||
		strings.Contains(msgLower, "查找") || strings.Contains(msgLower, "搜索") {
		action = "query"
	} else if strings.Contains(msgLower, "解释") || strings.Contains(msgLower, "explain") ||
		strings.Contains(msgLower, "什么是") || strings.Contains(msgLower, "为什么") {
		action = "explain"
	} else if strings.Contains(msgLower, "优化") || strings.Contains(msgLower, "optimize") ||
		strings.Contains(msgLower, "索引") || strings.Contains(msgLower, "index") ||
		strings.Contains(msgLower, "慢") || strings.Contains(msgLower, "slow") {
		action = "suggest"
	}

	// Build system prompt
	systemPrompt := a.buildSystemPrompt(schemaContext, action)

	// Build user prompt
	userPrompt := req.Message
	if req.Context != nil && req.Context.CurrentQuery != "" {
		userPrompt += "\n\n当前SQL:\n```sql\n" + req.Context.CurrentQuery + "\n```"
	}

	// Call AI provider via LLMClient interface
	ctx, cancel := context.WithTimeout(a.ctx, 60*time.Second)
	defer cancel()

	aiResp, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		return AIChatResponse{Error: fmt.Sprintf("AI 调用失败: %v", err)}
	}

	sql := extractSQLFromResponse(aiResp)
	suggestions := a.generateChatSuggestions(action)

	return AIChatResponse{
		Success:     true,
		Message:     aiResp,
		SQL:         sql,
		Action:      action,
		Suggestions: suggestions,
	}
}

// S17-2: Auto Index Recommendation
func (a *App) RecommendIndexes(config Connection, database string, tableName string) IndexAnalysisResult {
	result := IndexAnalysisResult{
		Recommendations: []IndexRecommendation{},
		ExistingIndexes: []string{},
	}

	// Get table structure
	columns, err := a.GetTableColumns(config, database, tableName)
	if err != nil || len(columns) == 0 {
		result.Summary = "无法获取表结构信息"
		return result
	}

	// Get existing indexes
	indexes, _ := a.GetTableIndexes(config, database, tableName)
	indexedCols := make(map[string]bool)
	for _, idx := range indexes {
		result.ExistingIndexes = append(result.ExistingIndexes, idx.Name)
		for _, col := range idx.Columns {
			indexedCols[col] = true
		}
	}

	// Get slow queries for this table
	slowQueries, _ := a.GetSlowQueries(config, database, 5)
	queryPatterns := make(map[string]int)
	for _, sq := range slowQueries {
		if q, ok := sq["query"].(string); ok {
			if strings.Contains(strings.ToLower(q), strings.ToLower(tableName)) {
				cols := extractWhereColumns(q)
				for _, col := range cols {
					queryPatterns[col]++
				}
			}
		}
	}

	// Analyze columns for index recommendations
	for _, col := range columns {
		if indexedCols[col.Name] {
			continue
		}

		// Primary key — usually auto-indexed
		if col.PrimaryKey {
			continue
		}

		// Frequently queried columns
		freq := queryPatterns[col.Name]
		if freq >= 3 {
			priority := "high"
			if freq < 5 {
				priority = "medium"
			}
			result.Recommendations = append(result.Recommendations, IndexRecommendation{
				TableName:       tableName,
				ColumnName:      col.Name,
				IndexType:       "btree",
				Reason:          fmt.Sprintf("该列在慢查询 WHERE 条件中出现 %d 次", freq),
				Priority:        priority,
				CreateSQL:       fmt.Sprintf("CREATE INDEX idx_%s_%s ON %s (%s);", tableName, col.Name, tableName, col.Name),
				EstimatedImpact: fmt.Sprintf("预计提升相关查询性能 %d%%-80%%", 30+freq*10),
			})
			continue
		}

		// Text columns for full-text search
		colTypeLower := strings.ToLower(col.Type)
		if (strings.Contains(colTypeLower, "text") || strings.Contains(colTypeLower, "varchar")) &&
			!col.Nullable {
			result.Recommendations = append(result.Recommendations, IndexRecommendation{
				TableName:       tableName,
				ColumnName:      col.Name,
				IndexType:       "gin",
				Reason:          "文本列适合创建 GIN 索引以支持全文搜索",
				Priority:        "low",
				CreateSQL:       fmt.Sprintf("CREATE INDEX idx_%s_%s_gin ON %s USING gin (to_tsvector('simple', %s));", tableName, col.Name, tableName, col.Name),
				EstimatedImpact: "提升全文搜索性能 10x+",
			})
		}
	}

	highCount := 0
	for _, rec := range result.Recommendations {
		if rec.Priority == "high" {
			highCount++
		}
	}
	result.Summary = fmt.Sprintf("分析完成: %d 个建议 (高优先级 %d), %d 个已有索引",
		len(result.Recommendations), highCount, len(result.ExistingIndexes))

	return result
}

// Helper: Build system prompt
func (a *App) buildSystemPrompt(schemaContext string, action string) string {
	var sb strings.Builder

	sb.WriteString("你是 DBNexus AI 助手，一个专业的数据库专家。\n")
	sb.WriteString("你帮助用户编写 SQL、优化查询、诊断问题。\n\n")

	if schemaContext != "" {
		sb.WriteString("当前数据库上下文:\n")
		sb.WriteString(schemaContext)
		sb.WriteString("\n")
	}

	switch action {
	case "query":
		sb.WriteString("用户想要查询数据。请生成正确的 SQL 语句。\n")
		sb.WriteString("使用 ```sql 代码块包裹 SQL。\n")
	case "explain":
		sb.WriteString("用户想要解释。请详细说明 SQL 逻辑或数据库概念。\n")
	case "suggest":
		sb.WriteString("用户想要优化建议。请分析并提供具体的索引建议和优化方案。\n")
	default:
		sb.WriteString("请友好地回答用户的问题。\n")
	}

	sb.WriteString("\n注意:\n- 使用与用户相同的语言回复\n- SQL 必须兼容目标数据库\n")

	return sb.String()
}

// Helper: Extract SQL from AI response
func extractSQLFromResponse(response string) string {
	start := strings.Index(response, "```sql")
	if start < 0 {
		start = strings.Index(response, "```SQL")
	}
	if start < 0 {
		return ""
	}
	start += 6
	end := strings.Index(response[start:], "```")
	if end < 0 {
		return ""
	}
	return strings.TrimSpace(response[start : start+end])
}

// Helper: Extract column names from WHERE clause
func extractWhereColumns(query string) []string {
	var columns []string
	upperQuery := strings.ToUpper(query)

	whereIdx := strings.Index(upperQuery, "WHERE")
	if whereIdx < 0 {
		return columns
	}

	whereClause := query[whereIdx+5:]
	parts := strings.Fields(whereClause)
	for i, part := range parts {
		upperPart := strings.ToUpper(part)
		if upperPart == "=" || upperPart == "IN" || upperPart == "LIKE" ||
			upperPart == ">" || upperPart == "<" || upperPart == ">=" || upperPart == "<=" ||
			upperPart == "!=" || upperPart == "<>" {
			if i > 0 {
				colName := strings.Trim(parts[i-1], "(),")
				if isValidColumnName(colName) {
					columns = append(columns, colName)
				}
			}
		}
	}
	return columns
}

func isValidColumnName(name string) bool {
	if name == "" || len(name) > 64 {
		return false
	}
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '_' || c == '.') {
			return false
		}
	}
	return true
}

// Helper: Generate chat suggestions
func (a *App) generateChatSuggestions(action string) []string {
	switch action {
	case "query":
		return []string{"优化这个查询", "添加分页", "添加排序"}
	case "explain":
		return []string{"如何优化这个查询？", "这个查询会用到哪些索引？"}
	case "suggest":
		return []string{"查看表结构", "分析慢查询"}
	default:
		return []string{"帮我写一个查询", "优化这个SQL", "解释这个查询"}
	}
}

// S17-3: AI-powered query optimization with auto-apply
type AIOptimizationResult struct {
	OriginalSQL      string               `json:"originalSql"`
	OptimizedSQL     string               `json:"optimizedSql"`
	Explanation      string               `json:"explanation"`
	Changes          []string             `json:"changes"`
	EstimatedGain    string               `json:"estimatedGain"`
	IndexSuggestions []IndexRecommendation `json:"indexSuggestions,omitempty"`
}

func (a *App) AIOptimizeQuery(config Connection, database string, sql string) AIOptimizationResult {
	result := AIOptimizationResult{
		OriginalSQL: sql,
		Changes:     []string{},
	}

	client, err := a.getAIClient()
	if err != nil {
		result.Explanation = "AI 功能未启用"
		return result
	}

	systemPrompt := "你是 SQL 优化专家。分析查询并提供优化建议。\n请返回优化后的 SQL 和详细说明。\n使用 ```sql 代码块包裹优化后的 SQL。\n"
	userPrompt := fmt.Sprintf("请优化以下 SQL:\n```sql\n%s\n```\n", sql)

	ctx, cancel := context.WithTimeout(a.ctx, 60*time.Second)
	defer cancel()

	aiResp, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		result.Explanation = fmt.Sprintf("AI 分析失败: %v", err)
		return result
	}

	result.OptimizedSQL = extractSQLFromResponse(aiResp)
	result.Explanation = aiResp

	if result.OptimizedSQL != "" && strings.ToUpper(result.OptimizedSQL) != strings.ToUpper(sql) {
		result.Changes = append(result.Changes, "SQL 已优化")
	}

	// Get index recommendations for tables in the query
	tables := extractTableNames(sql)
	for _, table := range tables {
		idxResult := a.RecommendIndexes(config, database, table)
		result.IndexSuggestions = append(result.IndexSuggestions, idxResult.Recommendations...)
	}

	if len(result.IndexSuggestions) > 0 {
		result.EstimatedGain = fmt.Sprintf("预计提升 %d%%-80%%", 20+len(result.IndexSuggestions)*15)
	}

	return result
}

// Helper: Extract table names from SQL
func extractTableNames(sql string) []string {
	var tables []string
	upperSQL := strings.ToUpper(sql)

	keywords := []string{"FROM", "JOIN", "INTO", "UPDATE"}
	for _, kw := range keywords {
		idx := 0
		for {
			pos := strings.Index(upperSQL[idx:], kw)
			if pos < 0 {
				break
			}
			pos += idx
			rest := strings.TrimSpace(sql[pos+len(kw):])
			parts := strings.Fields(rest)
			if len(parts) > 0 {
				tableName := strings.Trim(parts[0], ",;()")
				if isValidColumnName(tableName) {
					tables = append(tables, tableName)
				}
			}
			idx = pos + len(kw)
		}
	}

	seen := make(map[string]bool)
	unique := []string{}
	for _, t := range tables {
		if !seen[t] {
			seen[t] = true
			unique = append(unique, t)
		}
	}
	return unique
}
