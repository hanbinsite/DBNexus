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
	TransactionTimeout = 30 * time.Minute // 事务最大存活时间
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
)

// cleanupStaleTransactions 清理超时的事务
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
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	key := buildKey(dbConfig)
	a.poolMutex.RLock()
	pooledDriver, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if pooledDriver, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return "", fmt.Errorf("连接失败: %v", err)
			}
			a.pool.set(key, newDriver)
			pooledDriver, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
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

	ctx := context.Background()
	tx, err := pooledDriver.driver.BeginTx(ctx, sqlOpts)
	if err != nil {
		return "", fmt.Errorf("开始事务失败: %v", err)
	}

	txID := fmt.Sprintf("tx_%d", time.Now().UnixNano())
	globalTxMutex.Lock()
	globalTransactions[txID] = &activeTransaction{
		tx:      tx,
		driver:  pooledDriver.driver,
		ctx:     ctx,
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
		return 0, fmt.Errorf("事务不存在: %s", txID)
	}

	result, err := tx.tx.ExecContext(tx.ctx, query)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

func (a *App) CommitTransaction(txID string) error {
	globalTxMutex.Lock()
	defer globalTxMutex.Unlock()

	tx, exists := globalTransactions[txID]
	if !exists {
		return fmt.Errorf("事务不存在: %s", txID)
	}

	err := tx.tx.Commit()
	delete(globalTransactions, txID)

	if err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

func (a *App) RollbackTransaction(txID string) error {
	globalTxMutex.Lock()
	defer globalTxMutex.Unlock()

	tx, exists := globalTransactions[txID]
	if !exists {
		return fmt.Errorf("事务不存在: %s", txID)
	}

	err := tx.tx.Rollback()
	delete(globalTransactions, txID)

	if err != nil {
		return fmt.Errorf("回滚事务失败: %v", err)
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
