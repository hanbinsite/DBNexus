package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// S13-1: SSL/TLS 证书配置
type SSLConfig struct {
	Enabled       bool   `json:"enabled"`
	CAPath        string `json:"ca_path,omitempty"`
	CertPath      string `json:"cert_path,omitempty"`
	KeyPath       string `json:"key_path,omitempty"`
	SkipVerify    bool   `json:"skip_verify,omitempty"`
	MinTLSVersion string `json:"min_tls_version,omitempty"` // "1.0", "1.1", "1.2", "1.3"
}

var (
	sslConfigsMu sync.RWMutex
	sslConfigs   = make(map[string]SSLConfig) // keyed by connection ID
	sslLoaded    bool
)

func getSSLConfigPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "ssl_configs.json")
}

func loadSSLConfigs() {
	sslConfigsMu.Lock()
	defer sslConfigsMu.Unlock()
	if sslLoaded {
		return
	}
	sslLoaded = true
	data, err := os.ReadFile(getSSLConfigPath())
	if err != nil {
		return
	}
	json.Unmarshal(data, &sslConfigs)
}

func saveSSLConfigs() error {
	sslConfigsMu.RLock()
	data, err := json.Marshal(sslConfigs)
	sslConfigsMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(getSSLConfigPath())
	os.MkdirAll(dir, DirPermSecure)
	return os.WriteFile(getSSLConfigPath(), data, FilePermSecure)
}

func (a *App) GetSSLConfig(connectionID string) (SSLConfig, error) {
	loadSSLConfigs()
	sslConfigsMu.RLock()
	defer sslConfigsMu.RUnlock()

	if cfg, exists := sslConfigs[connectionID]; exists {
		return cfg, nil
	}
	return SSLConfig{Enabled: false}, nil
}

func (a *App) SetSSLConfig(connectionID string, config SSLConfig) error {
	if connectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	// Validate certificate files exist if provided
	if config.CertPath != "" {
		if _, err := os.Stat(config.CertPath); err != nil {
			return fmt.Errorf("certificate file not found: %s", config.CertPath)
		}
	}
	if config.KeyPath != "" {
		if _, err := os.Stat(config.KeyPath); err != nil {
			return fmt.Errorf("key file not found: %s", config.KeyPath)
		}
	}
	if config.CAPath != "" {
		if _, err := os.Stat(config.CAPath); err != nil {
			return fmt.Errorf("CA file not found: %s", config.CAPath)
		}
	}

	loadSSLConfigs()
	sslConfigsMu.Lock()
	defer sslConfigsMu.Unlock()

	sslConfigs[connectionID] = config

	if err := saveSSLConfigs(); err != nil {
		return fmt.Errorf("failed to save SSL config: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("SSL/TLS配置已设置: %s (enabled=%v)", connectionID, config.Enabled),
		map[string]interface{}{"connection": connectionID, "enabled": config.Enabled},
	)

	return nil
}

func (a *App) TestSSLConnection(connectionID string) (bool, string, error) {
	cfg, err := a.GetSSLConfig(connectionID)
	if err != nil {
		return false, "", err
	}

	if !cfg.Enabled {
		return true, "SSL未启用，使用普通连接", nil
	}

	// Build TLS config
	tlsConfig := &tls.Config{
		InsecureSkipVerify: cfg.SkipVerify,
	}

	// Set min TLS version
	switch cfg.MinTLSVersion {
	case "1.0":
		tlsConfig.MinVersion = tls.VersionTLS10
	case "1.1":
		tlsConfig.MinVersion = tls.VersionTLS11
	case "1.2":
		tlsConfig.MinVersion = tls.VersionTLS12
	case "1.3":
		tlsConfig.MinVersion = tls.VersionTLS13
	default:
		tlsConfig.MinVersion = tls.VersionTLS12
	}

	// Load CA certificate
	if cfg.CAPath != "" {
		caCert, err := os.ReadFile(cfg.CAPath)
		if err != nil {
			return false, "", fmt.Errorf("failed to read CA: %w", err)
		}
		caPool := x509.NewCertPool()
		if !caPool.AppendCertsFromPEM(caCert) {
			return false, "", fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caPool
	}

	// Load client cert + key
	if cfg.CertPath != "" && cfg.KeyPath != "" {
		cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
		if err != nil {
			return false, "", fmt.Errorf("failed to load client cert: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	// Test by attempting a TLS handshake
	// Find the connection
	a.connectionsMu.RLock()
	var conn *Connection
	for i := range a.connections {
		if a.connections[i].ID == connectionID {
			conn = &a.connections[i]
			break
		}
	}
	a.connectionsMu.RUnlock()

	if conn == nil {
		return false, "", fmt.Errorf("connection not found")
	}

	host := fmt.Sprintf("%s:%d", conn.Host, conn.Port)
	dialer := &tls.Dialer{Config: tlsConfig}
	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	c, err := dialer.DialContext(ctx, "tcp", host)
	if err != nil {
		return false, fmt.Sprintf("TLS连接失败: %v", err), nil
	}
	defer c.Close()

	state := c.(*tls.Conn).ConnectionState()
	versionStr := "unknown"
	switch state.Version {
	case tls.VersionTLS10:
		versionStr = "TLS 1.0"
	case tls.VersionTLS11:
		versionStr = "TLS 1.1"
	case tls.VersionTLS12:
		versionStr = "TLS 1.2"
	case tls.VersionTLS13:
		versionStr = "TLS 1.3"
	}

	cipherName := "unknown"
	if state.CipherSuite != 0 {
		cipherName = fmt.Sprintf("0x%04x", state.CipherSuite)
	}

	return true, fmt.Sprintf("TLS连接成功 (版本: %s, 密码套件: %s)", versionStr, cipherName), nil
}

func (a *App) DeleteSSLConfig(connectionID string) error {
	loadSSLConfigs()
	sslConfigsMu.Lock()
	defer sslConfigsMu.Unlock()

	delete(sslConfigs, connectionID)
	return saveSSLConfigs()
}

// S13-2: 报表导出（PDF）
type ReportConfig struct {
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
	Author   string `json:"author,omitempty"`
	Format   string `json:"format"` // "pdf", "html"
}

type ReportData struct {
	Config  ReportConfig   `json:"config"`
	Columns []string       `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
	Summary map[string]interface{} `json:"summary,omitempty"`
}

func (a *App) ExportReportPDF(config Connection, database string, query string, reportConfig ReportConfig, filePath string) (int, error) {
	if query == "" || filePath == "" {
		return 0, fmt.Errorf("query and file path are required")
	}

	// Execute query to get data
	result := a.ExecuteQueryWithTimeout(config, database, query, QueryOptions{Timeout: 60})
	if result.Error != "" {
		return 0, fmt.Errorf("query failed: %s", result.Error)
	}

	// Generate HTML report (PDF generation requires external library,
	// we generate a print-ready HTML that can be converted to PDF)
	html := generateHTMLReport(reportConfig, result.Columns, result.Rows)

	// Write HTML file
	ext := filepath.Ext(filePath)
	if ext == "" || strings.ToLower(ext) != ".html" {
		// If .pdf requested, write HTML with .html extension alongside
		htmlPath := strings.TrimSuffix(filePath, ext) + ".html"
		err := os.WriteFile(htmlPath, []byte(html), FilePermNormal)
		if err != nil {
			return 0, fmt.Errorf("failed to write report: %w", err)
		}
	}

	err := os.WriteFile(filePath, []byte(html), FilePermNormal)
	if err != nil {
		return 0, fmt.Errorf("failed to write file: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("报表导出: %s (%d rows)", reportConfig.Title, len(result.Rows)),
		map[string]interface{}{"title": reportConfig.Title, "rows": len(result.Rows), "path": filePath},
	)

	return len(result.Rows), nil
}

func generateHTMLReport(config ReportConfig, columns []string, rows [][]interface{}) string {
	var html strings.Builder

	html.WriteString(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>`)
	html.WriteString(config.Title)
	html.WriteString(`</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; }
  h1 { color: #1a1a2e; font-size: 20px; margin-bottom: 4px; }
  h2 { color: #666; font-size: 14px; font-weight: normal; margin-top: 0; }
  .meta { color: #999; font-size: 10px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #1a1a2e; color: #fff; padding: 8px 12px; text-align: left; font-size: 11px; }
  td { padding: 6px 12px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
  tr:nth-child(even) td { background: #f8f8f8; }
  .summary { margin-top: 20px; padding: 12px; background: #f0f0f0; border-radius: 4px; }
  .summary h3 { margin: 0 0 8px 0; font-size: 12px; color: #666; }
  .summary div { font-size: 11px; color: #333; margin: 2px 0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<h1>`)
	html.WriteString(config.Title)
	html.WriteString(`</h1>
`)
	if config.Subtitle != "" {
		html.WriteString("<h2>")
		html.WriteString(config.Subtitle)
		html.WriteString("</h2>\n")
	}

	html.WriteString(`<div class="meta">`)
	html.WriteString(fmt.Sprintf("生成时间: %s", time.Now().Format("2006-01-02 15:04:05")))
	if config.Author != "" {
		html.WriteString(fmt.Sprintf(" | 作者: %s", config.Author))
	}
	html.WriteString(fmt.Sprintf(" | 数据行数: %d", len(rows)))
	html.WriteString(`</div>

<table>
<thead><tr>`)
	for _, col := range columns {
		html.WriteString("<th>")
		html.WriteString(escapeHTML(col))
		html.WriteString("</th>")
	}
	html.WriteString(`</tr></thead>
<tbody>`)
	for _, row := range rows {
		html.WriteString("<tr>")
		for _, cell := range row {
			html.WriteString("<td>")
			if cell == nil {
				html.WriteString("<span style=\"color:#999\">NULL</span>")
			} else {
				html.WriteString(escapeHTML(fmt.Sprintf("%v", cell)))
			}
			html.WriteString("</td>")
		}
		html.WriteString("</tr>\n")
	}
	html.WriteString(`</tbody>
</table>
<div class="no-print" style="margin-top:20px;">
  <button onclick="window.print()" style="padding:8px 16px;background:#1a1a2e;color:#fff;border:none;border-radius:4px;cursor:pointer;">打印 / 保存为PDF</button>
</div>
</body>
</html>`)

	return html.String()
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

// S13-3: TECH-001 — 函数拆分辅助工具
// 提供函数复杂度分析
type FunctionComplexity struct {
	Name         string `json:"name"`
	LineCount    int    `json:"line_count"`
	Complexity   string `json:"complexity"` // "low", "medium", "high"
	Suggestion   string `json:"suggestion,omitempty"`
}

func (a *App) AnalyzeFunctionComplexity() []FunctionComplexity {
	// Parse Go source files using go/ast to identify long functions
	var results []FunctionComplexity

	// Get all .go files in the current directory
	files, err := filepath.Glob("*.go")
	if err != nil || len(files) == 0 {
		return []FunctionComplexity{}
	}

	for _, filename := range files {
		fset := token.NewFileSet()
		f, err := parser.ParseFile(fset, filename, nil, parser.ParseComments)
		if err != nil {
			continue
		}

		ast.Inspect(f, func(n ast.Node) bool {
			fn, ok := n.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				return true
			}

			// Count lines in function body
			start := fset.Position(fn.Body.Lbrace).Line
			end := fset.Position(fn.Body.Rbrace).Line
			lineCount := end - start - 1 // Exclude braces

			if lineCount < 20 {
				return true // Skip short functions
			}

			// Count control flow statements for complexity
			complexityScore := 0
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				switch n.(type) {
				case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt, *ast.SwitchStmt, *ast.TypeSwitchStmt, *ast.SelectStmt:
					complexityScore++
				case *ast.CaseClause:
					complexityScore++
				}
				return true
			})

			var complexity, suggestion string
			switch {
			case lineCount > 100 || complexityScore > 15:
				complexity = "high"
				suggestion = "建议拆分: 函数过长或控制流复杂，考虑提取子函数"
			case lineCount > 50 || complexityScore > 8:
				complexity = "medium"
				suggestion = "可优化: 考虑拆分部分逻辑"
			default:
				complexity = "low"
			}

			name := fn.Name.Name
			if fn.Recv != nil && len(fn.Recv.List) > 0 {
				// Method on a type
				recvType := ""
				if star, ok := fn.Recv.List[0].Type.(*ast.StarExpr); ok {
					if ident, ok := star.X.(*ast.Ident); ok {
						recvType = ident.Name
					}
				} else if ident, ok := fn.Recv.List[0].Type.(*ast.Ident); ok {
					recvType = ident.Name
				}
				if recvType != "" {
					name = recvType + "." + name
				}
			}

			results = append(results, FunctionComplexity{
				Name:       name,
				LineCount:  lineCount,
				Complexity: complexity,
				Suggestion: suggestion,
			})

			return true
		})
	}

	// Sort by line count descending
	sort.Slice(results, func(i, j int) bool {
		return results[i].LineCount > results[j].LineCount
	})

	// Limit to top 30
	if len(results) > 30 {
		results = results[:30]
	}

	if results == nil {
		results = []FunctionComplexity{}
	}
	return results
}

// S13-4: TECH-002 — 错误处理统一化
// 提供统一的错误处理辅助函数
type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e AppError) Error() string {
	return e.Message
}

func NewAppError(code string, message string, detail string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Detail:  detail,
	}
}

// 统一错误码常量
const (
	ErrCodeConnection    = "CONN_001"
	ErrCodeQueryTimeout  = "QUERY_001"
	ErrCodeQueryFailed   = "QUERY_002"
	ErrCodeAuthFailed    = "AUTH_001"
	ErrCodeNotFound      = "NOT_FOUND"
	ErrCodeInvalidInput  = "INVALID_INPUT"
	ErrCodePermission    = "PERM_001"
	ErrCodeInternal      = "INTERNAL_001"
)
