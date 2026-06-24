package main

import (
	"database/sql"
	"fmt"
	"strings"
	"unicode/utf8"

	"db-server/db"
)

func (a *App) GetDatabases(config Connection) ([]DatabaseInfo, error) {
	dbConfig := a.connectionToDBConfig(config)

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	databases, err := driver.GetDatabases(a.ctx)
	if err != nil {
		return nil, err
	}

	result := make([]DatabaseInfo, len(databases))
	for i, d := range databases {
		result[i] = DatabaseInfo{Name: d}
	}

	return result, nil
}

func (a *App) GetTables(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	if err := driver.UseDatabase(a.ctx, database); err != nil {
		return nil, fmt.Errorf(a.t(MsgDBSwitchFailed, a.getCurrentLang()), database, err)
	}

	tables, err := driver.GetTables(a.ctx)
	if err != nil {
		return nil, err
	}

	result := make([]TableInfo, len(tables))
	for i, table := range tables {
		result[i] = TableInfo{Name: table, Type: "table"}
	}

	return result, nil
}

func (a *App) GetViews(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	switch config.Type {
	case "mysql":
		safeDB := escapeStringLiteral(dbConfig.Database)
		query = `
		SELECT TABLE_NAME
		FROM information_schema.VIEWS
		WHERE TABLE_SCHEMA = '` + safeDB + `'
		`
	case "postgresql", "polardb", "gaussdb":
		query = `
		SELECT viewname
		FROM pg_views
		WHERE schemaname = 'public'
		`
	case "sqlite":
		query = `
		SELECT name
		FROM sqlite_master
		WHERE type='view'
		`
	default:
		return []TableInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return nil, fmt.Errorf(a.t(MsgViewQueryFailed, a.getCurrentLang()), err)
	}
	defer rows.Close()

	var views []TableInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			views = append(views, TableInfo{Name: name, Type: "view"})
		}
	}

	if views == nil {
		views = []TableInfo{}
	}
	return views, nil
}

func (a *App) GetFunctions(config Connection, database string) ([]TableInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	switch config.Type {
	case "mysql":
		safeDB := escapeStringLiteral(dbConfig.Database)
		query = `
		SELECT ROUTINE_NAME
		FROM information_schema.ROUTINES
		WHERE ROUTINE_TYPE = 'FUNCTION'
		AND ROUTINE_SCHEMA = '` + safeDB + `'
		`
	case "postgresql", "polardb", "gaussdb":
		query = `
			SELECT proname 
			FROM pg_proc 
			JOIN pg_namespace n ON pg_proc.pronamespace = n.oid 
			WHERE n.nspname = 'public' 
			AND pg_proc.prokind = 'f'
			LIMIT 100
		`
	case "sqlite":
		query = `
			SELECT name 
			FROM sqlite_master 
			WHERE type='view' AND name LIKE 'func_%'
		`
	default:
		return []TableInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return []TableInfo{}, nil
	}
	defer rows.Close()

	var functions []TableInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			functions = append(functions, TableInfo{Name: name, Type: "function"})
		}
	}

	return functions, nil
}

func (a *App) GetTableColumns(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	return driver.GetTableStructure(a.ctx, table)
}

func sanitizeIdentifier(identifier string) string {
	if identifier == "" {
		return "invalid_identifier"
	}

	if strings.Contains(identifier, "..") {
		return "invalid_identifier"
	}

	if strings.ContainsAny(identifier, ";--/*\\=(){}[]&|!<>") {
		return "invalid_identifier"
	}

	cleaned := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '.' {
			return r
		}
		return -1
	}, identifier)

	if cleaned == "" {
		return "invalid_identifier"
	}

	if utf8.RuneCountInString(cleaned) > 64 {
		runes := []rune(cleaned)
		cleaned = string(runes[:64])
	}

	if dotCount := strings.Count(cleaned, "."); dotCount > 1 {
		return "invalid_identifier"
	}

	return cleaned
}

func escapeStringLiteral(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

func (a *App) GetTableIndexes(config Connection, database string, table string) ([]IndexInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string
	var indexes []IndexInfo

	switch config.Type {
	case "mysql":
		safeTable := sanitizeIdentifier(table)
		query = fmt.Sprintf("SHOW INDEX FROM `%s`", safeTable)
	case "postgresql", "polardb", "gaussdb":
		safeTable := sanitizeIdentifier(table)
		query = fmt.Sprintf(`
			SELECT
				i.relname as index_name,
				ix.indisunique as is_unique,
				ix.indisprimary as is_primary,
				array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
			FROM pg_index ix
			JOIN pg_class i ON i.oid = ix.indexrelid
			JOIN pg_class t ON t.oid = ix.indrelid
			JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
			WHERE t.relname = '%s'
			GROUP BY i.relname, ix.indisunique, ix.indisprimary
		`, safeTable)
	default:
		return []IndexInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if config.Type == "mysql" {
		type mysqlIndex struct {
			Table        string
			NonUnique    int
			KeyName      string
			SeqInIndex   int
			ColumnName   string
			Collation    sql.NullString
			Cardinality  sql.NullInt64
			SubPart      sql.NullInt64
			Packed       sql.NullString
			Null         sql.NullString
			IndexType    sql.NullString
			Comment      sql.NullString
			IndexComment sql.NullString
		}

		indexMap := make(map[string]*IndexInfo)
		for rows.Next() {
			var idx mysqlIndex
			err := rows.Scan(&idx.Table, &idx.NonUnique, &idx.KeyName, &idx.SeqInIndex,
				&idx.ColumnName, &idx.Collation, &idx.Cardinality, &idx.SubPart,
				&idx.Packed, &idx.Null, &idx.IndexType, &idx.Comment, &idx.IndexComment)
			if err != nil {
				return nil, err
			}

			if _, exists := indexMap[idx.KeyName]; !exists {
				indexType := "INDEX"
				if idx.KeyName == "PRIMARY" {
					indexType = "PRIMARY"
				} else if idx.NonUnique == 0 {
					indexType = "UNIQUE"
				}

				indexMap[idx.KeyName] = &IndexInfo{
					Name:    idx.KeyName,
					Type:    indexType,
					Unique:  idx.NonUnique == 0,
					Columns: []string{},
				}
				if idx.Cardinality.Valid {
					indexMap[idx.KeyName].Cardinality = idx.Cardinality.Int64
				}
			}
			indexMap[idx.KeyName].Columns = append(indexMap[idx.KeyName].Columns, idx.ColumnName)
		}

		for _, idx := range indexMap {
			indexes = append(indexes, *idx)
		}
	} else {
		for rows.Next() {
			var idx IndexInfo
			var columnsArray string
			err := rows.Scan(&idx.Name, &idx.Unique, &idx.PrimaryKey, &columnsArray)
			if err != nil {
				return nil, err
			}

			if idx.PrimaryKey {
				idx.Type = "PRIMARY"
			} else if idx.Unique {
				idx.Type = "UNIQUE"
			} else {
				idx.Type = "INDEX"
			}

			idx.Columns = parsePostgresArray(columnsArray)
			indexes = append(indexes, idx)
		}
	}

	return indexes, nil
}

func (a *App) GetTableForeignKeys(config Connection, database string, table string) ([]ForeignKeyInfo, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, err
	}

	var query string

	safeTable := sanitizeIdentifier(table)
	safeDatabase := escapeStringLiteral(database)

	switch config.Type {
	case "mysql":
		query = fmt.Sprintf(`
		SELECT
		CONSTRAINT_NAME,
		COLUMN_NAME,
		REFERENCED_TABLE_NAME,
		REFERENCED_COLUMN_NAME,
		UPDATE_RULE,
		DELETE_RULE
		FROM information_schema.KEY_COLUMN_USAGE kcu
		JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
		ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
		AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
		WHERE kcu.TABLE_NAME = '%s'
		AND kcu.TABLE_SCHEMA = '%s'
		AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
		`, safeTable, safeDatabase)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf(`
			SELECT
				conname as constraint_name,
				a.attname as column_name,
				ref.relname as ref_table,
				af.attname as ref_column,
				confdeltype as on_delete,
				confupdtype as on_update
			FROM pg_constraint c
			JOIN pg_class t ON t.oid = c.conrelid
			JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
			JOIN pg_class ref ON ref.oid = c.confrelid
			JOIN pg_attribute af ON af.attrelid = ref.oid AND af.attnum = ANY(c.confkey)
			WHERE c.contype = 'f' AND t.relname = '%s'
		`, safeTable)
	default:
		return []ForeignKeyInfo{}, nil
	}

	rows, err := driver.Query(a.ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var foreignKeys []ForeignKeyInfo
	for rows.Next() {
		var fk ForeignKeyInfo
		var onUpdate, onDelete string

		if config.Type == "mysql" {
			err := rows.Scan(&fk.Name, &fk.ColumnName, &fk.RefTable, &fk.RefColumn, &onUpdate, &onDelete)
			if err != nil {
				return nil, err
			}
		} else {
			err := rows.Scan(&fk.Name, &fk.ColumnName, &fk.RefTable, &fk.RefColumn, &onDelete, &onUpdate)
			if err != nil {
				return nil, err
			}
		}

		fk.OnUpdate = convertRefAction(onUpdate)
		fk.OnDelete = convertRefAction(onDelete)
		foreignKeys = append(foreignKeys, fk)
	}

	return foreignKeys, nil
}

func (a *App) GetTableStats(config Connection, database string, table string) (TableStats, error) {
	dbConfig := a.connectionToDBConfig(config)
	dbConfig.Database = database

	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return TableStats{}, err
	}

	var stats TableStats

	safeTable := sanitizeIdentifier(table)

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", safeTable)
	if config.Type == "postgresql" || config.Type == "polardb" || config.Type == "gaussdb" {
		countQuery = fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", safeTable)
	}

	rows, err := driver.Query(a.ctx, countQuery)
	if err == nil && rows.Next() {
		rows.Scan(&stats.RowCount)
		rows.Close()
	}

	var infoQuery string
	switch config.Type {
	case "mysql":
		infoQuery = fmt.Sprintf("SHOW TABLE STATUS LIKE '%s'", safeTable)
	case "postgresql", "polardb", "gaussdb":
		infoQuery = fmt.Sprintf(`
			SELECT
				pg_relation_size('%s') as data_length,
				pg_indexes_size('%s') as index_length
		`, safeTable, safeTable)
	}

	rows2, err := driver.Query(a.ctx, infoQuery)
	if err == nil && rows2.Next() {
		if config.Type == "mysql" {
			var name, version, rowFormat, collation, createOptions, tableType sql.NullString
			var avgRowLength, dataLength, maxDataLength, indexLength, dataFree, autoIncrement sql.NullInt64
			var engine, checkTime, checksum, createOptions2 sql.NullString
			var rows sql.NullInt64

			rows2.Scan(&name, &version, &rowFormat, &rows, &avgRowLength, &dataLength,
				&maxDataLength, &indexLength, &dataFree, &autoIncrement, &createOptions,
				&collation, &checkTime, &checksum, &tableType, &createOptions2)

			if dataLength.Valid {
				stats.DataLength = dataLength.Int64
			}
			if indexLength.Valid {
				stats.IndexLength = indexLength.Int64
			}
			if engine.Valid {
				stats.Engine = engine.String
			}
			if collation.Valid {
				stats.Collation = collation.String
			}
		} else {
			rows2.Scan(&stats.DataLength, &stats.IndexLength)
		}
		rows2.Close()
	}

	return stats, nil
}

func parsePostgresArray(arr string) []string {
	if len(arr) < 2 || arr[0] != '{' || arr[len(arr)-1] != '}' {
		return []string{}
	}

	content := arr[1 : len(arr)-1]
	if content == "" {
		return []string{}
	}

	var result []string
	var current strings.Builder
	inQuote := false
	escaped := false

	for i := 0; i < len(content); i++ {
		c := content[i]

		if escaped {
			current.WriteByte(c)
			escaped = false
			continue
		}

		if c == '\\' {
			escaped = true
			current.WriteByte(c)
			continue
		}

		if c == '"' {
			inQuote = !inQuote
			continue
		}

		if c == ',' && !inQuote {
			result = append(result, current.String())
			current.Reset()
			continue
		}

		current.WriteByte(c)
	}

	if current.Len() > 0 {
		result = append(result, current.String())
	}

	return result
}

func convertRefAction(action string) string {
	switch action {
	case "a":
		return "NO ACTION"
	case "r":
		return "RESTRICT"
	case "c":
		return "CASCADE"
	case "n":
		return "SET NULL"
	case "d":
		return "SET DEFAULT"
	default:
		return action
	}
}
