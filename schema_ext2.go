package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

// S5-3: JSON/XML 格式化显示
func (a *App) FormatCellValue(value interface{}, format string) (string, error) {
	if value == nil {
		return "NULL", nil
	}

	switch format {
	case "json":
		str, ok := value.(string)
		if !ok {
			bytes, err := json.MarshalIndent(value, "", "  ")
			if err != nil {
				return "", fmt.Errorf("JSON format failed: %w", err)
			}
			return string(bytes), nil
		}
		// Try to parse and re-format
		var parsed interface{}
		if err := json.Unmarshal([]byte(str), &parsed); err != nil {
			return str, nil // Return as-is if not valid JSON
		}
		formatted, err := json.MarshalIndent(parsed, "", "  ")
		if err != nil {
			return str, nil
		}
		return string(formatted), nil

	case "xml":
		str, ok := value.(string)
		if !ok {
			return fmt.Sprintf("%v", value), nil
		}
		// Simple XML pretty-print (indent nested tags)
		return prettyPrintXML(str), nil

	case "base64":
		str, ok := value.(string)
		if !ok {
			return fmt.Sprintf("%v", value), nil
		}
		return str, nil

	case "hex":
		if bytes, ok := value.([]byte); ok {
			return fmt.Sprintf("%x", bytes), nil
		}
		return fmt.Sprintf("%v", value), nil

	default:
		return fmt.Sprintf("%v", value), nil
	}
}

func prettyPrintXML(xml string) string {
	var result strings.Builder
	indent := 0
	inTag := false
	inContent := false

	for i, ch := range xml {
		if ch == '<' {
			if inContent {
				result.WriteString("\n")
			}
			inTag = true
			// Check if closing tag
			if i+1 < len(xml) && xml[i+1] == '/' {
				indent--
			}
			result.WriteString(strings.Repeat("  ", indent))
		} else if ch == '>' {
			result.WriteString(string(ch))
			inTag = false
			// Check if self-closing or opening tag
			if i > 0 && xml[i-1] != '/' {
				// Opening tag — expect content
				inContent = true
				// Check if next char is not '<' (has content)
				if i+1 < len(xml) && xml[i+1] != '<' && xml[i+1] != '\n' && xml[i+1] != '\r' {
					// Don't increment indent for inline content
				} else {
					indent++
					result.WriteString("\n")
					inContent = false
				}
			} else {
				inContent = false
			}
			continue
		}

		if inTag || !inContent {
			result.WriteRune(ch)
		} else if inContent {
			result.WriteRune(ch)
		}
	}

	return result.String()
}

// S5-4: 结构对比
type StructureDiff struct {
	TableName   string   `json:"table_name"`
	OnlyIn1     []string `json:"only_in_1"`
	OnlyIn2     []string `json:"only_in_2"`
	TypeMismatches []TypeMismatch `json:"type_mismatches"`
	NullableDiffs []NullableDiff `json:"nullable_diffs"`
}

type TypeMismatch struct {
	Column    string `json:"column"`
	Type1     string `json:"type_1"`
	Type2     string `json:"type_2"`
}

type NullableDiff struct {
	Column    string `json:"column"`
	Nullable1 bool   `json:"nullable_1"`
	Nullable2 bool   `json:"nullable_2"`
}

func (a *App) CompareTableStructures(config Connection, database string, table1 string, table2 string) (*StructureDiff, error) {
	if table1 == "" || table2 == "" {
		return nil, fmt.Errorf("both table names are required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	cols1, err := driver.GetTableStructure(ctx, table1)
	if err != nil {
		return nil, fmt.Errorf("failed to get structure for %s: %w", table1, err)
	}
	cols2, err := driver.GetTableStructure(ctx, table2)
	if err != nil {
		return nil, fmt.Errorf("failed to get structure for %s: %w", table2, err)
	}

	diff := &StructureDiff{TableName: fmt.Sprintf("%s vs %s", table1, table2)}

	map1 := make(map[string]interface{})
	for _, c := range cols1 {
		map1[c.Name] = c
	}
	map2 := make(map[string]interface{})
	for _, c := range cols2 {
		map2[c.Name] = c
	}

	for name := range map1 {
		if _, exists := map2[name]; !exists {
			diff.OnlyIn1 = append(diff.OnlyIn1, name)
		}
	}
	for name := range map2 {
		if _, exists := map1[name]; !exists {
			diff.OnlyIn2 = append(diff.OnlyIn2, name)
		}
	}

	for _, c1 := range cols1 {
		if c2, exists := map2[c1.Name]; exists {
			col2 := c2.(interface{})
			// Use reflection-free approach
			cols2Map, _ := json.Marshal(col2)
			var c2Map map[string]interface{}
			json.Unmarshal(cols2Map, &c2Map)

			type2, _ := c2Map["type"].(string)
			nullable2, _ := c2Map["nullable"].(bool)

			if c1.Type != type2 {
				diff.TypeMismatches = append(diff.TypeMismatches, TypeMismatch{
					Column: c1.Name, Type1: c1.Type, Type2: type2,
				})
			}
			if c1.Nullable != nullable2 {
				diff.NullableDiffs = append(diff.NullableDiffs, NullableDiff{
					Column: c1.Name, Nullable1: c1.Nullable, Nullable2: nullable2,
				})
			}
		}
	}

	return diff, nil
}

// S5-7: 查询结果缓存
type QueryCache struct {
	cache map[string]*QueryResult
	keys  []string
	mu    sync.RWMutex
	maxSize int
}

var queryCache = &QueryCache{
	cache:   make(map[string]*QueryResult),
	maxSize: 50,
}

func (c *QueryCache) Get(key string) (*QueryResult, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result, exists := c.cache[key]
	return result, exists
}

func (c *QueryCache) Set(key string, result *QueryResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.cache) >= c.maxSize {
		// Evict oldest
		if len(c.keys) > 0 {
			oldest := c.keys[0]
			delete(c.cache, oldest)
			c.keys = c.keys[1:]
		}
	}
	c.cache[key] = result
	c.keys = append(c.keys, key)
}

func (c *QueryCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]*QueryResult)
	c.keys = nil
}

func (a *App) ClearQueryCache() {
	queryCache.Clear()
	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery, "查询缓存已清空", nil)
}

func (a *App) GetQueryCacheSize() int {
	queryCache.mu.RLock()
	defer queryCache.mu.RUnlock()
	return len(queryCache.cache)
}

