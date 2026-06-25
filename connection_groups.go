package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// S6-4: 连接分组管理 (文件夹组织)
type ConnectionGroup struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color,omitempty"`
	Order int    `json:"order,omitempty"`
}

type ConnectionWithGroup struct {
	Connection
	GroupID string `json:"group_id,omitempty"`
}

var (
	groupsMu     sync.RWMutex
	connectionGroups []ConnectionGroup
	groupsLoaded bool
)

func getGroupsFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".db-client", "groups.json")
}

func loadGroups() {
	groupsMu.Lock()
	defer groupsMu.Unlock()
	if groupsLoaded {
		return
	}
	groupsLoaded = true

	data, err := os.ReadFile(getGroupsFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &connectionGroups)
}

func saveGroups() error {
	data, err := json.Marshal(connectionGroups)
	if err != nil {
		return err
	}
	dir := filepath.Dir(getGroupsFilePath())
	os.MkdirAll(dir, 0700)
	return os.WriteFile(getGroupsFilePath(), data, 0600)
}

func (a *App) GetConnectionGroups() []ConnectionGroup {
	loadGroups()
	groupsMu.RLock()
	defer groupsMu.RUnlock()

	result := make([]ConnectionGroup, len(connectionGroups))
	copy(result, connectionGroups)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Order < result[j].Order
	})
	return result
}

func (a *App) CreateConnectionGroup(name string, color string) (ConnectionGroup, error) {
	if name == "" {
		return ConnectionGroup{}, fmt.Errorf("group name is required")
	}

	loadGroups()
	groupsMu.Lock()
	defer groupsMu.Unlock()

	group := ConnectionGroup{
		ID:    fmt.Sprintf("grp_%d", time.Now().UnixNano()),
		Name:  name,
		Color: color,
		Order: len(connectionGroups),
	}
	connectionGroups = append(connectionGroups, group)

	if err := saveGroups(); err != nil {
		return ConnectionGroup{}, fmt.Errorf("failed to save group: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("创建连接分组: %s", name),
		map[string]interface{}{"group": name},
	)

	return group, nil
}

func (a *App) DeleteConnectionGroup(groupID string) error {
	loadGroups()
	groupsMu.Lock()
	defer groupsMu.Unlock()

	found := false
	for i, g := range connectionGroups {
		if g.ID == groupID {
			connectionGroups = append(connectionGroups[:i], connectionGroups[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("group not found: %s", groupID)
	}

	if err := saveGroups(); err != nil {
		return fmt.Errorf("failed to save: %w", err)
	}

	return nil
}

func (a *App) RenameConnectionGroup(groupID string, newName string) error {
	if newName == "" {
		return fmt.Errorf("new name is required")
	}

	loadGroups()
	groupsMu.Lock()
	defer groupsMu.Unlock()

	for i, g := range connectionGroups {
		if g.ID == groupID {
			connectionGroups[i].Name = newName
			if err := saveGroups(); err != nil {
				return fmt.Errorf("failed to save: %w", err)
			}
			return nil
		}
	}
	return fmt.Errorf("group not found: %s", groupID)
}

// S6-6: 查询计划可视化
type PlanNode struct {
	ID          int                    `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Cost        float64                `json:"cost,omitempty"`
	Rows        int64                  `json:"rows,omitempty"`
	ActualRows  int64                  `json:"actual_rows,omitempty"`
	Loops       int64                  `json:"loops,omitempty"`
	Details     map[string]string      `json:"details,omitempty"`
	Children    []PlanNode             `json:"children,omitempty"`
	Warnings    []string               `json:"warnings,omitempty"`
}

func (a *App) GetVisualQueryPlan(config Connection, database string, query string) (*PlanNode, error) {
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	var explainQuery string
	switch config.Type {
	case "mysql":
		explainQuery = "EXPLAIN FORMAT=JSON " + query
	case "postgresql", "polardb", "gaussdb":
		explainQuery = "EXPLAIN (FORMAT JSON, ANALYZE false) " + query
	default:
		return nil, fmt.Errorf("visual plan not supported for %s", config.Type)
	}

	rows, err := driver.Query(ctx, explainQuery)
	if err != nil {
		// Fallback to simple EXPLAIN
		explainQuery = "EXPLAIN " + query
		rows, err = driver.Query(ctx, explainQuery)
		if err != nil {
			return nil, fmt.Errorf("EXPLAIN failed: %w", err)
		}
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	if rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}

		// Parse JSON plan (MySQL FORMAT=JSON or PG FORMAT JSON)
		var jsonStr string
		if b, ok := values[0].([]byte); ok {
			jsonStr = string(b)
		} else if s, ok := values[0].(string); ok {
			jsonStr = s
		} else {
			jsonStr = fmt.Sprintf("%v", values[0])
		}

		return parseJSONPlan(jsonStr, config.Type)
	}

	return &PlanNode{ID: 1, Name: "Empty Plan", Type: "ROOT"}, nil
}

func parseJSONPlan(jsonStr string, dbType string) (*PlanNode, error) {
	// Try to parse as JSON array (PostgreSQL format) or object (MySQL format)
	var raw interface{}

	// PG wraps in array, MySQL wraps in array of objects
	trimmed := jsonStr
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return &PlanNode{
			ID:       1,
			Name:     "Plan (raw)",
			Type:     "ROOT",
			Details:  map[string]string{"raw": truncateQuery(jsonStr, 500)},
		}, nil
	}

	root := &PlanNode{
		ID:      1,
		Name:    "Query Plan",
		Type:    "ROOT",
		Details: make(map[string]string),
		Children: []PlanNode{},
	}

	// Extract plan from JSON structure
	switch v := raw.(type) {
	case []interface{}:
		if len(v) > 0 {
			if obj, ok := v[0].(map[string]interface{}); ok {
				if plan, ok := obj["Plan"]; ok {
					extractPlanNode(plan, root, 1)
				}
				if qtext, ok := obj["Query Text"]; ok {
					root.Details["query"] = fmt.Sprintf("%v", qtext)
				}
			}
		}
	case map[string]interface{}:
		if plan, ok := v["query_block"]; ok {
			extractMySQLPlan(plan, root, 1)
		} else if plan, ok := v["Plan"]; ok {
			extractPlanNode(plan, root, 1)
		}
	}

	return root, nil
}

var planNodeCounter int

func extractPlanNode(data interface{}, parent *PlanNode, depth int) {
	if data == nil {
		return
	}

	if m, ok := data.(map[string]interface{}); ok {
		node := PlanNode{
			ID:      planNodeCounter,
			Details: make(map[string]string),
		}
		planNodeCounter++

		if nodeType, ok := m["Node Type"]; ok {
			node.Type = fmt.Sprintf("%v", nodeType)
			node.Name = node.Type
		}
		if cost, ok := m["Total Cost"]; ok {
			if f, ok := cost.(float64); ok {
				node.Cost = f
			}
		}
		if rows, ok := m["Plan Rows"]; ok {
			if f, ok := rows.(float64); ok {
				node.Rows = int64(f)
			}
		}
		if actualRows, ok := m["Actual Rows"]; ok {
			if f, ok := actualRows.(float64); ok {
				node.ActualRows = int64(f)
			}
		}

		// Extract other details
		for k, v := range m {
			if k != "Plans" && k != "Node Type" && k != "Total Cost" && k != "Plan Rows" && k != "Actual Rows" {
				node.Details[k] = fmt.Sprintf("%v", v)
			}
		}

		parent.Children = append(parent.Children, node)

		// Process sub-plans
		if plans, ok := m["Plans"]; ok {
			if arr, ok := plans.([]interface{}); ok {
				for _, subPlan := range arr {
					extractPlanNode(subPlan, &parent.Children[len(parent.Children)-1], depth+1)
				}
			}
		}
	}
}

func extractMySQLPlan(data interface{}, parent *PlanNode, depth int) {
	if data == nil {
		return
	}

	if m, ok := data.(map[string]interface{}); ok {
		// MySQL nested plan
		if nesting, ok := m["nested_loop"]; ok {
			if arr, ok := nesting.([]interface{}); ok {
				for _, item := range arr {
					extractMySQLPlan(item, parent, depth+1)
				}
			}
		}

		if table, ok := m["table"]; ok {
			if tblMap, ok := table.(map[string]interface{}); ok {
				node := PlanNode{
					ID:      planNodeCounter,
					Details: make(map[string]string),
				}
				planNodeCounter++

				if tableName, ok := tblMap["table_name"]; ok {
					node.Name = fmt.Sprintf("Scan: %v", tableName)
					node.Type = "TABLE SCAN"
				}
				if accessType, ok := tblMap["access_type"]; ok {
					node.Details["access_type"] = fmt.Sprintf("%v", accessType)
				}
				if rows, ok := tblMap["rows_examined_per_scan"]; ok {
					if f, ok := rows.(float64); ok {
						node.Rows = int64(f)
					}
				}
				if key, ok := tblMap["key"]; ok {
					node.Details["key"] = fmt.Sprintf("%v", key)
				}
				if filtered, ok := tblMap["filtered"]; ok {
					node.Details["filtered"] = fmt.Sprintf("%v", filtered)
				}

				parent.Children = append(parent.Children, node)
			}
		}
	}
}
