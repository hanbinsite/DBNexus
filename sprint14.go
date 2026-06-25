package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"db-server/db"
)

// S14-1: SQL 调试功能
type DebugStep struct {
	StepNumber   int    `json:"step_number"`
	Query        string `json:"query"`
	RowsAffected int64  `json:"rows_affected,omitempty"`
	RowCount     int    `json:"row_count,omitempty"`
	Duration     string `json:"duration"`
	Status       string `json:"status"` // "success", "error", "skipped"
	Error        string `json:"error,omitempty"`
	Columns      []string `json:"columns,omitempty"`
	Preview      [][]interface{} `json:"preview,omitempty"` // first 5 rows
}

type DebugResult struct {
	TotalSteps    int          `json:"total_steps"`
	SuccessSteps  int          `json:"success_steps"`
	ErrorSteps    int          `json:"error_steps"`
	TotalDuration string       `json:"total_duration"`
	Steps         []DebugStep  `json:"steps"`
}

func (a *App) DebugSQL(config Connection, database string, query string) (*DebugResult, error) {
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}

	// Split into individual statements
	queries := splitQueries(query)
	if len(queries) == 0 {
		return nil, fmt.Errorf("no valid SQL statements found")
	}

	startTime := time.Now()
	result := &DebugResult{
		TotalSteps: len(queries),
		Steps:      []DebugStep{},
	}

	for i, q := range queries {
		step := DebugStep{
			StepNumber: i + 1,
			Query:      q,
		}

		stepStart := time.Now()

		// Execute query
		queryResult := a.ExecuteQueryWithTimeout(config, database, q, QueryOptions{Timeout: 30})
		step.Duration = time.Since(stepStart).String()

		if queryResult.Error != "" {
			step.Status = "error"
			step.Error = queryResult.Error
			result.ErrorSteps++
		} else {
			step.Status = "success"
			step.RowCount = queryResult.RowCount
			step.Columns = queryResult.Columns
			// Preview first 5 rows
			if len(queryResult.Rows) > 0 {
				previewCount := 5
				if len(queryResult.Rows) < 5 {
					previewCount = len(queryResult.Rows)
				}
				step.Preview = queryResult.Rows[:previewCount]
			}
			result.SuccessSteps++
		}

		result.Steps = append(result.Steps, step)

		// Stop on error for debugging
		if step.Status == "error" {
			break
		}
	}

	result.TotalDuration = time.Since(startTime).String()

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("SQL调试: %d steps (%d success, %d errors)", result.TotalSteps, result.SuccessSteps, result.ErrorSteps),
		map[string]interface{}{"steps": result.TotalSteps, "success": result.SuccessSteps, "errors": result.ErrorSteps},
	)

	return result, nil
}

// S14-2: 权限角色管理
type Role struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"` // "read", "write", "ddl", "admin"
	Description string   `json:"description,omitempty"`
}

type UserRole struct {
	ConnectionID string `json:"connection_id"`
	RoleID       string `json:"role_id"`
}

var (
	rolesMu      sync.RWMutex
	roles        []Role
	userRoles    []UserRole
	rolesLoaded  bool
)

func getRolesFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "roles.json")
}

func loadRoles() {
	rolesMu.Lock()
	defer rolesMu.Unlock()
	if rolesLoaded {
		return
	}
	rolesLoaded = true

	data, err := os.ReadFile(getRolesFilePath())
	if err != nil {
		// Initialize with default roles
		roles = []Role{
			{ID: "role_admin", Name: "管理员", Permissions: []string{"read", "write", "ddl", "admin"}, Description: "完全访问权限"},
			{ID: "role_developer", Name: "开发者", Permissions: []string{"read", "write"}, Description: "读写权限，无DDL"},
			{ID: "role_analyst", Name: "数据分析师", Permissions: []string{"read"}, Description: "只读权限"},
			{ID: "role_dba", Name: "DBA", Permissions: []string{"read", "write", "ddl"}, Description: "读写+DDL，无用户管理"},
		}
		saveRoles()
		return
	}

	var cfg struct {
		Roles     []Role     `json:"roles"`
		UserRoles []UserRole `json:"user_roles"`
	}
	json.Unmarshal(data, &cfg)
	roles = cfg.Roles
	userRoles = cfg.UserRoles
}

func saveRoles() error {
	data, err := json.Marshal(struct {
		Roles     []Role     `json:"roles"`
		UserRoles []UserRole `json:"user_roles"`
	}{Roles: roles, UserRoles: userRoles})
	if err != nil {
		return err
	}
	dir := filepath.Dir(getRolesFilePath())
	os.MkdirAll(dir, DirPermSecure)
	return os.WriteFile(getRolesFilePath(), data, FilePermSecure)
}

func (a *App) GetRoles() []Role {
	loadRoles()
	rolesMu.RLock()
	defer rolesMu.RUnlock()

	result := make([]Role, len(roles))
	copy(result, roles)
	return result
}

func (a *App) CreateRole(name string, permissions []string, description string) (Role, error) {
	if name == "" {
		return Role{}, fmt.Errorf("role name is required")
	}

	loadRoles()
	rolesMu.Lock()
	defer rolesMu.Unlock()

	role := Role{
		ID:          fmt.Sprintf("role_%d", time.Now().UnixNano()),
		Name:        name,
		Permissions: permissions,
		Description: description,
	}
	roles = append(roles, role)

	if err := saveRoles(); err != nil {
		return Role{}, fmt.Errorf("failed to save role: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("创建角色: %s (permissions: %v)", name, permissions),
		map[string]interface{}{"role": name, "permissions": permissions},
	)

	return role, nil
}

func (a *App) DeleteRole(roleID string) error {
	loadRoles()
	rolesMu.Lock()
	defer rolesMu.Unlock()

	for i, r := range roles {
		if r.ID == roleID {
			roles = append(roles[:i], roles[i+1:]...)
			// Remove associated user roles
			var newUserRoles []UserRole
			for _, ur := range userRoles {
				if ur.RoleID != roleID {
					newUserRoles = append(newUserRoles, ur)
				}
			}
			userRoles = newUserRoles
			return saveRoles()
		}
	}
	return fmt.Errorf("role not found: %s", roleID)
}

func (a *App) AssignRoleToConnection(connectionID string, roleID string) error {
	loadRoles()
	rolesMu.Lock()
	defer rolesMu.Unlock()

	// Check if role exists
	roleExists := false
	for _, r := range roles {
		if r.ID == roleID {
			roleExists = true
			break
		}
	}
	if !roleExists {
		return fmt.Errorf("role not found: %s", roleID)
	}

	// Remove existing assignment for this connection
	var newUserRoles []UserRole
	for _, ur := range userRoles {
		if ur.ConnectionID != connectionID {
			newUserRoles = append(newUserRoles, ur)
		}
	}
	userRoles = append(newUserRoles, UserRole{ConnectionID: connectionID, RoleID: roleID})

	return saveRoles()
}

func (a *App) GetConnectionRole(connectionID string) (*Role, error) {
	loadRoles()
	rolesMu.RLock()
	defer rolesMu.RUnlock()

	for _, ur := range userRoles {
		if ur.ConnectionID == connectionID {
			for _, r := range roles {
				if r.ID == ur.RoleID {
					return &r, nil
				}
			}
		}
	}
	return nil, nil
}

func (a *App) CheckPermission(connectionID string, permission string) bool {
	loadRoles()
	rolesMu.RLock()
	defer rolesMu.RUnlock()

	for _, ur := range userRoles {
		if ur.ConnectionID == connectionID {
			for _, r := range roles {
				if r.ID == ur.RoleID {
					for _, p := range r.Permissions {
						if p == permission || p == "admin" {
							return true
						}
					}
					return false
				}
			}
		}
	}
	// No role assigned — default to full access for backward compatibility
	return true
}

// S14-3: 查询结果图表数据
type ChartData struct {
	Type     string            `json:"type"` // "bar", "line", "pie", "scatter"
	Title    string            `json:"title,omitempty"`
	Labels   []string          `json:"labels"`
	Datasets []ChartDataset    `json:"datasets"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type ChartDataset struct {
	Label   string        `json:"label"`
	Data    []float64     `json:"data"`
	Color   string        `json:"color,omitempty"`
}

func (a *App) PrepareChartData(config Connection, database string, query string, chartType string, labelColumn string, valueColumn string) (*ChartData, error) {
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}

	result := a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{Timeout: 30})
	if result.Error != "" {
		return nil, fmt.Errorf("query failed: %s", result.Error)
	}

	if len(result.Columns) < 2 || len(result.Rows) == 0 {
		return nil, fmt.Errorf("query must return at least 2 columns and 1 row for chart data")
	}

	chart := &ChartData{
		Type:   chartType,
		Title:  fmt.Sprintf("Query Result Chart (%s)", chartType),
		Labels: []string{},
		Datasets: []ChartDataset{},
	}

	// Find column indices
	labelIdx := -1
	valueIdx := -1
	for i, col := range result.Columns {
		if col == labelColumn {
			labelIdx = i
		}
		if col == valueColumn {
			valueIdx = i
		}
	}

	// Default to first and second columns
	if labelIdx < 0 {
		labelIdx = 0
	}
	if valueIdx < 0 {
		valueIdx = 1
	}

	colors := []string{"#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"}

	var data []float64
	for _, row := range result.Rows {
		// Label
		if labelIdx < len(row) && row[labelIdx] != nil {
			chart.Labels = append(chart.Labels, fmt.Sprintf("%v", row[labelIdx]))
		} else {
			chart.Labels = append(chart.Labels, "")
		}

		// Value
		if valueIdx < len(row) && row[valueIdx] != nil {
			f, _ := toFloat64(row[valueIdx])
			data = append(data, f)
		} else {
			data = append(data, 0)
		}
	}

	dataset := ChartDataset{
		Label: result.Columns[valueIdx],
		Data:  data,
	}
	if len(colors) > 0 {
		dataset.Color = colors[0]
	}
	chart.Datasets = append(chart.Datasets, dataset)

	chart.Metadata = map[string]string{
		"total_rows": fmt.Sprintf("%d", len(result.Rows)),
		"label_column": result.Columns[labelIdx],
		"value_column": result.Columns[valueIdx],
	}

	return chart, nil
}

// S14-4: TECH-003 — 接口抽象
// 定义服务层接口，便于单元测试

// QueryService defines the interface for query operations
type QueryService interface {
	ExecuteQuery(config Connection, database string, query string, options QueryOptions) QueryResult
	ExecuteMultiQuery(config Connection, database string, query string, options QueryOptions) MultiQueryResult
	ValidateSQLSyntax(sql string) *SQLValidationResult
}

// SchemaService defines the interface for schema operations
type SchemaService interface {
	GetTables(config Connection, database string) ([]TableInfo, error)
	GetTableStructure(config Connection, database string, table string) ([]db.ColumnInfo, error)
	GetDatabases(config Connection) ([]DatabaseInfo, error)
}

// ConnectionService defines the interface for connection operations
type ConnectionService interface {
	TestConnection(config Connection) (bool, string, error)
	SaveConnection(config Connection) error
	DeleteConnection(id string) error
	GetConnections() []Connection
}

// AuditService defines the interface for audit operations
type AuditService interface {
	Log(level string, event string, message string, details map[string]interface{})
}

// Implementation stubs for testing
type mockQueryService struct{}

func (m *mockQueryService) ExecuteQuery(config Connection, database string, query string, options QueryOptions) QueryResult {
	return QueryResult{Columns: []string{}, Rows: [][]interface{}{}, RowCount: 0, Duration: "0s"}
}

func (m *mockQueryService) ExecuteMultiQuery(config Connection, database string, query string, options QueryOptions) MultiQueryResult {
	return MultiQueryResult{TotalCount: 0, SuccessCount: 0, ErrorCount: 0}
}

func (m *mockQueryService) ValidateSQLSyntax(sql string) *SQLValidationResult {
	return &SQLValidationResult{Valid: true}
}

// S14-5: 团队工作空间 (简化版)
type Workspace struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	OwnerID  string `json:"owner_id,omitempty"`
	Members  []string `json:"members,omitempty"`
	Created  string `json:"created"`
}

var (
	workspacesMu  sync.RWMutex
	workspaces    []Workspace
	wsLoaded      bool
)

func getWorkspaceFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "workspaces.json")
}

func (a *App) GetWorkspaces() []Workspace {
	workspacesMu.RLock()
	defer workspacesMu.RUnlock()

	if !wsLoaded {
		workspacesMu.RUnlock()
		workspacesMu.Lock()
		if !wsLoaded {
			wsLoaded = true
			data, err := os.ReadFile(getWorkspaceFilePath())
			if err == nil {
				json.Unmarshal(data, &workspaces)
			}
		}
		workspacesMu.Unlock()
		workspacesMu.RLock()
	}

	result := make([]Workspace, len(workspaces))
	copy(result, workspaces)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Created > result[j].Created
	})
	return result
}

func (a *App) CreateWorkspace(name string) (Workspace, error) {
	if name == "" {
		return Workspace{}, fmt.Errorf("workspace name is required")
	}

	workspacesMu.Lock()
	defer workspacesMu.Unlock()

	if !wsLoaded {
		wsLoaded = true
		data, _ := os.ReadFile(getWorkspaceFilePath())
		json.Unmarshal(data, &workspaces)
	}

	ws := Workspace{
		ID:      fmt.Sprintf("ws_%d", time.Now().UnixNano()),
		Name:    name,
		Created: time.Now().Format("2006-01-02 15:04:05"),
	}
	workspaces = append(workspaces, ws)

	data, _ := json.Marshal(workspaces)
	dir := filepath.Dir(getWorkspaceFilePath())
	os.MkdirAll(dir, DirPermSecure)
	os.WriteFile(getWorkspaceFilePath(), data, FilePermSecure)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("创建工作空间: %s", name),
		map[string]interface{}{"workspace": name},
	)

	return ws, nil
}

func (a *App) DeleteWorkspace(workspaceID string) error {
	workspacesMu.Lock()
	defer workspacesMu.Unlock()

	for i, ws := range workspaces {
		if ws.ID == workspaceID {
			workspaces = append(workspaces[:i], workspaces[i+1:]...)
			data, _ := json.Marshal(workspaces)
			return os.WriteFile(getWorkspaceFilePath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("workspace not found: %s", workspaceID)
}

// S14-6: 跨数据库迁移 (简化版)
type MigrationConfig struct {
	SourceConfig Connection `json:"source_config"`
	TargetConfig Connection `json:"target_config"`
	SourceDB     string     `json:"source_db"`
	TargetDB     string     `json:"target_db"`
	Tables       []string   `json:"tables"`
	BatchSize    int        `json:"batch_size"`
}

type MigrationResult struct {
	TotalTables   int              `json:"total_tables"`
	SuccessTables int              `json:"success_tables"`
	FailedTables  int              `json:"failed_tables"`
	TotalRows     int64            `json:"total_rows"`
	TableResults  []MigrationTable `json:"table_results"`
	Duration      string           `json:"duration"`
}

type MigrationTable struct {
	TableName    string `json:"table_name"`
	RowsMigrated int64  `json:"rows_migrated"`
	Success      bool   `json:"success"`
	Error        string `json:"error,omitempty"`
}

func (a *App) MigrateData(config MigrationConfig) (*MigrationResult, error) {
	if len(config.Tables) == 0 {
		return nil, fmt.Errorf("no tables specified for migration")
	}
	if config.BatchSize <= 0 {
		config.BatchSize = 1000
	}

	startTime := time.Now()
	result := &MigrationResult{
		TotalTables: len(config.Tables),
		TableResults: []MigrationTable{},
	}

	for _, table := range config.Tables {
		mt := MigrationTable{TableName: table}

		// Read from source
		srcQuery := fmt.Sprintf("SELECT * FROM %s", sanitizeIdentifier(table))
		srcResult := a.ExecuteQueryWithTimeout(config.SourceConfig, config.SourceDB, srcQuery, QueryOptions{Timeout: 300})

		if srcResult.Error != "" {
			mt.Success = false
			mt.Error = srcResult.Error
			result.FailedTables++
			result.TableResults = append(result.TableResults, mt)
			continue
		}

		if len(srcResult.Rows) == 0 {
			mt.Success = true
			mt.RowsMigrated = 0
			result.SuccessTables++
			result.TableResults = append(result.TableResults, mt)
			continue
		}

		// Write to target in batches
		migrated := int64(0)
		for batchStart := 0; batchStart < len(srcResult.Rows); batchStart += config.BatchSize {
			batchEnd := batchStart + config.BatchSize
			if batchEnd > len(srcResult.Rows) {
				batchEnd = len(srcResult.Rows)
			}

			batch := srcResult.Rows[batchStart:batchEnd]
			var values strings.Builder
			for i, row := range batch {
				if i > 0 {
					values.WriteString(",")
				}
				values.WriteString("(")
				for j, val := range row {
					if j > 0 {
						values.WriteString(",")
					}
					values.WriteString(formatValueForSQL(val))
				}
				values.WriteString(")")
			}

			var colNames []string
			for _, col := range srcResult.Columns {
				if config.TargetConfig.Type == "mysql" {
					colNames = append(colNames, fmt.Sprintf("`%s`", sanitizeIdentifier(col)))
				} else {
					colNames = append(colNames, sanitizeIdentifier(col))
				}
			}

			insertQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES %s",
				sanitizeIdentifier(table),
				strings.Join(colNames, ", "),
				values.String())

			_, execErr, _ := a.ExecuteNonQuery(config.TargetConfig, config.TargetDB, insertQuery)
			if execErr != "" {
				mt.Success = false
				mt.Error = execErr
				break
			}
			migrated += int64(len(batch))
		}

		if mt.Success != false {
			mt.Success = true
		}
		mt.RowsMigrated = migrated
		if mt.Success {
			result.SuccessTables++
		} else {
			result.FailedTables++
		}
		result.TotalRows += migrated
		result.TableResults = append(result.TableResults, mt)
	}

	result.Duration = time.Since(startTime).String()

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("数据迁移: %d tables (%d success, %d failed, %d rows)",
			result.TotalTables, result.SuccessTables, result.FailedTables, result.TotalRows),
		map[string]interface{}{
			"tables": result.TotalTables, "success": result.SuccessTables,
			"failed": result.FailedTables, "rows": result.TotalRows,
		},
	)

	return result, nil
}

// S14-7: 增量同步 (简化版)
type SyncConfig struct {
	SourceConfig Connection `json:"source_config"`
	TargetConfig Connection `json:"target_config"`
	SourceDB     string     `json:"source_db"`
	TargetDB     string     `json:"target_db"`
	Table        string     `json:"table"`
	KeyColumn    string     `json:"key_column"`
	LastSyncValue interface{} `json:"last_sync_value,omitempty"`
}

type IncrementalSyncResult struct {
	InsertedCount int64  `json:"inserted_count"`
	UpdatedCount  int64  `json:"updated_count"`
	DeletedCount  int64  `json:"deleted_count"`
	LastKeyValue  interface{} `json:"last_key_value"`
	Duration      string `json:"duration"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
}

func (a *App) IncrementalSync(config SyncConfig) (*IncrementalSyncResult, error) {
	startTime := time.Now()
	result := &IncrementalSyncResult{Success: true}

	// Query source for new/updated records since last sync
	safeTable := sanitizeIdentifier(config.Table)
	safeKey := sanitizeIdentifier(config.KeyColumn)

	srcQuery := fmt.Sprintf("SELECT * FROM %s ORDER BY %s", safeTable, safeKey)
	if config.LastSyncValue != nil {
		if config.SourceConfig.Type == "mysql" {
			srcQuery = fmt.Sprintf("SELECT * FROM %s WHERE %s > ? ORDER BY %s", safeTable, safeKey, safeKey)
		} else {
			srcQuery = fmt.Sprintf("SELECT * FROM %s WHERE %s > $1 ORDER BY %s", safeTable, safeKey, safeKey)
		}
	}

	srcResult := a.ExecuteQueryWithTimeout(config.SourceConfig, config.SourceDB, srcQuery, QueryOptions{Timeout: 120})
	if srcResult.Error != "" {
		result.Success = false
		result.Error = srcResult.Error
		result.Duration = time.Since(startTime).String()
		return result, nil
	}

	// Find key column index
	keyIdx := -1
	for i, col := range srcResult.Columns {
		if col == config.KeyColumn {
			keyIdx = i
			break
		}
	}
	if keyIdx < 0 {
		result.Success = false
		result.Error = "key column not found"
		result.Duration = time.Since(startTime).String()
		return result, nil
	}

	// Upsert each row to target
	for _, row := range srcResult.Rows {
		keyVal := row[keyIdx]
		result.LastKeyValue = keyVal

		// Check if exists in target
		var checkQuery string
		if config.TargetConfig.Type == "mysql" {
			checkQuery = fmt.Sprintf("SELECT 1 FROM %s WHERE %s = ? LIMIT 1", safeTable, safeKey)
		} else {
			checkQuery = fmt.Sprintf("SELECT 1 FROM %s WHERE %s = $1 LIMIT 1", safeTable, safeKey)
		}

		checkResult := a.ExecuteQueryWithTimeout(config.TargetConfig, config.TargetDB, checkQuery, QueryOptions{Timeout: 10})
		if checkResult.Error != "" {
			continue
		}

		if len(checkResult.Rows) > 0 {
			// Update
			var setParts []string
			var wherePart string
			for i, col := range srcResult.Columns {
				if col == config.KeyColumn {
					if config.TargetConfig.Type == "mysql" {
						wherePart = fmt.Sprintf("`%s` = ?", sanitizeIdentifier(col))
					} else {
						wherePart = fmt.Sprintf("%s = $1", sanitizeIdentifier(col))
					}
					continue
				}
				if config.TargetConfig.Type == "mysql" {
					setParts = append(setParts, fmt.Sprintf("`%s` = %s", sanitizeIdentifier(col), formatValueForSQL(row[i])))
				} else {
					setParts = append(setParts, fmt.Sprintf("%s = %s", sanitizeIdentifier(col), formatValueForSQL(row[i])))
				}
			}
			updateQuery := fmt.Sprintf("UPDATE %s SET %s WHERE %s", safeTable, strings.Join(setParts, ", "), wherePart)
			a.ExecuteNonQuery(config.TargetConfig, config.TargetDB, updateQuery)
			result.UpdatedCount++
		} else {
			// Insert
			var colNames []string
			var vals []string
			for i, col := range srcResult.Columns {
				if config.TargetConfig.Type == "mysql" {
					colNames = append(colNames, fmt.Sprintf("`%s`", sanitizeIdentifier(col)))
				} else {
					colNames = append(colNames, sanitizeIdentifier(col))
				}
				vals = append(vals, formatValueForSQL(row[i]))
			}
			insertQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", safeTable, strings.Join(colNames, ", "), strings.Join(vals, ", "))
			a.ExecuteNonQuery(config.TargetConfig, config.TargetDB, insertQuery)
			result.InsertedCount++
		}
	}

	result.Duration = time.Since(startTime).String()

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("增量同步: %s (inserted=%d, updated=%d)", config.Table, result.InsertedCount, result.UpdatedCount),
		map[string]interface{}{"table": config.Table, "inserted": result.InsertedCount, "updated": result.UpdatedCount},
	)

	return result, nil
}

// Suppress unused import warning for context
var _ = context.Background
