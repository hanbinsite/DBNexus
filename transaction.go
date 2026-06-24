package main

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"db-server/db"
)

type TransactionOptions struct {
	Isolation string `json:"isolation"`
	ReadOnly  bool   `json:"readOnly"`
}

type TransactionResult struct {
	Success      bool               `json:"success"`
	RowsAffected int64              `json:"rowsAffected"`
	Message      string             `json:"message"`
	Error        string             `json:"error,omitempty"`
	Duration     string             `json:"duration"`
	Queries      []TransactionQuery `json:"queries"`
}

type TransactionQuery struct {
	Query        string `json:"query"`
	RowsAffected int64  `json:"rowsAffected"`
	Error        string `json:"error,omitempty"`
}

type TransactionRequest struct {
	Config   Connection         `json:"config"`
	Database string             `json:"database"`
	Queries  []string           `json:"queries"`
	Options  TransactionOptions `json:"options"`
}

const (
	TransactionTimeout  = 30 * time.Minute
	MaxActiveTransactions = 100
)

type activeTransaction struct {
	tx      *sql.Tx
	driver  db.DatabaseDriver
	ctx     context.Context
	created time.Time
}

var (
	globalTransactions = make(map[string]*activeTransaction)
	globalTxMutex      sync.RWMutex
	cleanupOnce        sync.Once
)

func (a *App) startStaleTransactionCleanup() {
	cleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				a.cleanupStaleTransactions()
			}
		}()
	})
}

func (a *App) cleanupStaleTransactions() {
	globalTxMutex.Lock()
	defer globalTxMutex.Unlock()

	now := time.Now()
	for txID, tx := range globalTransactions {
		if now.Sub(tx.created) > TransactionTimeout {
			tx.tx.Rollback()
			delete(globalTransactions, txID)
		}
	}
}

func (a *App) BeginTransaction(config Connection, database string, options TransactionOptions) (string, error) {
	a.startStaleTransactionCleanup()

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return "", fmt.Errorf(a.t(MsgConnectionError, a.getCurrentLang()), err)
	}

	var sqlOpts *sql.TxOptions
	if options.Isolation != "" || options.ReadOnly {
		sqlOpts = &sql.TxOptions{}
		switch options.Isolation {
		case "READ UNCOMMITTED":
			sqlOpts.Isolation = sql.LevelReadUncommitted
		case "READ COMMITTED":
			sqlOpts.Isolation = sql.LevelReadCommitted
		case "REPEATABLE READ":
			sqlOpts.Isolation = sql.LevelRepeatableRead
		case "SERIALIZABLE":
			sqlOpts.Isolation = sql.LevelSerializable
		default:
			sqlOpts.Isolation = sql.LevelDefault
		}
		sqlOpts.ReadOnly = options.ReadOnly
	}

	connectCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	tx, err := driver.BeginTx(connectCtx, sqlOpts)
	cancel()

	if err != nil {
		return "", fmt.Errorf(a.t(MsgTransactionStartFailed, a.getCurrentLang()), err)
	}

	txID := fmt.Sprintf("tx_%d", time.Now().UnixNano())
	globalTxMutex.Lock()
	if len(globalTransactions) >= MaxActiveTransactions {
		globalTxMutex.Unlock()
		return "", fmt.Errorf("too many active transactions (max %d), please commit or rollback existing ones", MaxActiveTransactions)
	}
	globalTransactions[txID] = &activeTransaction{
		tx:      tx,
		driver:  driver,
		ctx:     context.Background(),
		created: time.Now(),
	}
	globalTxMutex.Unlock()

	return txID, nil
}

func (a *App) ExecuteInTransaction(txID string, query string) (int64, error) {
	globalTxMutex.RLock()
	tx, exists := globalTransactions[txID]
	globalTxMutex.RUnlock()

	if !exists {
		return 0, fmt.Errorf(a.t(MsgTransactionNotFound, a.getCurrentLang()), txID)
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("事务内执行: %s", truncateQuery(query, 200)),
		map[string]interface{}{
			"tx_id": txID,
		},
	)

	result, err := tx.tx.ExecContext(tx.ctx, query)
	if err != nil {
		auditLogger.Log(AuditLevelError, AuditEventQueryError,
			fmt.Sprintf("事务执行失败: %v", err),
			map[string]interface{}{
				"tx_id": txID,
				"query": truncateQuery(query, 200),
			},
		)
		return 0, err
	}

	return result.RowsAffected()
}

func (a *App) CommitTransaction(txID string) error {
	globalTxMutex.Lock()
	defer globalTxMutex.Unlock()

	tx, exists := globalTransactions[txID]
	if !exists {
		return fmt.Errorf(a.t(MsgTransactionNotFound, a.getCurrentLang()), txID)
	}

	err := tx.tx.Commit()
	delete(globalTransactions, txID)

	if err != nil {
		return fmt.Errorf(a.t(MsgTransactionCommitFailed, a.getCurrentLang()), err)
	}

	return nil
}

func (a *App) RollbackTransaction(txID string) error {
	globalTxMutex.Lock()
	defer globalTxMutex.Unlock()

	tx, exists := globalTransactions[txID]
	if !exists {
		return fmt.Errorf(a.t(MsgTransactionNotFound, a.getCurrentLang()), txID)
	}

	err := tx.tx.Rollback()
	delete(globalTransactions, txID)

	if err != nil {
		return fmt.Errorf(a.t(MsgTransactionRollbackFailed, a.getCurrentLang()), err)
	}

	return nil
}

func (a *App) ExecuteTransactionBatch(req TransactionRequest) TransactionResult {
	startTime := time.Now()

	txID, err := a.BeginTransaction(req.Config, req.Database, req.Options)
	if err != nil {
		return TransactionResult{
			Success:  false,
			Error:    err.Error(),
			Duration: time.Since(startTime).String(),
		}
	}

	var queries []TransactionQuery
	var totalAffected int64
	hasError := false

	for _, query := range req.Queries {
		affected, err := a.ExecuteInTransaction(txID, query)
		qResult := TransactionQuery{
			Query:        query,
			RowsAffected: affected,
		}
		if err != nil {
			qResult.Error = err.Error()
			hasError = true
			queries = append(queries, qResult)
			break
		}
		queries = append(queries, qResult)
		totalAffected += affected
	}

	if hasError {
		a.RollbackTransaction(txID)
		return TransactionResult{
			Success:      false,
			RowsAffected: totalAffected,
			Message:      "事务已回滚",
			Error:        queries[len(queries)-1].Error,
			Duration:     time.Since(startTime).String(),
			Queries:      queries,
		}
	}

	if err := a.CommitTransaction(txID); err != nil {
		return TransactionResult{
			Success:      false,
			RowsAffected: totalAffected,
			Message:      "提交失败，事务已回滚",
			Error:        err.Error(),
			Duration:     time.Since(startTime).String(),
			Queries:      queries,
		}
	}

	return TransactionResult{
		Success:      true,
		RowsAffected: totalAffected,
		Message:      fmt.Sprintf("事务执行成功，共影响 %d 行", totalAffected),
		Duration:     time.Since(startTime).String(),
		Queries:      queries,
	}
}
