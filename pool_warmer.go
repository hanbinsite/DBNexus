package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// PoolWarmer pre-warms connection pool for frequently used connections
type PoolWarmer struct {
	mu       sync.RWMutex
	warmList []Connection
	warming  map[string]bool
	stopChan chan struct{}
}

var poolWarmer = &PoolWarmer{
	warming:  make(map[string]bool),
	stopChan: make(chan struct{}),
}

func (pw *PoolWarmer) AddConnection(conn Connection) {
	pw.mu.Lock()
	defer pw.mu.Unlock()

	// Check if already in list
	for _, c := range pw.warmList {
		if c.ID == conn.ID {
			return
		}
	}
	pw.warmList = append(pw.warmList, conn)
}

func (pw *PoolWarmer) RemoveConnection(connID string) {
	pw.mu.Lock()
	defer pw.mu.Unlock()

	for i, c := range pw.warmList {
		if c.ID == connID {
			pw.warmList = append(pw.warmList[:i], pw.warmList[i+1:]...)
			break
		}
	}
}

func (pw *PoolWarmer) Start(app *App) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		// Initial warm-up
		time.Sleep(2 * time.Second)
		pw.warmAll(app)

		for {
			select {
			case <-ticker.C:
				pw.warmAll(app)
			case <-pw.stopChan:
				return
			}
		}
	}()
}

func (pw *PoolWarmer) Stop() {
	close(pw.stopChan)
}

func (pw *PoolWarmer) warmAll(app *App) {
	pw.mu.RLock()
	connections := make([]Connection, len(pw.warmList))
	copy(connections, pw.warmList)
	pw.mu.RUnlock()

	for _, conn := range connections {
		pw.mu.Lock()
		if pw.warming[conn.ID] {
			pw.mu.Unlock()
			continue
		}
		pw.warming[conn.ID] = true
		pw.mu.Unlock()

		go func(c Connection) {
			defer func() {
				pw.mu.Lock()
				delete(pw.warming, c.ID)
				pw.mu.Unlock()
			}()

			// Try to get or create a connection
			dbConfig := app.connectionToDBConfig(c)
			driver, err := app.getDriverForConfig(dbConfig)
			if err != nil {
				return
			}

			// Ping with short timeout
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = driver.Ping(ctx)
		}(conn)
	}
}

func (pw *PoolWarmer) GetWarmStatus() []map[string]interface{} {
	pw.mu.RLock()
	defer pw.mu.RUnlock()

	result := []map[string]interface{}{}
	for _, c := range pw.warmList {
		warming := pw.warming[c.ID]
		result = append(result, map[string]interface{}{
			"connection_id": c.ID,
			"name":          c.Name,
			"type":          c.Type,
			"warming":       warming,
		})
	}
	return result
}

// Wails API
func (a *App) EnablePoolWarming() {
	poolWarmer.Start(a)
	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		"连接池预热已启用", nil,
	)
}

func (a *App) AddConnectionToWarmPool(connID string) error {
	a.connectionsMu.RLock()
	defer a.connectionsMu.RUnlock()

	for _, conn := range a.connections {
		if conn.ID == connID {
			poolWarmer.AddConnection(conn)
			return nil
		}
	}
	return fmt.Errorf("connection not found: %s", connID)
}

func (a *App) RemoveConnectionFromWarmPool(connID string) {
	poolWarmer.RemoveConnection(connID)
}

func (a *App) GetPoolWarmStatus() []map[string]interface{} {
	return poolWarmer.GetWarmStatus()
}

// QueryResultCache — cache for recent query results
type QueryResultCache2 struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
	maxSize int
}

type cacheEntry struct {
	result    *QueryResult
	timestamp time.Time
	ttl       time.Duration
}

var queryResultCache = &QueryResultCache2{
	entries: make(map[string]*cacheEntry),
	maxSize: 20,
}

func (c *QueryResultCache2) Get(key string) (*QueryResult, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.entries[key]
	if !exists {
		return nil, false
	}
	if time.Since(entry.timestamp) > entry.ttl {
		return nil, false
	}
	return entry.result, true
}

func (c *QueryResultCache2) Set(key string, result *QueryResult, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.entries) >= c.maxSize {
		// Evict oldest
		var oldestKey string
		var oldestTime time.Time
		for k, v := range c.entries {
			if oldestKey == "" || v.timestamp.Before(oldestTime) {
				oldestKey = k
				oldestTime = v.timestamp
			}
		}
		delete(c.entries, oldestKey)
	}

	c.entries[key] = &cacheEntry{
		result:    result,
		timestamp: time.Now(),
		ttl:       ttl,
	}
}

func (c *QueryResultCache2) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*cacheEntry)
}

func (c *QueryResultCache2) Stats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return map[string]interface{}{
		"entries":  len(c.entries),
		"max_size": c.maxSize,
	}
}

func makeQueryCacheKey(config Connection, database string, query string) string {
	return fmt.Sprintf("%s:%s:%s:%s", config.Type, config.Host, database, query)
}

