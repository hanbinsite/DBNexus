package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"db-server/db"
)

type connectionPool struct {
	mu          sync.RWMutex
	connections map[string]*pooledDriver
}

type pooledDriver struct {
	driver    db.DatabaseDriver
	createdAt time.Time
	lastPing  time.Time
}

func newConnectionPool() *connectionPool {
	return &connectionPool{
		connections: make(map[string]*pooledDriver),
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

func (p *connectionPool) get(key string) (*pooledDriver, bool) {
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
		existing.driver.Close()
	}
	p.connections[key] = &pooledDriver{
		driver:    driver,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}
}

func (p *connectionPool) remove(key string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if pooled, exists := p.connections[key]; exists {
		if pooled.driver != nil {
			pooled.driver.Close()
		}
	}
	delete(p.connections, key)
}

func (p *connectionPool) closeAll() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for key, pooled := range p.connections {
		if pooled.driver != nil {
			pooled.driver.Close()
		}
		delete(p.connections, key)
	}
}

// pingWithTimeout attempts to ping the driver with a timeout
func (p *connectionPool) pingWithTimeout(ctx context.Context, driver db.DatabaseDriver) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- driver.Ping(ctx)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Get returns a driver after validating its health, or false if invalid
// Validates connection before returning to prevent stale connection issues
func (p *connectionPool) GetHealthy(ctx context.Context, key string) (db.DatabaseDriver, bool) {
	p.mu.RLock()
	pooled, exists := p.connections[key]
	p.mu.RUnlock()

	if !exists {
		return nil, false
	}

	// Check connection health with ping
	if err := p.pingWithTimeout(ctx, pooled.driver); err != nil {
		// Connection is stale, remove it
		p.remove(key)
		return nil, false
	}

	// Update last ping time
	p.mu.Lock()
	if pooled, exists := p.connections[key]; exists {
		pooled.lastPing = time.Now()
	}
	p.mu.Unlock()

	return pooled.driver, true
}

// SetWithHealth adds a driver to the pool and verifies it's alive
func (p *connectionPool) SetWithHealth(ctx context.Context, key string, driver db.DatabaseDriver) error {
	if err := p.pingWithTimeout(ctx, driver); err != nil {
		driver.Close()
		return err
	}

	p.set(key, driver)
	return nil
}
