package main

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"db-server/db"
)

const MaxPoolSize = 50

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

func (p *connectionPool) getOrCreate(key string, createFunc func() (db.DatabaseDriver, error)) (*pooledDriver, error) {
	p.mu.RLock()
	if pooled, exists := p.connections[key]; exists {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := pooled.driver.Ping(ctx); err == nil {
			p.mu.RUnlock()
			cancel()
			return pooled, nil
		}
		cancel()
	}
	p.mu.RUnlock()

	p.mu.Lock()
	defer p.mu.Unlock()

	if pooled, exists := p.connections[key]; exists {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := pooled.driver.Ping(ctx); err == nil {
			cancel()
			return pooled, nil
		}
		cancel()
		if pooled.driver != nil {
			pooled.driver.Close()
		}
		delete(p.connections, key)
	}

	driver, err := createFunc()
	if err != nil {
		return nil, err
	}

	if len(p.connections) >= MaxPoolSize {
		p.evictOldest()
	}

	pooled := &pooledDriver{
		driver:    driver,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}
	p.connections[key] = pooled
	return pooled, nil
}

func (p *connectionPool) buildKey(config db.ConnectionConfig) string {
	return fmt.Sprintf("%s:%s:%d:%s:%s", config.Type, config.Host, config.Port, config.Username, config.Database)
}

func (p *connectionPool) evictOldest() {
	if len(p.connections) == 0 {
		return
	}

	type connInfo struct {
		key       string
		createdAt time.Time
	}

	var conns []connInfo
	for k, v := range p.connections {
		conns = append(conns, connInfo{key: k, createdAt: v.createdAt})
	}

	sort.Slice(conns, func(i, j int) bool {
		return conns[i].createdAt.Before(conns[j].createdAt)
	})

	oldest := conns[0]
	if pooled, exists := p.connections[oldest.key]; exists {
		if pooled.driver != nil {
			pooled.driver.Close()
		}
		delete(p.connections, oldest.key)
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

func (p *connectionPool) getHealthy(ctx context.Context, key string) (db.DatabaseDriver, bool) {
	p.mu.RLock()
	pooled, exists := p.connections[key]
	if !exists {
		p.mu.RUnlock()
		return nil, false
	}

	driver := pooled.driver
	p.mu.RUnlock()

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := driver.Ping(pingCtx); err != nil {
		p.mu.Lock()
		if pooled, exists := p.connections[key]; exists {
			if pooled.driver != nil {
				pooled.driver.Close()
			}
			delete(p.connections, key)
		}
		p.mu.Unlock()
		return nil, false
	}

	p.mu.Lock()
	if pooled, exists := p.connections[key]; exists {
		pooled.lastPing = time.Now()
	}
	p.mu.Unlock()

	return driver, true
}

