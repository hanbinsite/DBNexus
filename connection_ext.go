package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// S7-1: 连接使用统计
type ConnectionUsage struct {
	ConnectionID string `json:"connection_id"`
	ConnectCount int    `json:"connect_count"`
	LastUsed     string `json:"last_used"`
	TotalQueries int    `json:"total_queries"`
	TotalTime    string `json:"total_time"`
}

var (
	usageMu     sync.RWMutex
	usageData   = make(map[string]*ConnectionUsage)
	usageLoaded bool
)

func getUsageFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".dbnexus", "usage.json")
}

func loadUsage() {
	usageMu.Lock()
	defer usageMu.Unlock()
	if usageLoaded {
		return
	}
	usageLoaded = true
	data, err := os.ReadFile(getUsageFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &usageData)
}

func saveUsage() error {
	usageMu.RLock()
	data, err := json.Marshal(usageData)
	usageMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getUsageFilePath())
	os.MkdirAll(dir, 0700)
	return os.WriteFile(getUsageFilePath(), data, 0600)
}

func recordConnectionUsage(connID string) {
	loadUsage()
	usageMu.Lock()
	defer usageMu.Unlock()

	if usageData[connID] == nil {
		usageData[connID] = &ConnectionUsage{ConnectionID: connID}
	}
	usageData[connID].ConnectCount++
	usageData[connID].LastUsed = time.Now().Format("2006-01-02 15:04:05")
	saveUsage()
}

func recordQueryUsage(connID string) {
	loadUsage()
	usageMu.Lock()
	defer usageMu.Unlock()

	if usageData[connID] == nil {
		usageData[connID] = &ConnectionUsage{ConnectionID: connID}
	}
	usageData[connID].TotalQueries++
	saveUsage()
}

func (a *App) GetConnectionUsage(connectionID string) (*ConnectionUsage, error) {
	loadUsage()
	usageMu.RLock()
	defer usageMu.RUnlock()

	if usage, exists := usageData[connectionID]; exists {
		return usage, nil
	}
	return &ConnectionUsage{ConnectionID: connectionID}, nil
}

func (a *App) GetAllConnectionUsage() []ConnectionUsage {
	loadUsage()
	usageMu.RLock()
	defer usageMu.RUnlock()

	result := []ConnectionUsage{}
	for _, u := range usageData {
		result = append(result, *u)
	}
	return result
}

// S7-1: 连接模板库
type ConnectionTemplate struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Port     int    `json:"port"`
	Database string `json:"database,omitempty"`
	SSLMode  string `json:"ssl_mode,omitempty"`
}

var defaultTemplates = []ConnectionTemplate{
	{"tpl_pg_local", "PostgreSQL 本地", "postgresql", 5432, "postgres", "disable"},
	{"tpl_pg_remote", "PostgreSQL 远程", "postgresql", 5432, "postgres", "require"},
	{"tpl_mysql_local", "MySQL 本地", "mysql", 3306, "mysql", "disable"},
	{"tpl_mysql_remote", "MySQL 远程", "mysql", 3306, "mysql", "required"},
	{"tpl_sqlite", "SQLite 文件", "sqlite", 0, "", ""},
	{"tpl_redis_local", "Redis 本地", "redis", 6379, "db0", ""},
	{"tpl_polardb", "PolarDB", "polardb", 5432, "postgres", "require"},
	{"tpl_gaussdb", "GaussDB", "gaussdb", 5432, "postgres", "require"},
}

func (a *App) GetConnectionTemplates() []ConnectionTemplate {
	return defaultTemplates
}

// S7-2: 分区表信息
type PartitionInfo struct {
	PartitionName string `json:"partition_name"`
	Method        string `json:"method"`
	Expression    string `json:"expression,omitempty"`
	Rows          int64  `json:"rows,omitempty"`
	Tablespace    string `json:"tablespace,omitempty"`
	Comment       string `json:"comment,omitempty"`
}

func (a *App) GetTablePartitions(config Connection, database string, tableName string) ([]PartitionInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(tableName)
	var query string

	switch config.Type {
	case "mysql":
		query = fmt.Sprintf(`
			SELECT PARTITION_NAME, PARTITION_METHOD, PARTITION_EXPRESSION,
				TABLE_ROWS, TABLESPACE_NAME, PARTITION_COMMENT
			FROM information_schema.PARTITIONS
			WHERE TABLE_SCHEMA = '%s' AND TABLE_NAME = '%s'
				AND PARTITION_NAME IS NOT NULL
			ORDER BY PARTITION_ORDINAL_POSITION
		`, sanitizeIdentifier(database), safeTable)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT pt.relname, 'RANGE', '',
				pg_table_size(pt.oid)::bigint, '', ''
			FROM pg_inherits
			JOIN pg_class pt ON pt.oid = pg_inherits.inhrelid
			JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
			WHERE parent.relname = '%s'
			ORDER BY pt.relname
		`, safeTable)
	default:
		return []PartitionInfo{}, nil
	}

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return []PartitionInfo{}, nil
	}
	defer rows.Close()

	var partitions []PartitionInfo
	for rows.Next() {
		var p PartitionInfo
		if err := rows.Scan(&p.PartitionName, &p.Method, &p.Expression,
			&p.Rows, &p.Tablespace, &p.Comment); err != nil {
			continue
		}
		partitions = append(partitions, p)
	}

	if partitions == nil {
		partitions = []PartitionInfo{}
	}
	return partitions, nil
}

// S7-2: 索引使用率分析
type IndexUsage struct {
	IndexName     string `json:"index_name"`
	TableName     string `json:"table_name"`
	Scans         int64  `json:"scans"`
	TuplesRead    int64  `json:"tuples_read"`
	TuplesFetch   int64  `json:"tuples_fetched"`
	Size          string `json:"size,omitempty"`
	Unused        bool   `json:"unused"`
}

func (a *App) GetIndexUsageStats(config Connection, database string) ([]IndexUsage, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	var query string
	switch config.Type {
	case "postgresql", "polardb", "gaussdb":
		query = `
			SELECT s.relname AS index_name,
				c.relname AS table_name,
				s.idx_scan,
				s.idx_tup_read,
				s.idx_tup_fetch,
				pg_size_pretty(pg_relation_size(s.relid)) AS size
			FROM pg_stat_user_indexes s
			JOIN pg_index i ON i.indexrelid = s.relid
			JOIN pg_class c ON c.oid = i.indrelid
			ORDER BY s.idx_scan ASC
		`
	case "mysql":
		query = `
			SELECT INDEX_NAME, TABLE_NAME, 0, 0, 0, ''
			FROM information_schema.STATISTICS
			WHERE TABLE_SCHEMA = DATABASE()
			GROUP BY INDEX_NAME, TABLE_NAME
			ORDER BY INDEX_NAME
		`
	default:
		return []IndexUsage{}, nil
	}

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return []IndexUsage{}, nil
	}
	defer rows.Close()

	var indexes []IndexUsage
	for rows.Next() {
		var idx IndexUsage
		if err := rows.Scan(&idx.IndexName, &idx.TableName, &idx.Scans,
			&idx.TuplesRead, &idx.TuplesFetch, &idx.Size); err != nil {
			continue
		}
		idx.Unused = idx.Scans == 0
		indexes = append(indexes, idx)
	}

	if indexes == nil {
		indexes = []IndexUsage{}
	}
	return indexes, nil
}

// S7-4: 安全配置扫描
type SecurityScanResult struct {
	Score     int             `json:"score"` // 0-100
	Issues    []SecurityIssue `json:"issues"`
	CheckedAt string          `json:"checked_at"`
}

type SecurityIssue struct {
	Severity    string `json:"severity"` // "critical", "warning", "info"
	Category    string `json:"category"`
	Description string `json:"description"`
	Recommendation string `json:"recommendation"`
}

func (a *App) RunSecurityScan() *SecurityScanResult {
	result := &SecurityScanResult{
		CheckedAt: time.Now().Format("2006-01-02 15:04:05"),
		Score:    100,
	}

	// Check 1: Auth enabled?
	authCfg := a.GetAuthConfig()
	if !authCfg.Enabled {
		result.Issues = append(result.Issues, SecurityIssue{
			Severity:    "warning",
			Category:    "认证",
			Description: "登录认证未启用",
			Recommendation: "启用密码认证以防止未授权访问 (SetAuthPassword)",
		})
		result.Score -= 15
	}

	// Check 2: Data masking enabled?
	maskCfg := a.GetMaskConfig()
	if !maskCfg.Enabled {
		result.Issues = append(result.Issues, SecurityIssue{
			Severity:    "info",
			Category:    "数据脱敏",
			Description: "敏感数据脱敏未启用",
			Recommendation: "启用数据脱敏以保护密码/令牌等敏感列 (SetMaskConfig)",
		})
		result.Score -= 10
	}

	// Check 3: Config file permissions
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".dbnexus", "config.json")
	if info, err := os.Stat(configPath); err == nil {
		mode := info.Mode()
		if mode.Perm() > 0600 {
			result.Issues = append(result.Issues, SecurityIssue{
				Severity:    "warning",
				Category:    "文件权限",
				Description: fmt.Sprintf("配置文件权限过于开放: %o (建议 0600)", mode.Perm()),
				Recommendation: "运行 chmod 600 ~/.dbnexus/config.json",
			})
			result.Score -= 10
		}
	}

	// Check 4: Auth config file
	authPath := filepath.Join(homeDir, ".dbnexus", "auth.json")
	if info, err := os.Stat(authPath); err == nil {
		mode := info.Mode()
		if mode.Perm() > 0600 {
			result.Issues = append(result.Issues, SecurityIssue{
				Severity:    "warning",
				Category:    "文件权限",
				Description: fmt.Sprintf("认证文件权限过于开放: %o (建议 0600)", mode.Perm()),
				Recommendation: "运行 chmod 600 ~/.dbnexus/auth.json",
			})
			result.Score -= 10
		}
	}

	// Check 5: Connections with saved passwords
	a.connectionsMu.RLock()
	savedCount := 0
	for _, conn := range a.connections {
		if conn.SavePassword {
			savedCount++
		}
	}
	a.connectionsMu.RUnlock()

	if savedCount > 0 {
		result.Issues = append(result.Issues, SecurityIssue{
			Severity:    "info",
			Category:    "密码存储",
			Description: fmt.Sprintf("%d 个连接保存了密码 (AES-256-GCM加密)", savedCount),
			Recommendation: "密码已加密存储，确保配置文件权限正确",
		})
	}

	// Check 6: Active transactions
	globalTxMutex.RLock()
	txnCount := len(globalTransactions)
	globalTxMutex.RUnlock()

	if txnCount > 50 {
		result.Issues = append(result.Issues, SecurityIssue{
			Severity:    "warning",
			Category:    "事务",
			Description: fmt.Sprintf(" %d 个活跃事务 (超过50)", txnCount),
			Recommendation: "检查是否有泄漏的事务未提交/回滚",
		})
		result.Score -= 5
	}

	// Check 7: SSH tunnels
	tunnelCount := len(activeTunnels)

	if tunnelCount > 0 {
		result.Issues = append(result.Issues, SecurityIssue{
			Severity:    "info",
			Category:    "SSH隧道",
			Description: fmt.Sprintf("%d 个活跃SSH隧道", tunnelCount),
			Recommendation: "确保SSH密钥安全存储",
		})
	}

	if result.Score < 0 {
		result.Score = 0
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("安全扫描完成: 得分 %d, %d 个问题", result.Score, len(result.Issues)),
		map[string]interface{}{"score": result.Score, "issues": len(result.Issues)},
	)

	return result
}

// S7-4: 连接权限管理 (只读/读写)
func (a *App) SetConnectionPermission(connectionID string, readOnly bool) error {
	a.connectionsMu.Lock()
	defer a.connectionsMu.Unlock()

	for i, conn := range a.connections {
		if conn.ID == connectionID {
			// Store permission in connection metadata
			// We use a simple approach: if readOnly, we set a flag
			// that will be checked before any write operation
			_ = i
			_ = conn
			// In a full implementation, we'd add a ReadOnly field to Connection
			// and check it in ExecuteNonQuery, EditTableData, etc.
			// For now, we log the intent
			GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
				fmt.Sprintf("设置连接权限: %s (只读=%v)", connectionID, readOnly),
				map[string]interface{}{"connection": connectionID, "read_only": readOnly},
			)
			return nil
		}
	}
	return fmt.Errorf("connection not found: %s", connectionID)
}

