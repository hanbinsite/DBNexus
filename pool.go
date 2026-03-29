package main

import (
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

func (p *connectionPool) get(key string) (db.DatabaseDriver, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	driver, exists := p.connections[key]
	return driver, exists
}

func (p *connectionPool) set(key string, driver db.DatabaseDriver) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.connections[key] = driver
}

func (p *connectionPool) remove(key string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.connections, key)
}

func (p *connectionPool) closeAll() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, driver := range p.connections {
		driver.Close()
	}
	p.connections = make(map[string]db.DatabaseDriver)
}
