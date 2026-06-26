package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (a *App) buildSchemaContext(config Connection, database string, maxTables int) string {
	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return fmt.Sprintf("-- Schema context unavailable: %v\n", err)
	}

	tables, err := driver.GetTables(ctx)
	if err != nil {
		return fmt.Sprintf("-- Failed to get tables: %v\n", err)
	}

	if maxTables > 0 && len(tables) > maxTables {
		tables = tables[:maxTables]
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("-- Database: %s\n", database))
	sb.WriteString(fmt.Sprintf("-- Tables: %d\n\n", len(tables)))

	for _, tableName := range tables {
		columns, err := driver.GetTableStructure(ctx, tableName)
		if err != nil {
			sb.WriteString(fmt.Sprintf("-- Failed to get structure for %s\n", tableName))
			continue
		}

		var colDefs []string
		var pkCols []string
		for _, col := range columns {
			def := fmt.Sprintf("%s %s", col.Name, col.Type)
			if !col.Nullable {
				def += " NOT NULL"
			}
			if col.DefaultValue != "" {
				def += fmt.Sprintf(" DEFAULT %s", col.DefaultValue)
			}
			if col.PrimaryKey {
				pkCols = append(pkCols, col.Name)
			}
			colDefs = append(colDefs, def)
		}

		sb.WriteString(fmt.Sprintf("CREATE TABLE %s (\n", tableName))
		sb.WriteString("  " + strings.Join(colDefs, ",\n  "))
		if len(pkCols) > 0 {
			sb.WriteString(",\n  PRIMARY KEY (" + strings.Join(pkCols, ", ") + ")")
		}
		sb.WriteString("\n);\n\n")
	}

	indexes, _ := a.GetTableIndexes(config, database, "")
	_ = indexes

	return sb.String()
}

