package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// WindowInfo represents a managed window instance
type WindowInfo struct {
	ID           string          `json:"id"`
	Title        string          `json:"title"`
	ConnectionID string          `json:"connectionId"`
	Database     string          `json:"database"`
	Width        int             `json:"width"`
	Height       int             `json:"height"`
	X            int             `json:"x"`
	Y            int             `json:"y"`
	IsActive     bool            `json:"isActive"`
	CreatedAt    string          `json:"createdAt"`
	TabCount     int             `json:"tabCount"`
}

// WindowManager manages multiple window instances
type WindowManager struct {
	mu       sync.RWMutex
	windows  map[string]*WindowInfo
	active   string
	filePath string
}

var windowManager *WindowManager
var windowManagerOnce sync.Once

func GetWindowManager() *WindowManager {
	windowManagerOnce.Do(func() {
		homeDir, _ := os.UserHomeDir()
		windowManager = &WindowManager{
			windows:  make(map[string]*WindowInfo),
			filePath: filepath.Join(homeDir, ConfigDirName, "windows.json"),
		}
		windowManager.load()
	})
	return windowManager
}

func (wm *WindowManager) load() {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	data, err := os.ReadFile(wm.filePath)
	if err != nil {
		return
	}

	var windows []*WindowInfo
	if err := json.Unmarshal(data, &windows); err != nil {
		return
	}

	for _, w := range windows {
		wm.windows[w.ID] = w
	}
}

func (wm *WindowManager) save() {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	windows := make([]*WindowInfo, 0, len(wm.windows))
	for _, w := range wm.windows {
		windows = append(windows, w)
	}

	data, _ := json.MarshalIndent(windows, "", "  ")
	os.WriteFile(wm.filePath, data, DirPermSecure)
}

func (wm *WindowManager) CreateWindow(title string, connectionID string, database string) *WindowInfo {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	id := fmt.Sprintf("win-%d", time.Now().UnixNano())
	w := &WindowInfo{
		ID:           id,
		Title:        title,
		ConnectionID: connectionID,
		Database:     database,
		Width:        1280,
		Height:       800,
		X:            100,
		Y:            100,
		IsActive:     true,
		CreatedAt:    time.Now().Format(time.RFC3339),
		TabCount:     1,
	}

	// Deactivate other windows
	for _, existing := range wm.windows {
		existing.IsActive = false
	}

	wm.windows[id] = w
	wm.active = id

	wm.save()
	return w
}

func (wm *WindowManager) CloseWindow(id string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if _, exists := wm.windows[id]; !exists {
		return fmt.Errorf("window not found: %s", id)
	}

	delete(wm.windows, id)

	// If active window was closed, activate another
	if wm.active == id {
		wm.active = ""
		for _, w := range wm.windows {
			wm.active = w.ID
			w.IsActive = true
			break
		}
	}

	wm.save()
	return nil
}

func (wm *WindowManager) GetWindow(id string) (*WindowInfo, error) {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	w, exists := wm.windows[id]
	if !exists {
		return nil, fmt.Errorf("window not found: %s", id)
	}
	return w, nil
}

func (wm *WindowManager) GetAllWindows() []*WindowInfo {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	windows := make([]*WindowInfo, 0, len(wm.windows))
	for _, w := range wm.windows {
		windows = append(windows, w)
	}
	return windows
}

func (wm *WindowManager) ActivateWindow(id string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if _, exists := wm.windows[id]; !exists {
		return fmt.Errorf("window not found: %s", id)
	}

	// Deactivate all
	for _, w := range wm.windows {
		w.IsActive = false
	}

	wm.windows[id].IsActive = true
	wm.active = id
	wm.save()
	return nil
}

func (wm *WindowManager) UpdateWindowGeometry(id string, width, height, x, y int) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	w, exists := wm.windows[id]
	if !exists {
		return fmt.Errorf("window not found: %s", id)
	}

	w.Width = width
	w.Height = height
	w.X = x
	w.Y = y
	wm.save()
	return nil
}

func (wm *WindowManager) UpdateWindowConnection(id string, connectionID string, database string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	w, exists := wm.windows[id]
	if !exists {
		return fmt.Errorf("window not found: %s", id)
	}

	w.ConnectionID = connectionID
	w.Database = database
	wm.save()
	return nil
}

func (wm *WindowManager) UpdateTabCount(id string, count int) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	w, exists := wm.windows[id]
	if !exists {
		return
	}

	w.TabCount = count
	wm.save()
}

func (wm *WindowManager) GetActiveWindow() *WindowInfo {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	if wm.active == "" {
		return nil
	}
	return wm.windows[wm.active]
}

func (wm *WindowManager) GetWindowCount() int {
	wm.mu.RLock()
	defer wm.mu.RUnlock()
	return len(wm.windows)
}

// Wails API methods for window management

func (a *App) CreateWindow(title string, connectionID string, database string) (*WindowInfo, error) {
	wm := GetWindowManager()
	w := wm.CreateWindow(title, connectionID, database)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("创建窗口: %s (%s)", title, w.ID),
		map[string]interface{}{"windowId": w.ID, "connectionId": connectionID},
	)

	return w, nil
}

func (a *App) CloseWindowByID(id string) error {
	wm := GetWindowManager()
	err := wm.CloseWindow(id)
	if err != nil {
		return err
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("关闭窗口: %s", id),
		map[string]interface{}{"windowId": id},
	)

	return nil
}

func (a *App) GetAllWindows() []*WindowInfo {
	return GetWindowManager().GetAllWindows()
}

func (a *App) ActivateWindowByID(id string) error {
	return GetWindowManager().ActivateWindow(id)
}

func (a *App) UpdateWindowGeometry(id string, width, height, x, y int) error {
	return GetWindowManager().UpdateWindowGeometry(id, width, height, x, y)
}

func (a *App) UpdateWindowConnection(id string, connectionID string, database string) error {
	return GetWindowManager().UpdateWindowConnection(id, connectionID, database)
}

func (a *App) GetActiveWindowInfo() *WindowInfo {
	return GetWindowManager().GetActiveWindow()
}

func (a *App) GetWindowCount() int {
	return GetWindowManager().GetWindowCount()
}

// WindowSession manages per-window state (independent connections)
type WindowSession struct {
	WindowID      string                 `json:"windowId"`
	ConnectionID  string                 `json:"connectionId"`
	Database      string                 `json:"database"`
	ActiveTable   string                 `json:"activeTable"`
	QueryHistory  []string               `json:"queryHistory"`
	OpenTabs      []WindowTab            `json:"openTabs"`
	Settings      map[string]interface{} `json:"settings,omitempty"`
}

type WindowTab struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Label    string `json:"label"`
	Query    string `json:"query,omitempty"`
	Table    string `json:"table,omitempty"`
	Database string `json:"database,omitempty"`
}

var windowSessions sync.Map

func GetWindowSession(windowID string) *WindowSession {
	if session, ok := windowSessions.Load(windowID); ok {
		return session.(*WindowSession)
	}
	s := &WindowSession{
		WindowID:     windowID,
		QueryHistory: []string{},
		OpenTabs:     []WindowTab{},
		Settings:     make(map[string]interface{}),
	}
	windowSessions.Store(windowID, s)
	return s
}

func (s *WindowSession) AddTab(tab WindowTab) {
	s.OpenTabs = append(s.OpenTabs, tab)
}

func (s *WindowSession) RemoveTab(tabID string) {
	for i, t := range s.OpenTabs {
		if t.ID == tabID {
			s.OpenTabs = append(s.OpenTabs[:i], s.OpenTabs[i+1:]...)
			return
		}
	}
}

func (s *WindowSession) AddQueryHistory(query string) {
	if len(s.QueryHistory) >= 100 {
		s.QueryHistory = s.QueryHistory[1:]
	}
	s.QueryHistory = append(s.QueryHistory, query)
}

func (s *WindowSession) SetConnection(connectionID string, database string) {
	s.ConnectionID = connectionID
	s.Database = database
}

// Wails API for window sessions
func (a *App) GetWindowSessionState(windowID string) *WindowSession {
	return GetWindowSession(windowID)
}

func (a *App) SaveWindowSessionState(session WindowSession) error {
	s := GetWindowSession(session.WindowID)
	s.ConnectionID = session.ConnectionID
	s.Database = session.Database
	s.ActiveTable = session.ActiveTable
	s.OpenTabs = session.OpenTabs
	s.QueryHistory = session.QueryHistory
	return nil
}

func (a *App) AddWindowTab(windowID string, tab WindowTab) error {
	s := GetWindowSession(windowID)
	s.AddTab(tab)
	wm := GetWindowManager()
	wm.UpdateTabCount(windowID, len(s.OpenTabs))
	return nil
}

func (a *App) RemoveWindowTab(windowID string, tabID string) error {
	s := GetWindowSession(windowID)
	s.RemoveTab(tabID)
	wm := GetWindowManager()
	wm.UpdateTabCount(windowID, len(s.OpenTabs))
	return nil
}
