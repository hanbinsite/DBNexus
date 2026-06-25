package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	DefaultQueryTimeout = 30
	MaxQueryTimeout     = 300
	MinQueryTimeout     = 1
)

var (
	ErrQueryTimeout = errors.New("查询超时")
)

func (a *App) ExecuteQueryWithTimeout(config Connection, database string, query string, options QueryOptions) QueryResult {
	startTime := time.Now()

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

	ctx, cancel := context.WithTimeout(a.ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	queryID := fmt.Sprintf("q_%d", time.Now().UnixNano())
	registerQuery(queryID, query, cancel)
	defer unregisterQuery(queryID)

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return QueryResult{
			Error:    fmt.Sprintf("连接失败: %v", err),
			Duration: time.Since(startTime).String(),
		}
	}

	auditLogger := GetAuditLogger()
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("执行查询 (单): %s", truncateQuery(query, 200)),
		map[string]interface{}{
			"database":  database,
			"timeout":   timeoutSeconds,
			"query_id":  queryID,
		},
	)

	rows, err := driver.Query(ctx, query)
	if err != nil {
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
				row[i] = nil
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

func (a *App) ExecuteMultiQueryWithTimeout(config Connection, database string, query string, options QueryOptions) MultiQueryResult {
	startTime := time.Now()

	timeoutSeconds := options.Timeout
	if timeoutSeconds <= 0 {
		timeoutSeconds = DefaultQueryTimeout
	}
	if timeoutSeconds > MaxQueryTimeout {
		timeoutSeconds = MaxQueryTimeout
	}

	ctx, cancel := context.WithTimeout(a.ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return MultiQueryResult{
			TotalDuration: time.Since(startTime).String(),
		}
	}

	queries := splitQueries(query)

	var results []SingleQueryResult
	var totalDuration time.Duration

	for _, q := range queries {
		select {
		case <-ctx.Done():
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

		upperQuery := strings.ToUpper(strings.TrimSpace(q))
		isSelect := strings.HasPrefix(upperQuery, "SELECT") ||
			strings.HasPrefix(upperQuery, "SHOW") ||
			strings.HasPrefix(upperQuery, "DESCRIBE") ||
			strings.HasPrefix(upperQuery, "EXPLAIN") ||
			strings.HasPrefix(upperQuery, "WITH")

		if isSelect {
			rows, err := driver.Query(ctx, q)
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
							row[i] = nil
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
			sqlResult, err := driver.Exec(ctx, q)
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
