package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type QueryHistoryItem struct {
	Query     string `json:"query"`
	Database  string `json:"database"`
	Timestamp string `json:"timestamp"`
}

type Bookmark struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Query     string `json:"query"`
	Database  string `json:"database"`
	CreatedAt string `json:"created_at"`
}

var (
	historyMu  sync.Mutex
	history    []QueryHistoryItem
	bookmarks  []Bookmark
)

func getHistoryPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".db-client", "history.json")
}

func getBookmarksPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".db-client", "bookmarks.json")
}

func (a *App) GetQueryHistory() []QueryHistoryItem {
	historyMu.Lock()
	defer historyMu.Unlock()

	data, err := os.ReadFile(getHistoryPath())
	if err != nil {
		return []QueryHistoryItem{}
	}
	var items []QueryHistoryItem
	json.Unmarshal(data, &items)
	return items
}

func (a *App) AddQueryHistory(query string, database string) {
	if query == "" {
		return
	}

	historyMu.Lock()
	defer historyMu.Unlock()

	item := QueryHistoryItem{
		Query:     query,
		Database:  database,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
	}

	history = append(history, item)
	if len(history) > 100 {
		history = history[len(history)-100:]
	}

	data, _ := json.MarshalIndent(history, "", "  ")
	os.WriteFile(getHistoryPath(), data, 0600)
}

func (a *App) ClearQueryHistory() error {
	historyMu.Lock()
	defer historyMu.Unlock()
	history = []QueryHistoryItem{}
	return os.WriteFile(getHistoryPath(), []byte("[]"), 0600)
}

func (a *App) GetBookmarks() []Bookmark {
	historyMu.Lock()
	defer historyMu.Unlock()

	data, err := os.ReadFile(getBookmarksPath())
	if err != nil {
		return []Bookmark{}
	}
	var items []Bookmark
	json.Unmarshal(data, &items)
	return items
}

func (a *App) AddBookmark(name string, query string, database string) error {
	historyMu.Lock()
	defer historyMu.Unlock()

	bookmark := Bookmark{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Name:      name,
		Query:     query,
		Database:  database,
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	}

	bookmarks = append(bookmarks, bookmark)

	data, _ := json.MarshalIndent(bookmarks, "", "  ")
	return os.WriteFile(getBookmarksPath(), data, 0600)
}

func (a *App) DeleteBookmark(id string) error {
	historyMu.Lock()
	defer historyMu.Unlock()

	for i, b := range bookmarks {
		if b.ID == id {
			bookmarks = append(bookmarks[:i], bookmarks[i+1:]...)
			break
		}
	}

	data, _ := json.MarshalIndent(bookmarks, "", "  ")
	return os.WriteFile(getBookmarksPath(), data, 0600)
}

func (a *App) ExportConnections() (string, error) {
	a.connectionsMu.RLock()
	defer a.connectionsMu.RUnlock()

	data, err := json.MarshalIndent(a.connections, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to export: %w", err)
	}
	return string(data), nil
}

func (a *App) ImportConnections(jsonStr string) error {
	var conns []Connection
	if err := json.Unmarshal([]byte(jsonStr), &conns); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	a.connectionsMu.Lock()
	defer a.connectionsMu.Unlock()

	for _, conn := range conns {
		if conn.ID == "" {
			conn.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		a.connections = append(a.connections, conn)
	}

	return a.saveConnectionsToFile()
}

func (a *App) saveConnectionsToFile() error {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".db-client")
	os.MkdirAll(configDir, 0700)

	data, err := json.MarshalIndent(a.connections, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(configDir, "connections.json"), data, 0600)
}
