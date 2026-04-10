package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"db-server/db"
)

// EditOperation 编辑操作类型
type EditOperation string

const (
	EditOpInsert EditOperation = "INSERT"
	EditOpUpdate EditOperation = "UPDATE"
	EditOpDelete EditOperation = "DELETE"
)

// EditRequest 编辑请求
type EditRequest struct {
	Operation   EditOperation          `json:"operation"`
	Table       string                 `json:"table"`
	Database    string                 `json:"database"`
	Data        map[string]interface{} `json:"data"`
	WhereClause string                 `json:"whereClause,omitempty"`
	PrimaryKey  map[string]interface{} `json:"primaryKey,omitempty"`
}

// EditResult 编辑结果
type EditResult struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	RowsAffected int64  `json:"rowsAffected"`
	Error        string `json:"error,omitempty"`
}

// EditTableData 编辑表数据
func (a *App) EditTableData(config Connection, req EditRequest) EditResult {
	startTime := time.Now()
	auditLogger := GetAuditLogger()

	// 验证请求
	if err := a.validateEditRequest(req); err != nil {
		return EditResult{
			Success: false,
			Message: "验证失败",
			Error:   err.Error(),
		}
	}

	// 解密密码
	if config.SavePassword && config.Password != "" {
		decrypted, err := decryptPassword(config.Password)
		if err == nil {
			config.Password = decrypted
		}
	}

	// 获取数据库连接
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = req.Database

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
				auditLogger.Log(AuditLevelError, AuditEventQueryError,
					fmt.Sprintf("编辑数据失败: %s.%s", req.Database, req.Table),
					map[string]interface{}{
						"operation": string(req.Operation),
						"error":     err.Error(),
					})
				return EditResult{
					Success: false,
					Message: "连接数据库失败",
					Error:   err.Error(),
				}
			}
			a.pool.set(key, newDriver)
			pooledDriver, exists = a.pool.get(key)
			if !exists || pooledDriver == nil {
				a.poolMutex.Unlock()
				return EditResult{
					Success: false,
					Message: "连接池设置失败",
					Error:   "无法从连接池获取连接",
				}
			}
		}
		a.poolMutex.Unlock()
	}

	// 双重检查：确保 pooledDriver 和 driver 都不为 nil
	if pooledDriver == nil || pooledDriver.driver == nil {
		return EditResult{
			Success: false,
			Message: "连接无效",
			Error:   "连接池返回了无效的连接",
		}
	}

	var result EditResult
	var query string

	ctx := context.Background()

	switch req.Operation {
	case EditOpInsert:
		query, result = a.performInsert(ctx, pooledDriver.driver, req)
	case EditOpUpdate:
		query, result = a.performUpdate(ctx, pooledDriver.driver, req)
	case EditOpDelete:
		query, result = a.performDelete(ctx, pooledDriver.driver, req)
	default:
		return EditResult{
			Success: false,
			Message: "不支持的操作类型",
			Error:   fmt.Sprintf("未知操作: %s", req.Operation),
		}
	}

	// 记录审计日志
	if result.Success {
		auditLogger.Log(AuditLevelInfo, AuditEventQuery,
			fmt.Sprintf("编辑数据: %s.%s - %s", req.Database, req.Table, req.Operation),
			map[string]interface{}{
				"operation":     string(req.Operation),
				"table":         req.Table,
				"query":         truncateQuery(query, 200),
				"rows_affected": result.RowsAffected,
				"duration":      time.Since(startTime).String(),
			})
	} else {
		auditLogger.Log(AuditLevelError, AuditEventQueryError,
			fmt.Sprintf("编辑数据失败: %s.%s - %s", req.Database, req.Table, req.Operation),
			map[string]interface{}{
				"operation": string(req.Operation),
				"table":     req.Table,
				"query":     truncateQuery(query, 200),
				"error":     result.Error,
			})
	}

	return result
}

// validateEditRequest 验证编辑请求
func (a *App) validateEditRequest(req EditRequest) error {
	if req.Table == "" {
		return fmt.Errorf("表名不能为空")
	}
	if req.Database == "" {
		return fmt.Errorf("数据库名不能为空")
	}
	if req.Operation == "" {
		return fmt.Errorf("操作类型不能为空")
	}

	safeTable := sanitizeIdentifier(req.Table)
	if safeTable == "invalid_identifier" {
		return fmt.Errorf("无效的表名: %s", req.Table)
	}

	return nil
}

// performInsert 执行插入操作
func (a *App) performInsert(ctx context.Context, driver db.DatabaseDriver, req EditRequest) (string, EditResult) {
	if len(req.Data) == 0 {
		return "", EditResult{
			Success: false,
			Message: "插入数据不能为空",
			Error:   "数据为空",
		}
	}

	safeTable := sanitizeIdentifier(req.Table)
	var columns []string
	var placeholders []string
	var values []interface{}

	for col, val := range req.Data {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		columns = append(columns, fmt.Sprintf("`%s`", safeCol))
		placeholders = append(placeholders, "?")
		values = append(values, val)
	}

	query := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES (%s)",
		safeTable,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "))

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Message: "插入失败",
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		Message:      fmt.Sprintf("成功插入 %d 行数据", rowsAffected),
		RowsAffected: rowsAffected,
	}
}

// performUpdate 执行更新操作
func (a *App) performUpdate(ctx context.Context, driver db.DatabaseDriver, req EditRequest) (string, EditResult) {
	if len(req.Data) == 0 {
		return "", EditResult{
			Success: false,
			Message: "更新数据不能为空",
			Error:   "数据为空",
		}
	}

	if req.WhereClause == "" && len(req.PrimaryKey) == 0 {
		return "", EditResult{
			Success: false,
			Message: "更新操作必须指定 WHERE 条件或主键",
			Error:   "缺少 WHERE 条件",
		}
	}

	safeTable := sanitizeIdentifier(req.Table)
	var setClauses []string
	var values []interface{}

	for col, val := range req.Data {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("`%s` = ?", safeCol))
		values = append(values, val)
	}

	var whereClause string
	if req.WhereClause != "" {
		whereClause = req.WhereClause
	} else {
		var whereConditions []string
		for col, val := range req.PrimaryKey {
			safeCol := sanitizeIdentifier(col)
			if safeCol == "invalid_identifier" {
				continue
			}
			whereConditions = append(whereConditions, fmt.Sprintf("`%s` = ?", safeCol))
			values = append(values, val)
		}
		whereClause = strings.Join(whereConditions, " AND ")
	}

	query := fmt.Sprintf("UPDATE `%s` SET %s WHERE %s",
		safeTable,
		strings.Join(setClauses, ", "),
		whereClause)

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Message: "更新失败",
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		Message:      fmt.Sprintf("成功更新 %d 行数据", rowsAffected),
		RowsAffected: rowsAffected,
	}
}

// performDelete 执行删除操作
func (a *App) performDelete(ctx context.Context, driver db.DatabaseDriver, req EditRequest) (string, EditResult) {
	if req.WhereClause == "" && len(req.PrimaryKey) == 0 {
		return "", EditResult{
			Success: false,
			Message: "删除操作必须指定 WHERE 条件或主键",
			Error:   "缺少 WHERE 条件",
		}
	}

	safeTable := sanitizeIdentifier(req.Table)
	var values []interface{}

	var whereClause string
	if req.WhereClause != "" {
		whereClause = req.WhereClause
	} else {
		var whereConditions []string
		for col, val := range req.PrimaryKey {
			safeCol := sanitizeIdentifier(col)
			if safeCol == "invalid_identifier" {
				continue
			}
			whereConditions = append(whereConditions, fmt.Sprintf("`%s` = ?", safeCol))
			values = append(values, val)
		}
		whereClause = strings.Join(whereConditions, " AND ")
	}

	query := fmt.Sprintf("DELETE FROM `%s` WHERE %s", safeTable, whereClause)

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Message: "删除失败",
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		Message:      fmt.Sprintf("成功删除 %d 行数据", rowsAffected),
		RowsAffected: rowsAffected,
	}
}

// GetEditableColumns 获取可编辑的列信息
func (a *App) GetEditableColumns(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	columns, err := a.GetTableColumns(config, database, table)
	if err != nil {
		return nil, err
	}

	var editableColumns []db.ColumnInfo
	for _, col := range columns {
		isAutoIncrement := strings.Contains(strings.ToUpper(col.DefaultValue), "AUTO_INCREMENT")
		if !isAutoIncrement {
			editableColumns = append(editableColumns, col)
		}
	}

	return editableColumns, nil
}

// BatchEdit 批量编辑操作
func (a *App) BatchEdit(config Connection, requests []EditRequest) []EditResult {
	var results []EditResult

	for _, req := range requests {
		result := a.EditTableData(config, req)
		results = append(results, result)
	}

	return results
}

// GenerateInsertStatement 生成 INSERT 语句（用于预览）
func (a *App) GenerateInsertStatement(table string, data map[string]interface{}) string {
	safeTable := sanitizeIdentifier(table)
	var columns []string
	var values []string

	for col, val := range data {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		columns = append(columns, fmt.Sprintf("`%s`", safeCol))
		values = append(values, formatValueForSQL(val))
	}

	return fmt.Sprintf("INSERT INTO `%s` (%s) VALUES (%s)",
		safeTable,
		strings.Join(columns, ", "),
		strings.Join(values, ", "))
}

// GenerateUpdateStatement 生成 UPDATE 语句（用于预览）
func (a *App) GenerateUpdateStatement(table string, data map[string]interface{}, whereClause string) string {
	safeTable := sanitizeIdentifier(table)
	var setClauses []string

	for col, val := range data {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(val)))
	}

	return fmt.Sprintf("UPDATE `%s` SET %s WHERE %s",
		safeTable,
		strings.Join(setClauses, ", "),
		whereClause)
}

// formatValueForSQL 格式化值为 SQL 字符串
func formatValueForSQL(val interface{}) string {
	switch v := val.(type) {
	case string:
		return fmt.Sprintf("'%s'", strings.ReplaceAll(v, "'", "''"))
	case nil:
		return "NULL"
	case bool:
		if v {
			return "1"
		}
		return "0"
	default:
		return fmt.Sprintf("%v", v)
	}
}
