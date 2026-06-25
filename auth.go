package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// S5-8: 登录认证 (密码/PIN)
type AuthConfig struct {
	Enabled    bool   `json:"enabled"`
	PasswordHash string `json:"password_hash,omitempty"`
	SessionTimeout int  `json:"session_timeout"` // minutes
}

type AuthSession struct {
	Token     string
	Created   time.Time
	ExpiresAt time.Time
}

var (
	authConfig     AuthConfig
	authSession    *AuthSession
	authMutex      sync.RWMutex
	authConfigPath string
)

func init() {
	homeDir, _ := os.UserHomeDir()
	authConfigPath = filepath.Join(homeDir, ".db-client", "auth.json")
}

func (a *App) GetAuthConfig() AuthConfig {
	authMutex.RLock()
	defer authMutex.RUnlock()
	cfg := authConfig
	cfg.PasswordHash = "" // Never expose hash to frontend
	return cfg
}

func (a *App) SetAuthPassword(password string, sessionTimeout int) error {
	if password == "" {
		return fmt.Errorf("password cannot be empty")
	}
	if len(password) < 4 {
		return fmt.Errorf("password must be at least 4 characters")
	}
	if sessionTimeout <= 0 {
		sessionTimeout = 30 // default 30 minutes
	}

	hash := hashPassword(password)

	authMutex.Lock()
	defer authMutex.Unlock()

	authConfig.Enabled = true
	authConfig.PasswordHash = hash
	authConfig.SessionTimeout = sessionTimeout

	if err := saveAuthConfig(); err != nil {
		return fmt.Errorf("failed to save auth config: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		"登录密码已设置", map[string]interface{}{"session_timeout": sessionTimeout},
	)

	return nil
}

func (a *App) DisableAuth() error {
	authMutex.Lock()
	defer authMutex.Unlock()

	authConfig.Enabled = false
	authConfig.PasswordHash = ""
	authConfig.SessionTimeout = 0
	authSession = nil

	if err := saveAuthConfig(); err != nil {
		return fmt.Errorf("failed to save auth config: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		"登录认证已禁用", nil,
	)

	return nil
}

func (a *App) Login(password string) (string, error) {
	authMutex.Lock()
	defer authMutex.Unlock()

	if !authConfig.Enabled {
		return "", fmt.Errorf("authentication is not enabled")
	}

	if hashPassword(password) != authConfig.PasswordHash {
		GetAuditLogger().Log(AuditLevelError, AuditEventLogin,
			"登录失败: 密码错误", nil,
		)
		return "", fmt.Errorf("invalid password")
	}

	// Create session
	token := generateSessionToken()
	timeout := time.Duration(authConfig.SessionTimeout) * time.Minute
	authSession = &AuthSession{
		Token:     token,
		Created:   time.Now(),
		ExpiresAt: time.Now().Add(timeout),
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventLogin,
		"登录成功", map[string]interface{}{"expires": authSession.ExpiresAt.Format("2006-01-02 15:04:05")},
	)

	return token, nil
}

func (a *App) Logout() error {
	authMutex.Lock()
	defer authMutex.Unlock()

	if authSession != nil {
		GetAuditLogger().Log(AuditLevelInfo, AuditEventLogout,
			"用户登出", nil,
		)
		authSession = nil
	}

	return nil
}

func (a *App) ValidateSession(token string) bool {
	authMutex.RLock()
	defer authMutex.RUnlock()

	if !authConfig.Enabled {
		return true // Auth disabled, always valid
	}

	if authSession == nil {
		return false
	}

	if token != authSession.Token {
		return false
	}

	if time.Now().After(authSession.ExpiresAt) {
		return false
	}

	return true
}

func (a *App) RefreshSession() (string, error) {
	authMutex.Lock()
	defer authMutex.Unlock()

	if !authConfig.Enabled || authSession == nil {
		return "", fmt.Errorf("no active session")
	}

	timeout := time.Duration(authConfig.SessionTimeout) * time.Minute
	authSession.ExpiresAt = time.Now().Add(timeout)

	return authSession.Token, nil
}

func hashPassword(password string) string {
	h := sha256.New()
	h.Write([]byte(password))
	h.Write([]byte("db-client-salt-2024")) // Static salt
	return hex.EncodeToString(h.Sum(nil))
}

func generateSessionToken() string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	h.Write([]byte("session-token"))
	return hex.EncodeToString(h.Sum(nil))[:32]
}

func saveAuthConfig() error {
	data, err := json.Marshal(authConfig)
	if err != nil {
		return err
	}
	dir := filepath.Dir(authConfigPath)
	os.MkdirAll(dir, 0700)
	return os.WriteFile(authConfigPath, data, 0600)
}

func loadAuthConfig() {
	data, err := os.ReadFile(authConfigPath)
	if err != nil {
		return
	}
	authMutex.Lock()
	defer authMutex.Unlock()
	json.Unmarshal(data, &authConfig)
}
