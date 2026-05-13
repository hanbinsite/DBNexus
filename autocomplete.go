package main

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

type AutoCompleteType string

const (
	AutoCompleteTable    AutoCompleteType = "table"
	AutoCompleteColumn   AutoCompleteType = "column"
	AutoCompleteKeyword  AutoCompleteType = "keyword"
	AutoCompleteFunction AutoCompleteType = "function"
	AutoCompleteDatabase AutoCompleteType = "database"
)

type AutoCompleteItem struct {
	Label         string           `json:"label"`
	Kind          AutoCompleteType `json:"kind"`
	Detail        string           `json:"detail,omitempty"`
	Documentation string           `json:"documentation,omitempty"`
	InsertText    string           `json:"insertText"`
	SortText      string           `json:"sortText"`
}

type AutoCompleteResult struct {
	Suggestions []AutoCompleteItem `json:"suggestions"`
	From        int                `json:"from"`
	To          int                `json:"to"`
}

type SQLKeyword struct {
	Keyword string
	Detail  string
}

var (
	sqlKeywords = []SQLKeyword{
		{"SELECT", "从数据库中选取数据"},
		{"FROM", "指定要查询的表"},
		{"WHERE", "指定过滤条件"},
		{"INSERT", "插入新数据"},
		{"INTO", "指定插入的表"},
		{"VALUES", "指定插入的值"},
		{"UPDATE", "更新数据"},
		{"SET", "指定要更新的列"},
		{"DELETE", "删除数据"},
		{"JOIN", "连接表"},
		{"INNER", "内连接"},
		{"LEFT", "左连接"},
		{"RIGHT", "右连接"},
		{"OUTER", "外连接"},
		{"ON", "指定连接条件"},
		{"GROUP", "分组"},
		{"BY", "按...分组/排序"},
		{"HAVING", "分组过滤条件"},
		{"ORDER", "排序"},
		{"ASC", "升序"},
		{"DESC", "降序"},
		{"LIMIT", "限制返回行数"},
		{"OFFSET", "偏移量"},
		{"DISTINCT", "去重"},
		{"COUNT", "计数"},
		{"SUM", "求和"},
		{"AVG", "平均值"},
		{"MAX", "最大值"},
		{"MIN", "最小值"},
		{"LIKE", "模糊匹配"},
		{"IN", "在列表中"},
		{"BETWEEN", "在范围内"},
		{"AND", "逻辑与"},
		{"OR", "逻辑或"},
		{"NOT", "逻辑非"},
		{"NULL", "空值"},
		{"IS", "是"},
		{"AS", "别名"},
		{"CREATE", "创建"},
		{"TABLE", "表"},
		{"INDEX", "索引"},
		{"DROP", "删除"},
		{"ALTER", "修改"},
		{"ADD", "添加"},
		{"COLUMN", "列"},
		{"PRIMARY", "主键"},
		{"KEY", "键"},
		{"FOREIGN", "外键"},
		{"REFERENCES", "引用"},
		{"UNIQUE", "唯一"},
		{"DEFAULT", "默认值"},
		{"AUTO_INCREMENT", "自增"},
		{"ENGINE", "存储引擎"},
		{"CHARSET", "字符集"},
		{"COLLATE", "排序规则"},
		{"SHOW", "显示"},
		{"DESCRIBE", "描述表结构"},
		{"EXPLAIN", "查询执行计划"},
		{"USE", "切换数据库"},
		{"DATABASE", "数据库"},
		{"TRUNCATE", "清空表"},
		{"UNION", "联合查询"},
		{"ALL", "所有"},
		{"CASE", "条件表达式"},
		{"WHEN", "当"},
		{"THEN", "则"},
		{"ELSE", "否则"},
		{"END", "结束"},
		{"WITH", "CTE 表达式"},
		{"RECURSIVE", "递归"},
	}

	sqlFunctions = []SQLKeyword{
		{"CONCAT", "连接字符串"},
		{"SUBSTRING", "截取子串"},
		{"LENGTH", "字符串长度"},
		{"UPPER", "转大写"},
		{"LOWER", "转小写"},
		{"TRIM", "去除空格"},
		{"LTRIM", "去除左侧空格"},
		{"RTRIM", "去除右侧空格"},
		{"REPLACE", "替换字符串"},
		{"REVERSE", "反转字符串"},
		{"LEFT", "取左侧字符"},
		{"RIGHT", "取右侧字符"},
		{"LPAD", "左侧填充"},
		{"RPAD", "右侧填充"},
		{"INSTR", "查找子串位置"},
		{"LOCATE", "定位子串"},

		{"ABS", "绝对值"},
		{"CEIL", "向上取整"},
		{"FLOOR", "向下取整"},
		{"ROUND", "四舍五入"},
		{"MOD", "取模"},
		{"POWER", "幂运算"},
		{"SQRT", "平方根"},
		{"RAND", "随机数"},
		{"SIGN", "符号"},
		{"EXP", "e的幂"},
		{"LN", "自然对数"},
		{"LOG", "对数"},
		{"LOG10", "以10为底的对数"},

		{"NOW", "当前日期时间"},
		{"CURDATE", "当前日期"},
		{"CURTIME", "当前时间"},
		{"DATE", "提取日期"},
		{"TIME", "提取时间"},
		{"YEAR", "提取年份"},
		{"MONTH", "提取月份"},
		{"DAY", "提取日"},
		{"HOUR", "提取小时"},
		{"MINUTE", "提取分钟"},
		{"SECOND", "提取秒"},
		{"DATE_FORMAT", "格式化日期"},
		{"DATE_ADD", "日期加"},
		{"DATE_SUB", "日期减"},
		{"DATEDIFF", "日期差"},
		{"TIMESTAMPDIFF", "时间戳差"},

		{"COUNT", "计数"},
		{"SUM", "求和"},
		{"AVG", "平均值"},
		{"MAX", "最大值"},
		{"MIN", "最小值"},
		{"GROUP_CONCAT", "分组连接"},

		{"IF", "条件判断"},
		{"IFNULL", "空值处理"},
		{"NULLIF", "空值判断"},
		{"COALESCE", "返回第一个非空值"},

		{"CAST", "类型转换"},
		{"CONVERT", "类型转换"},

		{"USER", "当前用户"},
		{"DATABASE", "当前数据库"},
		{"VERSION", "数据库版本"},
		{"LAST_INSERT_ID", "最后插入ID"},
	}

	mysqlFunctions = []SQLKeyword{
		{"IFNULL", "空值替换"},
		{"GROUP_CONCAT", "分组连接字符串"},
		{"FIND_IN_SET", "在集合中查找"},
		{"FIELD", "返回字符串位置"},
		{"ELT", "返回第N个字符串"},
		{"JSON_EXTRACT", "提取JSON值"},
		{"JSON_UNQUOTE", "去除JSON引号"},
		{"REGEXP", "正则匹配"},
	}

	postgresFunctions = []SQLKeyword{
		{"STRING_AGG", "字符串聚合"},
		{"ARRAY_AGG", "数组聚合"},
		{"JSON_AGG", "JSON聚合"},
		{"JSONB_BUILD_OBJECT", "构建JSON对象"},
		{"TO_JSON", "转换为JSON"},
		{"TO_JSONB", "转换为JSONB"},
		{"AGE", "计算年龄"},
		{"JUSTIFY_DAYS", "调整天数"},
		{"MD5", "MD5哈希"},
		{"ENCODE", "编码"},
		{"DECODE", "解码"},
	}
)

func (a *App) GetAutoCompleteSuggestions(config Connection, database string, query string, position int) AutoCompleteResult {
	ctx := context.Background()

	word, startPos, endPos := extractCurrentWord(query, position)
	context := analyzeQueryContext(query, startPos)

	var suggestions []AutoCompleteItem

	switch context {
	case "FROM", "JOIN", "INTO", "UPDATE", "TABLE":
		suggestions = a.getTableSuggestions(ctx, config, database, word)
	case "SELECT", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "SET":
		columnSuggestions := a.getColumnSuggestions(ctx, config, database, word)
		functionSuggestions := a.getFunctionSuggestions(word, config.Type)
		keywordSuggestions := a.getKeywordSuggestions(word)
		suggestions = append(suggestions, columnSuggestions...)
		suggestions = append(suggestions, functionSuggestions...)
		suggestions = append(suggestions, keywordSuggestions...)
	case "USE", "DATABASE":
		suggestions = a.getDatabaseSuggestions(ctx, config, word)
	default:
		keywordSuggestions := a.getKeywordSuggestions(word)
		functionSuggestions := a.getFunctionSuggestions(word, config.Type)
		suggestions = append(suggestions, keywordSuggestions...)
		suggestions = append(suggestions, functionSuggestions...)
	}

	suggestions = filterAndSortSuggestions(suggestions, word)

	return AutoCompleteResult{
		Suggestions: suggestions,
		From:        startPos,
		To:          endPos,
	}
}

func extractCurrentWord(query string, position int) (string, int, int) {
	if position < 0 || position > len(query) {
		return "", 0, 0
	}

	start := position
	for start > 0 && isIdentifierChar(query[start-1]) {
		start--
	}

	end := position
	for end < len(query) && isIdentifierChar(query[end]) {
		end++
	}

	return query[start:end], start, end
}

func isIdentifierChar(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_'
}

func analyzeQueryContext(query string, position int) string {
	textBefore := strings.ToUpper(query[:position])

	keywords := []string{"FROM", "JOIN", "INTO", "UPDATE", "SELECT", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "SET", "USE", "TABLE", "DATABASE"}

	for _, keyword := range keywords {
		idx := strings.LastIndex(textBefore, keyword)
		if idx != -1 {
			afterKeyword := strings.TrimSpace(textBefore[idx+len(keyword):])
			hasOtherKeyword := false
			for _, otherKeyword := range keywords {
				if strings.HasPrefix(afterKeyword, otherKeyword) {
					hasOtherKeyword = true
					break
				}
			}
			if !hasOtherKeyword {
				return keyword
			}
		}
	}

	return ""
}

func (a *App) getTableSuggestions(ctx context.Context, config Connection, database string, prefix string) []AutoCompleteItem {
	var items []AutoCompleteItem

	tables, err := a.GetTables(config, database)
	if err != nil {
		return items
	}

	prefix = strings.ToLower(prefix)
	for _, table := range tables {
		if prefix == "" || strings.HasPrefix(strings.ToLower(table.Name), prefix) {
			items = append(items, AutoCompleteItem{
				Label:      table.Name,
				Kind:       AutoCompleteTable,
				Detail:     fmt.Sprintf("表 (%s)", table.Type),
				InsertText: table.Name,
				SortText:   "0" + table.Name,
			})
		}
	}

	return items
}

func (a *App) getColumnSuggestions(ctx context.Context, config Connection, database string, prefix string) []AutoCompleteItem {
	var items []AutoCompleteItem

	tables, err := a.GetTables(config, database)
	if err != nil {
		return items
	}

	prefix = strings.ToLower(prefix)

	for _, table := range tables {
		columns, err := a.GetTableColumns(config, database, table.Name)
		if err != nil {
			continue
		}
		for _, col := range columns {
			if prefix == "" || strings.HasPrefix(strings.ToLower(col.Name), prefix) {
				items = append(items, AutoCompleteItem{
					Label:      col.Name,
					Kind:       AutoCompleteColumn,
					Detail:     fmt.Sprintf("%s (%s.%s)", col.Type, table.Name, col.Name),
					InsertText: col.Name,
					SortText:   "1" + col.Name,
				})
			}
		}
	}

	return items
}

func (a *App) getDatabaseSuggestions(ctx context.Context, config Connection, prefix string) []AutoCompleteItem {
	var items []AutoCompleteItem

	databases, err := a.GetDatabases(config)
	if err != nil {
		return items
	}

	prefix = strings.ToLower(prefix)
	for _, db := range databases {
		if prefix == "" || strings.HasPrefix(strings.ToLower(db.Name), prefix) {
			items = append(items, AutoCompleteItem{
				Label:      db.Name,
				Kind:       AutoCompleteDatabase,
				Detail:     "数据库",
				InsertText: db.Name,
				SortText:   "0" + db.Name,
			})
		}
	}

	return items
}

func (a *App) getKeywordSuggestions(prefix string) []AutoCompleteItem {
	var items []AutoCompleteItem

	prefix = strings.ToUpper(prefix)
	for _, kw := range sqlKeywords {
		if prefix == "" || strings.HasPrefix(kw.Keyword, prefix) {
			items = append(items, AutoCompleteItem{
				Label:         kw.Keyword,
				Kind:          AutoCompleteKeyword,
				Detail:        kw.Detail,
				Documentation: fmt.Sprintf("SQL 关键字: %s", kw.Keyword),
				InsertText:    kw.Keyword,
				SortText:      "1" + kw.Keyword,
			})
		}
	}

	return items
}

func (a *App) getFunctionSuggestions(prefix string, dbType string) []AutoCompleteItem {
	var items []AutoCompleteItem

	allFunctions := append(sqlFunctions, getDBSpecificFunctions(dbType)...)

	prefix = strings.ToUpper(prefix)
	for _, fn := range allFunctions {
		if prefix == "" || strings.HasPrefix(fn.Keyword, prefix) {
			items = append(items, AutoCompleteItem{
				Label:         fn.Keyword,
				Kind:          AutoCompleteFunction,
				Detail:        fn.Detail,
				Documentation: fmt.Sprintf("函数: %s()", fn.Keyword),
				InsertText:    fn.Keyword + "()",
				SortText:      "2" + fn.Keyword,
			})
		}
	}

	return items
}

func getDBSpecificFunctions(dbType string) []SQLKeyword {
	switch dbType {
	case "mysql":
		return mysqlFunctions
	case "postgresql", "polardb", "gaussdb":
		return postgresFunctions
	default:
		return []SQLKeyword{}
	}
}

func filterAndSortSuggestions(suggestions []AutoCompleteItem, prefix string) []AutoCompleteItem {
	if prefix == "" {
		return suggestions
	}

	var filtered []AutoCompleteItem
	prefix = strings.ToLower(prefix)
	for _, item := range suggestions {
		if strings.HasPrefix(strings.ToLower(item.Label), prefix) {
			filtered = append(filtered, item)
		}
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].SortText < filtered[j].SortText
	})

	if len(filtered) > 50 {
		filtered = filtered[:50]
	}

	return filtered
}

func (a *App) GetTableColumnsForAutoComplete(config Connection, database string, tableName string) ([]AutoCompleteItem, error) {
	var items []AutoCompleteItem

	columns, err := a.GetTableColumns(config, database, tableName)
	if err != nil {
		return items, err
	}

	for _, col := range columns {
		detail := col.Type
		if col.PrimaryKey {
			detail += " (主键)"
		}
		if !col.Nullable {
			detail += " (非空)"
		}

		items = append(items, AutoCompleteItem{
			Label:         col.Name,
			Kind:          AutoCompleteColumn,
			Detail:        detail,
			Documentation: fmt.Sprintf("列: %s, 类型: %s", col.Name, col.Type),
			InsertText:    col.Name,
			SortText:      "0" + col.Name,
		})
	}

	return items, nil
}

func (a *App) GetQuickSuggestions(prefix string) []AutoCompleteItem {
	var items []AutoCompleteItem

	items = append(items, a.getKeywordSuggestions(prefix)...)
	items = append(items, a.getFunctionSuggestions(prefix, "")...)

	return items
}
