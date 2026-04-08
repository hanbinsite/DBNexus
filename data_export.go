package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ExportFormat 导出格式
type ExportFormat string

const (
	ExportCSV   ExportFormat = "csv"
	ExportJSON  ExportFormat = "json"
	ExportExcel ExportFormat = "xlsx"
	ExportSQL   ExportFormat = "sql"
)

// ExportRequest 导出请求
type ExportRequest struct {
	Format   ExportFormat `json:"format"`
	FileName string       `json:"fileName"`
	Query    string       `json:"query,omitempty"`
	Table    string       `json:"table,omitempty"`
	Database string       `json:"database"`
	Limit    int          `json:"limit,omitempty"`
	Offset   int          `json:"offset,omitempty"`
}

// ExportResult 导出结果
type ExportResult struct {
	Success   bool   `json:"success"`
	FileName  string `json:"fileName"`
	RowsCount int    `json:"rowsCount"`
	Message   string `json:"message"`
	Error     string `json:"error,omitempty"`
	FilePath  string `json:"filePath,omitempty"`
}

// ExportData 导出数据
func (a *App) ExportData(config Connection, req ExportRequest) ExportResult {
	auditLogger := GetAuditLogger()

	// 验证请求
	if req.Format == "" {
		return ExportResult{
			Success: false,
			Message: "导出格式不能为空",
			Error:   "缺少导出格式",
		}
	}

	if req.FileName == "" {
		req.FileName = fmt.Sprintf("export_%s", time.Now().Format("20060102_150405"))
	}

	// 执行查询获取数据
	var query string
	if req.Query != "" {
		query = req.Query
	} else if req.Table != "" {
		safeTable := sanitizeIdentifier(req.Table)
		query = fmt.Sprintf("SELECT * FROM `%s`", safeTable)
		if req.Limit > 0 {
			query += fmt.Sprintf(" LIMIT %d", req.Limit)
		}
		if req.Offset > 0 {
			query += fmt.Sprintf(" OFFSET %d", req.Offset)
		}
	} else {
		return ExportResult{
			Success: false,
			Message: "必须指定查询语句或表名",
			Error:   "缺少查询条件",
		}
	}

	// 执行查询
	result := a.ExecuteQuery(config, req.Database, query)
	if result.Error != "" {
		return ExportResult{
			Success: false,
			Message: "查询失败",
			Error:   result.Error,
		}
	}

	// 确定导出路径
	homeDir, _ := os.UserHomeDir()
	exportDir := filepath.Join(homeDir, ".db-client", "exports")
	os.MkdirAll(exportDir, 0755)

	fileName := fmt.Sprintf("%s.%s", req.FileName, req.Format)
	filePath := filepath.Join(exportDir, fileName)

	// 根据格式导出
	var err error
	switch req.Format {
	case ExportCSV:
		err = a.exportToCSV(result, filePath)
	case ExportJSON:
		err = a.exportToJSON(result, filePath)
	case ExportExcel:
		err = a.exportToExcel(result, filePath)
	case ExportSQL:
		err = a.exportToSQL(result, filePath, req.Table)
	default:
		return ExportResult{
			Success: false,
			Message: "不支持的导出格式",
			Error:   fmt.Sprintf("格式: %s", req.Format),
		}
	}

	if err != nil {
		auditLogger.Log(AuditLevelError, AuditEventQueryError,
			fmt.Sprintf("导出数据失败: %s", fileName),
			map[string]interface{}{
				"format":     string(req.Format),
				"table":      req.Table,
				"rows_count": result.RowCount,
				"error":      err.Error(),
			})
		return ExportResult{
			Success: false,
			Message: "导出失败",
			Error:   err.Error(),
		}
	}

	// 记录审计日志
	auditLogger.Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("导出数据成功: %s", fileName),
		map[string]interface{}{
			"format":     string(req.Format),
			"table":      req.Table,
			"rows_count": result.RowCount,
			"file_path":  filePath,
		})

	return ExportResult{
		Success:   true,
		FileName:  fileName,
		RowsCount: result.RowCount,
		Message:   fmt.Sprintf("成功导出 %d 行数据", result.RowCount),
		FilePath:  filePath,
	}
}

// exportToCSV 导出为 CSV
func (a *App) exportToCSV(result QueryResult, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// 写入表头
	if err := writer.Write(result.Columns); err != nil {
		return err
	}

	// 写入数据行
	for _, row := range result.Rows {
		var record []string
		for _, value := range row {
			record = append(record, fmt.Sprintf("%v", value))
		}
		if err := writer.Write(record); err != nil {
			return err
		}
	}

	return nil
}

// exportToJSON 导出为 JSON
func (a *App) exportToJSON(result QueryResult, filePath string) error {
	var data []map[string]interface{}

	for _, row := range result.Rows {
		rowMap := make(map[string]interface{})
		for i, col := range result.Columns {
			rowMap[col] = row[i]
		}
		data = append(data, rowMap)
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, jsonData, 0644)
}

// exportToExcel 导出为 Excel
func (a *App) exportToExcel(result QueryResult, filePath string) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Sheet1"

	// 写入表头
	for i, col := range result.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, col)
	}

	// 写入数据
	for rowIdx, row := range result.Rows {
		for colIdx, value := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet, cell, value)
		}
	}

	// 自动调整列宽
	for i := range result.Columns {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 15)
	}

	return f.SaveAs(filePath)
}

// exportToSQL 导出为 SQL INSERT 语句
func (a *App) exportToSQL(result QueryResult, filePath string, tableName string) error {
	if tableName == "" {
		tableName = "table_name"
	}

	var sqlBuilder strings.Builder

	for _, row := range result.Rows {
		var columns []string
		var values []string

		for i, value := range row {
			columns = append(columns, fmt.Sprintf("`%s`", result.Columns[i]))
			values = append(values, formatValueForSQL(value))
		}

		sql := fmt.Sprintf("INSERT INTO `%s` (%s) VALUES (%s);\n",
			tableName,
			strings.Join(columns, ", "),
			strings.Join(values, ", "))

		sqlBuilder.WriteString(sql)
	}

	return os.WriteFile(filePath, []byte(sqlBuilder.String()), 0644)
}

// ImportRequest 导入请求
type ImportRequest struct {
	Format   ExportFormat `json:"format"`
	FileName string       `json:"fileName"`
	Table    string       `json:"table"`
	Database string       `json:"database"`
}

// ImportResult 导入结果
type ImportResult struct {
	Success      bool   `json:"success"`
	RowsImported int    `json:"rowsImported"`
	Message      string `json:"message"`
	Error        string `json:"error,omitempty"`
}

// ImportData 导入数据
func (a *App) ImportData(config Connection, req ImportRequest) ImportResult {
	auditLogger := GetAuditLogger()

	// 验证请求
	if req.FileName == "" {
		return ImportResult{
			Success: false,
			Message: "文件名不能为空",
			Error:   "缺少文件名",
		}
	}

	if req.Table == "" {
		return ImportResult{
			Success: false,
			Message: "表名不能为空",
			Error:   "缺少表名",
		}
	}

	// 确定文件路径
	homeDir, _ := os.UserHomeDir()
	importDir := filepath.Join(homeDir, ".db-client", "imports")
	filePath := filepath.Join(importDir, req.FileName)

	// 读取文件
	var data []map[string]interface{}
	var err error

	switch req.Format {
	case ExportCSV:
		data, err = a.importFromCSV(filePath)
	case ExportJSON:
		data, err = a.importFromJSON(filePath)
	default:
		return ImportResult{
			Success: false,
			Message: "不支持的导入格式",
			Error:   fmt.Sprintf("格式: %s", req.Format),
		}
	}

	if err != nil {
		return ImportResult{
			Success: false,
			Message: "读取文件失败",
			Error:   err.Error(),
		}
	}

	// 批量插入数据
	var rowsImported int
	var errors []string

	for _, row := range data {
		editReq := EditRequest{
			Operation: EditOpInsert,
			Table:     req.Table,
			Database:  req.Database,
			Data:      row,
		}

		result := a.EditTableData(config, editReq)
		if result.Success {
			rowsImported++
		} else {
			errors = append(errors, result.Error)
		}
	}

	// 记录审计日志
	if rowsImported > 0 {
		auditLogger.Log(AuditLevelInfo, AuditEventQuery,
			fmt.Sprintf("导入数据: %s -> %s", req.FileName, req.Table),
			map[string]interface{}{
				"format":        string(req.Format),
				"table":         req.Table,
				"rows_imported": rowsImported,
			})
	}

	message := fmt.Sprintf("成功导入 %d 行数据", rowsImported)
	if len(errors) > 0 {
		message += fmt.Sprintf(", 失败 %d 行", len(errors))
	}

	return ImportResult{
		Success:      rowsImported > 0,
		RowsImported: rowsImported,
		Message:      message,
		Error:        strings.Join(errors, "; "),
	}
}

// importFromCSV 从 CSV 导入
func (a *App) importFromCSV(filePath string) ([]map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return []map[string]interface{}{}, nil
	}

	// 第一行是表头
	headers := records[0]
	var data []map[string]interface{}

	for i := 1; i < len(records); i++ {
		row := make(map[string]interface{})
		for j, value := range records[i] {
			if j < len(headers) {
				row[headers[j]] = value
			}
		}
		data = append(data, row)
	}

	return data, nil
}

// importFromJSON 从 JSON 导入
func (a *App) importFromJSON(filePath string) ([]map[string]interface{}, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}
