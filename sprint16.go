package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// S16-1: NoSQL 数据库支持基础框架 (MongoDB/Elasticsearch)
type NoSQLConnection struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"` // "mongodb", "elasticsearch"
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Database string `json:"database,omitempty"`
	SSL      bool   `json:"ssl,omitempty"`
}

type NoSQLCollectionInfo struct {
	Name        string `json:"name"`
	DocumentCount int64 `json:"document_count"`
	Size        int64  `json:"size,omitempty"`
	Indexes     int    `json:"indexes,omitempty"`
}

type NoSQLDocument struct {
	ID     string                 `json:"id"`
	Data   map[string]interface{} `json:"data"`
}

type NoSQLQueryResult struct {
	Documents []map[string]interface{} `json:"documents"`
	TotalCount int                     `json:"total_count"`
	Duration   string                  `json:"duration"`
	Error      string                  `json:"error,omitempty"`
}

var (
	nosqlConnsMu  sync.RWMutex
	nosqlConns    []NoSQLConnection
	nosqlLoaded   bool
)

func getNoSQLFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "nosql_connections.json")
}

func loadNoSQLConns() {
	nosqlConnsMu.Lock()
	defer nosqlConnsMu.Unlock()
	if nosqlLoaded {
		return
	}
	nosqlLoaded = true
	data, err := os.ReadFile(getNoSQLFilePath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &nosqlConns)
}

func saveNoSQLConns() error {
	nosqlConnsMu.RLock()
	data, err := json.Marshal(nosqlConns)
	nosqlConnsMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getNoSQLFilePath())
	os.MkdirAll(dir, DirPermSecure)
	return os.WriteFile(getNoSQLFilePath(), data, FilePermSecure)
}

func (a *App) GetNoSQLConnections() []NoSQLConnection {
	loadNoSQLConns()
	nosqlConnsMu.RLock()
	defer nosqlConnsMu.RUnlock()

	result := make([]NoSQLConnection, len(nosqlConns))
	copy(result, nosqlConns)
	// Clear passwords for security
	for i := range result {
		result[i].Password = ""
	}
	return result
}

func (a *App) SaveNoSQLConnection(conn NoSQLConnection) (NoSQLConnection, error) {
	if conn.Name == "" || conn.Type == "" {
		return NoSQLConnection{}, fmt.Errorf("name and type are required")
	}

	loadNoSQLConns()
	nosqlConnsMu.Lock()
	defer nosqlConnsMu.Unlock()

	if conn.ID == "" {
		conn.ID = fmt.Sprintf("nosql_%d", time.Now().UnixNano())
		nosqlConns = append(nosqlConns, conn)
	} else {
		found := false
		for i, c := range nosqlConns {
			if c.ID == conn.ID {
				if conn.Password == "" {
					conn.Password = c.Password // Keep existing password
				}
				nosqlConns[i] = conn
				found = true
				break
			}
		}
		if !found {
			nosqlConns = append(nosqlConns, conn)
		}
	}

	if err := saveNoSQLConns(); err != nil {
		return NoSQLConnection{}, fmt.Errorf("failed to save: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("保存NoSQL连接: %s (%s)", conn.Name, conn.Type),
		map[string]interface{}{"name": conn.Name, "type": conn.Type},
	)

	conn.Password = ""
	return conn, nil
}

func (a *App) DeleteNoSQLConnection(id string) error {
	loadNoSQLConns()
	nosqlConnsMu.Lock()
	defer nosqlConnsMu.Unlock()

	for i, c := range nosqlConns {
		if c.ID == id {
			nosqlConns = append(nosqlConns[:i], nosqlConns[i+1:]...)
			return saveNoSQLConns()
		}
	}
	return fmt.Errorf("connection not found: %s", id)
}

func (a *App) TestNoSQLConnection(conn NoSQLConnection) (bool, string, error) {
	switch conn.Type {
	case "mongodb":
		// Build connection URI
		uri := buildMongoDBURI(conn)
		// In a real implementation, this would use go.mongodb.org/mongo-driver
		// For now, we do a basic TCP connectivity check
		return testTCPConnectivity(conn.Host, conn.Port, 10), fmt.Sprintf("MongoDB URI: %s", sanitizeURI(uri)), nil

	case "elasticsearch":
		uri := buildESURI(conn)
		return testTCPConnectivity(conn.Host, conn.Port, 10), fmt.Sprintf("Elasticsearch URI: %s", sanitizeURI(uri)), nil

	default:
		return false, "", fmt.Errorf("unsupported NoSQL type: %s", conn.Type)
	}
}

func buildMongoDBURI(conn NoSQLConnection) string {
	scheme := "mongodb"
	if conn.SSL {
		scheme = "mongodb+srv"
	}
	uri := fmt.Sprintf("%s://", scheme)
	if conn.Username != "" {
		uri += fmt.Sprintf("%s:%s@", conn.Username, conn.Password)
	}
	uri += fmt.Sprintf("%s:%d", conn.Host, conn.Port)
	if conn.Database != "" {
		uri += "/" + conn.Database
	}
	return uri
}

func buildESURI(conn NoSQLConnection) string {
	scheme := "http"
	if conn.SSL {
		scheme = "https"
	}
	uri := fmt.Sprintf("%s://", scheme)
	if conn.Username != "" {
		uri += fmt.Sprintf("%s:%s@", conn.Username, conn.Password)
	}
	uri += fmt.Sprintf("%s:%d", conn.Host, conn.Port)
	return uri
}

func sanitizeURI(uri string) string {
	// Remove password from URI for display
	idx := strings.Index(uri, ":")
	if idx < 0 {
		return uri
	}
	atIdx := strings.Index(uri[idx:], "@")
	if atIdx < 0 {
		return uri
	}
	return uri[:idx+1] + "***" + uri[idx+atIdx:]
}

func testTCPConnectivity(host string, port int, timeoutSecs int) bool {
	if host == "" || port <= 0 {
		return false
	}
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), time.Duration(timeoutSecs)*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// S16-2: 云数据库连接框架
type CloudDBConnection struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"` // "aws", "gcp", "azure", "aliyun", "tencent"
	Region    string `json:"region"`
	InstanceID string `json:"instance_id,omitempty"`
	DBType    string `json:"db_type"` // "rds-mysql", "rds-postgresql", "aurora", "cloud-sql"
	Endpoint  string `json:"endpoint"`
	Port      int    `json:"port"`
	Database  string `json:"database"`
	Username  string `json:"username"`
	Password  string `json:"password,omitempty"`
	SSL       bool   `json:"ssl"`
}

var (
	cloudConnsMu sync.RWMutex
	cloudConns   []CloudDBConnection
	cloudLoaded  bool
)

func getCloudDBFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "cloud_connections.json")
}

func (a *App) GetCloudDBConnections() []CloudDBConnection {
	cloudConnsMu.RLock()
	defer cloudConnsMu.RUnlock()

	if !cloudLoaded {
		cloudConnsMu.RUnlock()
		cloudConnsMu.Lock()
		if !cloudLoaded {
			cloudLoaded = true
			data, _ := os.ReadFile(getCloudDBFilePath())
			json.Unmarshal(data, &cloudConns)
		}
		cloudConnsMu.Unlock()
		cloudConnsMu.RLock()
	}

	result := make([]CloudDBConnection, len(cloudConns))
	copy(result, cloudConns)
	for i := range result {
		result[i].Password = ""
	}
	return result
}

func (a *App) SaveCloudDBConnection(conn CloudDBConnection) (CloudDBConnection, error) {
	if conn.Name == "" || conn.Provider == "" {
		return CloudDBConnection{}, fmt.Errorf("name and provider are required")
	}

	cloudConnsMu.Lock()
	defer cloudConnsMu.Unlock()

	if !cloudLoaded {
		cloudLoaded = true
		data, _ := os.ReadFile(getCloudDBFilePath())
		json.Unmarshal(data, &cloudConns)
	}

	if conn.ID == "" {
		conn.ID = fmt.Sprintf("cloud_%d", time.Now().UnixNano())
		cloudConns = append(cloudConns, conn)
	} else {
		found := false
		for i, c := range cloudConns {
			if c.ID == conn.ID {
				if conn.Password == "" {
					conn.Password = c.Password
				}
				cloudConns[i] = conn
				found = true
				break
			}
		}
		if !found {
			cloudConns = append(cloudConns, conn)
		}
	}

	data, _ := json.Marshal(cloudConns)
	dir := filepath.Dir(getCloudDBFilePath())
	os.MkdirAll(dir, DirPermSecure)
	os.WriteFile(getCloudDBFilePath(), data, FilePermSecure)

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("保存云数据库连接: %s (%s/%s)", conn.Name, conn.Provider, conn.Region),
		map[string]interface{}{"name": conn.Name, "provider": conn.Provider, "region": conn.Region},
	)

	conn.Password = ""
	return conn, nil
}

func (a *App) DeleteCloudDBConnection(id string) error {
	cloudConnsMu.Lock()
	defer cloudConnsMu.Unlock()

	for i, c := range cloudConns {
		if c.ID == id {
			cloudConns = append(cloudConns[:i], cloudConns[i+1:]...)
			data, _ := json.Marshal(cloudConns)
			return os.WriteFile(getCloudDBFilePath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("connection not found: %s", id)
}

func (a *App) GetCloudDBProviders() []map[string]string {
	return []map[string]string{
		{"id": "aws", "name": "Amazon Web Services", "types": "rds-mysql,rds-postgresql,aurora-mysql,aurora-postgresql"},
		{"id": "gcp", "name": "Google Cloud Platform", "types": "cloud-sql-mysql,cloud-sql-postgresql,spanner"},
		{"id": "azure", "name": "Microsoft Azure", "types": "azure-sql,azure-mysql,azure-postgresql"},
		{"id": "aliyun", "name": "阿里云", "types": "rds-mysql,rds-postgresql,polardb-mysql,polardb-postgresql"},
		{"id": "tencent", "name": "腾讯云", "types": "cdb-mysql,cdb-postgresql,tidb"},
		{"id": "huawei", "name": "华为云", "types": "rds-mysql,rds-postgresql,gaussdb-mysql"},
	}
}

func (a *App) TestCloudDBConnection(conn CloudDBConnection) (bool, string, error) {
	// Basic TCP connectivity test
	connected := testTCPConnectivity(conn.Endpoint, conn.Port, 10)
	if connected {
		return true, fmt.Sprintf("云数据库连接成功 (%s/%s)", conn.Provider, conn.Region), nil
	}
	return false, fmt.Sprintf("连接失败: %s:%d", conn.Endpoint, conn.Port), nil
}

// S16-3: 自定义报表设计器基础
type ReportTemplate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Sections    []ReportSection        `json:"sections"`
	Parameters  []ReportParameter      `json:"parameters,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at,omitempty"`
}

type ReportSection struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Type     string `json:"type"` // "table", "chart", "summary", "text"
	Query    string `json:"query,omitempty"`
	ChartType string `json:"chart_type,omitempty"` // "bar", "line", "pie"
	LabelColumn string `json:"label_column,omitempty"`
	ValueColumn string `json:"value_column,omitempty"`
	Width    int    `json:"width,omitempty"`  // 1-12 grid
	Height   int    `json:"height,omitempty"` // in pixels
}

type ReportParameter struct {
	Name    string `json:"name"`
	Label   string `json:"label"`
	Type    string `json:"type"` // "text", "date", "number", "select"
	Default string `json:"default,omitempty"`
	Options string `json:"options,omitempty"` // comma-separated for select
}

var (
	reportTemplatesMu sync.RWMutex
	reportTemplates   []ReportTemplate
	reportsLoaded     bool
)

func getReportTemplatesPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "report_templates.json")
}

func (a *App) GetReportTemplates() []ReportTemplate {
	reportTemplatesMu.RLock()
	defer reportTemplatesMu.RUnlock()

	if !reportsLoaded {
		reportTemplatesMu.RUnlock()
		reportTemplatesMu.Lock()
		if !reportsLoaded {
			reportsLoaded = true
			data, _ := os.ReadFile(getReportTemplatesPath())
			json.Unmarshal(data, &reportTemplates)
		}
		reportTemplatesMu.Unlock()
		reportTemplatesMu.RLock()
	}

	result := make([]ReportTemplate, len(reportTemplates))
	copy(result, reportTemplates)
	return result
}

func (a *App) SaveReportTemplate(template ReportTemplate) (ReportTemplate, error) {
	if template.Name == "" {
		return ReportTemplate{}, fmt.Errorf("template name is required")
	}

	reportTemplatesMu.Lock()
	defer reportTemplatesMu.Unlock()

	if !reportsLoaded {
		reportsLoaded = true
		data, _ := os.ReadFile(getReportTemplatesPath())
		json.Unmarshal(data, &reportTemplates)
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	if template.ID == "" {
		template.ID = fmt.Sprintf("report_%d", time.Now().UnixNano())
		template.CreatedAt = now
		reportTemplates = append(reportTemplates, template)
	} else {
		found := false
		for i, t := range reportTemplates {
			if t.ID == template.ID {
				template.CreatedAt = t.CreatedAt
				template.UpdatedAt = now
				reportTemplates[i] = template
				found = true
				break
			}
		}
		if !found {
			template.CreatedAt = now
			reportTemplates = append(reportTemplates, template)
		}
	}

	data, _ := json.Marshal(reportTemplates)
	dir := filepath.Dir(getReportTemplatesPath())
	os.MkdirAll(dir, DirPermSecure)
	os.WriteFile(getReportTemplatesPath(), data, FilePermSecure)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("保存报表模板: %s (%d sections)", template.Name, len(template.Sections)),
		map[string]interface{}{"template": template.Name, "sections": len(template.Sections)},
	)

	return template, nil
}

func (a *App) DeleteReportTemplate(id string) error {
	reportTemplatesMu.Lock()
	defer reportTemplatesMu.Unlock()

	for i, t := range reportTemplates {
		if t.ID == id {
			reportTemplates = append(reportTemplates[:i], reportTemplates[i+1:]...)
			data, _ := json.Marshal(reportTemplates)
			return os.WriteFile(getReportTemplatesPath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("template not found: %s", id)
}

func (a *App) ExecuteReportTemplate(config Connection, database string, templateID string, parameters map[string]string) (map[string]interface{}, error) {
	reportTemplatesMu.RLock()
	var template *ReportTemplate
	for i := range reportTemplates {
		if reportTemplates[i].ID == templateID {
			template = &reportTemplates[i]
			break
		}
	}
	reportTemplatesMu.RUnlock()

	if template == nil {
		return nil, fmt.Errorf("template not found: %s", templateID)
	}

	result := map[string]interface{}{
		"template_name": template.Name,
		"sections":      []map[string]interface{}{},
		"generated_at":  time.Now().Format("2006-01-02 15:04:05"),
	}

	var sections []map[string]interface{}
	for _, section := range template.Sections {
		sectionResult := map[string]interface{}{
			"id":    section.ID,
			"title": section.Title,
			"type":  section.Type,
		}

		if section.Type == "table" && section.Query != "" {
			// Replace parameters in query
			query := section.Query
			for paramName, paramValue := range parameters {
				query = strings.ReplaceAll(query, ":"+paramName, paramValue)
			}

			qr := a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{Timeout: 60})
			sectionResult["columns"] = qr.Columns
			sectionResult["rows"] = qr.Rows
			sectionResult["row_count"] = qr.RowCount
			if qr.Error != "" {
				sectionResult["error"] = qr.Error
			}
		} else if section.Type == "chart" && section.Query != "" {
			query := section.Query
			for paramName, paramValue := range parameters {
				query = strings.ReplaceAll(query, ":"+paramName, paramValue)
			}

			chartData, err := a.PrepareChartData(config, database, query, section.ChartType, section.LabelColumn, section.ValueColumn)
			if err != nil {
				sectionResult["error"] = err.Error()
			} else {
				sectionResult["chart"] = chartData
			}
		} else if section.Type == "summary" && section.Query != "" {
			query := section.Query
			for paramName, paramValue := range parameters {
				query = strings.ReplaceAll(query, ":"+paramName, paramValue)
			}

			qr := a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{Timeout: 60})
			if qr.Error == "" && len(qr.Rows) > 0 && len(qr.Columns) > 0 {
				sectionResult["summary"] = map[string]interface{}{
					"columns": qr.Columns,
					"values":  qr.Rows[0],
				}
			}
		} else if section.Type == "text" {
			sectionResult["content"] = section.Query // Use Query field as text content
		}

		sections = append(sections, sectionResult)
	}

	result["sections"] = sections

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("执行报表模板: %s (%d sections)", template.Name, len(template.Sections)),
		map[string]interface{}{"template": template.Name, "sections": len(template.Sections)},
	)

	return result, nil
}
