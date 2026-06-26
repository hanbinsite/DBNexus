package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// S12-1: TECH-004 — 硬编码字符串提取为常量
// 集中管理所有常量，避免硬编码

// 数据库类型常量
const (
	DBTypeMySQL      = "mysql"
	DBTypePostgreSQL = "postgresql"
	DBTypeSQLite     = "sqlite"
	DBTypeRedis      = "redis"
	DBTypePolarDB    = "polardb"
	DBTypeGaussDB    = "gaussdb"
)

// 默认端口常量
const (
	DefaultPortMySQL      = 3306
	DefaultPortPostgreSQL = 5432
	DefaultPortRedis      = 6379
)

// 超时常量 (补充 query_timeout.go 中未定义的)
const (
	DefaultConnectTimeout    = 10   // seconds
	DefaultExportTimeout     = 300  // seconds
	DefaultImportTimeout     = 120  // seconds
	DefaultLongQueryTimeout  = 60   // seconds
)

// 连接池常量
const (
	MaxPoolConnections  = 50
	PingTimeoutSeconds  = 3
	MaxIdleConnections  = 10
)

// 事务常量
const (
	DefaultTxTimeoutMinutes    = 30
	MaxActiveTxCount           = 100
	StaleTxCleanupIntervalMins = 5
)

// 文件路径常量
const (
	ConfigDirName    = ".db-client"
	ConfigFileName   = "config.json"
	AuthFileName     = "auth.json"
	GroupsFileName   = "groups.json"
	UsageFileName    = "usage.json"
	TasksFileName    = "tasks.json"
	ScriptsFileName  = "scripts.json"
	HistoryFileName  = "history.json"
	QueryHistoryName = "query_history.json"
	ExportsDirName   = "exports"
	ImportsDirName   = "imports"
)

// 文件权限常量
const (
	FilePermSecure   = 0600
	FilePermNormal   = 0644
	DirPermSecure    = 0700
)

// 缓存常量
const (
	QueryCacheMaxEntries       = 50
	TableStructCacheTTLMinutes = 5
	ExportPreviewMaxBytes      = 64 * 1024
	ExportPreviewMaxText       = 4096
	ExportPreviewMaxHex        = 1024
)

// 分页常量
const (
	DefaultPageSize    = 50
	MaxPageSize        = 10000
	VirtualScrollThreshold = 500
	VirtualRowHeight   = 32
)

// 审计常量
const (
	AuditMaxLogSize    = 10 * 1024 * 1024 // 10MB
	AuditMaxLogBackups = 5
)

// 安全常量
const (
	MinPasswordLength    = 4
	DefaultSessionTimeoutMins = 30
	PasswordSalt          = "db-client-salt-2024"
)

// S12-2: ARCH-004 — 配置热重载机制
type ConfigWatcher struct {
	mu          sync.RWMutex
	callbacks   []func()
	watching    bool
	lastModTime time.Time
	stopChan    chan struct{}
}

var configWatcher = &ConfigWatcher{
	stopChan: make(chan struct{}),
}

func (w *ConfigWatcher) AddCallback(cb func()) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.callbacks = append(w.callbacks, cb)
}

func (w *ConfigWatcher) Start() {
	w.mu.Lock()
	if w.watching {
		w.mu.Unlock()
		return
	}
	w.watching = true
	w.mu.Unlock()

	go func() {
		// Use 2-second polling with file size + mod time detection
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		homeDir, _ := os.UserHomeDir()
		configPath := filepath.Join(homeDir, ConfigDirName, ConfigFileName)

		var lastSize int64 = -1

		for {
			select {
			case <-ticker.C:
				info, err := os.Stat(configPath)
				if err != nil {
					continue
				}
				modTime := info.ModTime()
				currentSize := info.Size()

				w.mu.RLock()
				lastMod := w.lastModTime
				w.mu.RUnlock()

				// Detect changes via both mod time and file size
				changed := !modTime.Equal(lastMod) || currentSize != lastSize

				if changed {
					w.mu.Lock()
					w.lastModTime = modTime
					w.mu.Unlock()
					lastSize = currentSize

					callbacks := w.getCallbacks()
					for _, cb := range callbacks {
						safeCallback(cb)
					}
					GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
						"配置文件已热重载", map[string]interface{}{
							"path": configPath,
							"size": currentSize,
						},
					)
				}
			case <-w.stopChan:
				return
			}
		}
	}()
}

func (w *ConfigWatcher) getCallbacks() []func() {
	w.mu.RLock()
	defer w.mu.RUnlock()
	callbacks := make([]func(), len(w.callbacks))
	copy(callbacks, w.callbacks)
	return callbacks
}

func (w *ConfigWatcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.watching {
		w.watching = false
		close(w.stopChan)
		w.stopChan = make(chan struct{})
	}
}

func safeCallback(cb func()) {
	defer func() {
		if r := recover(); r != nil {
			// Log error but don't crash
			fmt.Printf("config reload callback panic: %v\n", r)
		}
	}()
	cb()
}

func (a *App) ReloadConfig() error {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ConfigDirName, ConfigFileName)

	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	a.connectionsMu.Lock()
	defer a.connectionsMu.Unlock()

	var cfg struct {
		Connections []Connection `json:"connections"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	a.connections = cfg.Connections

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		"配置已手动重载", map[string]interface{}{"connections": len(a.connections)},
	)

	return nil
}

func (a *App) EnableConfigHotReload() {
	configWatcher.Start()
	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		"配置热重载已启用", nil,
	)
}

// S12-3: ARCH-005 — 事件总线 (带持久化)
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string][]chan Event
	eventLog    []Event
	logMu       sync.Mutex
}

type Event struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp string      `json:"timestamp"`
	Source    string      `json:"source,omitempty"`
}

var eventBus = &EventBus{
	subscribers: make(map[string][]chan Event),
	eventLog:    make([]Event, 0, 500),
}

func getEventLogPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "event_log.json")
}

func (eb *EventBus) persistEvent(event Event) {
	eb.logMu.Lock()
	defer eb.logMu.Unlock()

	eb.eventLog = append(eb.eventLog, event)
	// Keep last 500 events in memory
	if len(eb.eventLog) > 500 {
		eb.eventLog = eb.eventLog[len(eb.eventLog)-500:]
	}

	// Persist to file asynchronously
	go func(events []Event) {
		data, err := json.Marshal(events)
		if err != nil {
			return
		}
		dir := filepath.Dir(getEventLogPath())
		os.MkdirAll(dir, DirPermSecure)
		os.WriteFile(getEventLogPath(), data, FilePermSecure)
	}(append([]Event(nil), eb.eventLog...))
}

func (eb *EventBus) loadPersistedEvents() {
	eb.logMu.Lock()
	defer eb.logMu.Unlock()

	data, err := os.ReadFile(getEventLogPath())
	if err != nil {
		return
	}
	var events []Event
	if err := json.Unmarshal(data, &events); err != nil {
		return
	}
	eb.eventLog = events
}

func (eb *EventBus) Subscribe(eventType string) chan Event {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	ch := make(chan Event, 50)
	eb.subscribers[eventType] = append(eb.subscribers[eventType], ch)
	return ch
}

func (eb *EventBus) Unsubscribe(eventType string, ch chan Event) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	subs := eb.subscribers[eventType]
	for i, sub := range subs {
		if sub == ch {
			eb.subscribers[eventType] = append(subs[:i], subs[i+1:]...)
			close(ch)
			return
		}
	}
}

func (eb *EventBus) Publish(eventType string, data interface{}, source string) {
	event := Event{
		Type:      eventType,
		Data:      data,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
		Source:    source,
	}

	// Persist event to file
	eb.persistEvent(event)

	eb.mu.RLock()
	subs := eb.subscribers[eventType]
	eb.mu.RUnlock()

	for _, ch := range subs {
		select {
		case ch <- event:
		default: // Drop if subscriber is slow
		}
	}
}

// 事件类型常量
const (
	EventQueryExecuted    = "query.executed"
	EventConnectionOpened = "connection.opened"
	EventConnectionClosed = "connection.closed"
	EventTransactionBegin = "transaction.begin"
	EventTransactionCommit = "transaction.commit"
	EventTransactionRollback = "transaction.rollback"
	EventConfigChanged    = "config.changed"
	EventTaskExecuted     = "task.executed"
	EventError            = "error.occurred"
)

func (a *App) SubscribeToEvents(eventType string) []Event {
	ch := eventBus.Subscribe(eventType)
	defer eventBus.Unsubscribe(eventType, ch)

	var events []Event
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-ch:
			events = append(events, event)
		case <-timeout:
			if events == nil {
				events = []Event{}
			}
			return events
		}
	}
}

func (a *App) GetEventHistory(limit int) []Event {
	eventBus.logMu.Lock()
	defer eventBus.logMu.Unlock()

	if limit <= 0 || limit > len(eventBus.eventLog) {
		limit = len(eventBus.eventLog)
	}

	start := len(eventBus.eventLog) - limit
	if start < 0 {
		start = 0
	}

	result := make([]Event, limit)
	copy(result, eventBus.eventLog[start:])
	return result
}

func (a *App) ClearEventHistory() error {
	eventBus.logMu.Lock()
	defer eventBus.logMu.Unlock()

	eventBus.eventLog = make([]Event, 0, 500)
	return os.Remove(getEventLogPath())
}

func (a *App) PublishEvent(eventType string, data interface{}) {
	eventBus.Publish(eventType, data, "app")
}

// 内部事件发布辅助函数
func publishQueryEvent(query string, duration string, rows int, success bool) {
	eventBus.Publish(EventQueryExecuted, map[string]interface{}{
		"query":    truncateQuery(query, 200),
		"duration": duration,
		"rows":     rows,
		"success":  success,
	}, "query")
}

func publishConnectionEvent(connID string, opened bool) {
	eventType := EventConnectionClosed
	if opened {
		eventType = EventConnectionOpened
	}
	eventBus.Publish(eventType, map[string]interface{}{
		"connection_id": connID,
	}, "connection")
}
