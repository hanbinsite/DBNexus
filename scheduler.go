package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// S8-1: 查询脚本共享
type SharedScript struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SQL       string `json:"sql"`
	Database  string `json:"database,omitempty"`
	Created   string `json:"created"`
	CreatedBy string `json:"created_by,omitempty"`
	Tags      string `json:"tags,omitempty"`
}

var (
	scriptsMu     sync.RWMutex
	sharedScripts []SharedScript
	scriptsLoaded bool
)

func getScriptsFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".dbnexus", "scripts.json")
}

func loadScripts() {
	scriptsMu.Lock()
	defer scriptsMu.Unlock()
	if scriptsLoaded {
		return
	}
	scriptsLoaded = true
	data, err := os.ReadFile(getScriptsFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &sharedScripts)
}

func saveScripts() error {
	scriptsMu.RLock()
	data, err := json.Marshal(sharedScripts)
	scriptsMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getScriptsFilePath())
	os.MkdirAll(dir, 0700)
	return os.WriteFile(getScriptsFilePath(), data, 0600)
}

func (a *App) SaveSharedScript(name string, sql string, database string, tags string) (SharedScript, error) {
	if name == "" || sql == "" {
		return SharedScript{}, fmt.Errorf("name and SQL are required")
	}

	loadScripts()
	scriptsMu.Lock()
	defer scriptsMu.Unlock()

	script := SharedScript{
		ID:       fmt.Sprintf("script_%d", time.Now().UnixNano()),
		Name:     name,
		SQL:      sql,
		Database: database,
		Created:  time.Now().Format("2006-01-02 15:04:05"),
		Tags:     tags,
	}
	sharedScripts = append(sharedScripts, script)

	if err := saveScripts(); err != nil {
		return SharedScript{}, fmt.Errorf("failed to save script: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("保存查询脚本: %s", name),
		map[string]interface{}{"script": name},
	)

	return script, nil
}

func (a *App) GetSharedScripts() []SharedScript {
	loadScripts()
	scriptsMu.RLock()
	defer scriptsMu.RUnlock()

	result := make([]SharedScript, len(sharedScripts))
	copy(result, sharedScripts)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Created > result[j].Created
	})
	return result
}

func (a *App) DeleteSharedScript(scriptID string) error {
	loadScripts()
	scriptsMu.Lock()
	defer scriptsMu.Unlock()

	for i, s := range sharedScripts {
		if s.ID == scriptID {
			sharedScripts = append(sharedScripts[:i], sharedScripts[i+1:]...)
			return saveScripts()
		}
	}
	return fmt.Errorf("script not found: %s", scriptID)
}

func (a *App) ExportSharedScripts(filePath string) error {
	loadScripts()
	scriptsMu.RLock()
	defer scriptsMu.RUnlock()

	data, err := json.MarshalIndent(sharedScripts, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}
	return os.WriteFile(filePath, data, 0600)
}

func (a *App) ImportSharedScripts(filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("failed to read file: %w", err)
	}

	var scripts []SharedScript
	if err := json.Unmarshal(data, &scripts); err != nil {
		return 0, fmt.Errorf("parse failed: %w", err)
	}

	loadScripts()
	scriptsMu.Lock()
	defer scriptsMu.Unlock()

	importedCount := 0
	for _, s := range scripts {
		if s.ID == "" {
			s.ID = fmt.Sprintf("script_%d", time.Now().UnixNano()+int64(importedCount))
		}
		s.Created = time.Now().Format("2006-01-02 15:04:05")
		sharedScripts = append(sharedScripts, s)
		importedCount++
	}

	saveScripts()
	return importedCount, nil
}

// S8-2: 定时查询执行 + 任务调度器
type ScheduledTask struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Config    Connection `json:"config"`
	Database  string `json:"database"`
	Query     string `json:"query"`
	Cron      string `json:"cron"`      // simplified: interval in seconds
	Enabled   bool   `json:"enabled"`
	LastRun   string `json:"last_run,omitempty"`
	NextRun   string `json:"next_run,omitempty"`
	RunCount  int    `json:"run_count"`
}

type TaskExecutionResult struct {
	TaskID    string `json:"task_id"`
	Success   bool   `json:"success"`
	Timestamp string `json:"timestamp"`
	Duration  string `json:"duration"`
	RowCount  int    `json:"row_count"`
	Error     string `json:"error,omitempty"`
}

var (
	tasksMu      sync.RWMutex
	scheduledTasks []ScheduledTask
	tasksLoaded   bool
	taskStopChan  = make(chan string, 10)
	activeTimers  = make(map[string]*time.Timer)
)

func getTasksFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".dbnexus", "tasks.json")
}

func loadTasks() {
	tasksMu.Lock()
	defer tasksMu.Unlock()
	if tasksLoaded {
		return
	}
	tasksLoaded = true
	data, err := os.ReadFile(getTasksFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &scheduledTasks)
}

func saveTasks() error {
	tasksMu.RLock()
	data, err := json.Marshal(scheduledTasks)
	tasksMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getTasksFilePath())
	os.MkdirAll(dir, 0700)
	return os.WriteFile(getTasksFilePath(), data, 0600)
}

func (a *App) CreateScheduledTask(name string, config Connection, database string, query string, intervalSeconds int) (ScheduledTask, error) {
	if name == "" || query == "" {
		return ScheduledTask{}, fmt.Errorf("name and query are required")
	}
	if intervalSeconds < 10 {
		intervalSeconds = 60 // minimum 60s
	}

	loadTasks()
	tasksMu.Lock()
	defer tasksMu.Unlock()

	task := ScheduledTask{
		ID:        fmt.Sprintf("task_%d", time.Now().UnixNano()),
		Name:      name,
		Config:    config,
		Database:  database,
		Query:     query,
		Cron:      fmt.Sprintf("%d", intervalSeconds),
		Enabled:   true,
		NextRun:   time.Now().Add(time.Duration(intervalSeconds) * time.Second).Format("2006-01-02 15:04:05"),
	}
	scheduledTasks = append(scheduledTasks, task)

	if err := saveTasks(); err != nil {
		return ScheduledTask{}, fmt.Errorf("failed to save task: %w", err)
	}

	// Start timer
	a.startTaskTimer(task)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("创建定时任务: %s (间隔 %ds)", name, intervalSeconds),
		map[string]interface{}{"task": name, "interval": intervalSeconds},
	)

	return task, nil
}

func (a *App) GetScheduledTasks() []ScheduledTask {
	loadTasks()
	tasksMu.RLock()
	defer tasksMu.RUnlock()

	result := make([]ScheduledTask, len(scheduledTasks))
	copy(result, scheduledTasks)
	return result
}

func (a *App) DeleteScheduledTask(taskID string) error {
	loadTasks()
	tasksMu.Lock()
	defer tasksMu.Unlock()

	// Stop timer
	if timer, exists := activeTimers[taskID]; exists {
		timer.Stop()
		delete(activeTimers, taskID)
	}

	for i, t := range scheduledTasks {
		if t.ID == taskID {
			scheduledTasks = append(scheduledTasks[:i], scheduledTasks[i+1:]...)
			return saveTasks()
		}
	}
	return fmt.Errorf("task not found: %s", taskID)
}

func (a *App) ToggleScheduledTask(taskID string, enabled bool) error {
	loadTasks()
	tasksMu.Lock()
	defer tasksMu.Unlock()

	for i, t := range scheduledTasks {
		if t.ID == taskID {
			scheduledTasks[i].Enabled = enabled
			if enabled {
				interval, _ := time.ParseDuration(t.Cron + "s")
				scheduledTasks[i].NextRun = time.Now().Add(interval).Format("2006-01-02 15:04:05")
				a.startTaskTimer(scheduledTasks[i])
			} else {
				if timer, exists := activeTimers[taskID]; exists {
					timer.Stop()
					delete(activeTimers, taskID)
				}
			}
			return saveTasks()
		}
	}
	return fmt.Errorf("task not found: %s", taskID)
}

func (a *App) RunTaskNow(taskID string) (TaskExecutionResult, error) {
	loadTasks()
	tasksMu.RLock()
	var task *ScheduledTask
	for i := range scheduledTasks {
		if scheduledTasks[i].ID == taskID {
			task = &scheduledTasks[i]
			break
		}
	}
	tasksMu.RUnlock()

	if task == nil {
		return TaskExecutionResult{}, fmt.Errorf("task not found: %s", taskID)
	}

	return a.executeTask(*task)
}

func (a *App) executeTask(task ScheduledTask) (TaskExecutionResult, error) {
	startTime := time.Now()
	result := TaskExecutionResult{
		TaskID:    task.ID,
		Timestamp: startTime.Format("2006-01-02 15:04:05"),
	}

	queryResult := a.ExecuteQueryWithTimeout(task.Config, task.Database, task.Query, QueryOptions{Timeout: 60})
	result.Duration = time.Since(startTime).String()
	result.RowCount = queryResult.RowCount

	if queryResult.Error != "" {
		result.Success = false
		result.Error = queryResult.Error
	} else {
		result.Success = true
	}

	// Update last run
	tasksMu.Lock()
	for i := range scheduledTasks {
		if scheduledTasks[i].ID == task.ID {
			scheduledTasks[i].LastRun = result.Timestamp
			scheduledTasks[i].RunCount++
			if scheduledTasks[i].Enabled {
				interval, _ := time.ParseDuration(scheduledTasks[i].Cron + "s")
				scheduledTasks[i].NextRun = time.Now().Add(interval).Format("2006-01-02 15:04:05")
			}
			break
		}
	}
	saveTasks()
	tasksMu.Unlock()

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("定时任务执行: %s (%v)", task.Name, result.Success),
		map[string]interface{}{"task": task.Name, "success": result.Success, "rows": result.RowCount},
	)

	return result, nil
}

func (a *App) startTaskTimer(task ScheduledTask) {
	if !task.Enabled {
		return
	}

	interval, err := time.ParseDuration(task.Cron + "s")
	if err != nil || interval < 10*time.Second {
		interval = 60 * time.Second
	}

	// Stop existing timer
	if timer, exists := activeTimers[task.ID]; exists {
		timer.Stop()
	}

	timer := time.AfterFunc(interval, func() {
		a.executeTask(task)
		// Reschedule
		a.startTaskTimer(task)
	})
	activeTimers[task.ID] = timer
}

// S8-3: GetTableStats 优化 — 大表使用近似值
func (a *App) GetTableStatsFast(config Connection, database string, tableName string) (TableStats, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return TableStats{}, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(tableName)
	safeDB := sanitizeIdentifier(database)

	var query string
	switch config.Type {
	case "mysql":
		// Use information_schema for approximate count (no COUNT(*))
		query = fmt.Sprintf(`
			SELECT TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, ENGINE,
				CHARACTER_SET_NAME, TABLE_COLLATION, TABLE_COMMENT
			FROM information_schema.TABLES
			WHERE TABLE_SCHEMA = '%s' AND TABLE_NAME = '%s'
		`, safeDB, safeTable)
	case "postgresql", "polardb", "gaussdb":
		// Use pg_class reltuples for approximate count
		query = fmt.Sprintf(`
			SELECT reltuples::bigint,
				pg_table_size(c.oid),
				pg_indexes_size(c.oid),
				'', '', '',
				obj_description(c.oid)
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE c.relname = '%s' AND c.relkind = 'r'
		`, safeTable)
	default:
		return a.GetTableStats(config, database, tableName)
	}

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return a.GetTableStats(config, database, tableName)
	}
	defer rows.Close()

	if rows.Next() {
		var stats TableStats
		var engine, charset, collation, comment interface{}
		if err := rows.Scan(&stats.RowCount, &stats.DataLength, &stats.IndexLength,
			&engine, &charset, &collation, &comment); err != nil {
			return a.GetTableStats(config, database, tableName)
		}
		if engine != nil {
			stats.Engine = fmt.Sprintf("%v", engine)
		}
		if charset != nil {
			stats.Charset = fmt.Sprintf("%v", charset)
		}
		if collation != nil {
			stats.Collation = fmt.Sprintf("%v", collation)
		}
		if comment != nil {
			stats.Comment = fmt.Sprintf("%v", comment)
		}
		return stats, nil
	}

	return TableStats{}, nil
}

// S8-4: compareValues 浮点数精确比较
func compareValuesPrecise(v1, v2 interface{}) bool {
	// Try numeric comparison first
	f1, ok1 := toFloat64(v1)
	f2, ok2 := toFloat64(v2)
	if ok1 && ok2 {
		// Use tolerance for float comparison
		diff := math.Abs(f1 - f2)
		return diff < 1e-9 || diff/(math.Abs(f1)+math.Abs(f2)+1) < 1e-9
	}
	// Fall back to string comparison
	return fmt.Sprintf("%v", v1) == fmt.Sprintf("%v", v2)
}

func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case int32:
		return float64(val), true
	case []byte:
		var f float64
		if n, err := fmt.Sscanf(string(val), "%f", &f); err == nil && n == 1 {
			return f, true
		}
		return 0, false
	case string:
		var f float64
		if n, err := fmt.Sscanf(val, "%f", &f); err == nil && n == 1 {
			return f, true
		}
		return 0, false
	default:
		return 0, false
	}
}

