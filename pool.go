package main

import (
	"fmt"
	"sync"

	"db-client/db"
)

type connectionPool struct {
	mu          sync.RWMutex
	connections map[string]db.DatabaseDriver
}

func newConnectionPool() *connectionPool {
	return &connectionPool{
		connections: make(map[string]db.DatabaseDriver),
	}
}

// buildKey creates a unique key for a database connection (includes database name)
func buildKey(config db.ConnectionConfig) string {
	return fmt.Sprintf("%s:%s:%d:%s:%s", config.Type, config.Host, config.Port, config.Username, config.Database)
}

// buildConnectionKey creates a unique key for a physical server connection (excludes database name)
func buildConnectionKey(config db.ConnectionConfig) string {
	return fmt.Sprintf("%s:%s:%d:%s", config.Type, config.Host, config.Port, config.Username)
}

func (p *connectionPool) get(key string) (db.DatabaseDriver, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	driver, exists := p.connections[key]
	return driver, exists
}

func (p *connectionPool) set(key string, driver db.DatabaseDriver) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Close existing connection if it exists
	if existing, exists := p.connections[key]; exists {
		existing.Close()
	}
	p.connections[key] = driver
}

func (p *connectionPool) remove(key string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if driver, exists := p.connections[key]; exists {
		driver.Close()
	}
	delete(p.connections, key)
}

func (p *connectionPool) closeAll() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for key, driver := range p.connections {
		driver.Close()
		delete(p.connections, key)
	}
}

// getOrConnect tries to get an existing connection from the pool,
// or creates a new one if none exists.
func (p *connectionPool) getOrConnect(key string, connectFn func() (db.DatabaseDriver, error)) (db.DatabaseDriver, error) {
	// Try to get from pool first
	if driver, exists := p.get(key); exists {
		return driver, nil
	}

	// Create new connection
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double check after acquiring write lock
	if driver, exists := p.connections[key]; exists {
		return driver, nil
	}

	driver, err := connectFn()
	if err != nil {
		return nil, err
	}

	p.connections[key] = driver
	return driver, nil
}
