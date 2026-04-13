package main

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"db-server/db"
)

const (
	MaxPoolSize = 50 // 最大连接池大小
)

type connectionPool struct {
	mu          sync.RWMutex
	connections map[string]*pooledDriver
}

// getOrCreate原子性地获取或创建连接，避免竞态条件
// 如果连接不存在或已失效，调用createFunc创建新连接
func (p *connectionPool) getOrCreate(key string, createFunc func() (db.DatabaseDriver, error)) (*pooledDriver, error) {
	// 第一次检查：读锁
	p.mu.RLock()
	if pooled, exists := p.connections[key]; exists {
		// 检查连接是否有效
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := pooled.driver.Ping(ctx); err == nil {
			p.mu.RUnlock()
			return pooled, nil
		}
	}
	p.mu.RUnlock()

	// 需要创建或替换连接：写锁
	p.mu.Lock()
	defer p.mu.Unlock()

	// 双重检查：可能在等待写锁期间已被其他goroutine创建
	if pooled, exists := p.connections[key]; exists {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := pooled.driver.Ping(ctx); err == nil {
			return pooled, nil
		}
		// 连接无效，清理它
		if pooled.driver != nil {
			pooled.driver.Close()
		}
		delete(p.connections, key)
	}

	// 创建新连接
	driver, err := createFunc()
	if err != nil {
		return nil, err
	}

	// 检查连接池大小限制
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

	// 检查连接池大小限制，超过限制时淘汰最旧的连接
	if len(p.connections) >= MaxPoolSize {
		p.evictOldest()
	}

	p.connections[key] = &pooledDriver{
		driver:    driver,
		createdAt: time.Now(),
		lastPing:  time.Now(),
	}
}

// evictOldest 淘汰最旧的连接（在持有锁的情况下调用）
func (p *connectionPool) evictOldest() {
	if len(p.connections) == 0 {
		return
	}

	// 找到最旧的连接
	type connInfo struct {
		key       string
		createdAt time.Time
	}

	var conns []connInfo
	for k, v := range p.connections {
		conns = append(conns, connInfo{key: k, createdAt: v.createdAt})
	}

	// 按创建时间排序
	sort.Slice(conns, func(i, j int) bool {
		return conns[i].createdAt.Before(conns[j].createdAt)
	})

	// 淘汰最旧的连接（至少淘汰一个）
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
		p.mu.Unlock()
	} else {
		p.mu.Unlock()
	}

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
