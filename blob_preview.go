package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"
)

// S5-2: BLOB/CLOB 数据预览
type BlobPreview struct {
	Type       string `json:"type"`        // "image", "text", "hex", "base64", "json", "xml"
	Size       int64  `json:"size"`
	Preview    string `json:"preview"`     // base64 for images, text for text/hex, truncated
	IsTruncated bool   `json:"is_truncated"`
	MimeType   string `json:"mime_type,omitempty"`
}

func (a *App) PreviewBlobData(config Connection, database string, table string, column string, primaryKeyColumn string, primaryKeyValue string) (*BlobPreview, error) {
	if table == "" || column == "" || primaryKeyColumn == "" {
		return nil, fmt.Errorf("table, column, and primary key column are required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(table)
	safeColumn := sanitizeIdentifier(column)
	safePK := sanitizeIdentifier(primaryKeyColumn)

	var query string
	if config.Type == "mysql" {
		query = fmt.Sprintf("SELECT `%s` FROM `%s` WHERE `%s` = ? LIMIT 1", safeColumn, safeTable, safePK)
	} else {
		query = fmt.Sprintf("SELECT %s FROM %s WHERE %s = $1 LIMIT 1", safeColumn, safeTable, safePK)
	}

	rows, err := driver.Query(ctx, query, primaryKeyValue)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("no row found with %s = %s", primaryKeyColumn, primaryKeyValue)
	}

	var rawValue []byte
	if err := rows.Scan(&rawValue); err != nil {
		// Try as string
		var strVal string
		rows.Close()
		rows2, err2 := driver.Query(ctx, query, primaryKeyValue)
		if err2 != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		defer rows2.Close()
		if rows2.Next() {
			if err := rows2.Scan(&strVal); err != nil {
				return nil, fmt.Errorf("scan failed: %w", err)
			}
			rawValue = []byte(strVal)
		}
	}

	preview := &BlobPreview{
		Size: int64(len(rawValue)),
	}

	const maxPreviewSize = 64 * 1024 // 64KB preview limit

	// Detect type
	contentType := detectContentType(rawValue)
	preview.MimeType = contentType

	if strings.HasPrefix(contentType, "image/") {
		preview.Type = "image"
		if len(rawValue) <= maxPreviewSize {
			preview.Preview = base64.StdEncoding.EncodeToString(rawValue)
		} else {
			preview.Preview = base64.StdEncoding.EncodeToString(rawValue[:maxPreviewSize])
			preview.IsTruncated = true
		}
	} else if isPrintableText(rawValue) {
		text := string(rawValue)
		preview.Type = "text"
		if len(text) > 4096 {
			preview.Preview = text[:4096]
			preview.IsTruncated = true
		} else {
			preview.Preview = text
		}
		// Check if JSON or XML
		trimmed := strings.TrimSpace(text)
		if (strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")) ||
			(strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")) {
			preview.Type = "json"
		} else if strings.HasPrefix(trimmed, "<") && strings.HasSuffix(trimmed, ">") {
			preview.Type = "xml"
		}
	} else {
		preview.Type = "hex"
		hexLen := len(rawValue)
		if hexLen > 1024 {
			hexLen = 1024
		}
		preview.Preview = fmt.Sprintf("%x", rawValue[:hexLen])
		if len(rawValue) > 1024 {
			preview.IsTruncated = true
		}
	}

	return preview, nil
}

func detectContentType(data []byte) string {
	if len(data) == 0 {
		return "application/octet-stream"
	}

	// Check for common image magic numbers
	if len(data) >= 4 {
		if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
			return "image/jpeg"
		}
		if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
			return "image/png"
		}
		if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
			return "image/gif"
		}
		if data[0] == 0x42 && data[1] == 0x4D {
			return "image/bmp"
		}
	}

	// Check for PDF
	if len(data) >= 4 && string(data[:4]) == "%PDF" {
		return "application/pdf"
	}

	// Check for printable text (ASCII or UTF-8)
	if isPrintableText(data) {
		trimmed := strings.TrimSpace(string(data))
		if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
			return "application/json"
		}
		if strings.HasPrefix(trimmed, "<") {
			return "application/xml"
		}
		return "text/plain"
	}

	return "application/octet-stream"
}

func isPrintableText(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	printable := 0
	total := len(data)
	if total > 512 {
		total = 512 // Sample first 512 bytes
	}
	for i := 0; i < total; i++ {
		b := data[i]
		if b == '\n' || b == '\r' || b == '\t' || (b >= 32 && b < 127) || b >= 0x80 {
			printable++
		}
	}
	return printable*100/total > 90
}

