package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"db-server/db"
)

const (
	EditOpInsert = "INSERT"
	EditOpUpdate = "UPDATE"
	EditOpDelete = "DELETE"
)

func (a *App) EditTableData(config Connection, req EditRequest) EditResult {
	startTime := time.Now()
	auditLogger := GetAuditLogger()

	if err := a.validateEditRequest(req); err != nil {
		return EditResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = req.Database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		auditLogger.Log(AuditLevelError, AuditEventQueryError,
			fmt.Sprintf("编辑数据失败: %s.%s", req.Database, req.Table),
			map[string]interface{}{
				"operation": req.Operation,
				"error":     err.Error(),
			})
		return EditResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	var result EditResult
	var query string

	ctx := context.Background()

	switch req.Operation {
	case EditOpInsert:
		query, result = a.performInsert(ctx, driver, req, config.Type)
	case EditOpUpdate:
		query, result = a.performUpdate(ctx, driver, req, config.Type)
	case EditOpDelete:
		query, result = a.performDelete(ctx, driver, req, config.Type)
	default:
		return EditResult{
			Success: false,
			Error:   fmt.Sprintf("未知操作: %s", req.Operation),
		}
	}

	if result.Success {
		auditLogger.Log(AuditLevelInfo, AuditEventQuery,
			fmt.Sprintf("编辑数据: %s.%s - %s", req.Database, req.Table, req.Operation),
			map[string]interface{}{
				"operation":     req.Operation,
				"table":         req.Table,
				"query":         truncateQuery(query, 200),
				"rows_affected": result.RowsAffected,
				"duration":      time.Since(startTime).String(),
			})
	} else {
		auditLogger.Log(AuditLevelError, AuditEventQueryError,
			fmt.Sprintf("编辑数据失败: %s.%s - %s", req.Database, req.Table, req.Operation),
			map[string]interface{}{
				"operation": req.Operation,
				"table":     req.Table,
				"query":     truncateQuery(query, 200),
				"error":     result.Error,
			})
	}

	return result
}

func (a *App) validateEditRequest(req EditRequest) error {
	if req.Table == "" {
		return fmt.Errorf("%s", a.t(MsgTableNameRequired, a.getCurrentLang()))
	}
	if req.Database == "" {
		return fmt.Errorf("%s", a.t(MsgDBNameRequired, a.getCurrentLang()))
	}
	if req.Operation == "" {
		return fmt.Errorf("%s", a.t(MsgOpTypeRequired, a.getCurrentLang()))
	}

	safeTable := sanitizeIdentifier(req.Table)
	if safeTable == "invalid_identifier" {
		return fmt.Errorf(a.t(MsgInvalidTableName, a.getCurrentLang()), req.Table)
	}

	return nil
}

func quoteIdentifier(name, dbType string) string {
	safeName := sanitizeIdentifier(name)
	switch dbType {
	case "postgresql", "polardb", "gaussdb":
		return fmt.Sprintf("\"%s\"", safeName)
	default:
		return fmt.Sprintf("`%s`", safeName)
	}
}

func (a *App) performInsert(ctx context.Context, driver db.DatabaseDriver, req EditRequest, dbType string) (string, EditResult) {
	if len(req.Data) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "插入数据不能为空",
		}
	}

	var columns []string
	var placeholders []string
	var values []interface{}

	for col, val := range req.Data {
		safeCol := quoteIdentifier(col, dbType)
		if safeCol == "\"invalid_identifier\"" || safeCol == "`invalid_identifier`" {
			continue
		}
		columns = append(columns, safeCol)
		placeholders = append(placeholders, "?")
		values = append(values, val)
	}

	tableName := quoteIdentifier(req.Table, dbType)
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "))

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		RowsAffected: rowsAffected,
	}
}

func (a *App) performUpdate(ctx context.Context, driver db.DatabaseDriver, req EditRequest, dbType string) (string, EditResult) {
	if len(req.Data) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "更新数据不能为空",
		}
	}

	if len(req.PrimaryKey) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "更新操作必须指定主键",
		}
	}

	var setClauses []string
	var values []interface{}

	for col, val := range req.Data {
		safeCol := quoteIdentifier(col, dbType)
		if safeCol == "\"invalid_identifier\"" || safeCol == "`invalid_identifier`" {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = ?", safeCol))
		values = append(values, val)
	}

	var whereConditions []string
	for col, val := range req.PrimaryKey {
		safeCol := quoteIdentifier(col, dbType)
		if safeCol == "\"invalid_identifier\"" || safeCol == "`invalid_identifier`" {
			continue
		}
		whereConditions = append(whereConditions, fmt.Sprintf("%s = ?", safeCol))
		values = append(values, val)
	}

	if len(whereConditions) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "主键列无效",
		}
	}

	tableName := quoteIdentifier(req.Table, dbType)
	query := fmt.Sprintf("UPDATE %s SET %s WHERE %s",
		tableName,
		strings.Join(setClauses, ", "),
		strings.Join(whereConditions, " AND "))

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		RowsAffected: rowsAffected,
	}
}

func (a *App) performDelete(ctx context.Context, driver db.DatabaseDriver, req EditRequest, dbType string) (string, EditResult) {
	if len(req.PrimaryKey) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "删除操作必须指定主键",
		}
	}

	var values []interface{}
	var whereConditions []string

	for col, val := range req.PrimaryKey {
		safeCol := quoteIdentifier(col, dbType)
		if safeCol == "\"invalid_identifier\"" || safeCol == "`invalid_identifier`" {
			continue
		}
		whereConditions = append(whereConditions, fmt.Sprintf("%s = ?", safeCol))
		values = append(values, val)
	}

	if len(whereConditions) == 0 {
		return "", EditResult{
			Success: false,
			Error:   "主键列无效",
		}
	}

	tableName := quoteIdentifier(req.Table, dbType)
	query := fmt.Sprintf("DELETE FROM %s WHERE %s", tableName, strings.Join(whereConditions, " AND "))

	result, err := driver.Exec(ctx, query, values...)
	if err != nil {
		return query, EditResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	rowsAffected, _ := result.RowsAffected()
	return query, EditResult{
		Success:      true,
		RowsAffected: rowsAffected,
	}
}

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

func (a *App) BatchEdit(config Connection, requests []EditRequest) []EditResult {
	var results []EditResult

	for _, req := range requests {
		result := a.EditTableData(config, req)
		results = append(results, result)
		if !result.Success {
			return results
		}
	}

	return results
}

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

func (a *App) GenerateUpdateStatement(table string, data map[string]interface{}, primaryKey map[string]interface{}) string {
	safeTable := sanitizeIdentifier(table)
	var setClauses []string

	for col, val := range data {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(val)))
	}

	var whereConditions []string
	for col, val := range primaryKey {
		safeCol := sanitizeIdentifier(col)
		if safeCol == "invalid_identifier" {
			continue
		}
		whereConditions = append(whereConditions, fmt.Sprintf("`%s` = %s", safeCol, formatValueForSQL(val)))
	}

	return fmt.Sprintf("UPDATE `%s` SET %s WHERE %s",
		safeTable,
		strings.Join(setClauses, ", "),
		strings.Join(whereConditions, " AND "))
}

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
