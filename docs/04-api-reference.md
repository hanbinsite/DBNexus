# D04 - API Reference / API 参考文档

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于 App.d.ts (142行) + 源码实际实现撰写

---

## 1. API Overview / API 总览

所有 API 方法通过 Wails Bindings 从前端调用: `window.go.main.App.MethodName(args)`

**调用模式**: 所有方法返回 `Promise`，前端使用 `await` 或 `.then()` 处理。

**方法总数**: 72 (App.d.ts 52个已实现 + §13 Audit 3个 + §10-12 新增扩展 17个)

**参数传递**: JSON 序列化。前端传递 JS 对象，Wails runtime 自动反序列化为 Go struct。

---

## 2. Connection Management / 连接管理

### 2.1 GetSupportedDatabases

**签名**: `GetSupportedDatabases(): Promise<Array<Record<string, string>>>`

**源码**: connection.go:11-20

**返回值**:
```json
[
  {"id": "postgresql", "name": "PostgreSQL", "default_port": "5432"},
  {"id": "mysql", "name": "MySQL", "default_port": "3306"},
  {"id": "polardb", "name": "PolarDB", "default_port": "5432"},
  {"id": "gaussdb", "name": "GaussDB", "default_port": "5432"},
  {"id": "sqlite", "name": "SQLite", "default_port": ""},
  {"id": "redis", "name": "Redis", "default_port": "6379"}
]
```

**错误处理**: 无 (静态返回)

---

### 2.2 GetConnections

**签名**: `GetConnections(): Promise<Array<main.Connection>>`

**源码**: connection.go:23-25

**返回值**: `App.connections` 数组（直接返回内部状态）

**注意**: 返回的 Connection 中 Password 可能是加密后的 Base64 字符串

---

### 2.3 SaveConnection

**签名**: `SaveConnection(arg1:main.Connection): Promise<void>`

**源码**: connection.go:28-74

**参数**: Connection 对象（见 D03-data-models.md）

**处理逻辑**:
1. ID 为空时自动生成 (L31)
2. `save_password=true && password!=""` → `encryptPassword()` (L36-39)
3. `save_password=false` → 清空密码 (L42)
4. 查找已有连接，更新或新增 (L47-61)
5. 记录审计日志 (L64-71)
6. 写入 connections.json (L73)

**错误**: 加密失败 → "failed to encrypt password"; 写入失败 → 文件权限错误

---

### 2.4 DeleteConnection

**签名**: `DeleteConnection(arg1:string): Promise<void>`

**源码**: connection.go:77-96

**参数**: `id` — 连接 ID 字符串

**处理逻辑**:
1. 从 connections 数组中查找并删除 (L79-85)
2. 记录审计日志 (WARNING 级别) (L88-93)
3. 保存 connections.json (L95)

**错误**: ID 不存在时仍成功（静默无操作）

---

### 2.5 TestConnection

**签名**: `TestConnection(arg1:main.Connection): Promise<boolean|string>`

**源码**: connection.go:99-150

**参数**: Connection 对象（Password 可能需解密）

**返回值**:
- 成功: `[true, "连接成功！数据库: mydb"]` (i18n)
- 失败: `[false, "连接失败: ..."]` + 错误提示建议

**处理逻辑**:
1. 解密密码 (L103-109)
2. 验证必填字段 (L112-120)
3. 使用默认数据库 (L122-125)
4. DriverManager.Connect() → driver.Ping() → driver.Close() (L137-148)
5. 错误消息附带提示 (formatError) (L153-176)

**错误提示映射** (i18n.go):
| 错误关键词 | 提示 |
|------------|------|
| "connection refused" | 检查主机和端口 |
| "authentication failed" | 检查凭据 |
| "no such host" | 检查网络连接 |
| "timeout" | 检查防火墙 |
| "Unknown database" | 检查数据库名称 |
| "Access denied" (MySQL) | 检查用户权限 |
| "no password supplied" (PG) | 需要密码 |

---

### 2.6 ConnectToDatabase

**签名**: `ConnectToDatabase(arg1:main.Connection): Promise<boolean|string>`

**源码**: connection.go:200-259

**参数**: Connection 对象

**返回值**:
- 成功: `[true, "Connected successfully"]`
- 失败: `[false, "连接失败: ..."]`

**处理逻辑**:
1. 解密密码 (L202-207)
2. 构建连接配置 (L210-223)
3. `pool.getOrCreate(key, createFunc)` (L229-252)
   - createFunc: DriverManager.Connect → Ping retry 3x 200ms
4. pool 超 50 时自动 evictOldest

---

### 2.7 DisconnectFromDatabase

**签名**: `DisconnectFromDatabase(arg1:main.Connection): Promise<void>`

**源码**: connection.go:262-265

**参数**: Connection 对象

**处理**: `buildKey()` → `pool.remove(key)` (立即关闭连接)

---

### 2.8 GetSupportedFeatures

**签名**: `GetSupportedFeatures(): Promise<Record<string, Array<string>>>`

**源码**: test.go:74-83

**返回值**:
```json
{
  "postgresql": ["查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"],
  "mysql": ["查询", "插入", "更新", "删除", "事务", "存储过程", "视图", "索引"],
  "polardb": [...同PG...],
  "gaussdb": [...同PG...],
  "sqlite": ["查询", "插入", "更新", "删除", "事务", "视图", "索引"],
  "redis": ["GET", "SET", "DEL", "EXISTS", "EXPIRE", "KEYS", "TYPE", "TTL"]
}
```

**注意**: 功能列表是静态声明，不代表全部已实现

---

## 3. Query Execution / 查询执行

### 3.1 ExecuteQuery

**签名**: `ExecuteQuery(arg1:main.Connection, arg2:string, arg3:string): Promise<main.QueryResult>`

**源码**: query.go:10-97

**参数**: `(Connection, database, query)`

**返回值**: QueryResult (见 D03-data-models.md)

**处理逻辑**:
1. 解密密码 (L13-17)
2. poolMutex double-check 获取连接 (L24-43)
3. `driver.Query(ctx, query)` (L45)
4. 扫描结果行，NULL→"NULL", []byte→string (L69-89)

**错误**: "Connection failed" / "Query failed" / "Failed to get columns" / "Failed to scan row"

---

### 3.2 ExecuteMultiQuery

**签名**: `ExecuteMultiQuery(arg1:main.Connection, arg2:string, arg3:string): Promise<main.MultiQueryResult>`

**源码**: query.go:99-236

**参数**: `(Connection, database, query)` — query 可包含多条分号分割的 SQL

**返回值**: MultiQueryResult

**处理逻辑**:
1. `splitQueries()` 智能分割 (L132, query.go:238-289)
2. 每条查询判断类型 (SELECT/SHOW/DESCRIBE/EXPLAIN/WITH → Query, 其余 → Exec)
3. SELECT 查询: 扫描列名 + 行数据
4. 非 SELECT: RowsAffected

---

### 3.3 ExecuteNonQuery

**签名**: `ExecuteNonQuery(arg1:main.Connection, arg2:string, arg3:string): Promise<number>`

**源码**: query.go:292-329

**参数**: `(Connection, database, query)`

**返回值**: `rowsAffected` (int64 → number)

**错误**: "connection failed" / "execution failed"

---

### 3.4 ExecuteQueryWithTimeout

**签名**: `ExecuteQueryWithTimeout(arg1:main.Connection, arg2:string, arg3:string, arg4:main.QueryOptions): Promise<main.QueryResult>`

**源码**: query_timeout.go:27-152

**参数**: `(Connection, database, query, QueryOptions{Timeout: int})`

**超时配置**:
- `Timeout=0` → 默认 30s
- `Timeout>300` → 上限 300s
- `Timeout<1` → 下限 1s

**超时错误**: "查询超时（{N}秒），请优化查询或增加超时时间。💡提示：..."

**特点**: 每行扫描时检查 `ctx.Done()` (L111-122)，防止大数据集读取阻塞

---

### 3.5 ExecuteMultiQueryWithTimeout

**签名**: `ExecuteMultiQueryWithTimeout(arg1:main.Connection, arg2:string, arg3:string, arg4:main.QueryOptions): Promise<main.MultiQueryResult>`

**源码**: query_timeout.go:155-322

**参数**: `(Connection, database, query, QueryOptions{Timeout: int})`

**特点**: 总超时控制 — 每条子查询前检查 `ctx.Done()` (L210-223)

---

## 4. Schema Inspection / Schema 查询

### 4.1 GetDatabases

**签名**: `GetDatabases(arg1:main.Connection): Promise<Array<main.DatabaseInfo>>`

**源码**: schema.go:11-30

**返回值**: DatabaseInfo 数组（仅 Name 字段填充）

---

### 4.2 GetTables

**签名**: `GetTables(arg1:main.Connection, arg2:string): Promise<Array<main.TableInfo>>`

**源码**: schema.go:33-60

**参数**: `(Connection, database)`

**处理**: `UseDatabase()` → `driver.GetTables()` → 转为 TableInfo{Name, Type:"table"}

---

### 4.3 GetViews

**签名**: `GetViews(arg1:main.Connection, arg2:string): Promise<Array<main.TableInfo>>`

**源码**: schema.go:63-115

**返回值**: TableInfo 数组，Type="view"

**SQL**: MySQL→`information_schema.VIEWS`, PG→`pg_views`, SQLite→`sqlite_master`

---

### 4.4 GetFunctions

**签名**: `GetFunctions(arg1:main.Connection, arg2:string): Promise<Array<main.TableInfo>>`

**源码**: schema.go:118-171

**返回值**: TableInfo 数组，Type="function"

**SQL**: MySQL→`information_schema.ROUTINES`, PG→`pg_proc`, SQLite→`sqlite_master WHERE type='view' AND name LIKE 'func_%'`

**⚠️ SQLite 查询条件错误**: 使用 `type='view'` 而非 `type='function'`

---

### 4.5 GetTableColumns

**签名**: `GetTableColumns(arg1:main.Connection, arg2:string, arg3:string): Promise<Array<db.ColumnInfo>>`

**源码**: schema.go:174-192

**参数**: `(Connection, database, tableName)`

**返回值**: ColumnInfo 数组 (Name, Type, Nullable, DefaultValue, PrimaryKey)

---

### 4.6 GetTableIndexes

**签名**: `GetTableIndexes(arg1:main.Connection, arg2:string, arg3:string): Promise<Array<main.IndexInfo>>`

**源码**: schema.go:243-361

**参数**: `(Connection, database, tableName)`

**支持数据库**: MySQL (`SHOW INDEX FROM`), PostgreSQL (`pg_index` + `pg_class`)

**SQLite/Redis**: 返回空数组

---

### 4.7 GetTableForeignKeys

**签名**: `GetTableForeignKeys(arg1:main.Connection, arg2:string, arg3:string): Promise<Array<main.ForeignKeyInfo>>`

**源码**: schema.go:364-445

**参数**: `(Connection, database, tableName)`

**支持数据库**: MySQL (`information_schema.KEY_COLUMN_USAGE + REFERENTIAL_CONSTRAINTS`), PostgreSQL (`pg_constraint + pg_attribute`)

**SQLite/Redis**: 返回空数组

---

### 4.8 GetTableStats

**签名**: `GetTableStats(arg1:main.Connection, arg2:string, arg3:string): Promise<main.TableStats>`

**源码**: schema.go:448-515

**返回值**: TableStats (RowCount, DataLength, IndexLength, Engine, Charset, Collation)

**获取方式**: COUNT(*) 查询 + `SHOW TABLE STATUS` (MySQL) / `pg_relation_size()` (PG)

---

### 4.9 GetTableStatistics

**签名**: `GetTableStatistics(arg1:main.Connection, arg2:string, arg3:string): Promise<Record<string, any>>`

**源码**: query_analyzer.go:714-736

**返回值**: map 包含 row_count, data_length, index_length, engine, charset, collation, comment, index_ratio

---

## 5. Data Editing / 数据编辑

### 5.1 EditTableData

**签名**: `EditTableData(arg1:main.Connection, arg2:main.EditRequest): Promise<main.EditResult>`

**源码**: data_editor.go:40-154

**参数**: `(Connection, EditRequest{operation, table, database, data, whereClause, primaryKey})`

**操作类型**: INSERT / UPDATE / DELETE

**验证**: table 非空, database 非空, sanitizeIdentifier(table) 合法

**⚠️ 安全注意**: `whereClause` 直接拼接进 SQL，未参数化

---

### 5.2 BatchEdit

**签名**: `BatchEdit(arg1:main.Connection, arg2:Array<main.EditRequest>): Promise<Array<main.EditResult>>`

**源码**: data_editor.go:359-368

**处理**: 遍历每个 EditRequest，逐个调用 EditTableData()

**注意**: 非原子操作，部分失败不影响其余

---

### 5.3 GetEditableColumns

**签名**: `GetEditableColumns(arg1:main.Connection, arg2:string, arg3:string): Promise<Array<db.ColumnInfo>>`

**源码**: data_editor.go:341-356

**参数**: `(Connection, database, tableName)`

**返回值**: 排除 AUTO_INCREMENT 列后的 ColumnInfo 数组

---

### 5.4 GenerateInsertStatement

**签名**: `GenerateInsertStatement(arg1:string, arg2:Record<string, any>): Promise<string>`

**源码**: data_editor.go:371-389

**参数**: `(tableName, data)` — 列名→值映射

**返回值**: SQL INSERT 语句字符串（仅用于预览，不执行）

---

### 5.5 GenerateUpdateStatement

**签名**: `GenerateUpdateStatement(arg1:string, arg2:Record<string, any>, arg3:string): Promise<string>`

**源码**: data_editor.go:392-408

**参数**: `(tableName, data, whereClause)`

**返回值**: SQL UPDATE 语句字符串

---

## 6. Data Export/Import / 数据导出导入

### 6.1 ExportData

**签名**: `ExportData(arg1:main.Connection, arg2:main.ExportRequest): Promise<main.ExportResult>`

**源码**: data_export.go:47-154

**参数**: `(Connection, ExportRequest{format, fileName, query, table, database, limit, offset})`

**支持格式**: csv / json / xlsx / sql

**导出路径**: `~/.db-client/exports/{fileName}.{format}`

---

### 6.2 ImportData

**签名**: `ImportData(arg1:main.Connection, arg2:main.ImportRequest): Promise<main.ImportResult>`

**源码**: data_export.go:281-373

**参数**: `(Connection, ImportRequest{format, fileName, table, database})`

**支持格式**: csv / json (仅这两种)

**导入路径**: `~/.db-client/imports/{fileName}`

**处理方式**: 逐行 INSERT（调用 EditTableData），非批量

---

## 7. Data Compare / 数据对比

### 7.1 CompareTables

**签名**: `CompareTables(arg1:main.Connection, arg2:main.CompareRequest): Promise<main.CompareResult>`

**源码**: data_compare.go:73-129

**参数**: `(Connection, CompareRequest{type, mode, sourceDB, targetDB, sourceTable, targetTable, keyColumns, compareColumns})`

**前置条件**: sourceTable 和 targetTable 非空, keyColumns 非空

---

### 7.2 CompareQueries

**签名**: `CompareQueries(arg1:main.Connection, arg2:main.CompareRequest): Promise<main.CompareResult>`

**源码**: data_compare.go:306-341

**参数**: `(Connection, CompareRequest{type, mode, sourceDB, targetDB, sourceQuery, targetQuery})`

**前置条件**: sourceQuery 和 targetQuery 非空

**自动检测**: keyColumns 为空时使用第一列 (L335-337)

---

### 7.3 GetCompareReport

**签名**: `GetCompareReport(arg1:main.CompareResult): Promise<string>`

**源码**: data_compare.go:344-368

**参数**: CompareResult 对象

**返回值**: 文本格式对比报告

---

### 7.4 ExportCompareResult

**签名**: `ExportCompareResult(arg1:main.CompareResult, arg2:string): Promise<Array<number>>`

**源码**: data_compare.go:371-382

**参数**: `(CompareResult, format)` — format: "json" / "csv" / "txt"

**返回值**: byte 数组 (JSON序列化的结果)

---

## 8. Transaction / 事务管理

### 8.1 BeginTransaction

**签名**: `BeginTransaction(arg1:main.Connection, arg2:string, arg3:main.TransactionOptions): Promise<string>`

**源码**: transaction.go:70-138

**参数**: `(Connection, database, TransactionOptions{isolation, readOnly})`

**返回值**: 事务 ID 字符串 (`"tx_{UnixNano}"`)

**隔离级别映射**:
| 传入值 | SQL 级别 |
|--------|----------|
| "READ UNCOMMITTED" | sql.LevelReadUncommitted |
| "READ COMMITTED" | sql.LevelReadCommitted |
| "REPEATABLE READ" | sql.LevelRepeatableRead |
| "SERIALIZABLE" | sql.LevelSerializable |
| "" / 其他 | sql.LevelDefault |

**事务超时**: 30 分钟 (TransactionTimeout, L41)

---

### 8.2 ExecuteInTransaction

**签名**: `ExecuteInTransaction(arg1:string, arg2:string): Promise<number>`

**源码**: transaction.go:140-155

**参数**: `(txID, query)`

**返回值**: RowsAffected (int64 → number)

**错误**: "事务不存在: {txID}"

---

### 8.3 CommitTransaction

**签名**: `CommitTransaction(arg1:string): Promise<void>`

**源码**: transaction.go:157-174

**参数**: `txID`

**错误**: "提交事务失败: ..." / "事务不存在: {txID}"

---

### 8.4 RollbackTransaction

**签名**: `RollbackTransaction(arg1:string): Promise<void>`

**源码**: transaction.go:176-193

**参数**: `txID`

**错误**: "回滚事务失败: ..." / "事务不存在: {txID}"

---

### 8.5 ExecuteTransactionBatch

**签名**: `ExecuteTransactionBatch(arg1:main.TransactionRequest): Promise<main.TransactionResult>`

**源码**: transaction.go:195-257

**参数**: `TransactionRequest{config, database, queries, options}`

**处理逻辑**:
1. BeginTransaction → 遍历 queries → ExecuteInTransaction
2. 任一失败 → RollbackTransaction → 返回错误结果
3. 全部成功 → CommitTransaction → 返回成功结果

---

## 9. Redis API / Redis 专用接口

### 9.1 GetRedisKeyInfo

**签名**: `GetRedisKeyInfo(arg1:main.Connection, arg2:string): Promise<db.RedisKeyInfo>`

**源码**: redis_api.go:13-31

**参数**: `(Connection, keyName)`

**返回值**: RedisKeyInfo (key, type, ttl, size, value, encoding)

**值格式**:
| Type | Value 类型 |
|------|-----------|
| string | string |
| list | []string |
| set | []string |
| zset | []redis.Z |
| hash | map[string]string |
| stream | []redis.XMessage |

---

### 9.2 SetRedisKeyValue

**签名**: `SetRedisKeyValue(arg1:main.Connection, arg2:string, arg3:any, arg4:number): Promise<void>`

**源码**: redis_api.go:34-66

**参数**: `(Connection, key, value, ttl)` — ttl: 过期时间秒数, 0=永不过期

---

### 9.3 DeleteRedisKey

**签名**: `DeleteRedisKey(arg1:main.Connection, arg2:Array<string>): Promise<void>`

**源码**: redis_api.go:69-99

**参数**: `(Connection, keys)` — 支持多键删除

**审计**: WARNING 级别记录删除操作

---

### 9.4 ExecuteRedisCommand

**签名**: `ExecuteRedisCommand(arg1:main.Connection, arg2:string, arg3:Array<any>): Promise<any>`

**源码**: redis_api.go:102-134

**参数**: `(Connection, cmd, args)` — 任意 Redis 命令

**⚠️ 安全警告**: 允许执行任意 Redis 命令，包括 FLUSHALL 等危险操作

---

### 9.5 GetRedisInfo

**签名**: `GetRedisInfo(arg1:main.Connection, arg2:string): Promise<string>`

**源码**: redis_api.go:137-155

**参数**: `(Connection, section)` — Redis INFO 命令的 section 参数

---

### 9.6 GetRedisDBSize

**签名**: `GetRedisDBSize(arg1:main.Connection): Promise<number>`

**源码**: redis_api.go:158-176

**返回值**: 当前数据库的键数量 (int64 → number)

---

### 9.7 ScanRedisKeys

**签名**: `ScanRedisKeys(arg1:main.Connection, arg2:string, arg3:number, arg4:number): Promise<Array<string>>`

**源码**: redis_api.go:179-197

**参数**: `(Connection, pattern, cursor, count)`

**⚠️ App.d.ts 声明**: arg3 和 arg4 均为 number (JS 侧), Go 侧为 `(string, uint64, int64)` — cursor 和 count 的类型转换可能有问题

**返回值**: 键名数组 (仅返回 keys，不返回新 cursor)

**⚠️ 注意**: App.d.ts 返回类型是 `Promise<Array<string>>`，但 Go 方法返回 `([]string, uint64, error)`，Wails 仅序列化第一个返回值

---

## 10. Autocomplete / 自动补全

### 10.1 GetAutoCompleteSuggestions

**签名**: `GetAutoCompleteSuggestions(arg1:main.Connection, arg2:string, arg3:string, arg4:number): Promise<main.AutoCompleteResult>`

**源码**: autocomplete.go:226-267

**参数**: `(Connection, database, query, position)` — position: 光标在查询中的位置

**上下文感知**:
| 上下文 | 补全类型 |
|--------|----------|
| FROM/JOIN/INTO/UPDATE/TABLE | 表名 |
| SELECT/WHERE/GROUP BY/ORDER BY/HAVING/SET | 列名+函数+关键字 |
| USE/DATABASE | 数据库名 |
| 默认 | 关键字+函数 |

---

### 10.2 GetQuickSuggestions

**签名**: `GetQuickSuggestions(arg1:string): Promise<Array<main.AutoCompleteItem>>`

**源码**: autocomplete.go:504-514

**参数**: `prefix` — 前缀字符串

**返回值**: 关键字 + 函数补全（不需要数据库连接）

---

### 10.3 GetTableColumnsForAutoComplete

**签名**: `GetTableColumnsForAutoComplete(arg1:main.Connection, arg2:string, arg3:string): Promise<Array<main.AutoCompleteItem>>`

**源码**: autocomplete.go:472-501

**参数**: `(Connection, database, tableName)`

**返回值**: 列名补全项（含类型、主键、非空信息）

---

## 11. SQL Formatter / SQL 格式化

### 11.1 FormatSQL

**签名**: `FormatSQL(arg1:string, arg2:main.FormatOptions): Promise<string>`

**源码**: sql_formatter.go:58-61

**参数**: `(sql, FormatOptions{indentWidth, keywordCase, lineBreakStyle, alignClauses, formatFunctions, maxLineLength})`

---

### 11.2 MinifySQL

**签名**: `MinifySQL(arg1:string): Promise<string>`

**源码**: sql_formatter.go:293-306

**处理**: 移除单行注释(`--`)、多行注释(`/* */`)、多余空白

---

### 11.3 ValidateSQL

**签名**: `ValidateSQL(arg1:string): Promise<boolean|Array<string>>`

**源码**: sql_formatter.go:322-347

**返回值**: `[isValid, errors[]]`
- isValid: true/false
- errors: 空语句 / 无效起始关键字 / 括号不匹配 / 引号不匹配

**验证范围**: 仅基础语法检查，不验证语义

---

### 11.4 BeautifySQL

**签名**: `BeautifySQL(arg1:string): Promise<string>`

**源码**: sql_formatter.go:426-428

**等同于**: `FormatSQL(sql, DefaultFormatOptions)`

---

### 11.5 CompactSQL

**签名**: `CompactSQL(arg1:string): Promise<string>`

**源码**: sql_formatter.go:431-438

**等同于**: `FormatSQL(sql, {indentWidth:2, keywordCase:"upper", lineBreakStyle:"compact", maxLineLength:120})`

---

### 11.6 GetSQLStructure

**签名**: `GetSQLStructure(arg1:string): Promise<Record<string, any>>`

**源码**: sql_formatter.go:442-473

**返回值**: `{type: "SELECT"|"INSERT"|"UPDATE"|"DELETE"|"CREATE"|"ALTER"|"DROP"|"OTHER", has_where, has_join, has_group, has_order, has_limit, has_union}`

---

## 12. Query Analyzer / 查询分析

### 12.1 GetExplainPlan

**签名**: `GetExplainPlan(arg1:main.Connection, arg2:string, arg3:string): Promise<main.ExplainResult>`

**源码**: query_analyzer.go:84-172

**参数**: `(Connection, database, query)` — 仅支持 SELECT 查询

**数据库适配**:
| 类型 | EXPLAIN 命令 |
|------|--------------|
| MySQL | `EXPLAIN {query}` |
| PostgreSQL/PolarDB/GaussDB | `EXPLAIN ANALYZE {query}` |
| 其他 | `EXPLAIN {query}` |

---

### 12.2 AnalyzeQuery

**签名**: `AnalyzeQuery(arg1:string): Promise<main.QueryAnalysis>`

**源码**: query_analyzer.go:549-587

**参数**: `query` — SQL 查询字符串

**返回值**: QueryAnalysis (queryType, tables, joinCount, complexity, recommendations)

**不需要数据库连接**: 纯静态分析

---

### 12.3 GetSlowQueries

**签名**: `GetSlowQueries(arg1:main.Connection, arg2:string, arg3:number): Promise<Array<Record<string, any>>>`

**源码**: query_analyzer.go:707-711

**⚠️ 未实现**: 始终返回空数组

---

### 12.4 GetTableStatistics

**签名**: `GetTableStatistics(arg1:main.Connection, arg2:string, arg3:string): Promise<Record<string, any>>`

**源码**: query_analyzer.go:714-736

**返回值**: row_count, data_length, index_length, engine, charset, collation, comment, index_ratio

---

### 12.5 AnalyzeTableUsage

**签名**: `AnalyzeTableUsage(arg1:main.Connection, arg2:string): Promise<Array<Record<string, any>>>`

**源码**: query_analyzer.go:739-766

**返回值**: 每个表的 `{table_name, row_count, data_size, index_size, total_size}`

---

## 13. Audit / 审计

### 13.1 GetAuditLogs

**签名**: `GetAuditLogs(level: string, eventType: string, limit: int, offset: int): Promise<Array<AuditLog>>`

**行为**: 获取审计日志列表。支持按级别(INFO/WARNING/ERROR/CRITICAL)和事件类型过滤。`limit` 默认100。

**前端用法**: `WailsAPI.GetAuditLogs("ERROR", "", 50, 0)` — 获取前50条ERROR级别日志。

---

### 13.2 ExportAuditLogs

**签名**: `ExportAuditLogs(format: string, startTime: string, endTime: string): Promise<Array<number>>`

**行为**: 导出审计日志。`format` 可选 `"json"` 或 `"csv"`。返回文件字节数组，前端通过 Blob 触发下载。

**前端用法**: `WailsAPI.ExportAuditLogs("json", "2024-01-01T00:00:00", "2024-01-31T23:59:59")`

---

### 13.3 ClearOldAuditLogs

**签名**: `ClearOldAuditLogs(days: int): Promise<int>`

**行为**: 清除超过指定天数的旧日志。返回清除的条数。

**前端用法**: `WailsAPI.ClearOldAuditLogs(30)` — 清除30天前的日志，返回清除数。

---

## 14. Window / 窗口控制

### 14.1 WindowMinimize

**签名**: `WindowMinimize(): Promise<void>`

**源码**: window.go:8-9

---

### 14.2 WindowMaximize

**签名**: `WindowMaximize(): Promise<void>`

**源码**: window.go:13-19

**行为**: 最大化/还原切换 (isMaximized → unmaximise, else → maximise)

---

### 14.3 WindowClose

**签名**: `WindowClose(): Promise<void>`

**源码**: window.go:22-24

**行为**: `runtime.Quit(a.ctx)` — 触发应用退出

---

### 14.4 WindowIsMaximized

**签名**: `WindowIsMaximized(): Promise<boolean>`

**源码**: window.go:27-29

---

## 15. Language / 语言

### 15.1 GetLanguage

**签名**: `GetLanguage(): Promise<string>`

**源码**: app.go:62-68

**返回值**: "zh" 或 "en" (来自 DB_CLIENT_LANG env 或默认 "zh")

---

### 15.2 SetLanguage

**签名**: `SetLanguage(arg1:string): Promise<void>`

**源码**: app.go:71-91

**参数**: `lang` — "zh" 或 "en"

**存储**: `~/.db-client/config.json` → `{language: "en"}`

---

## 16. Server Info / 服务器信息

### 16.1 GetServerInfo

**签名**: `GetServerInfo(arg1:main.Connection): Promise<Record<string, string>>`

**源码**: test.go:86-136

**返回值**: `{type, host, port, database, version?, table_count?, error?}`

**PostgreSQL**: 附加 `SELECT version()` 结果
**其他类型**: 仅基础信息

---

## 17. File Dialog / 文件对话框

### 17.1 OpenFileDialog

**签名**: `OpenFileDialog(arg1:string, arg2:string): Promise<string>`

**源码**: filedialog.go:8-16

**参数**: `(title, filters)` — filters 参数未实际使用 (runtime.OpenDialogOptions 仅设置 Title)

**返回值**: 选择的文件路径，取消返回空字符串

---

### 17.2 SaveFileDialog

**签名**: `SaveFileDialog(arg1:string, arg2:string): Promise<string>`

**源码**: filedialog.go:19-27

**参数**: `(title, defaultName)` — defaultName 作为 DefaultFilename

**返回值**: 选择的保存路径，取消返回空字符串

---

## 18. Test / 测试

### 18.1 RunConnectionTest

**签名**: `RunConnectionTest(arg1:main.Connection): Promise<main.TestResult>`

**源码**: test.go:11-59

**返回值**: TestResult {name, success, message, time}

**行为**: DriverManager.Connect → Ping → Close (不存入连接池)

---

### 18.2 RunAllTests

**签名**: `RunAllTests(): Promise<Array<main.TestResult>>`

**源码**: test.go:62-71

**行为**: 对所有已保存连接逐一调用 RunConnectionTest

---

## 19. Error Handling Patterns / 错误处理模式

### 19.1 Go Side Error Handling

| 模式 | 使用位置 | 返回方式 |
|------|----------|----------|
| struct Error field | QueryResult, EditResult, CompareResult, ExplainResult | `Error: "..."` JSON field |
| Go error return | ExecuteNonQuery, CommitTransaction, etc | Wails converts to JS Error |
| (bool, string) tuple | TestConnection, ConnectToDatabase | `[success, message]` |
| Empty result + error field | GetTableIndexes (unsupported DB) | `[]IndexInfo{}` |
| nil return | GetSlowQueries stub | `[]map[string]interface{}{}` |

### 19.2 Frontend Error Handling

```javascript
try {
    const result = await WailsAPI.executeQuery(conn, db, sql);
    if (result.error) {
        showError(result.error);
    } else {
        renderResults(result);
    }
} catch (e) {
    showError(e.message);
}
```

---

## 20. API Method Summary / API 方法汇总

| Category | Methods | Count |
|----------|---------|-------|
| Connection | GetSupportedDatabases, GetConnections, SaveConnection, DeleteConnection, TestConnection, ConnectToDatabase, DisconnectFromDatabase, GetSupportedFeatures | 8 |
| Query | ExecuteQuery, ExecuteMultiQuery, ExecuteNonQuery, ExecuteQueryWithTimeout, ExecuteMultiQueryWithTimeout | 5 |
| Schema | GetDatabases, GetTables, GetViews, GetFunctions, GetTableColumns, GetTableIndexes, GetTableForeignKeys, GetTableStats, GetTableStatistics | 9 |
| Data Editing | EditTableData, BatchEdit, GetEditableColumns, GenerateInsertStatement, GenerateUpdateStatement | 5 |
| Export/Import | ExportData, ImportData | 2 |
| Data Compare | CompareTables, CompareQueries, GetCompareReport, ExportCompareResult | 4 |
| Transaction | BeginTransaction, ExecuteInTransaction, CommitTransaction, RollbackTransaction, ExecuteTransactionBatch | 5 |
| Redis | GetRedisKeyInfo, SetRedisKeyValue, DeleteRedisKey, ExecuteRedisCommand, GetRedisInfo, GetRedisDBSize, ScanRedisKeys | 7 |
| Autocomplete | GetAutoCompleteSuggestions, GetQuickSuggestions, GetTableColumnsForAutoComplete | 3 |
| SQL Formatter | FormatSQL, MinifySQL, ValidateSQL, BeautifySQL, CompactSQL, GetSQLStructure | 6 |
| Query Analyzer | GetExplainPlan, AnalyzeQuery, GetSlowQueries, AnalyzeTableUsage | 4 |
| Window | WindowMinimize, WindowMaximize, WindowClose, WindowIsMaximized | 4 |
| Language | GetLanguage, SetLanguage | 2 |
| Server Info | GetServerInfo | 1 |
| File Dialog | OpenFileDialog, SaveFileDialog | 2 |
| Test | RunAllTests, RunConnectionTest | 2 |
| Audit | GetAuditLogs, ExportAuditLogs, ClearOldAuditLogs | 3 |
| **Total** | | **72** |

**⚠️ 注意**: App.d.ts 列出 52 个方法声明（已实现的Go后端方法）。文档中额外标注了 20 个规划/扩展方法（Audit 3个 + Autocomplete扩展 + SQL Formatter扩展 + Query Analyzer扩展 + Data Compare扩展 + Transaction扩展），总计 72 个方法定义。`ScanRedisKeys` 的 Go 返回值 `([]string, uint64, error)` 在 Wails 中仅序列化第一个返回值。`ValidateSQL` 的 Go 返回值 `(bool, []string)` 在 App.d.ts 中映射为 `Promise<boolean|Array<string>>`。