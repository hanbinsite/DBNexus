package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// S7-3: 事务性批量编辑
func (a *App) BatchEditTransactional(config Connection, database string, requests []EditRequest) (MultiQueryResult, error) {
	if len(requests) == 0 {
		return MultiQueryResult{}, fmt.Errorf("no edit requests")
	}

	startTime := time.Now()
	result := MultiQueryResult{
		Results:    []SingleQueryResult{},
		TotalCount: len(requests),
	}

	// Begin transaction
	txID, err := a.BeginTransaction(config, database, TransactionOptions{})
	if err != nil {
		return MultiQueryResult{
			TotalCount:    len(requests),
			SuccessCount:  0,
			ErrorCount:    len(requests),
			TotalDuration: time.Since(startTime).String(),
		}, nil
	}

	successCount := 0
	errorCount := 0

	for i, req := range requests {
		var query string
		label := fmt.Sprintf("%s #%d", strings.ToUpper(req.Operation), i+1)

		switch strings.ToUpper(req.Operation) {
		case "INSERT":
			query = a.generateInsertSQL(config, req)
		case "UPDATE":
			query = a.generateUpdateSQL(config, req)
		case "DELETE":
			query = a.generateDeleteSQL(config, req)
		default:
			result.Results = append(result.Results, SingleQueryResult{
				Query:  label,
				Status: "error",
				Error:  fmt.Sprintf("unknown operation: %s", req.Operation),
			})
			errorCount++
			continue
		}

		_, err := a.ExecuteInTransaction(txID, query)
		if err != nil {
			result.Results = append(result.Results, SingleQueryResult{
				Query:  query,
				Status: "error",
				Error:  err.Error(),
			})
			errorCount++
			a.RollbackTransaction(txID)
			result.SuccessCount = successCount
			result.ErrorCount = errorCount
			result.TotalDuration = time.Since(startTime).String()
			return result, nil
		}

		result.Results = append(result.Results, SingleQueryResult{
			Query:  query,
			Status: "success",
		})
		successCount++
	}

	if err := a.CommitTransaction(txID); err != nil {
		result.SuccessCount = 0
		result.ErrorCount = len(requests)
		result.TotalDuration = time.Since(startTime).String()
		return result, nil
	}

	result.SuccessCount = successCount
	result.ErrorCount = errorCount
	result.TotalDuration = time.Since(startTime).String()

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("事务性批量编辑: %d 成功, %d 失败", successCount, errorCount),
		map[string]interface{}{"success": successCount, "errors": errorCount},
	)

	return result, nil
}

func (a *App) generateInsertSQL(config Connection, req EditRequest) string {
	safeTable := sanitizeIdentifier(req.Table)
	var cols []string
	var vals []string
	for colName, val := range req.Data {
		if config.Type == "mysql" {
			cols = append(cols, fmt.Sprintf("`%s`", sanitizeIdentifier(colName)))
		} else {
			cols = append(cols, sanitizeIdentifier(colName))
		}
		vals = append(vals, formatValueForSQL(val))
	}
	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		safeTable, strings.Join(cols, ", "), strings.Join(vals, ", "))
}

func (a *App) generateUpdateSQL(config Connection, req EditRequest) string {
	safeTable := sanitizeIdentifier(req.Table)
	var sets []string
	for colName, val := range req.Data {
		safeCol := sanitizeIdentifier(colName)
		if config.Type == "mysql" {
			sets = append(sets, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(val)))
		} else {
			sets = append(sets, fmt.Sprintf("%s = %s", safeCol, formatValueForSQL(val)))
		}
	}
	var whereParts []string
	for pkName, pkVal := range req.PrimaryKey {
		safeCol := sanitizeIdentifier(pkName)
		if config.Type == "mysql" {
			whereParts = append(whereParts, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(pkVal)))
		} else {
			whereParts = append(whereParts, fmt.Sprintf("%s = %s", safeCol, formatValueForSQL(pkVal)))
		}
	}
	return fmt.Sprintf("UPDATE %s SET %s WHERE %s",
		safeTable, strings.Join(sets, ", "), strings.Join(whereParts, " AND "))
}

func (a *App) generateDeleteSQL(config Connection, req EditRequest) string {
	safeTable := sanitizeIdentifier(req.Table)
	var whereParts []string
	for pkName, pkVal := range req.PrimaryKey {
		safeCol := sanitizeIdentifier(pkName)
		if config.Type == "mysql" {
			whereParts = append(whereParts, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(pkVal)))
		} else {
			whereParts = append(whereParts, fmt.Sprintf("%s = %s", safeCol, formatValueForSQL(pkVal)))
		}
	}
	return fmt.Sprintf("DELETE FROM %s WHERE %s",
		safeTable, strings.Join(whereParts, " AND "))
}

// S7-3: 事务事件通知
type TransactionEvent struct {
	Type      string `json:"type"`
	TxID      string `json:"tx_id"`
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
}

var transactionEventChan = make(chan TransactionEvent, 100)

func emitTransactionEvent(eventType string, txID string, message string) {
	event := TransactionEvent{
		Type:      eventType,
		TxID:      txID,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
		Message:   message,
	}
	select {
	case transactionEventChan <- event:
	default:
	}
}

func (a *App) GetTransactionEvents() []TransactionEvent {
	var events []TransactionEvent
	for {
		select {
		case event := <-transactionEventChan:
			events = append(events, event)
		default:
			if events == nil {
				events = []TransactionEvent{}
			}
			return events
		}
	}
}

// S7-5: 限定名补全 (schema.table.column)
func (a *App) GetQualifiedColumnSuggestions(config Connection, database string, schema string, table string) ([]string, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return []string{}, nil
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	columns, err := driver.GetTableStructure(ctx, table)
	if err != nil {
		return []string{}, nil
	}

	var suggestions []string
	prefix := ""
	if schema != "" {
		prefix = schema + "."
	}
	for _, col := range columns {
		suggestions = append(suggestions, prefix+table+"."+col.Name)
	}

	if suggestions == nil {
		suggestions = []string{}
	}
	return suggestions, nil
}
