package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// AuditLogLevel 审计日志级别
type AuditLogLevel string

const (
	AuditLevelInfo     AuditLogLevel = "INFO"
	AuditLevelWarning  AuditLogLevel = "WARNING"
	AuditLevelError    AuditLogLevel = "ERROR"
	AuditLevelCritical AuditLogLevel = "CRITICAL"
)

// AuditEventType 审计事件类型
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

// AuditLog 审计日志条目
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

// AuditLogger 审计日志记录器
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

// GetAuditLogger 获取审计日志记录器单例
func GetAuditLogger() *AuditLogger {
	auditLoggerOnce.Do(func() {
		homeDir, _ := os.UserHomeDir()
		logDir := filepath.Join(homeDir, ".db-client", "logs")
		os.MkdirAll(logDir, 0755)

		// 按日期创建日志文件
		logFile := filepath.Join(logDir, fmt.Sprintf("audit_%s.log", time.Now().Format("2006-01-02")))

		auditLogger = &AuditLogger{
			logFile: logFile,
			logs:    make([]AuditLog, 0),
			maxLogs: 10000, // 内存中最多保留10000条日志
			enabled: true,
		}

		// 加载今日已有的日志
		auditLogger.loadTodayLogs()
	})
	return auditLogger
}

// loadTodayLogs 加载今日的日志
func (al *AuditLogger) loadTodayLogs() {
	al.mu.Lock()
	defer al.mu.Unlock()

	data, err := os.ReadFile(al.logFile)
	if err != nil {
		return
	}

	var logs []AuditLog
	if err := json.Unmarshal(data, &logs); err == nil {
		al.logs = logs
	}
}

// Log 记录审计日志
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

	// 添加到内存
	al.logs = append(al.logs, log)

	// 如果超过最大数量，移除旧的
	if len(al.logs) > al.maxLogs {
		al.logs = al.logs[len(al.logs)-al.maxLogs:]
	}

	// 写入文件
	al.writeToFile()
}

// LogQuery 记录查询日志
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

// LogConnection 记录连接日志
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

// LogSensitiveData 记录敏感数据访问
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

// writeToFile 写入日志文件
func (al *AuditLogger) writeToFile() {
	data, err := json.MarshalIndent(al.logs, "", "  ")
	if err != nil {
		fmt.Printf("审计日志序列化失败: %v\n", err)
		return
	}

	// 使用临时文件避免写入过程中出现问题
	tmpFile := al.logFile + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0600); err != nil {
		fmt.Printf("写入审计日志失败: %v\n", err)
		return
	}

	// 重命名临时文件
	if err := os.Rename(tmpFile, al.logFile); err != nil {
		fmt.Printf("重命名审计日志文件失败: %v\n", err)
	}
}

// GetLogs 获取日志列表
func (al *AuditLogger) GetLogs(limit int, level AuditLogLevel, eventType AuditEventType) []AuditLog {
	al.mu.RLock()
	defer al.mu.RUnlock()

	var result []AuditLog
	count := 0

	// 从后往前遍历，获取最新的日志
	for i := len(al.logs) - 1; i >= 0 && count < limit; i-- {
		log := al.logs[i]

		// 过滤条件
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

// ExportLogs 导出日志
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

// ClearOldLogs 清理旧日志
func (al *AuditLogger) ClearOldLogs(daysToKeep int) error {
	al.mu.Lock()
	defer al.mu.Unlock()

	cutoffTime := time.Now().AddDate(0, 0, -daysToKeep)
	cutoffStr := cutoffTime.Format("2006-01-02")

	// 删除旧日志文件
	homeDir, _ := os.UserHomeDir()
	logDir := filepath.Join(homeDir, ".db-client", "logs")

	entries, err := os.ReadDir(logDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// 解析文件名中的日期
		name := entry.Name()
		if len(name) >= len("audit_2006-01-02.log") {
			dateStr := name[6:16] // 提取日期部分
			if dateStr < cutoffStr {
				filePath := filepath.Join(logDir, name)
				os.Remove(filePath)
			}
		}
	}

	return nil
}

// truncateQuery 截断查询字符串
func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// Enable 启用审计日志
func (al *AuditLogger) Enable() {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.enabled = true
}

// Disable 禁用审计日志
func (al *AuditLogger) Disable() {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.enabled = false
}

// IsEnabled 检查是否启用
func (al *AuditLogger) IsEnabled() bool {
	al.mu.RLock()
	defer al.mu.RUnlock()
	return al.enabled
}
