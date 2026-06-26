package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (a *App) ExplainSQL(query string) (string, error) {
	client, err := a.getAIClient()
	if err != nil {
		return a.fallbackExplainSQL(query), nil
	}

	lang := a.getCurrentLang()
	langInstruction := "Respond in Chinese."
	if lang == "en" {
		langInstruction = "Respond in English."
	}

	systemPrompt := fmt.Sprintf(`You are an expert SQL analyst. Explain the given SQL query clearly and concisely. %s

Format:
1. Purpose: One sentence summary
2. Tables: List tables involved
3. Logic: Step-by-step explanation of what the query does
4. Notes: Any potential issues or optimizations (if any)`, langInstruction)

	userPrompt := fmt.Sprintf("Explain this SQL query:\n\n```sql\n%s\n```", query)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		return a.fallbackExplainSQL(query), nil
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		"AI: SQL解释",
		map[string]interface{}{"query": truncateQuery(query, 200)},
	)

	return result, nil
}

func (a *App) fallbackExplainSQL(query string) string {
	analysis := a.AnalyzeQuery(query)
	var sb strings.Builder
	sb.WriteString("## SQL 分析 (离线模式)\n\n")
	sb.WriteString(fmt.Sprintf("**查询类型**: %s\n", analysis.QueryType))
	if len(analysis.Tables) > 0 {
		sb.WriteString(fmt.Sprintf("**涉及表**: %s\n", strings.Join(analysis.Tables, ", ")))
	}
	sb.WriteString(fmt.Sprintf("**JOIN 数量**: %d\n", analysis.JoinCount))
	sb.WriteString(fmt.Sprintf("**复杂度**: %s\n", analysis.Complexity))
	if len(analysis.Recommendations) > 0 {
		sb.WriteString("\n**建议**:\n")
		for _, rec := range analysis.Recommendations {
			sb.WriteString(fmt.Sprintf("- %s\n", rec))
		}
	}
	return sb.String()
}

func (a *App) DiagnoseQueryError(config Connection, database string, query string, errorMessage string) (string, error) {
	client, err := a.getAIClient()
	if err != nil {
		return fmt.Sprintf("AI 不可用: %v\n\n错误: %s", err, errorMessage), nil
	}

	schemaContext := a.buildSchemaContext(config, database, 5)

	lang := a.getCurrentLang()
	langInstruction := "Respond in Chinese."
	if lang == "en" {
		langInstruction = "Respond in English."
	}

	systemPrompt := fmt.Sprintf(`You are a database expert. A SQL query failed with an error. Diagnose the cause and suggest a fix. %s

Format:
1. Error Cause: Why the error occurred
2. Suggested Fix: Corrected SQL or action to take
3. Explanation: Brief explanation of the fix`, langInstruction)

	userPrompt := fmt.Sprintf("Query:\n%s\n\nError:\n%s\n\nRelevant schema:\n%s", query, errorMessage, schemaContext)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		return fmt.Sprintf("诊断失败: %v", err), nil
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		"AI: 错误诊断",
		map[string]interface{}{
			"query": truncateQuery(query, 200),
			"error": truncateQuery(errorMessage, 200),
		},
	)

	return result, nil
}

func (a *App) SuggestOptimizations(config Connection, database string, query string) (string, error) {
	client, err := a.getAIClient()
	if err != nil {
		return a.fallbackOptimize(query, config, database), nil
	}

	schemaContext := a.buildSchemaContext(config, database, 10)

	explainResult := a.GetExplainPlan(config, database, query)
	explainText := ""
	if explainResult.Success && explainResult.RootNode != nil {
		if plan, ok := explainResult.RootNode.Details["plan"]; ok {
			explainText = plan
		}
		for _, w := range explainResult.Warnings {
			explainText += "\nWarning: " + w
		}
	}

	lang := a.getCurrentLang()
	langInstruction := "Respond in Chinese."
	if lang == "en" {
		langInstruction = "Respond in English."
	}

	systemPrompt := fmt.Sprintf(`You are a database performance expert. Analyze the SQL query and suggest optimizations. %s

Format:
1. Current Issues: What's potentially slow
2. Index Suggestions: Specific CREATE INDEX statements
3. Query Rewrite: Optimized version of the query (if applicable)
4. Expected Impact: Why these changes help`, langInstruction)

	userPrompt := fmt.Sprintf("Query:\n%s\n\nEXPLAIN output:\n%s\n\nRelevant schema:\n%s", query, explainText, schemaContext)

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	result, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		return a.fallbackOptimize(query, config, database), nil
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		"AI: 优化建议",
		map[string]interface{}{"query": truncateQuery(query, 200)},
	)

	return result, nil
}

func (a *App) fallbackOptimize(query string, config Connection, database string) string {
	explainResult := a.GetExplainPlan(config, database, query)
	var sb strings.Builder
	sb.WriteString("## 优化建议 (离线模式)\n\n")

	if len(explainResult.Warnings) > 0 {
		sb.WriteString("**EXPLAIN 警告**:\n")
		for _, w := range explainResult.Warnings {
			sb.WriteString(fmt.Sprintf("- %s\n", w))
		}
	} else {
		sb.WriteString("未检测到明显性能问题。\n")
	}

	sb.WriteString("\n**通用建议**:\n")
	sb.WriteString("- 确保 WHERE 条件中的列有索引\n")
	sb.WriteString("- 避免 SELECT *, 只查询需要的列\n")
	sb.WriteString("- 大表 JOIN 确保连接条件有索引\n")
	sb.WriteString("- 考虑添加 LIMIT 限制结果集大小\n")

	return sb.String()
}

func (a *App) NaturalLanguageToSQL(config Connection, database string, naturalLanguage string) (string, error) {
	client, err := a.getAIClient()
	if err != nil {
		return "", fmt.Errorf("AI 不可用: %v", err)
	}

	schemaContext := a.buildSchemaContext(config, database, 20)

	dialect := "PostgreSQL"
	if config.Type == "mysql" {
		dialect = "MySQL"
	} else if config.Type == "sqlite" {
		dialect = "SQLite"
	}

	lang := a.getCurrentLang()
	langInstruction := "Respond in Chinese."
	if lang == "en" {
		langInstruction = "Respond in English."
	}

	systemPrompt := fmt.Sprintf(`You are an expert SQL developer. Convert the user's natural language request into a %s SQL query. %s

Rules:
- Return ONLY the SQL query, no explanation
- Use the schema provided
- Use proper %s syntax
- Add appropriate LIMIT if the user asks for "top" or "first" records`, dialect, langInstruction, dialect)

	userPrompt := fmt.Sprintf(`Schema:
%s

Request: %s`, schemaContext, naturalLanguage)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Complete(ctx, systemPrompt, userPrompt)
	if err != nil {
		return "", err
	}

	result = strings.TrimSpace(result)
	result = strings.TrimPrefix(result, "```sql")
	result = strings.TrimPrefix(result, "```")
	result = strings.TrimSuffix(result, "```")
	result = strings.TrimSpace(result)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		"AI: 自然语言转SQL",
		map[string]interface{}{
			"request":  truncateQuery(naturalLanguage, 200),
			"database": database,
		},
	)

	return result, nil
}

