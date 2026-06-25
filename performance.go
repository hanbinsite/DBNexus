package main

import (
	"context"
	"fmt"
	"runtime"
	"time"
)

type PerformanceMetrics struct {
	Timestamp     string                 `json:"timestamp"`
	GoRoutines    int                    `json:"goroutines"`
	GoMemAllocMB  float64                `json:"go_mem_alloc_mb"`
	GoNumGC       uint32                 `json:"go_num_gc"`
	CPUPercent    float64                `json:"cpu_percent"`
	ActiveQueries int                    `json:"active_queries"`
	ActiveTxns    int                    `json:"active_txns"`
	PoolStats     map[string]interface{} `json:"pool_stats"`
}

func (a *App) GetPerformanceMetrics() PerformanceMetrics {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	globalTxMutex.Lock()
	txnCount := len(globalTransactions)
	globalTxMutex.Unlock()

	activeQueriesMu.Lock()
	queryCount := len(activeQueries)
	activeQueriesMu.Unlock()

	poolStats := map[string]interface{}{}
	if a.pool != nil {
		a.pool.mu.RLock()
		poolStats["total_connections"] = len(a.pool.connections)
		var recent int
		for _, entry := range a.pool.connections {
			if time.Since(entry.lastPing) < 5*time.Minute {
				recent++
			}
		}
		poolStats["healthy_connections"] = recent
		poolStats["max_pool_size"] = MaxPoolSize
		a.pool.mu.RUnlock()
	}

	return PerformanceMetrics{
		Timestamp:     time.Now().Format("2006-01-02 15:04:05"),
		GoRoutines:    runtime.NumGoroutine(),
		GoMemAllocMB:  float64(memStats.Alloc) / 1024 / 1024,
		GoNumGC:       memStats.NumGC,
		CPUPercent:    0,
		ActiveQueries: queryCount,
		ActiveTxns:    txnCount,
		PoolStats:     poolStats,
	}
}

type SlowQueryInfo struct {
	QueryID    string  `json:"query_id"`
	Query      string  `json:"query"`
	Database   string  `json:"database"`
	DurationMs float64 `json:"duration_ms"`
	Timestamp  string  `json:"timestamp"`
}

func (a *App) GetConnectionPoolStats() map[string]interface{} {
	stats := map[string]interface{}{
		"max_pool_size": MaxPoolSize,
	}

	if a.pool != nil {
		a.pool.mu.RLock()
		defer a.pool.mu.RUnlock()

		stats["total_connections"] = len(a.pool.connections)
		var recent int
		for _, entry := range a.pool.connections {
			if time.Since(entry.lastPing) < 5*time.Minute {
				recent++
			}
		}
		stats["healthy_connections"] = recent
		stats["unhealthy_connections"] = len(a.pool.connections) - recent
	}

	return stats
}

func (a *App) GetSystemInfo() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return map[string]interface{}{
		"go_version":      runtime.Version(),
		"goroutines":      runtime.NumGoroutine(),
		"mem_alloc_mb":    fmt.Sprintf("%.2f", float64(memStats.Alloc)/1024/1024),
		"mem_sys_mb":      fmt.Sprintf("%.2f", float64(memStats.Sys)/1024/1024),
		"num_gc":          memStats.NumGC,
		"num_goroutine":   runtime.NumGoroutine(),
		"cpu_cores":       runtime.NumCPU(),
		"os":              runtime.GOOS,
		"arch":            runtime.GOARCH,
		"uptime":          time.Since(appStartTime).String(),
	}
}

var appStartTime = time.Now()

func (a *App) HealthCheck() map[string]interface{} {
	if a.ctx != nil {
		ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
		defer cancel()
		_ = ctx
	}

	result := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Format("2006-01-02 15:04:05"),
		"checks":    map[string]interface{}{},
	}

	checks := map[string]interface{}{}

	checks["goroutines"] = map[string]interface{}{
		"status": "ok",
		"value":  runtime.NumGoroutine(),
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	memMB := float64(memStats.Alloc) / 1024 / 1024
	memStatus := "ok"
	if memMB > 500 {
		memStatus = "warning"
	}
	checks["memory"] = map[string]interface{}{
		"status": memStatus,
		"value":  fmt.Sprintf("%.2f MB", memMB),
	}

	globalTxMutex.Lock()
	txnCount := len(globalTransactions)
	globalTxMutex.Unlock()
	txnStatus := "ok"
	if txnCount > MaxActiveTransactions/2 {
		txnStatus = "warning"
	}
	checks["transactions"] = map[string]interface{}{
		"status": txnStatus,
		"value":  txnCount,
	}

	if a.pool != nil {
		a.pool.mu.RLock()
		poolLen := len(a.pool.connections)
		a.pool.mu.RUnlock()
		checks["connection_pool"] = map[string]interface{}{
			"status": "ok",
			"value":  poolLen,
		}
	} else {
		checks["connection_pool"] = map[string]interface{}{
			"status": "not_initialized",
			"value":  0,
		}
	}

	result["checks"] = checks

	return result
}
