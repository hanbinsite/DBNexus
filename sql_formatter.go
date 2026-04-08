package main

import (
	"regexp"
	"strings"
)

// FormatOptions 格式化选项
type FormatOptions struct {
	IndentWidth     int    `json:"indentWidth"`     // 缩进宽度
	KeywordCase     string `json:"keywordCase"`     // 关键字大小写: upper, lower, preserve
	LineBreakStyle  string `json:"lineBreakStyle"`  // 换行风格: standard, compact
	AlignClauses    bool   `json:"alignClauses"`    // 对齐子句
	FormatFunctions bool   `json:"formatFunctions"` // 格式化函数
	MaxLineLength   int    `json:"maxLineLength"`   // 最大行长度
}

// DefaultFormatOptions 默认格式化选项
var DefaultFormatOptions = FormatOptions{
	IndentWidth:     4,
	KeywordCase:     "upper",
	LineBreakStyle:  "standard",
	AlignClauses:    true,
	FormatFunctions: true,
	MaxLineLength:   80,
}

// SQLFormatter SQL 格式化器
type SQLFormatter struct {
	options        FormatOptions
	keywords       map[string]bool
	clauseKeywords []string
}

// NewSQLFormatter 创建 SQL 格式化器
func NewSQLFormatter(options FormatOptions) *SQLFormatter {
	if options.IndentWidth == 0 {
		options = DefaultFormatOptions
	}

	return &SQLFormatter{
		options:  options,
		keywords: getSQLKeywords(),
		clauseKeywords: []string{
			"SELECT", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY",
			"LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
			"DELETE", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN",
			"FULL JOIN", "ON", "UNION", "UNION ALL", "CREATE", "TABLE",
			"ALTER", "DROP", "INDEX", "PRIMARY KEY", "FOREIGN KEY",
			"REFERENCES", "UNIQUE", "NOT NULL", "DEFAULT", "AUTO_INCREMENT",
			"ENGINE", "CHARSET", "COLLATE", "WITH", "CASE", "WHEN", "THEN",
			"ELSE", "END",
		},
	}
}

// FormatSQL 格式化 SQL 语句
func (a *App) FormatSQL(sql string, options FormatOptions) string {
	formatter := NewSQLFormatter(options)
	return formatter.Format(sql)
}

// Format 格式化 SQL
func (f *SQLFormatter) Format(sql string) string {
	// 预处理
	sql = strings.TrimSpace(sql)
	if sql == "" {
		return ""
	}

	// 移除多余的空白
	sql = removeExtraWhitespace(sql)

	// 分词
	tokens := f.tokenize(sql)

	// 格式化
	formatted := f.formatTokens(tokens)

	return formatted
}

// tokenize 分词
func (f *SQLFormatter) tokenize(sql string) []string {
	var tokens []string
	var current strings.Builder
	inString := false
	stringChar := byte(0)

	for i := 0; i < len(sql); i++ {
		c := sql[i]

		// 处理字符串
		if inString {
			current.WriteByte(c)
			if c == stringChar && i > 0 && sql[i-1] != '\\' {
				tokens = append(tokens, current.String())
				current.Reset()
				inString = false
			}
			continue
		}

		// 检测字符串开始
		if c == '\'' || c == '"' || c == '`' {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			current.WriteByte(c)
			inString = true
			stringChar = c
			continue
		}

		// 处理空白
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			continue
		}

		// 处理特殊字符
		if c == '(' || c == ')' || c == ',' || c == ';' {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			tokens = append(tokens, string(c))
			continue
		}

		// 处理操作符
		if c == '=' || c == '<' || c == '>' || c == '!' {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			// 检查是否是组合操作符
			if i+1 < len(sql) && (sql[i+1] == '=' || sql[i+1] == '>') {
				tokens = append(tokens, string(c)+string(sql[i+1]))
				i++
			} else {
				tokens = append(tokens, string(c))
			}
			continue
		}

		current.WriteByte(c)
	}

	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}

	return tokens
}

// formatTokens 格式化 token 列表
func (f *SQLFormatter) formatTokens(tokens []string) string {
	var result strings.Builder
	indent := ""
	lineLength := 0

	for i, token := range tokens {
		upperToken := strings.ToUpper(token)

		// 检查是否需要换行
		if f.shouldBreakLine(upperToken, i, tokens) {
			result.WriteByte('\n')
			result.WriteString(indent)
			lineLength = len(indent)

			// 增加缩进（针对子查询）
			if upperToken == "SELECT" && i > 0 {
				indent += strings.Repeat(" ", f.options.IndentWidth)
			}
		}

		// 处理关键字大小写
		formattedToken := f.formatKeyword(token)

		// 添加空格（如果需要）
		if i > 0 && !f.shouldSkipSpace(tokens[i-1], token) {
			result.WriteByte(' ')
			lineLength++
		}

		// 写入 token
		result.WriteString(formattedToken)
		lineLength += len(formattedToken)
	}

	return strings.TrimSpace(result.String())
}

// shouldBreakLine 判断是否应该换行
func (f *SQLFormatter) shouldBreakLine(token string, index int, tokens []string) bool {
	// 主要子句总是换行
	for _, clause := range f.clauseKeywords {
		if token == clause {
			return true
		}
	}

	// 逗号后的换行（在标准模式下）
	if index > 0 && tokens[index-1] == "," && f.options.LineBreakStyle == "standard" {
		return true
	}

	return false
}

// shouldSkipSpace 判断是否应该跳过空格
func (f *SQLFormatter) shouldSkipSpace(prevToken, currentToken string) bool {
	// 括号后不需要空格
	if prevToken == "(" {
		return true
	}

	// 括号前不需要空格
	if currentToken == ")" || currentToken == "(" {
		if prevToken != "(" && prevToken != "," {
			return false
		}
		return true
	}

	// 逗号前不需要空格
	if currentToken == "," {
		return true
	}

	// 操作符前后需要空格（除了某些情况）
	return false
}

// formatKeyword 格式化关键字
func (f *SQLFormatter) formatKeyword(token string) string {
	// 检查是否是关键字
	if !f.keywords[strings.ToUpper(token)] {
		return token
	}

	switch f.options.KeywordCase {
	case "upper":
		return strings.ToUpper(token)
	case "lower":
		return strings.ToLower(token)
	default:
		return token
	}
}

// removeExtraWhitespace 移除多余空白
func removeExtraWhitespace(sql string) string {
	// 使用正则表达式替换多个空白为单个空格
	re := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(re.ReplaceAllString(sql, " "))
}

// getSQLKeywords 获取 SQL 关键字集合
func getSQLKeywords() map[string]bool {
	keywords := []string{
		"SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "INTO",
		"VALUES", "SET", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "FULL",
		"ON", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC", "LIMIT",
		"OFFSET", "UNION", "ALL", "DISTINCT", "AS", "AND", "OR", "NOT",
		"IN", "LIKE", "BETWEEN", "IS", "NULL", "TRUE", "FALSE",
		"CREATE", "ALTER", "DROP", "TABLE", "INDEX", "VIEW", "DATABASE",
		"PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "DEFAULT",
		"AUTO_INCREMENT", "NOT", "NULL", "ENGINE", "CHARSET", "COLLATE",
		"WITH", "CASE", "WHEN", "THEN", "ELSE", "END", "EXISTS",
		"BETWEEN", "COUNT", "SUM", "AVG", "MAX", "MIN", "COALESCE",
		"IFNULL", "NULLIF", "CAST", "CONVERT", "CONCAT", "SUBSTRING",
		"LENGTH", "UPPER", "LOWER", "TRIM", "LTRIM", "RTRIM", "REPLACE",
		"NOW", "CURDATE", "CURTIME", "DATE", "TIME", "YEAR", "MONTH",
		"DAY", "HOUR", "MINUTE", "SECOND", "USE", "SHOW", "DESCRIBE",
		"EXPLAIN", "TRUNCATE", "USING", "NATURAL", "CROSS", "RECURSIVE",
	}

	keywordSet := make(map[string]bool)
	for _, kw := range keywords {
		keywordSet[kw] = true
	}

	return keywordSet
}

// MinifySQL 压缩 SQL（移除所有不必要的空白）
func (a *App) MinifySQL(sql string) string {
	sql = strings.TrimSpace(sql)
	if sql == "" {
		return ""
	}

	// 移除注释
	sql = removeSQLComments(sql)

	// 移除多余空白
	sql = removeExtraWhitespace(sql)

	return sql
}

// removeSQLComments 移除 SQL 注释
func removeSQLComments(sql string) string {
	// 移除单行注释 --
	re1 := regexp.MustCompile(`--.*?\n`)
	sql = re1.ReplaceAllString(sql, " ")

	// 移除多行注释 /* */
	re2 := regexp.MustCompile(`/\*.*?\*/`)
	sql = re2.ReplaceAllString(sql, " ")

	return sql
}

// ValidateSQL 验证 SQL 语法（基础验证）
func (a *App) ValidateSQL(sql string) (bool, []string) {
	var errors []string

	sql = strings.ToUpper(strings.TrimSpace(sql))
	if sql == "" {
		errors = append(errors, "SQL 语句为空")
		return false, errors
	}

	// 检查基本语法
	if !hasValidStart(sql) {
		errors = append(errors, "SQL 语句必须以 SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, SHOW, USE 或 EXPLAIN 开头")
	}

	// 检查括号匹配
	if !hasBalancedParentheses(sql) {
		errors = append(errors, "括号不匹配")
	}

	// 检查引号匹配
	if !hasBalancedQuotes(sql) {
		errors = append(errors, "引号不匹配")
	}

	return len(errors) == 0, errors
}

// hasValidStart 检查是否有有效的起始关键字
func hasValidStart(sql string) bool {
	validStarts := []string{
		"SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER",
		"DROP", "SHOW", "USE", "EXPLAIN", "DESCRIBE", "TRUNCATE",
	}

	for _, start := range validStarts {
		if strings.HasPrefix(sql, start) {
			return true
		}
	}

	return false
}

// hasBalancedParentheses 检查括号是否匹配
func hasBalancedParentheses(sql string) bool {
	count := 0
	inString := false
	stringChar := byte(0)

	for i := 0; i < len(sql); i++ {
		c := sql[i]

		if inString {
			if c == stringChar && i > 0 && sql[i-1] != '\\' {
				inString = false
			}
			continue
		}

		if c == '\'' || c == '"' || c == '`' {
			inString = true
			stringChar = c
			continue
		}

		if c == '(' {
			count++
		} else if c == ')' {
			count--
			if count < 0 {
				return false
			}
		}
	}

	return count == 0
}

// hasBalancedQuotes 检查引号是否匹配
func hasBalancedQuotes(sql string) bool {
	singleCount := 0
	doubleCount := 0
	backtickCount := 0

	for i := 0; i < len(sql); i++ {
		c := sql[i]
		if i > 0 && sql[i-1] == '\\' {
			continue
		}

		switch c {
		case '\'':
			singleCount++
		case '"':
			doubleCount++
		case '`':
			backtickCount++
		}
	}

	return singleCount%2 == 0 && doubleCount%2 == 0 && backtickCount%2 == 0
}

// BeautifySQL 美化 SQL（快速美化）
func (a *App) BeautifySQL(sql string) string {
	return a.FormatSQL(sql, DefaultFormatOptions)
}

// CompactSQL 紧凑格式 SQL
func (a *App) CompactSQL(sql string) string {
	options := FormatOptions{
		IndentWidth:    2,
		KeywordCase:    "upper",
		LineBreakStyle: "compact",
		MaxLineLength:  120,
	}
	return a.FormatSQL(sql, options)
}

// GetSQLStructure 获取 SQL 结构分析
func (a *App) GetSQLStructure(sql string) map[string]interface{} {
	structure := make(map[string]interface{})

	sql = strings.ToUpper(strings.TrimSpace(sql))

	// 检测 SQL 类型
	if strings.HasPrefix(sql, "SELECT") {
		structure["type"] = "SELECT"
		structure["has_where"] = strings.Contains(sql, " WHERE ")
		structure["has_join"] = strings.Contains(sql, " JOIN ")
		structure["has_group"] = strings.Contains(sql, " GROUP BY ")
		structure["has_order"] = strings.Contains(sql, " ORDER BY ")
		structure["has_limit"] = strings.Contains(sql, " LIMIT ")
		structure["has_union"] = strings.Contains(sql, " UNION ")
	} else if strings.HasPrefix(sql, "INSERT") {
		structure["type"] = "INSERT"
	} else if strings.HasPrefix(sql, "UPDATE") {
		structure["type"] = "UPDATE"
	} else if strings.HasPrefix(sql, "DELETE") {
		structure["type"] = "DELETE"
	} else if strings.HasPrefix(sql, "CREATE") {
		structure["type"] = "CREATE"
	} else if strings.HasPrefix(sql, "ALTER") {
		structure["type"] = "ALTER"
	} else if strings.HasPrefix(sql, "DROP") {
		structure["type"] = "DROP"
	} else {
		structure["type"] = "OTHER"
	}

	return structure
}
