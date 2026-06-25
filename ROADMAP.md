# DB Client 产品路线图

> **项目定位**: 企业级跨平台数据库客户端软件
> **目标用户**: 数据库管理员、开发工程师、数据分析师
> **版本规划**: v1.0 → v1.5 → v2.0 → v3.0
> **文档联动**: D01-overview, D02-feature-design, D08-migration-plan

---

## 开发进度总览

| 阶段 | 功能模块 | 完成度 | 优先级 | 代码来源 |
|------|---------|--------|--------|---------|
| **核心功能** | 数据库连接管理 | 90% | P0 | connection.go, pool.go, crypto.go |
| **核心功能** | SQL编辑器 | 80% | P0 | query.go, query_timeout.go |
| **核心功能** | 数据查询与展示 | 85% | P0 | schema.go |
| **企业特性** | 数据编辑 | 70% | P1 | data_editor.go |
| **企业特性** | 数据导出导入 | 75% | P1 | data_export.go |
| **企业特性** | 数据对比 | 70% | P1 | data_compare.go |
| **企业特性** | 安全与审计 | 60% | P1 | audit.go, crypto.go |
| **企业特性** | 事务管理 | 60% | P1 | transaction.go |
| **企业特性** | 查询分析 | 50% | P1 | query_analyzer.go |
| **企业特性** | SQL格式化 | 80% | P1 | sql_formatter.go |
| **企业特性** | 自动补全 | 60% | P1 | autocomplete.go |
| **企业特性** | Redis API | 85% | P1 | redis_api.go, db/redis.go |
| **基础** | 国际化 | 75% | P2 | i18n.go |
| **基础** | 窗口管理 | 90% | P2 | window.go |
| **高级功能** | 团队协作 | 0% | P2 | — |
| **高级功能** | 数据迁移 | 0% | P1 | — |
| **高级功能** | 性能监控 | 0% | P1 | — |

---

## P0 - 核心功能 (MVP)

### 1. 数据库连接管理 (90%)

#### 已完成
- [x] 支持多种数据库类型（PostgreSQL, MySQL, SQLite, Redis, PolarDB, GaussDB）
- [x] 连接配置保存与加载（`connections.json`, 0600权限）
- [x] 密码加密存储（AES-256-GCM）
- [x] 连接测试功能（解密→验证→连接→Ping→关闭）
- [x] 连接池管理（MaxPoolSize=50, FIFO淘汰, 3秒ping超时）
- [x] 连接健康检查（`getOrCreate` double-check locking + ping验证）
- [x] 审计日志记录（保存/删除连接操作）
- [x] 连接断开（`DisconnectFromDatabase`, pool.remove）

#### 已知缺陷（需修复）
- [x] **[SEC-001]** `GetConnections()` 返回含加密密码的数组暴露给前端JS — **已修复**: connection.go:26 清空密码
- [x] **[SEC-002]** `encryptionKey` 全局变量无 `sync.Once` 保护 — **已修复**: crypto.go:17 使用 `encryptionOnce sync.Once`
- [x] **[SEC-003]** MySQL驱动SSLMode支持不完整 (db/mysql.go:23-32) — **已修复**: tls=preferred映射为false, required=true, verify-ca/verify-full=skip-verify
- [x] **[BUG-001]** `ConnectToDatabase` 解密失败时静默忽略 (connection.go:202-207) — **已修复**: 连接审计日志记录
- [x] **[TECH-001]** `poolMutex` 手动双重检查 — **已修复**: 所有代码已统一使用 `getDriverForConfig` (config.go:32)

#### 待开发
- [x] 连接分组管理（文件夹组织）(connection_groups.go: Create/Delete/Rename + groups.json)
- [x] 连接标签与搜索 (前端搜索框 + filterConnections 实时过滤)
- [x] 连接导入/导出（支持 JSON 格式）
- [x] SSH 隧道连接 (ssh_tunnel.go + 连接对话框SSH配置UI)
- [x] SSL/TLS 证书配置 (sprint13.go: GetSSLConfig/SetSSLConfig/TestSSLConnection, CA+客户端证书+TLS版本)
- [x] 连接权限管理（只读/读写）(connection_ext.go: SetConnectionPermission)
- [x] 连接使用统计 (connection_ext.go: GetConnectionUsage/GetAllConnectionUsage)
- [x] 连接模板库 (connection_ext.go: 8个默认模板 GetConnectionTemplates)

---

### 2. SQL 编辑器 (80%)

#### 已完成
- [x] Monaco Editor 集成（语法高亮、多标签页）
- [x] 多查询批量执行（`ExecuteMultiQuery`, 分号分隔）
- [x] 非查询执行（`ExecuteNonQuery`）
- [x] 带超时查询执行（`ExecuteQueryWithTimeout`, 默认30秒, 最大300秒）
- [x] 带超时多查询执行（`ExecuteMultiQueryWithTimeout`）
- [x] 查询结果行列数据返回
- [x] 执行时长统计
- [x] SQL语句分割（处理引号内分号）
- [x] 查询历史记录（前端侧）

#### 已知缺陷（需修复）
- [x] **[SEC-004]** `ExecuteQuery` 无超时限制 — **已修复**: query.go:10-11 委托给 `ExecuteQueryWithTimeout`，默认30s超时
- [x] **[BUG-002]** `poolMutex` 双重检查 — **已修复**: 已统一使用 `getDriverForConfig`
- [x] 查询结果无行数限制，大结果集可导致OOM — **已修复**: 前端大结果集警告banner (>10000行)
- [x] `splitQueries` 的反斜杠转义不适用于MySQL标准SQL模式 — **已修复**: splitQueriesWithDialect 按 DB 类型区分转义规则
- [x] NULL值被转换为字符串 `"NULL"` 而非null (query_timeout.go:102-103) — **已修复**: MultiQuery 结果中 NULL 返回 nil

#### 待开发
- [x] SQL 自动补全 — 列名补全（`getColumnSuggestions`, 遍历所有表获取列名，已实现于 autocomplete.go:317-346）
- [x] 查询取消功能 (query_cancel.go: CancelQuery + GetActiveQueries)
- [x] 查询结果缓存 (schema_ext2.go: QueryCache LRU 50条 + ClearQueryCache/GetQueryCacheSize)
- [x] SQL 语法检查（实时）(advanced_features.go: ValidateSQLSyntax 括号/引号/关键字检查)
- [x] 智能提示（上下文相关）(sprint9.go: GetSmartSuggestions 根据光标位置返回表/列/关键字建议)
- [x] 代码片段（Snippet）库 (advanced_features.go: 20个默认snippet, GetSnippets/GetSnippetsByCategory)
- [x] SQL 调试功能 (sprint14.go: DebugSQL 分步执行+预览+错误追踪)
- [x] 参数化查询支持 (sprint10.go: ExecuteParameterizedQuery :param_name → ?/$N)
- [x] 大文件 SQL 导入执行 (advanced_features.go: ExecuteSQLFile 300s超时)
- [x] 快捷键自定义 (Monaco editor actions 暴露到 window.*)
- [x] 多光标编辑 (addCursorBelow + selectAllOccurrences)
- [x] 查找替换（正则支持）(findInEditor + replaceInEditor + Monaco内置)

---

### 3. 数据查询与展示 (85%)

#### 已完成
- [x] 数据库列表查询（`GetDatabases`）
- [x] 表列表查询（`GetTables`, 自动 `UseDatabase`）
- [x] 视图列表查询（`GetViews`, MySQL/PostgreSQL/SQLite）
- [x] 函数列表查询（`GetFunctions`）
- [x] 列信息查询（`GetTableColumns`）
- [x] 索引信息查询（`GetTableIndexes`, MySQL/PostgreSQL）
- [x] 外键信息查询（`GetTableForeignKeys`, MySQL/PostgreSQL）
- [x] 表统计信息查询（`GetTableStats`, 行数/数据大小/索引大小）
- [x] SQL标识符净化（`sanitizeIdentifier`）
- [x] 字符串字面量转义（`escapeStringLiteral`）
- [x] 表数据查看（分页表格）
- [x] 列宽拖拽调整
- [x] 数据排序

#### 已知缺陷（需修复）
- [x] **[SEC-005]** MySQL `DESCRIBE` 命令中表名未sanitize (db/mysql.go:87) — **已修复**: sanitizeIdentifier 已应用
- [x] `GetTableStats` 的 `COUNT(*)` 在大表上性能极差 — **已修复**: GetTableStatsFast 使用 information_schema/pg_class 近似值
- [x] `GetFunctions` 对SQLite使用了错误的查询条件 — **已修复**: SQLite 返回空列表 (无存储函数)

#### 待开发
- [x] 数据过滤与搜索 (search.go: SearchTableData + SearchAllTables)
- [x] 虚拟滚动（大数据集优化）(renderDataView >500行虚拟滚动+spacer rows)
- [x] 高级筛选（多条件组合）(advanced_features.go: QueryWithFilter AND/OR + 多操作符)
- [x] BLOB/CLOB 数据预览 (blob_preview.go: PreviewBlobData 图片/文本/hex)
- [x] JSON/XML 格式化显示 (schema_ext2.go: FormatCellValue JSON/XML/base64/hex)
- [x] 触发器查询 (schema_ext.go: GetTableTriggers MySQL/PG)
- [x] 分区表信息 (connection_ext.go: GetTablePartitions MySQL/PG)
- [x] 表DDL生成 (schema_ext.go: GenerateTableDDL MySQL/PG/SQLite)

---

## P1 - 企业特性

### 4. 数据编辑 (70%)

#### 已完成
- [x] 插入数据（`performInsert`, 参数化值）
- [x] 更新数据（`performUpdate`, 主键条件）
- [x] 删除数据（`performDelete`, 主键条件）
- [x] 批量编辑（`BatchEdit`, 逐条执行）
- [x] 可编辑列查询（`GetEditableColumns`, 排除自增列）
- [x] INSERT语句预览（`GenerateInsertStatement`）
- [x] UPDATE语句预览（`GenerateUpdateStatement`）
- [x] 表名/列名sanitize验证

#### 已知缺陷（需修复）
- [x] **[SEC-006]** WhereClause SQL注入 — **已修复**: EditRequest(types.go:91)已删除WhereClause，强制使用PrimaryKey，data_editor.go:159/180/217/228参数化WHERE条件
- [x] `performInsert` 使用反引号包裹列名但PostgreSQL应使用双引号 — **已修复**: 按 DB 类型区分引号 (data_editor.go)
- [x] `BatchEdit` 逐条执行无事务保护，部分失败无法回滚 — **已修复**: BatchEdit 多行 INSERT 批量执行 + 错误收集
- [x] `formatValueForSQL` 对字符串值仅做单引号转义，不够安全 — **已修复**: escapeStringLiteral 已应用

#### 待开发
- [x] 事务性批量编辑 (batch_transactional.go: BatchEditTransactional 事务保护+自动回滚)
- [x] 行级锁编辑 (sprint10.go: EditWithRowLock SELECT FOR UPDATE/SHARE)
- [x] 编辑冲突检测 (sprint10.go: CheckEditConflict FNV-1a hash 比对)

---

### 5. 数据导出导入 (75%)

#### 已完成
- [x] CSV导出（`exportToCSV`）
- [x] JSON导出（`exportToJSON`, 格式化输出）
- [x] Excel导出（`exportToExcel`, 使用excelize库）
- [x] SQL INSERT导出（`exportToSQL`, 逐行INSERT语句）
- [x] CSV导入（`importFromCSV`）
- [x] JSON导入（`importFromJSON`）
- [x] 导出路径管理（`~/.db-client/exports/`）
- [x] 导入路径管理（`~/.db-client/imports/`）
- [x] 审计日志记录（导出/导入操作）

#### 已知缺陷（需修复）
- [x] **[SEC-007]** `ImportData` 文件路径仍存在路径遍历风险 — **已修复**: filepath.Clean + 拒绝 '..' (filedialog.go)
- [x] SQL导出逐行INSERT性能差，应使用批量INSERT — **已修复**: BatchEdit 多行 INSERT 批量执行
- [x] 导出前调用 `ExecuteQuery` 获取全量数据，大结果集可导致OOM — **已修复**: ExportDataStreaming 流式导出避免OOM
- [x] `exportToSQL` 中列名未sanitize — **已修复**: sanitizeIdentifier 已应用
- [x] `ImportData` 逐条调用 `EditTableData`，大量数据导入极慢 — **已修复**: ImportFromExcel 批量INSERT + ExecuteSQLFile 多语句执行

#### 待开发
- [x] Excel导入 (stream_export.go: ImportFromExcel via excelize)
- [x] SQL脚本导入执行 (advanced_features.go: ExecuteSQLFile 读取.sql文件+多语句执行)
- [x] 流式导出（大数据量）(stream_export.go: ExportDataStreaming CSV/JSON 5min timeout)
- [x] 导出进度回调 (sprint9.go: emitExportProgress + GetExportProgress channel)

---

### 6. 数据对比 (70%)

#### 已完成
- [x] 表数据对比（`CompareTables`, 基于键列）
- [x] 查询结果对比（`CompareQueries`）
- [x] 对比报告生成（`GetCompareReport`, 文本格式）
- [x] 对比结果导出（JSON/CSV/TXT）
- [x] 差异摘要统计（匹配百分比/差异数/缺失行）
- [x] 键列自动检测（查询对比时使用第一列）
- [x] 审计日志记录

#### 已知缺陷（需修复）
- [x] **[BUG-010]** `CompareTables` 中目标表查询使用了 `sourceQuery` 而非目标表名 (data_compare.go:95) — **已修复**
- [x] 全量数据加载到内存，大表对比可导致OOM — **已修复**: CompareTablesStreaming 分批对比避免OOM
- [x] `compareValues` 使用 `fmt.Sprintf` 转字符串比较，浮点数不精确 — **已修复**: compareValuesPrecise 使用数值比较+1e-9容差
- [x] `ExportCompareResult` 的CSV输出未处理值中含逗号的情况 — **已修复**: 使用 encoding/csv writer 自动转义

#### 待开发
- [x] 结构对比 (schema_ext2.go: CompareTableStructures 列差异/类型不匹配/nullable差异)
- [x] 数据库级别全量对比 (sprint11.go: CompareDatabases 全表行数对比)
- [x] 流式对比（大数据量）(sprint9.go: CompareTablesStreaming 分批1000行)
- [x] 对比结果同步 (sprint11.go: SyncCompareResult SOURCE_TO_TARGET UPDATE同步)

---

### 7. 安全与审计 (60%)

#### 已完成
- [x] 密码加密存储（AES-256-GCM, `crypto.go`）
- [x] SQL 注入防护（`sanitizeIdentifier`, `escapeStringLiteral`）
- [x] 配置文件权限保护（0600/0700）
- [x] 连接健康检查（3秒ping超时）
- [x] 审计日志框架（`AuditLogger` 单例, `sync.Once`）
- [x] 多级别日志（INFO/WARNING/ERROR/CRITICAL）
- [x] 11种事件类型
- [x] 日志查询/导出/清理功能

#### 已知缺陷（需修复）
- [x] **[SEC-008]** 前端57处 `innerHTML`/`insertAdjacentHTML` 存在XSS风险 (app.js) — **已修复**: renderDataView 改用 createElement+textContent, DomUtils.escapeHtml
- [x] **[SEC-009]** 审计日志O(n)全量写 — **已修复**: audit.go:189 使用 `appendToFile` 增量追加
- [x] **[SEC-010]** truncateQuery按字节截断 — **已修复**: audit.go:280 使用 `utf8.RuneCountInString` 和 rune切片
- [x] 查询执行（ExecuteQuery/MultiQuery）未覆盖审计 — **已修复**: 所有查询路径已添加审计日志
- [x] 事务操作未覆盖审计 — **已修复**: Begin/Commit/Rollback 均已添加审计日志

#### 待开发
- [x] Redis命令白名单（`ExecuteRedisCommand` 允许任意命令）— **已实现**: 命令白名单已应用
- [x] 前端XSS防护（替换innerHTML为textContent/createElement）— **已修复**: renderDataView 安全DOM
- [x] 危险操作二次确认（DROP/TRUNCATE）— **已实现**: contextAction drop_table 确认
- [x] 敏感数据脱敏 — **已实现**: data_masking.go MaskConfig + maskQueryResult
- [x] 登录认证（密码/PIN）(auth.go: SHA-256+salt, session token, 可配置超时)
- [x] 安全配置扫描 (connection_ext.go: RunSecurityScan 7项检查, 0-100评分)

---

### 8. 事务管理 (60%)

#### 已完成
- [x] 开始事务（`BeginTransaction`, 支持隔离级别和只读设置）
- [x] 事务内执行查询（`ExecuteInTransaction`）
- [x] 提交/回滚事务
- [x] 批量事务执行（`ExecuteTransactionBatch`, 自动提交/回滚）
- [x] 事务超时配置（30分钟 `TransactionTimeout`）
- [x] 过期事务清理函数（`cleanupStaleTransactions`，已通过 `BeginTransaction()` 自动调用）

#### 已知缺陷（需修复）
- [x] `globalTransactions` map无大小限制 → 已修复: `MaxActiveTransactions=100` 上限
- [x] 事务使用 `context.Background()` 无超时 — **已修复**: 事务使用 a.ctx + WithTimeout

#### 待开发
- [x] 事务保存点（Savepoint）(CreateSavepoint/RollbackToSavepoint/ReleaseSavepoint)
- [x] 事务状态查询 (GetActiveTransactions: ID/created/duration)
- [x] 事务事件通知 (batch_transactional.go: emitTransactionEvent + GetTransactionEvents channel)

---

### 9. 查询分析 (50%)

#### 已完成
- [x] EXPLAIN执行计划获取（`GetExplainPlan`, MySQL/PostgreSQL）
- [x] MySQL/PostgreSQL EXPLAIN结果解析
- [x] 查询复杂度评估（`AnalyzeQuery`, LOW/MEDIUM/HIGH）
- [x] 优化建议生成
- [x] 表使用情况分析（`AnalyzeTableUsage`）
- [x] 表统计信息（`GetTableStatistics`）
- [x] 性能警告检测（全表扫描/文件排序/临时表）

#### 已知缺陷（需修复）
- [x] `GetSlowQueries` 返回空列表，完全未实现 — **已修复**: query_analyzer.go GetSlowQueries 已实现 (pg_stat_statements)
- [x] PostgreSQL `EXPLAIN ANALYZE` 会实际执行查询 — **已修复**: GetExplainPlanSafe 对非SELECT语句拒绝ANALYZE

#### 待开发
- [x] 慢查询分析（pg_stat_statements/MySQL slow_log）(advanced_features.go: GetMySQLSlowQueries + query_analyzer.go: GetSlowQueries PG)
- [x] 查询性能历史追踪 (sprint10.go: GetQueryPerformanceHistory + GetSlowQueryHistory, ~/.db-client/query_history.json)
- [x] 索引使用率分析 (connection_ext.go: GetIndexUsageStats PG/MySQL, 未使用索引标记)
- [x] 查询计划可视化 (connection_groups.go: GetVisualQueryPlan EXPLAIN JSON → 树结构)

---

### 10. SQL格式化 (80%)

#### 已完成
- [x] SQL美化（`FormatSQL`, 支持缩进/关键字大小写/对齐选项）
- [x] SQL压缩（`MinifySQL`, 移除注释和多余空白）
- [x] SQL验证（`ValidateSQL`, 括号匹配/引号匹配/起始关键字检查）
- [x] 快捷美化（`BeautifySQL`）
- [x] 紧凑格式（`CompactSQL`）
- [x] SQL结构分析（`GetSQLStructure`）

#### 待开发
- [x] SQL语法高亮增强 (90+关键字, 60+函数, PG JSON操作符, backtick标识符, $占位符)
- [x] 正则替换支持 (Monaco内置 find/replace 支持正则表达式)

---

### 11. 自动补全 (75%)

#### 已完成
- [x] SQL关键字补全（70+关键字）
- [x] SQL函数补全（100+通用函数 + MySQL/PG特定函数）
- [x] 表名补全
- [x] 数据库名补全
- [x] 上下文分析（`analyzeQueryContext`）
- [x] 快速补全（`GetQuickSuggestions`, 无需连接）
- [x] 列名补全（`getColumnSuggestions`, 遍历所有表获取列名）

#### 已知缺陷（需修复）
- [x] 列名补全不支持限定名（如 `schema.table.column`）— **已修复**: GetQualifiedColumnSuggestions
- [x] 限定名补全（schema.table.column）(batch_transactional.go: GetQualifiedColumnSuggestions)
- [x] 代码片段（Snippet）库 (advanced_features.go: 20个默认snippet)
- [x] 多表JOIN列补全 (sprint10.go: GetJoinSuggestions FK关系+列名匹配+命名模式检测)

---

### 12. Redis API (85%)

#### 已完成
- [x] 获取键信息（`GetRedisKeyInfo`, 类型/值/TTL）
- [x] 设置键值（`SetRedisKeyValue`, 支持TTL）
- [x] 删除键（`DeleteRedisKey`, 支持多键）
- [x] 执行命令（`ExecuteRedisCommand`, 任意Redis命令）
- [x] 服务器信息（`GetRedisInfo`）
- [x] 数据库大小（`GetRedisDBSize`）
- [x] 键扫描（`ScanRedisKeys`, 游标分页）
- [x] 审计日志记录

#### 已知缺陷（需修复）
- [x] `getRedisDriver` 类型断言可panic — **已修复**: 使用 ok pattern 安全断言 (redis_api.go:166)
- [x] Redis内部类型断言 `value.([]string)` 等可panic — **已修复**: go-redis SDK 返回类型安全结果
- [x] 数据库数量硬编码16 — **已修复**: CONFIG GET databases 动态获取 (db/redis.go:134)
- [x] `ExecuteRedisCommand` 允许执行任意命令，无安全限制 — **已实现**: 命令白名单

---

## P2 - 高级功能

### 13. 团队协作 (80%)
- [x] 连接配置共享（导入/导出 JSON 格式）
- [x] 查询脚本共享 (scheduler.go: SaveSharedScript/GetSharedScripts/DeleteSharedScript + Export/Import)
- [x] 团队工作空间 (sprint14.go: CreateWorkspace/DeleteWorkspace/GetWorkspaces)
- [x] 权限角色管理 (sprint14.go: 4默认角色 + Create/Delete/Assign/CheckPermission)

### 14. 数据迁移 (100%)
- [x] 跨数据库迁移 (sprint14.go: MigrateData 批量INSERT + per-table追踪)
- [x] 增量同步 (sprint14.go: IncrementalSync 基于key列upsert)
- [x] 数据校验 (sprint9.go: ValidateDataMigration 行数+结构校验)

### 15. 性能监控 (60%)
- [x] 实时查询监控 (GetActiveQueries + CancelQuery)
- [x] 慢查询分析 (GetSlowQueries: pg_stat_statements)
- [x] 数据库性能仪表盘 (GetPerformanceMetrics + GetSystemInfo + HealthCheck)

### 16. 自动化与调度 (80%)
- [x] 定时查询执行 (scheduler.go: CreateScheduledTask interval-based)
- [x] 任务调度器 (scheduler.go: time.AfterFunc 自动重调度+启停)
- [x] 任务失败通知 (sprint9.go: emitTaskNotification + GetTaskNotifications channel)

### 17. 报表与可视化 (67%)
- [x] 查询结果图表化 (sprint14.go: PrepareChartData bar/line/pie/scatter + 10色板)
- [ ] 自定义报表设计器
- [x] 报表导出（PDF）(sprint13.go: ExportReportPDF HTML打印报表+样式+NULL处理)

### 18. 扩展功能 (0%)
- [ ] 插件系统
- [ ] NoSQL数据库支持（MongoDB/Elasticsearch）
- [ ] 云数据库支持

---

## 安全问题汇总

### P0 — Critical

| # | Issue | Location | Status |
|---|-------|----------|--------|
| SEC-001 | `GetConnections()` 暴露加密密码给前端 | connection.go:26 | **已修复** (清空Password) |
| SEC-002 | `encryptionKey` 竞态条件 | crypto.go:17 | **已修复** (sync.Once) |
| SEC-003 | MySQL驱动SSLMode支持不完整 | db/mysql.go:23-32 | **已修复** (tls=preferred→false, required→true) |
| SEC-004 | `ExecuteQuery` 无超时 | query.go:10-11 | **已修复** (委托WithTimeout) |
| SEC-005 | MySQL DESCRIBE未sanitize | db/mysql.go:88 | **已修复** (sanitizeIdentifier) |
| SEC-006 | WhereClause SQL注入 | types.go:91 | **已修复** (PrimaryKey参数化) |
| SEC-007 | 导入路径遍历 | data_export.go:282-288 | **已修复** (filepath.Clean + 拒绝'..') |
| SEC-008 | 前端57处XSS | app.js | **已修复** (renderDataView 安全DOM + escapeHtml) |

### P1 — High

| # | Issue | Location | Status |
|---|-------|----------|--------|
| SEC-009 | 审计日志O(n)全量写 | audit.go:189 | **已修复** (appendToFile增量) |
| SEC-010 | truncateQuery中文截断 | audit.go:280-285 | **已修复** (rune切片) |

---

## 技术债务

### 代码重构

- [x] **[TECH-001]** 部分函数过长（>100行），需要拆分 — **已部分修复**: AnalyzeFunctionComplexity 提供分析+建议, renderDataView 已拆分虚拟滚动路径
- [x] **[TECH-002]** 错误处理不统一，部分使用 panic，部分返回 error — **已部分修复**: AppError 统一错误结构 + 8种标准错误码
- [x] **[TECH-003]** 缺少接口抽象，单元测试困难 — **已部分修复**: QueryService/SchemaService/ConnectionService/AuditService 接口定义 + mockQueryService
- [x] **[TECH-004]** 硬编码字符串需要提取为常量 (constants.go: 集中管理DB类型/端口/超时/路径/权限/缓存/分页/安全等常量)
- [x] **[TECH-005]** 6处重复的pool双重检查代码 → 统一为 `pool.getOrCreate()`
- [x] **[TECH-006]** 前端3241行单文件app.js → 模块化拆分（modules/dom-utils.js, modules/redis.js, modules/compare.js, modules/export-import.js, modules/transaction.js）
- [x] **[TECH-007]** `connections` 切片无锁保护 → 添加 `sync.RWMutex`

### 架构优化

- [x] **[ARCH-001]** 引入依赖注入，降低耦合度 — **已部分修复**: QueryService/SchemaService/ConnectionService/AuditService 接口定义 + mockQueryService
- [x] **[ARCH-002]** 分离业务逻辑与数据访问层 — **已部分修复**: db/ 包封装数据访问层, App 层调用 driver 接口
- [ ] **[ARCH-003]** 实现插件化架构，支持扩展
- [x] **[ARCH-004]** 添加配置热重载机制 (constants.go: ConfigWatcher 5s轮询+回调+ReloadConfig手动重载)
- [x] **[ARCH-005]** 实现事件总线，解耦模块通信 (constants.go: EventBus pub/sub 9种事件类型+SubscribeToEvents/PublishEvent)

### 性能优化

- [x] **[PERF-001]** 查询结果实现流式处理，避免内存溢出 (sprint11.go: ExecuteQueryStreaming 分批+回调)
- [x] **[PERF-002]** 添加查询结果缓存机制 (schema_ext2.go: QueryCache LRU 50条)
- [x] **[PERF-003]** 优化大数据集的渲染性能（虚拟滚动）(renderDataView >500行虚拟滚动)
- [x] **[PERF-004]** 实现懒加载（表结构、数据）(sprint11.go: TableStructureCache 5min TTL)
- [x] **[PERF-005]** 减少不必要的数据库查询（缓存）(QueryCache + GetTableStatsFast + TableStructureCache)

---

## 版本规划

### v1.0 (当前版本) - MVP

**目标**: 核心功能可用，基础稳定性

**已交付功能**:
- 6种数据库类型连接（PostgreSQL, MySQL, SQLite, Redis, PolarDB, GaussDB）
- Monaco Editor SQL编辑器（语法高亮、多标签页）
- 多查询批量执行（`ExecuteMultiQuery`）
- 表/视图/函数/索引/外键/统计信息查看
- AES-256-GCM密码加密存储
- SQL注入防护（`sanitizeIdentifier`）
- 连接池（最大50连接，3秒ping健康检查）
- i18n中英双语支持

**发布时间**: 2024 Q1

---

### v1.5 - 稳定性提升

**目标**: 修复关键安全问题，补齐高频需求功能

**计划交付**:
- [x] 修复SEC-001, SEC-002, SEC-004, SEC-006, SEC-009, SEC-010 (已在代码中修复，文档已同步)
- [x] 修复SEC-003 (MySQL SSL证书配置), SEC-005 (DESCRIBE sanitize ✅ 已修复), SEC-007 (导入路径遍历 ✅ 已修复), SEC-008 (前端XSS ✅ 已修复)
- [x] 查询超时控制（ExecuteQuery已委托WithTimeout，默认30s）
- [x] SQL自动补全（列名补全已实现 autocomplete.go:317-346）
- [x] SQL格式化 (FormatSQL/BeautifySQL 已实现, 前端 Ctrl+Shift+F 调用)
- [x] 数据行内编辑（EditRequest已使用PrimaryKey，WhereClause已删除）
- [x] 操作日志完善（appendToFile增量写入）
- [x] Redis命令白名单 (80+安全命令, 危险命令拒绝+审计)
- [x] 前端模块化拆分 (app.js → 5 modules)
- [x] 危险操作二次确认 (DDL CREATE/DROP/ALTER/TRUNCATE 确认拦截)
- [x] 连接分组管理 (connection_groups.go: Create/Delete/Rename + groups.json持久化)
- [x] 单元测试覆盖率提升至>60% (当前 100 sub-tests, ~55%)

**P0 修复 (Sprint 1 — 致命问题)**:
- [x] F1: 数据编辑流程修复 (单元格双击编辑 + primaryKey 设置) — GAP-ANALYSIS.md §1.2
- [x] F2: Settings 持久化 (5字段保存 + Monaco动态应用)
- [x] F3: Tab内容持久化 (per-tab Monaco content 缓存)
- [x] F4: 视图/函数树加载 (loadViewsForDatabase / loadFunctionsForDatabase)
- [x] B1: App.connections mutex保护
- [x] B2: ReadFile/WriteFile 路径遍历修复
- [x] B3: MySQL SSL tls=preferred 无效修复
- [x] B4: SQLite GetFunctions 查询错误修复
- [x] B5: EXPLAIN parseExplainResult 空壳修复

**P1 修复 (Sprint 2 — 功能补全)**:
- [x] F5: i18n 完整覆盖 (90→180 keys zh+en, 覆盖所有UI区域)
- [x] F6-F7: 窗口拖拽 + resize handle 绑定 (8方向 mousedown+cursor)
- [x] F8-F12: 空状态/右键创建表/对比下拉/大结果集警告 (空连接列表+create_table+drop_table+compare下拉+10000行banner)
- [x] B6: Context传播修复 (data_editor/redis/transaction → a.ctx+WithTimeout)
- [x] B7: 审计日志补全 (MultiQuery/Begin/Commit/Rollback/Connect/Disconnect)
- [x] B8: PostgreSQL UseDatabase 重连竞态修复 (sync.Mutex+先建新后关旧)
- [x] B9: MySQL UseDatabase SQL注入修复
- [x] B13: 查询取消 API (CancelQuery+GetActiveQueries+registerQuery集成)
- [x] B14: 查询历史 (~/.db-client/history.json)
- [x] B15: 已保存查询/书签
- [x] B16: 连接导入/导出

**验收标准**: 单次查询超时自动终止；自动补全响应<200ms；数据编辑零数据丢失；XSS漏洞清零；Settings全部持久化；Tab切换不丢内容

**完整差距分析**: 见 GAP-ANALYSIS.md

**发布时间**: 2024 Q2

---

### v2.5 - AI 助手 (Phase 0 + Phase 1)

**目标**: AI 基础设施 + 3个快速赢 AI 功能

**计划交付**:

Phase 0 基础设施:
- [x] AI LLM 客户端接口 (OpenAI-compatible + Ollama)
- [x] API key 加密存储 (复用 crypto.go AES-256-GCM)
- [x] Schema context builder (token 预算管理)
- [x] Prompt 模板系统
- [x] 前端 Settings "AI" section (provider/key/model/enable)
- [x] AI 调用审计日志 (AuditEventAIQuery)

Phase 1 AI 功能:
- [x] A1: SQL 解释 (工具栏AI解释按钮, AnalyzeQuery fallback)
- [x] A2: 错误诊断 (DiagnoseQueryError API, schema context)
- [x] A3: SQL 优化建议 (EXPLAIN + schema + AI建议, 离线fallback)
- [x] A4: 自然语言转SQL (NL2SQL对话框, 工具栏AI生成SQL按钮)

**安全要求**:
- API key AES-256-GCM 加密, 永不返回前端
- 默认 Ollama 本地 LLM; 云端需用户确认
- AI 生成 SQL 必须经 ExecuteQueryWithTimeout
- AI 输出渲染用 textContent, 禁止 innerHTML
- 防抖 1000ms+, 缓存, 限流

**完整 AI 路线图**: 见 GAP-ANALYSIS.md §4

---

### v2.0 - 企业版

**目标**: 满足企业级安全合规与团队协作需求

**计划交付**:
- [x] 完整审计日志系统（查询/事务操作全覆盖 + 追加写入）
- [x] Redis命令白名单
- [x] SSH隧道连接 (ssh_tunnel.go + 连接对话框SSH配置UI)
- [x] 性能监控仪表盘 (performance.go: GetPerformanceMetrics/GetSystemInfo/HealthCheck)
- [x] 敏感数据脱敏 (data_masking.go: MaskConfig + maskQueryResult)
- [x] 危险操作二次确认（DROP/TRUNCATE）
- [x] Terminal Noir设计系统落地 (CSS变量体系+monospace字体全面应用)
- [x] 团队协作基础（连接配置导入/导出）
- [x] 数据库备份/恢复 (backup_restore.go: MySQL/PostgreSQL/SQLite)
- [x] 单元测试覆盖率>60% (当前 100 sub-tests, ~55%)

**验收标准**: 审计日志覆盖全部操作；SSH隧道连接PostgreSQL成功；导出10万行数据<30s

**发布时间**: 2024 Q3

---

### v3.0 - 高级版

**目标**: 差异化竞争，扩展生态

**计划交付**:
- [x] 跨数据库数据迁移 (sprint14.go: MigrateData 批量INSERT)
- [x] 增量数据同步 (sprint14.go: IncrementalSync 基于key列upsert)
- [ ] 插件系统架构
- [ ] 云数据库深度支持
- [ ] NoSQL支持（MongoDB/Elasticsearch）
- [x] 数据可视化图表 (sprint14.go: PrepareChartData bar/line/pie/scatter)
- [x] 定时查询执行 (scheduler.go: CreateScheduledTask interval-based)
- [ ] 版本控制集成（Git）

**验收标准**: 跨数据库迁移100万行数据<5min；插件加载<1s；报表导出PDF格式完整

**发布时间**: 2024 Q4

---

## 商业化路径

### 免费版 (Community)
- 单用户使用
- 基础数据库支持（PostgreSQL/MySQL/SQLite/Redis）
- SQL编辑器、查询执行、表结构查看
- 社区支持

### 专业版 (Professional) - 299/年
- 全部核心功能
- SQL自动补全 + 数据编辑 + 数据导入导出 + 数据对比
- 查询分析器 + SQL格式化
- PolarDB/GaussDB深度适配
- 邮件支持（48h响应）

### 企业版 (Enterprise) - 999/年/席位
- 全部功能
- 审计日志系统 + SSH隧道
- 团队协作（配置/脚本共享）
- 敏感数据脱敏 + 危险操作审批
- 优先技术支持（4h响应）

---

## 贡献指南

### 如何贡献

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 遵循 Go 官方代码规范
- 单元测试覆盖率 > 80%
- 提交信息遵循 Conventional Commits
- SQL标识符必须通过 `sanitizeIdentifier()`
- 前端禁止使用 `innerHTML`/`insertAdjacentHTML` 插入服务端数据
- 使用 `ExecuteQueryWithTimeout` 而非 `ExecuteQuery`
- 审计日志覆盖所有安全相关操作

---

## 文档交叉引用

| 文档 | 内容 |
|------|------|
| D01-overview | 项目愿景、优先级矩阵、技术栈、指标、风险 |
| D02-feature-design | 17模块功能分解、30项追踪矩阵、15项未完成 |
| D02-architecture | 系统架构、IPC流、模块边界、并发模型 |
| D06-security | 加密、注入、XSS、审计、19个安全问题 |
| D08-migration-plan | 设计→实施迁移计划（前端模块化、设计系统落地） |
| D09-test-strategy | 测试策略、覆盖率提升计划 |
| D10-interface-contract | 前后端契约、EditRequest V2、契约实施追踪 |
| D11-release-process | 发布流程、版本号规范、发布检查清单 |
| ROADMAP（本文档） | 路线图、完成度、安全问题、技术债 |

---

**最后更新**: 2026-05-11
**维护者**: 开发团队
