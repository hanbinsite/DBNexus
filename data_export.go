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

type ExportFormat string

const (
	ExportCSV   ExportFormat = "csv"
	ExportJSON  ExportFormat = "json"
	ExportExcel ExportFormat = "xlsx"
	ExportSQL   ExportFormat = "sql"
)

type ExportRequest struct {
	Format   ExportFormat `json:"format"`
	FileName string       `json:"fileName"`
	Query    string       `json:"query,omitempty"`
	Table    string       `json:"table,omitempty"`
	Database string       `json:"database"`
	Limit    int          `json:"limit,omitempty"`
	Offset   int          `json:"offset,omitempty"`
}

type ExportResult struct {
	Success   bool   `json:"success"`
	FileName  string `json:"fileName"`
	RowsCount int    `json:"rowsCount"`
	Message   string `json:"message"`
	Error     string `json:"error,omitempty"`
	FilePath  string `json:"filePath,omitempty"`
}

func (a *App) ExportData(config Connection, req ExportRequest) ExportResult {
	auditLogger := GetAuditLogger()

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

	result := a.ExecuteQuery(config, req.Database, query)
	if result.Error != "" {
		return ExportResult{
			Success: false,
			Message: "查询失败",
			Error:   result.Error,
		}
	}

	homeDir, _ := os.UserHomeDir()
	exportDir := filepath.Join(homeDir, ".db-client", "exports")
	os.MkdirAll(exportDir, 0700)

	fileName := fmt.Sprintf("%s.%s", req.FileName, req.Format)
	filePath := filepath.Join(exportDir, fileName)

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

func (a *App) exportToCSV(result QueryResult, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write(result.Columns); err != nil {
		return err
	}

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

	return os.WriteFile(filePath, jsonData, 0600)
}

func (a *App) exportToExcel(result QueryResult, filePath string) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Sheet1"

	for i, col := range result.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, col)
	}

	for rowIdx, row := range result.Rows {
		for colIdx, value := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet, cell, value)
		}
	}

	for i := range result.Columns {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheet, col, col, 15)
	}

	return f.SaveAs(filePath)
}

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

	return os.WriteFile(filePath, []byte(sqlBuilder.String()), 0600)
}

type ImportRequest struct {
	Format   ExportFormat `json:"format"`
	FileName string       `json:"fileName"`
	Table    string       `json:"table"`
	Database string       `json:"database"`
}

type ImportResult struct {
	Success      bool   `json:"success"`
	RowsImported int    `json:"rowsImported"`
	Message      string `json:"message"`
	Error        string `json:"error,omitempty"`
}

func (a *App) ImportData(config Connection, req ImportRequest) ImportResult {
	auditLogger := GetAuditLogger()

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

	homeDir, _ := os.UserHomeDir()
	importDir := filepath.Join(homeDir, ".db-client", "imports")
	os.MkdirAll(importDir, 0700)

	baseName := filepath.Base(req.FileName)
	if baseName != req.FileName || strings.Contains(req.FileName, "..") {
		return ImportResult{
			Success: false,
			Message: "无效的文件名",
		}
	}
	filePath := filepath.Join(importDir, baseName)

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
