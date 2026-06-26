package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"db-server/db"
)

// OracleClientConfig stores Oracle Instant Client configuration
type OracleClientConfig struct {
	InstantClientPath string `json:"instant_client_path"` // Path to Oracle Instant Client directory
	LibPath           string `json:"lib_path"`            // LD_LIBRARY_PATH / PATH / DYLD_LIBRARY_PATH
	TNSAdmin          string `json:"tns_admin"`           // TNS_ADMIN path (for tnsnames.ora)
	NLSLang           string `json:"nls_lang"`            // NLS_LANG (e.g. AMERICAN_AMERICA.AL32UTF8)
	Initialized       bool   `json:"initialized"`
}

var (
	oracleClientMu  sync.RWMutex
	oracleClientCfg OracleClientConfig
	oracleCfgPath   string
)

func init() {
	homeDir, _ := os.UserHomeDir()
	oracleCfgPath = filepath.Join(homeDir, ConfigDirName, "oracle_client.json")
	loadOracleClientConfig()
}

func loadOracleClientConfig() {
	oracleClientMu.Lock()
	defer oracleClientMu.Unlock()

	data, err := os.ReadFile(oracleCfgPath)
	if err != nil {
		// Default: try to detect from environment
		oracleClientCfg = OracleClientConfig{
			InstantClientPath: os.Getenv("ORACLE_HOME"),
			LibPath:           getOracleLibPathFromEnv(),
			TNSAdmin:          os.Getenv("TNS_ADMIN"),
			NLSLang:           os.Getenv("NLS_LANG"),
		}
		if oracleClientCfg.InstantClientPath != "" || oracleClientCfg.LibPath != "" {
			oracleClientCfg.Initialized = true
		}
		return
	}
	json.Unmarshal(data, &oracleClientCfg)
}

func saveOracleClientConfig() error {
	oracleClientMu.RLock()
	data, err := json.MarshalIndent(oracleClientCfg, "", "  ")
	oracleClientMu.RUnlock()
	if err != nil {
		return err
	}
	dir := filepath.Dir(oracleCfgPath)
	os.MkdirAll(dir, DirPermSecure)
	return os.WriteFile(oracleCfgPath, data, FilePermSecure)
}

func getOracleLibPathFromEnv() string {
	switch runtime.GOOS {
	case "windows":
		return os.Getenv("PATH")
	case "darwin":
		return os.Getenv("DYLD_LIBRARY_PATH")
	default:
		return os.Getenv("LD_LIBRARY_PATH")
	}
}

// SetOracleClientConfig sets Oracle Instant Client path and applies environment variables
func (a *App) SetOracleClientConfig(config OracleClientConfig) error {
	oracleClientMu.Lock()
	defer oracleClientMu.Unlock()

	// Validate path if provided
	if config.InstantClientPath != "" {
		info, err := os.Stat(config.InstantClientPath)
		if err != nil {
			return fmt.Errorf("路径不存在: %s (%w)", config.InstantClientPath, err)
		}
		if !info.IsDir() {
			return fmt.Errorf("路径不是目录: %s", config.InstantClientPath)
		}
	}

	// Apply environment variables
	if config.InstantClientPath != "" {
		os.Setenv("ORACLE_HOME", config.InstantClientPath)
	}

	if config.LibPath != "" {
		switch runtime.GOOS {
		case "windows":
			// On Windows, prepend to PATH
			currentPath := os.Getenv("PATH")
			if config.LibPath != currentPath {
				os.Setenv("PATH", config.LibPath+string(os.PathListSeparator)+currentPath)
			}
		case "darwin":
			os.Setenv("DYLD_LIBRARY_PATH", config.LibPath)
		default:
			os.Setenv("LD_LIBRARY_PATH", config.LibPath)
		}
	}

	if config.TNSAdmin != "" {
		os.Setenv("TNS_ADMIN", config.TNSAdmin)
	}

	if config.NLSLang != "" {
		os.Setenv("NLS_LANG", config.NLSLang)
	}

	config.Initialized = true
	oracleClientCfg = config

	if err := saveOracleClientConfig(); err != nil {
		return fmt.Errorf("保存配置失败: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("Oracle客户端路径已设置: %s", config.InstantClientPath),
		map[string]interface{}{
			"path":     config.InstantClientPath,
			"lib_path": config.LibPath,
			"tns":      config.TNSAdmin,
		},
	)

	return nil
}

// GetOracleClientConfig returns current Oracle client configuration
func (a *App) GetOracleClientConfig() OracleClientConfig {
	oracleClientMu.RLock()
	defer oracleClientMu.RUnlock()
	return oracleClientCfg
}

// TestOracleClient tests if Oracle Instant Client is properly configured
func (a *App) TestOracleClient() (bool, string, error) {
	oracleClientMu.RLock()
	cfg := oracleClientCfg
	oracleClientMu.RUnlock()

	// Check if path exists
	if cfg.InstantClientPath == "" {
		return false, "未设置 Oracle Instant Client 路径。请先设置路径。", nil
	}

	info, err := os.Stat(cfg.InstantClientPath)
	if err != nil {
		return false, fmt.Sprintf("路径不存在: %s", cfg.InstantClientPath), nil
	}
	if !info.IsDir() {
		return false, fmt.Sprintf("路径不是目录: %s", cfg.InstantClientPath), nil
	}

	// Check for key files
	entries, err := os.ReadDir(cfg.InstantClientPath)
	if err != nil {
		return false, fmt.Sprintf("无法读取目录: %s", cfg.InstantClientPath), nil
	}

	hasOracleLib := false
	for _, entry := range entries {
		name := entry.Name()
		switch runtime.GOOS {
		case "windows":
			if name == "oci.dll" || name == "OCI.DLL" {
				hasOracleLib = true
			}
		case "darwin":
			if name == "libclntsh.dylib" || name == "libclntsh.dylib.19.1" || name == "libclntsh.dylib.21.1" {
				hasOracleLib = true
			}
		default:
			if name == "libclntsh.so" || name == "libclntsh.so.19.1" || name == "libclntsh.so.21.1" {
				hasOracleLib = true
			}
		}
	}

	if !hasOracleLib {
		return false, fmt.Sprintf("目录中未找到 Oracle 客户端库文件 (libclntsh/oci.dll): %s", cfg.InstantClientPath), nil
	}

	// Try to create a test connection
	testConn := Connection{
		Type:     "oracle",
		Host:     "localhost",
		Port:     1521,
		Username: "system",
		Password: "",
		Database: "ORCL",
	}

	// Just verify driver can be created
	_, err = a.driverManager.Connect(db.ConnectionConfig{
		Type:     db.DBType("oracle"),
		Host:     testConn.Host,
		Port:     testConn.Port,
		Username: testConn.Username,
		Password: testConn.Password,
		Database: testConn.Database,
	})

	if err != nil {
		return true, fmt.Sprintf("路径有效 (库文件已找到)，但无法连接测试数据库: %v", err), nil
	}

	return true, "Oracle Instant Client 配置正确，库文件已找到。", nil
}

// GetOracleClientDownloadURLs returns download URLs for Oracle Instant Client by platform
func (a *App) GetOracleClientDownloadURLs() map[string]interface{} {
	return map[string]interface{}{
		"info":    "Oracle Instant Client 是 Oracle 数据库连接的必需依赖。请根据你的操作系统下载对应版本。",
		"version": "19c (推荐) 或 21c",
		"platforms": []map[string]string{
			{
				"os":     "Windows",
				"arch":   "x64",
				"url":    "https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html",
				"file":   "instantclient-basic-windows.x64-19.19.0.0.0dbru.zip",
				"note":   "下载 Basic 或 Basic Lite 包，解压到任意目录(如 C:\\oracle\\instantclient)",
			},
			{
				"os":     "Windows",
				"arch":   "x86",
				"url":    "https://www.oracle.com/database/technologies/instant-client/microsoft-windows-32-downloads.html",
				"file":   "instantclient-basic-nt-19.19.0.0.0dbru.zip",
				"note":   "32位版本 (不推荐)",
			},
			{
				"os":     "Linux",
				"arch":   "x64",
				"url":    "https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html",
				"file":   "instantclient-basic-linux.x64-19.19.0.0.0dbru.zip",
				"note":   "需要安装 libaio1: sudo apt install libaio1",
			},
			{
				"os":     "Linux",
				"arch":   "ARM64",
				"url":    "https://www.oracle.com/database/technologies/instant-client/linux-arm-aarch64-downloads.html",
				"file":   "instantclient-basic-linux.arm64-19.19.0.0.0dbru.zip",
				"note":   "ARM64 架构 (Apple Silicon Docker 等)",
			},
			{
				"os":     "macOS",
				"arch":   "x64 (Intel)",
				"url":    "https://www.oracle.com/database/technologies/instant-client/mac-os-x-intel-x86-downloads.html",
				"file":   "instantclient-basic-macos.x64-19.19.0.0.0dbru.dmg",
				"note":   "Intel Mac",
			},
			{
				"os":     "macOS",
				"arch":   "ARM64 (Apple Silicon)",
				"url":    "https://www.oracle.com/database/technologies/instant-client/mac-os-apple-silicon-arm64-downloads.html",
				"file":   "instantclient-basic-macos.dmg",
				"note":   "M1/M2/M3 Mac",
			},
		},
		"setup_guide": []string{
			"1. 访问上方链接下载 Oracle Instant Client Basic 包",
			"2. 需要免费注册 Oracle 账号",
			"3. 解压/安装到本地目录",
			"4. 在下方设置路径指向解压后的目录",
			"5. 点击测试验证配置",
			"6. 配置成功后即可连接 Oracle 数据库",
		},
		"env_vars": map[string]string{
			"ORACLE_HOME":      "Instant Client 解压目录路径",
			"LD_LIBRARY_PATH":  "Linux: 指向 Instant Client 目录 (自动设置)",
			"DYLD_LIBRARY_PATH": "macOS: 指向 Instant Client 目录 (自动设置)",
			"PATH":             "Windows: Instant Client 目录会被添加到 PATH (自动设置)",
			"TNS_ADMIN":        "tnsname.ora 文件所在目录 (可选)",
			"NLS_LANG":         "字符集设置，如 AMERICAN_AMERICA.AL32UTF8 (可选)",
		},
	}
}
