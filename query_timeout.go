package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	DefaultQueryTimeout = 30  // 默认查询超时时间（秒）
	MaxQueryTimeout     = 300 // 最大查询超时时间（秒）
	MinQueryTimeout     = 1   // 最小查询超时时间（秒）
)

var (
	ErrQueryTimeout = errors.New("查询超时")
)

// QueryOptions 查询选项
type QueryOptions struct {
	Timeout int // 超时时间（秒），0表示使用默认值
}

// ExecuteQueryWithTimeout 执行带超时控制的查询
func (a *App) ExecuteQueryWithTimeout(config Connection, database string, query string, options QueryOptions) QueryResult {
	startTime := time.Now()

	// 设置超时时间
	timeoutSeconds := options.Timeout
	if timeoutSeconds <= 0 {
		timeoutSeconds = DefaultQueryTimeout
	}
	if timeoutSeconds > MaxQueryTimeout {
		timeoutSeconds = MaxQueryTimeout
	}
	if timeoutSeconds < MinQueryTimeout {
		timeoutSeconds = MinQueryTimeout
	}

	// 创建带超时的 context
	ctx, cancel := context.WithTimeout(a.ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	// 解密密码
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
				return QueryResult{
					Error:    fmt.Sprintf("连接失败: %v", err),
					Duration: time.Since(startTime).String(),
				}
			}
			a.pool.set(key, newDriver)
			pooledDriver, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
	}

	// 使用带超时的 context 执行查询
	rows, err := pooledDriver.driver.Query(ctx, query)
	if err != nil {
		// 检查是否是超时错误
		if errors.Is(err, context.DeadlineExceeded) {
			return QueryResult{
				Error:    fmt.Sprintf("查询超时（%d秒），请优化查询或增加超时时间。\n\n💡 提示：\n- 使用 LIMIT 限制返回行数\n- 添加适当的索引\n- 拆分复杂查询", timeoutSeconds),
				Duration: time.Since(startTime).String(),
			}
		}
		return QueryResult{
			Error:    fmt.Sprintf("查询失败: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("获取列信息失败: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}

	var resultRows [][]interface{}
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	for rows.Next() {
		// 检查 context 是否已取消（防止读取过多数据）
		select {
		case <-ctx.Done():
			return QueryResult{
				Error:    fmt.Sprintf("查询超时（%d秒），已返回 %d 行数据", timeoutSeconds, len(resultRows)),
				Columns:  columns,
				Rows:     resultRows,
				RowCount: len(resultRows),
				Duration: time.Since(startTime).String(),
			}
		default:
		}

		err = rows.Scan(valuePtrs...)
		if err != nil {
			return QueryResult{
				Error:    fmt.Sprintf("扫描行数据失败: %v", err),
				Duration: time.Since(startTime).String(),
			}
		}

		row := make([]interface{}, len(columns))
		for i, v := range values {
			if v == nil {
				row[i] = "NULL"
			} else if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		resultRows = append(resultRows, row)
	}

	return QueryResult{
		Columns:  columns,
		Rows:     resultRows,
		RowCount: len(resultRows),
		Duration: time.Since(startTime).String(),
	}
}

// ExecuteMultiQueryWithTimeout 执行带超时控制的多查询
func (a *App) ExecuteMultiQueryWithTimeout(config Connection, database string, query string, options QueryOptions) MultiQueryResult {
	startTime := time.Now()

	// 设置超时时间
	timeoutSeconds := options.Timeout
	if timeoutSeconds <= 0 {
		timeoutSeconds = DefaultQueryTimeout
	}
	if timeoutSeconds > MaxQueryTimeout {
		timeoutSeconds = MaxQueryTimeout
	}

	// 创建带超时的 context
	ctx, cancel := context.WithTimeout(a.ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

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
	pooled, exists := a.pool.get(key)
	a.poolMutex.RUnlock()

	if !exists {
		a.poolMutex.Lock()
		if pooled, exists = a.pool.get(key); !exists {
			newDriver, err := a.driverManager.Connect(dbConfig)
			if err != nil {
				a.poolMutex.Unlock()
				return MultiQueryResult{
					TotalDuration: time.Since(startTime).String(),
				}
			}
			a.pool.set(key, newDriver)
			pooled, _ = a.pool.get(key)
		}
		a.poolMutex.Unlock()
	}

	// 分割查询
	queries := splitQueries(query)

	var results []SingleQueryResult
	var totalDuration time.Duration

	for _, q := range queries {
		// 检查总超时
		select {
		case <-ctx.Done():
			// 超时，返回已执行的结果
			return MultiQueryResult{
				Results:       results,
				TotalCount:    len(results),
				SuccessCount:  countSuccess(results),
				ErrorCount:    countErrors(results),
				TotalDuration: time.Since(startTime).String(),
				StartTime:     time.Now().Format("15:04:05"),
				EndTime:       time.Now().Add(totalDuration).Format("15:04:05"),
			}
		default:
		}

		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}

		queryStart := time.Now()
		result := SingleQueryResult{
			Query:  q,
			Status: "success",
		}

		// 检查是否是 SELECT 查询
		upperQuery := strings.ToUpper(strings.TrimSpace(q))
		isSelect := strings.HasPrefix(upperQuery, "SELECT") ||
			strings.HasPrefix(upperQuery, "SHOW") ||
			strings.HasPrefix(upperQuery, "DESCRIBE") ||
			strings.HasPrefix(upperQuery, "EXPLAIN") ||
			strings.HasPrefix(upperQuery, "WITH")

		if isSelect {
			rows, err := pooled.driver.Query(ctx, q)
			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					result.Error = fmt.Sprintf("查询超时（%d秒）", timeoutSeconds)
				} else {
					result.Error = err.Error()
				}
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}

			columns, err := rows.Columns()
			if err == nil {
				result.Columns = columns
				values := make([]interface{}, len(columns))
				valuePtrs := make([]interface{}, len(columns))
				for i := range values {
					valuePtrs[i] = &values[i]
				}

				for rows.Next() {
					if err := rows.Scan(valuePtrs...); err != nil {
						break
					}
					row := make([]interface{}, len(columns))
					for i, v := range values {
						if v == nil {
							row[i] = "NULL"
						} else if b, ok := v.([]byte); ok {
							row[i] = string(b)
						} else {
							row[i] = v
						}
					}
					result.Rows = append(result.Rows, row)
				}
				result.RowCount = len(result.Rows)
			}
			rows.Close()
		} else {
			// Non-SELECT: INSERT, UPDATE, DELETE, etc.
			sqlResult, err := pooled.driver.Exec(ctx, q)
			if err != nil {
				if errors.Is(err, context.DeadlineExceeded) {
					result.Error = fmt.Sprintf("执行超时（%d秒）", timeoutSeconds)
				} else {
					result.Error = err.Error()
				}
				result.Status = "error"
				result.Duration = time.Since(queryStart).String()
				results = append(results, result)
				continue
			}
			if sqlResult != nil {
				if affected, err := sqlResult.RowsAffected(); err == nil {
					result.RowCount = int(affected)
				}
			}
		}

		result.Duration = time.Since(queryStart).String()
		results = append(results, result)
	}

	totalDuration = time.Since(startTime)

	return MultiQueryResult{
		Results:       results,
		TotalCount:    len(results),
		SuccessCount:  countSuccess(results),
		ErrorCount:    countErrors(results),
		TotalDuration: totalDuration.String(),
		StartTime:     time.Now().Format("15:04:05"),
		EndTime:       time.Now().Add(totalDuration).Format("15:04:05"),
	}
}

// 辅助函数
func countSuccess(results []SingleQueryResult) int {
	count := 0
	for _, r := range results {
		if r.Status == "success" {
			count++
		}
	}
	return count
}

func countErrors(results []SingleQueryResult) int {
	count := 0
	for _, r := range results {
		if r.Status == "error" {
			count++
		}
	}
	return count
}
