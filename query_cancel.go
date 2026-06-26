package main

import (
	"fmt"
	"sync"
	"time"
)

type activeQuery struct {
	cancelFunc func()
	query     string
	started   time.Time
}

var (
	activeQueries    = make(map[string]*activeQuery)
	activeQueriesMu  sync.Mutex
)

func (a *App) CancelQuery(queryID string) error {
	activeQueriesMu.Lock()
	defer activeQueriesMu.Unlock()

	q, exists := activeQueries[queryID]
	if !exists {
		return fmt.Errorf("query not found or already completed: %s", queryID)
	}

	q.cancelFunc()
	delete(activeQueries, queryID)

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("查询已取消: %s", queryID),
		map[string]interface{}{"query_id": queryID, "query": truncateQuery(q.query, 200)},
	)

	return nil
}

func (a *App) GetActiveQueries() []map[string]interface{} {
	activeQueriesMu.Lock()
	defer activeQueriesMu.Unlock()

	result := []map[string]interface{}{}
	for id, q := range activeQueries {
		result = append(result, map[string]interface{}{
			"id":       id,
			"query":    truncateQuery(q.query, 100),
			"duration": time.Since(q.started).String(),
		})
	}
	return result
}

func registerQuery(queryID string, query string, cancel func()) {
	activeQueriesMu.Lock()
	defer activeQueriesMu.Unlock()
	activeQueries[queryID] = &activeQuery{
		cancelFunc: cancel,
		query:      query,
		started:    time.Now(),
	}
}

func unregisterQuery(queryID string) {
	activeQueriesMu.Lock()
	defer activeQueriesMu.Unlock()
	delete(activeQueries, queryID)
}

