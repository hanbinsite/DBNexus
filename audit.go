package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type AuditLogLevel string

const (
	AuditLevelInfo     AuditLogLevel = "INFO"
	AuditLevelWarning  AuditLogLevel = "WARNING"
	AuditLevelError    AuditLogLevel = "ERROR"
	AuditLevelCritical AuditLogLevel = "CRITICAL"
)

type AuditEventType string

const (
	AuditEventConnect          AuditEventType = "CONNECT"
	AuditEventDisconnect       AuditEventType = "DISCONNECT"
	AuditEventQuery            AuditEventType = "QUERY"
	AuditEventQueryTimeout     AuditEventType = "QUERY_TIMEOUT"
	AuditEventQueryError       AuditEventType = "QUERY_ERROR"
	AuditEventConnectionSave   AuditEventType = "CONNECTION_SAVE"
	AuditEventConnectionDelete AuditEventType = "CONNECTION_DELETE"
	AuditEventLogin            AuditEventType = "LOGIN"
	AuditEventLogout           AuditEventType = "LOGOUT"
	AuditEventConfigChange     AuditEventType = "CONFIG_CHANGE"
	AuditEventSensitiveData    AuditEventType = "SENSITIVE_DATA_ACCESS"
)

type AuditLog struct {
	ID         string                 `json:"id"`
	Timestamp  string                 `json:"timestamp"`
	Level      AuditLogLevel          `json:"level"`
	EventType  AuditEventType         `json:"event_type"`
	User       string                 `json:"user,omitempty"`
	Connection string                 `json:"connection,omitempty"`
	Database   string                 `json:"database,omitempty"`
	Query      string                 `json:"query,omitempty"`
	Duration   string                 `json:"duration,omitempty"`
	Success    bool                   `json:"success"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	ClientIP   string                 `json:"client_ip,omitempty"`
	UserAgent  string                 `json:"user_agent,omitempty"`
}

type AuditLogger struct {
	mu      sync.RWMutex
	logFile string
	logs    []AuditLog
	maxLogs int
	enabled bool
}

var (
	auditLogger     *AuditLogger
	auditLoggerOnce sync.Once
)

func GetAuditLogger() *AuditLogger {
	auditLoggerOnce.Do(func() {
		homeDir, _ := os.UserHomeDir()
		logDir := filepath.Join(homeDir, ".dbnexus", "logs")
		os.MkdirAll(logDir, 0700)

		logFile := filepath.Join(logDir, fmt.Sprintf("audit_%s.log", time.Now().Format("2006-01-02")))

		auditLogger = &AuditLogger{
			logFile: logFile,
			logs:    make([]AuditLog, 0),
			maxLogs: 10000,
			enabled: true,
		}

		auditLogger.loadTodayLogs()
	})
	return auditLogger
}

func (al *AuditLogger) loadTodayLogs() {
	al.mu.Lock()
	defer al.mu.Unlock()

	data, err := os.ReadFile(al.logFile)
	if err != nil {
		return
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var log AuditLog
		if err := json.Unmarshal([]byte(line), &log); err == nil {
			al.logs = append(al.logs, log)
		}
	}
}

func (al *AuditLogger) Log(level AuditLogLevel, eventType AuditEventType, message string, details map[string]interface{}) {
	al.mu.Lock()
	defer al.mu.Unlock()

	if !al.enabled {
		return
	}

	log := AuditLog{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Timestamp: time.Now().Format("2006-01-02 15:04:05.000"),
		Level:     level,
		EventType: eventType,
		Message:   message,
		Success:   level != AuditLevelError && level != AuditLevelCritical,
		Details:   details,
	}

	al.logs = append(al.logs, log)

	if len(al.logs) > al.maxLogs {
		al.logs = al.logs[len(al.logs)-al.maxLogs:]
	}

	al.appendToFile(log)
}

func (al *AuditLogger) LogQuery(connectionName, database, query, duration string, success bool, errMessage string) {
	level := AuditLevelInfo
	eventType := AuditEventQuery
	if !success {
		level = AuditLevelError
		eventType = AuditEventQueryError
	}

	details := map[string]interface{}{
		"connection": connectionName,
		"database":   database,
		"duration":   duration,
	}

	if errMessage != "" {
		details["error"] = errMessage
	}

	al.Log(level, eventType, fmt.Sprintf("执行查询: %s", truncateQuery(query, 100)), details)
}

func (al *AuditLogger) LogConnection(connectionName, database string, success bool, errMessage string) {
	level := AuditLevelInfo
	eventType := AuditEventConnect
	if !success {
		level = AuditLevelError
	}

	details := map[string]interface{}{
		"connection": connectionName,
		"database":   database,
	}

	if errMessage != "" {
		details["error"] = errMessage
	}

	al.Log(level, eventType, fmt.Sprintf("连接数据库: %s", connectionName), details)
}

func (al *AuditLogger) LogSensitiveData(connectionName, database, table, action string) {
	al.Log(AuditLevelWarning, AuditEventSensitiveData,
		fmt.Sprintf("敏感数据访问: %s.%s - %s", database, table, action),
		map[string]interface{}{
			"connection": connectionName,
			"database":   database,
			"table":      table,
			"action":     action,
		})
}

func (al *AuditLogger) appendToFile(log AuditLog) {
	data, err := json.Marshal(log)
	if err != nil {
		fmt.Printf("审计日志序列化失败: %v\n", err)
		return
	}

	f, err := os.OpenFile(al.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		fmt.Printf("打开审计日志文件失败: %v\n", err)
		return
	}
	defer f.Close()

	if _, err := f.Write(append(data, '\n')); err != nil {
		fmt.Printf("写入审计日志失败: %v\n", err)
	}
}

func (al *AuditLogger) GetLogs(limit int, level AuditLogLevel, eventType AuditEventType) []AuditLog {
	al.mu.RLock()
	defer al.mu.RUnlock()

	var result []AuditLog
	count := 0

	for i := len(al.logs) - 1; i >= 0 && count < limit; i-- {
		log := al.logs[i]

		if level != "" && log.Level != level {
			continue
		}
		if eventType != "" && log.EventType != eventType {
			continue
		}

		result = append(result, log)
		count++
	}

	return result
}

func (al *AuditLogger) ExportLogs(startTime, endTime string) ([]byte, error) {
	al.mu.RLock()
	defer al.mu.RUnlock()

	var filteredLogs []AuditLog

	for _, log := range al.logs {
		if log.Timestamp >= startTime && log.Timestamp <= endTime {
			filteredLogs = append(filteredLogs, log)
		}
	}

	return json.MarshalIndent(filteredLogs, "", "  ")
}

func (al *AuditLogger) ClearOldLogs(daysToKeep int) error {
	al.mu.Lock()
	defer al.mu.Unlock()

	cutoffTime := time.Now().AddDate(0, 0, -daysToKeep)
	cutoffStr := cutoffTime.Format("2006-01-02")

	homeDir, _ := os.UserHomeDir()
	logDir := filepath.Join(homeDir, ".dbnexus", "logs")

	entries, err := os.ReadDir(logDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if len(name) >= len("audit_2006-01-02.log") {
			dateStr := name[6:16]
			if dateStr < cutoffStr {
				filePath := filepath.Join(logDir, name)
				os.Remove(filePath)
			}
		}
	}

	return nil
}

func truncateQuery(query string, maxLen int) string {
	if utf8.RuneCountInString(query) <= maxLen {
		return query
	}
	runes := []rune(query)
	return string(runes[:maxLen]) + "..."
}

func (al *AuditLogger) Enable() {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.enabled = true
}

func (al *AuditLogger) Disable() {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.enabled = false
}

func (al *AuditLogger) IsEnabled() bool {
	al.mu.RLock()
	defer al.mu.RUnlock()
	return al.enabled
}

func (a *App) GetAuditLogs(limit int, level string, eventType string) []AuditLog {
	auditLogger := GetAuditLogger()
	return auditLogger.GetLogs(limit, AuditLogLevel(level), AuditEventType(eventType))
}

func (a *App) ExportAuditLogs(startTime string, endTime string) ([]byte, error) {
	auditLogger := GetAuditLogger()
	return auditLogger.ExportLogs(startTime, endTime)
}

func (a *App) ClearOldAuditLogs(daysToKeep int) error {
	auditLogger := GetAuditLogger()
	return auditLogger.ClearOldLogs(daysToKeep)
}

