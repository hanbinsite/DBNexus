package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// S4-2: 表DDL生成
func (a *App) GenerateTableDDL(config Connection, database string, tableName string) (string, error) {
	if tableName == "" {
		return "", fmt.Errorf("table name is required")
	}

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return "", fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(tableName)
	var ddl strings.Builder

	switch config.Type {
	case "mysql":
		ddl.WriteString(fmt.Sprintf("CREATE TABLE `%s` (\n", safeTable))
		columns, err := driver.GetTableStructure(ctx, tableName)
		if err != nil {
			return "", fmt.Errorf("failed to get columns: %w", err)
		}
		var primaryKeys []string
		for i, col := range columns {
			if i > 0 {
				ddl.WriteString(",\n")
			}
			ddl.WriteString(fmt.Sprintf("  `%s` %s", col.Name, col.Type))
			if !col.Nullable {
				ddl.WriteString(" NOT NULL")
			}
			if col.DefaultValue != "" {
				ddl.WriteString(fmt.Sprintf(" DEFAULT %s", col.DefaultValue))
			}
			if col.PrimaryKey {
				primaryKeys = append(primaryKeys, col.Name)
			}
		}
		if len(primaryKeys) > 0 {
			ddl.WriteString(fmt.Sprintf(",\n  PRIMARY KEY (`%s`)", strings.Join(primaryKeys, "`, `")))
		}
		ddl.WriteString("\n);")

	case "postgresql", "polardb", "gaussdb":
		ddl.WriteString(fmt.Sprintf("CREATE TABLE %s (\n", safeTable))
		columns, err := driver.GetTableStructure(ctx, tableName)
		if err != nil {
			return "", fmt.Errorf("failed to get columns: %w", err)
		}
		var primaryKeys []string
		for i, col := range columns {
			if i > 0 {
				ddl.WriteString(",\n")
			}
			ddl.WriteString(fmt.Sprintf("  %s %s", sanitizeIdentifier(col.Name), col.Type))
			if !col.Nullable {
				ddl.WriteString(" NOT NULL")
			}
			if col.DefaultValue != "" {
				ddl.WriteString(fmt.Sprintf(" DEFAULT %s", col.DefaultValue))
			}
			if col.PrimaryKey {
				primaryKeys = append(primaryKeys, col.Name)
			}
		}
		if len(primaryKeys) > 0 {
			ddl.WriteString(fmt.Sprintf(",\n  PRIMARY KEY (%s)", strings.Join(primaryKeys, ", ")))
		}
		ddl.WriteString("\n);")

	case "sqlite":
		ddl.WriteString(fmt.Sprintf("CREATE TABLE %s (\n", safeTable))
		columns, err := driver.GetTableStructure(ctx, tableName)
		if err != nil {
			return "", fmt.Errorf("failed to get columns: %w", err)
		}
		var primaryKeys []string
		for i, col := range columns {
			if i > 0 {
				ddl.WriteString(",\n")
			}
			ddl.WriteString(fmt.Sprintf("  %s %s", sanitizeIdentifier(col.Name), col.Type))
			if !col.Nullable {
				ddl.WriteString(" NOT NULL")
			}
			if col.DefaultValue != "" {
				ddl.WriteString(fmt.Sprintf(" DEFAULT %s", col.DefaultValue))
			}
			if col.PrimaryKey {
				primaryKeys = append(primaryKeys, col.Name)
			}
		}
		if len(primaryKeys) > 0 {
			ddl.WriteString(fmt.Sprintf(",\n  PRIMARY KEY (%s)", strings.Join(primaryKeys, ", ")))
		}
		ddl.WriteString("\n);")

	default:
		return "", fmt.Errorf("DDL generation not supported for type: %s", config.Type)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("生成表DDL: %s.%s", database, tableName),
		map[string]interface{}{"table": tableName, "database": database},
	)

	return ddl.String(), nil
}

// S4-3: 触发器查询
type TriggerInfo struct {
	Name        string `json:"name"`
	Event       string `json:"event"`
	Timing      string `json:"timing"`
	Statement   string `json:"statement"`
	Created     string `json:"created,omitempty"`
	Enabled     string `json:"enabled,omitempty"`
}

func (a *App) GetTableTriggers(config Connection, database string, tableName string) ([]TriggerInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	safeTable := sanitizeIdentifier(tableName)
	var query string

	switch config.Type {
	case "mysql":
		query = fmt.Sprintf(`
			SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT, CREATED
			FROM information_schema.TRIGGERS
			WHERE EVENT_OBJECT_TABLE = '%s'
			ORDER BY TRIGGER_NAME
		`, safeTable)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT t.tgname,
				CASE WHEN (t.tgtype & 2) != 0 THEN 'BEFORE' ELSE 'AFTER' END,
				CASE WHEN (t.tgtype & 4) != 0 THEN 'INSERT'
				     WHEN (t.tgtype & 8) != 0 THEN 'DELETE'
				     WHEN (t.tgtype & 16) != 0 THEN 'UPDATE'
				     ELSE 'UNKNOWN' END,
				LEFT(pg_get_triggerdef(t.oid), 500),
				''
			FROM pg_trigger t
			JOIN pg_class c ON c.oid = t.tgrelid
			WHERE c.relname = '%s' AND NOT t.tgisinternal
			ORDER BY t.tgname
		`, safeTable)
	default:
		return []TriggerInfo{}, nil
	}

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return []TriggerInfo{}, nil
	}
	defer rows.Close()

	var triggers []TriggerInfo
	for rows.Next() {
		var t TriggerInfo
		if err := rows.Scan(&t.Name, &t.Event, &t.Timing, &t.Statement, &t.Created); err != nil {
			continue
		}
		triggers = append(triggers, t)
	}

	if triggers == nil {
		triggers = []TriggerInfo{}
	}
	return triggers, nil
}

