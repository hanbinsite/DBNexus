# D02 - 功能设计与数据模型

## 1. 模块总览

| 模块名 | 功能描述 | 完成度 | 关键文件 | 安全风险 |
|--------|----------|--------|----------|----------|
| 连接管理 | 多数据库连接创建、保存、测试与池化管理 | 90% | connection.go, pool.go, config.go, crypto.go | 加密密码暴露前端 (GetConnections) |
| SQL编辑器 | SQL查询执行、多语句执行、超时控制 | 80% | query.go, query_timeout.go, app.js Monaco | ExecuteQuery无超时 |
| 数据查询与展示 | 数据库/表/视图/列/索引/外键元数据查询 | 85% | schema.go, app.js dataViewPanel | 查询结果无行数限制 |
| 数据编辑 | 表数据INSERT/UPDATE/DELETE操作 | 70% | data_editor.go | WhereClause SQL注入 |
| 数据导出导入 | CSV/JSON/Excel/SQL导出、CSV/JSON导入 | 75% | data_export.go | SQL导出逐行INSERT性能差 |
| 数据对比 | 表数据对比、查询结果对比、报告生成 | 70% | data_compare.go | 全量内存加载 |
| Schema检查 | 索引/外键/统计信息/视图/函数查询 | 85% | schema.go | MySQL DESCRIBE未sanitize |
| 事务管理 | 事务开始/提交/回滚/批量执行 | 60% | transaction.go | 无自动清理过期事务 |
| 查询分析 | EXPLAIN解析、复杂度评估、优化建议 | 50% | query_analyzer.go | GetSlowQueries空实现 |
| SQL格式化 | SQL美化/压缩/验证/结构分析 | 80% | sql_formatter.go | 基础验证不够严格 |
| 自动补全 | 表名/列名/关键字/函数/数据库名补全 | 60% | autocomplete.go | 列名补全空实现 |
| 审计日志 | 操作日志记录/查询/导出/清理 | 70% | audit.go | 每次Log全量重写文件 |
| Redis API | Redis键值CRUD、命令执行、信息查询 | 85% | redis_api.go, db/redis.go | 类型断言可panic |
| 国际化 | 中英文消息翻译 | 75% | i18n.go | 部分硬编码中文 |
| 窗口管理 | 窗口最小化/最大化/关闭/状态查询 | 90% | window.go | 无安全风险 |
| 文件对话框 | 打开/保存文件对话框 | 90% | filedialog.go | 无安全风险 |
| 测试服务 | 连接测试、服务器信息查询 | 60% | test.go | 仅连接测试 |

---

## 2. 各模块功能分解

### 2.1 连接管理

**功能列表**:
- ✅ 多数据库类型支持 (PostgreSQL, MySQL, SQLite, Redis, PolarDB, GaussDB)
- ✅ 连接配置保存与加载 (`~/.db-client/connections.json`, 0600权限)
- ✅ 密码AES-256-GCM加密存储
- ✅ 连接测试 (`TestConnection` with 解密→验证→连接→Ping→关闭)
- ✅ 连接池管理 (`MaxPoolSize=50`, FIFO淘汰, 3秒ping超时健康检查)
- ✅ 连接健康检查 (`getOrCreate`双重检查锁 + ping验证)
- ✅ 审计日志记录 (保存/删除连接操作)
- 🚧 连接分组管理
- 📝 SSH隧道连接
- 📝 SSL/TLS证书配置 (MySQL驱动忽略SSLMode)

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetSupportedDatabases` | 获取支持的数据库类型及默认端口 | ✅ |
| `GetConnections` | 获取所有已保存连接 | ✅ |
| `SaveConnection` | 保存/更新连接(加密密码) | ✅ |
| `DeleteConnection` | 删除连接(记录审计日志) | ✅ |
| `TestConnection` | 测试连接(解密→验证→连接→Ping→关闭) | ✅ |
| `ConnectToDatabase` | 连接数据库(pool.getOrCreate + ping重试3次) | ✅ |
| `DisconnectFromDatabase` | 断开连接(pool.remove + driver.Close) | ✅ |

**数据模型**: `Connection` (见 03-data-models.md), `ConnectionConfig` (db包), `pooledDriver` (pool包)

**已知缺陷**:
- `ConnectToDatabase` 解密失败时静默忽略 (connection.go:202-207, 仅 `if err == nil` 而不报错)
- `GetConnections` 返回含加密密码的数组暴露给前端JS上下文 (connection.go:23-25)
- MySQL驱动忽略SSLMode (db/mysql.go:23, 连接字符串未包含tls参数)
- `encryptionKey` 全局变量无 `sync.Once` 保护, 并发init可覆盖key文件 (crypto.go:14)
- `poolMutex` 在 `query.go` 等文件中仍使用手动双重检查而非 `pool.getOrCreate` (query.go:24-43)

**安全注意事项**:
- 密码必须在保存前加密, 传输前解密
- 连接池key包含数据库名 (`buildKey`, pool.go:89-91), 避免缓存错乱
- 审计日志记录所有连接操作
- `connections.json` 应设置0600权限 (config.go:114)
- 配置目录应设置0700权限 (config.go:65)

---

### 2.2 SQL编辑器

**功能列表**:
- ✅ 单查询执行 (`ExecuteQuery`)
- ✅ 多语句执行 (`ExecuteMultiQuery`, 分号分隔)
- ✅ 非查询执行 (`ExecuteNonQuery`, INSERT/UPDATE/DELETE)
- ✅ 带超时查询执行 (`ExecuteQueryWithTimeout`, 默认30秒, 最大300秒)
- ✅ 带超时多查询执行 (`ExecuteMultiQueryWithTimeout`)
- ✅ 查询结果行列数据返回
- ✅ 执行时长统计
- ✅ SQL语句分割 (处理引号内分号)
- 🚧 查询历史记录
- 📝 查询结果缓存
- 📝 查询取消功能

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `ExecuteQuery` | 执行单条SQL查询(无超时) | ✅ |
| `ExecuteMultiQuery` | 执行多条SQL(分号分隔) | ✅ |
| `ExecuteNonQuery` | 执行非查询语句 | ✅ |
| `ExecuteQueryWithTimeout` | 执行带超时控制的查询 | ✅ |
| `ExecuteMultiQueryWithTimeout` | 执行带超时控制的多查询 | ✅ |

**数据模型**: `QueryResult`, `SingleQueryResult`, `MultiQueryResult`, `QueryOptions`

**已知缺陷**:
- `ExecuteQuery` 无超时限制, 可无限阻塞UI (query.go:10-97)
- `ExecuteQuery` 仍使用手动 `poolMutex` 双重检查而非 `pool.getOrCreate` (query.go:24-43)
- 查询结果无行数限制, 大结果集可导致OOM (query.go:62-89)
- `splitQueries` 的反斜杠转义不适用于MySQL标准SQL模式 (query.go:252-256)
- NULL值被转换为字符串 `"NULL"` 而非null (query.go:82)

**安全注意事项**:
- 优先使用 `ExecuteQueryWithTimeout` 而非 `ExecuteQuery`
- 超时范围: 最小1秒, 默认30秒, 最大300秒 (query_timeout.go:12-14)
- `ExecuteQueryWithTimeout` 在行扫描中检查 `ctx.Done()`, 防止读取过多数据 (query_timeout.go:113-123)
- 应添加查询结果行数上限配置

---

### 2.3 数据查询与展示

**功能列表**:
- ✅ 数据库列表查询 (`GetDatabases`)
- ✅ 表列表查询 (`GetTables`, 自动 `UseDatabase`)
- ✅ 视图列表查询 (`GetViews`, MySQL/PostgreSQL/SQLite)
- ✅ 函数列表查询 (`GetFunctions`, MySQL/PostgreSQL/SQLite)
- ✅ 列信息查询 (`GetTableColumns`)
- ✅ 索引信息查询 (`GetTableIndexes`, MySQL/PostgreSQL)
- ✅ 外键信息查询 (`GetTableForeignKeys`, MySQL/PostgreSQL)
- ✅ 表统计信息查询 (`GetTableStats`, 行数/数据大小/索引大小)
- ✅ SQL标识符净化 (`sanitizeIdentifier`)
- ✅ 字符串字面量转义 (`escapeStringLiteral`)
- 🚧 存储过程查询
- 📝 触发器查询
- 📝 分区表信息

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetDatabases` | 获取数据库列表 | ✅ |
| `GetTables` | 获取表列表(自动切换数据库) | ✅ |
| `GetViews` | 获取视图列表 | ✅ |
| `GetFunctions` | 获取函数/存储过程列表 | ✅ |
| `GetTableColumns` | 获取表的列信息 | ✅ |
| `GetTableIndexes` | 获取索引信息 | ✅ |
| `GetTableForeignKeys` | 获取外键信息 | ✅ |
| `GetTableStats` | 获取表统计信息(行数/大小) | ✅ |

**数据模型**: `DatabaseInfo`, `TableInfo`, `IndexInfo`, `ForeignKeyInfo`, `TableStats`, `ColumnInfo` (db包)

**已知缺陷**:
- MySQL `DESCRIBE` 命令中表名未sanitize (db/mysql.go:87, 直接拼接 `tableName`)
- `GetTableStats` 的 `COUNT(*)` 在大表上性能极差 (schema.go:461)
- `GetTableStats` 的 `SHOW TABLE STATUS` 在MySQL上扫描列数固定, 不同版本可能不兼容 (schema.go:492-494)
- `GetFunctions` 对SQLite使用了错误的查询条件 (`type='view' AND name LIKE 'func_%'`, schema.go:149-151)
- PostgreSQL数组解析 `parsePostgresArray` 不处理NULL元素 (schema.go:518-567)

**安全注意事项**:
- `sanitizeIdentifier` 阻止路径遍历 (`..`) 和危险字符 (schema.go:194-234)
- `escapeStringLiteral` 使用SQL标准双单号转义 (schema.go:237-240)
- 标识符长度限制64字符防止DOS (schema.go:224-226)
- `GetViews` 和 `GetFunctions` 使用 `escapeStringLiteral` 处理数据库名 (schema.go:75, 131)

---

### 2.4 数据编辑

**功能列表**:
- ✅ 插入数据 (`performInsert`, 参数化值)
- ✅ 更新数据 (`performUpdate`, 主键条件/WhereClause)
- ✅ 删除数据 (`performDelete`, 主键条件/WhereClause)
- ✅ 批量编辑 (`BatchEdit`, 逐条执行)
- ✅ 可编辑列查询 (`GetEditableColumns`, 排除自增列)
- ✅ INSERT语句预览 (`GenerateInsertStatement`)
- ✅ UPDATE语句预览 (`GenerateUpdateStatement`)
- ✅ 表名/列名sanitize验证
- 🚧 事务性批量编辑
- 📝 行级锁编辑
- 📝 编辑冲突检测

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `EditTableData` | 编辑表数据(INSERT/UPDATE/DELETE) | ✅ |
| `BatchEdit` | 批量编辑操作 | ✅ |
| `GetEditableColumns` | 获取可编辑列(排除自增列) | ✅ |
| `GenerateInsertStatement` | 生成INSERT语句预览 | ✅ |
| `GenerateUpdateStatement` | 生成UPDATE语句预览 | ✅ |

**数据模型**: `EditRequest`, `EditResult`, `EditOperation`

**已知缺陷**:
- **`WhereClause` SQL注入**: `req.WhereClause` 直接拼接到SQL中, 未参数化 (data_editor.go:255-256, 306-307)
- `performInsert` 使用反引号包裹列名但PostgreSQL应使用双引号 (data_editor.go:196-201)
- `formatValueForSQL` 对字符串值仅做单引号转义, 不够安全 (data_editor.go:411-425)
- `BatchEdit` 逐条执行无事务保护, 部分失败无法回滚 (data_editor.go:359-368)
- `GenerateUpdateStatement` 中 `whereClause` 参数未sanitize (data_editor.go:392-408)

**安全注意事项**:
- **P0**: `WhereClause` 必须改为参数化查询或至少添加白名单验证
- 表名和列名通过 `sanitizeIdentifier` 净化 (data_editor.go:168, 186, 192, 241, 246, 260, 302, 311)
- 所有编辑操作记录审计日志 (data_editor.go:132-153)
- 更新/删除操作要求必须有WHERE条件或主键 (data_editor.go:233-239, 294-300)

---

### 2.5 数据导出导入

**功能列表**:
- ✅ CSV导出 (`exportToCSV`)
- ✅ JSON导出 (`exportToJSON`, 格式化输出)
- ✅ Excel导出 (`exportToExcel`, 使用excelize库)
- ✅ SQL INSERT导出 (`exportToSQL`, 逐行INSERT语句)
- ✅ CSV导入 (`importFromCSV`)
- ✅ JSON导入 (`importFromJSON`)
- ✅ 导出路径管理 (`~/.db-client/exports/`)
- ✅ 导入路径管理 (`~/.db-client/imports/`)
- 🚧 Excel导入
- 📝 SQL脚本导入执行
- 📝 流式导出(大数据量)
- 📝 导出进度回调

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `ExportData` | 导出数据(CSV/JSON/Excel/SQL) | ✅ |
| `ImportData` | 导入数据(CSV/JSON) | ✅ |

**数据模型**: `ExportRequest`, `ExportResult`, `ImportRequest`, `ImportResult`, `ExportFormat`

**已知缺陷**:
- SQL导出逐行INSERT性能差, 应使用批量INSERT (data_export.go:244-259)
- 导出前调用 `ExecuteQuery` 获取全量数据, 大结果集可导致OOM (data_export.go:85)
- `exportToSQL` 中列名未sanitize (data_export.go:249, 直接使用 `result.Columns[i]`)
- `ImportData` 逐条调用 `EditTableData`, 大量数据导入极慢 (data_export.go:335-349)
- 导入文件路径未做路径遍历检查 (data_export.go:304)
- `ExportData` 自动创建导出目录时使用0755权限而非0700 (data_export.go:97)

**安全注意事项**:
- 导出文件使用0644权限, 含敏感数据时应使用0600 (data_export.go:203, 261)
- 导入数据经过 `EditTableData` 流程, 享有相同的sanitize保护
- 审计日志记录导出/导入操作 (data_export.go:138-145, 352-360)
- `ExportRequest.Query` 允许执行任意SQL, 需确保来源可信

---

### 2.6 数据对比

**功能列表**:
- ✅ 表数据对比 (`CompareTables`, 基于键列)
- ✅ 查询结果对比 (`CompareQueries`)
- ✅ 对比报告生成 (`GetCompareReport`, 文本格式)
- ✅ 对比结果导出 (JSON/CSV/TXT)
- ✅ 差异摘要统计 (匹配百分比/差异数/缺失行)
- ✅ 键列自动检测 (查询对比时使用第一列)
- 🚧 结构对比
- 📝 数据库级别全量对比
- 📝 流式对比(大数据量)
- 📝 对比结果同步

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `CompareTables` | 对比两个表的数据 | ✅ |
| `CompareQueries` | 对比两个查询结果 | ✅ |
| `GetCompareReport` | 生成文本格式对比报告 | ✅ |
| `ExportCompareResult` | 导出对比结果(JSON/CSV/TXT) | ✅ |

**数据模型**: `CompareRequest`, `CompareResult`, `CompareSummary`, `DifferenceItem`, `CompareType`, `CompareMode`

**已知缺陷**:
- 全量数据加载到内存 (`buildDataMap`), 大表对比可导致OOM (data_compare.go:226-268)
- `CompareTables` 中目标表查询使用了 `sourceQuery` 而非目标表名 (data_compare.go:105)
- `compareValues` 使用 `fmt.Sprintf` 转字符串比较, 浮点数比较不精确 (data_compare.go:271-282)
- `CompareQueries` 自动使用第一列作为键列, 可能不准确 (data_compare.go:335-337)
- `ExportCompareResult` 的CSV输出未处理值中含逗号的情况 (data_compare.go:394-400)

**安全注意事项**:
- `buildCompareQuery` 使用 `sanitizeIdentifier` 净化表名 (data_compare.go:133)
- 对比操作调用 `ExecuteQuery`, 继承其安全风险(无超时)
- 审计日志记录对比操作 (data_compare.go:118-126)

---

### 2.7 Schema检查

**功能列表**:
- ✅ 索引信息查询 (`GetTableIndexes`, MySQL/PostgreSQL)
- ✅ 外键信息查询 (`GetTableForeignKeys`, MySQL/PostgreSQL)
- ✅ 表统计信息 (`GetTableStats`, 行数/数据长度/索引长度/引擎/排序规则)
- ✅ PostgreSQL数组解析 (`parsePostgresArray`)
- ✅ 参照动作转换 (`convertRefAction`, PostgreSQL内部代码→SQL标准)
- ✅ 标识符净化 (`sanitizeIdentifier`)
- ✅ 字符串转义 (`escapeStringLiteral`)
- 🚧 触发器查询
- 📝 分区表信息
- 📝 表DDL生成

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetTableIndexes` | 获取索引信息(MySQL/PostgreSQL) | ✅ |
| `GetTableForeignKeys` | 获取外键信息(MySQL/PostgreSQL) | ✅ |
| `GetTableStats` | 获取表统计信息 | ✅ |
| `GetTableStatistics` | 获取表统计信息(map格式, query_analyzer.go:714) | ✅ |
| `AnalyzeTableUsage` | 分析所有表的使用情况 | ✅ |

**数据模型**: `IndexInfo`, `ForeignKeyInfo`, `TableStats`

**已知缺陷**:
- MySQL `DESCRIBE` 命令中表名未sanitize (db/mysql.go:87)
- `GetTableStats` 的 `COUNT(*)` 在大表上性能极差 (schema.go:461)
- SQLite不支持索引和外键查询 (schema.go:274, 413)
- `GetTableStats` 的 `SHOW TABLE STATUS` 扫描列数不兼容所有MySQL版本 (schema.go:487-494)
- `convertRefAction` 仅处理PostgreSQL代码, MySQL值直接返回 (schema.go:570-584)

**安全注意事项**:
- 所有表名通过 `sanitizeIdentifier` 净化 (schema.go:258, 375, 459)
- 数据库名通过 `escapeStringLiteral` 转义 (schema.go:76, 131, 376)
- `GetTableStats` 使用参数化查询构建, 标识符经sanitize处理

---

### 2.8 事务管理

**功能列表**:
- ✅ 开始事务 (`BeginTransaction`, 支持隔离级别和只读设置)
- ✅ 事务内执行查询 (`ExecuteInTransaction`)
- ✅ 提交事务 (`CommitTransaction`)
- ✅ 回滚事务 (`RollbackTransaction`)
- ✅ 批量事务执行 (`ExecuteTransactionBatch`, 自动提交/回滚)
- ✅ 事务超时配置 (30分钟 `TransactionTimeout`)
- ✅ 全局事务map (`globalTransactions`, 线程安全)
- 🚧 过期事务自动清理
- 📝 事务保存点(Savepoint)
- 📝 事务状态查询
- 📝 事务事件通知

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `BeginTransaction` | 开始事务(支持隔离级别) | ✅ |
| `ExecuteInTransaction` | 在事务内执行SQL | ✅ |
| `CommitTransaction` | 提交事务 | ✅ |
| `RollbackTransaction` | 回滚事务 | ✅ |
| `ExecuteTransactionBatch` | 批量事务执行(自动提交/回滚) | ✅ |

**数据模型**: `TransactionOptions`, `TransactionResult`, `TransactionQuery`, `TransactionRequest`, `activeTransaction`

**已知缺陷**:
- `cleanupStaleTransactions` 从未被自动调用, 过期事务不会被清理 (transaction.go:57-68)
- 事务使用 `context.Background()` 无超时, 仅依赖 `TransactionTimeout` 常量但未实际使用 (transaction.go:132)
- `ExecuteInTransaction` 直接拼接query执行, 无SQL注入防护 (transaction.go:149)
- `BeginTransaction` 的连接context超时仅10秒, 但事务本身无限期 (transaction.go:119-121)
- `globalTransactions` map无大小限制, 可累积大量未提交事务 (transaction.go:52)

**安全注意事项**:
- 事务隔离级别支持: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE (transaction.go:103-114)
- 事务提交/回滚后自动从map中删除 (transaction.go:167, 186)
- `ExecuteTransactionBatch` 在出错时自动回滚 (transaction.go:228)
- 应添加定时器自动调用 `cleanupStaleTransactions`

---

### 2.9 查询分析

**功能列表**:
- ✅ EXPLAIN执行计划获取 (`GetExplainPlan`, MySQL/PostgreSQL)
- ✅ MySQL EXPLAIN结果解析 (`parseMySQLExplain`)
- ✅ PostgreSQL EXPLAIN ANALYZE结果解析 (`parsePostgresExplainText`)
- ✅ 通用EXPLAIN结果解析 (`parseGenericExplain`)
- ✅ 查询复杂度评估 (`AnalyzeQuery`, LOW/MEDIUM/HIGH)
- ✅ 优化建议生成 (`generateRecommendations`, `generateOptimizationSuggestions`)
- ✅ 表使用情况分析 (`AnalyzeTableUsage`)
- ✅ 表统计信息 (`GetTableStatistics`)
- ✅ 性能警告检测 (全表扫描/文件排序/临时表)
- 🚧 慢查询分析
- 📝 查询性能历史追踪
- 📝 索引使用率分析
- 📝 查询计划可视化

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetExplainPlan` | 获取EXPLAIN执行计划 | ✅ |
| `AnalyzeQuery` | 分析查询复杂度 | ✅ |
| `GetSlowQueries` | 获取慢查询列表 | 📝 空实现 |
| `GetTableStatistics` | 获取表统计信息(map格式) | ✅ |
| `AnalyzeTableUsage` | 分析所有表使用情况 | ✅ |

**数据模型**: `ExplainResult`, `ExplainNode`, `QueryAnalysis`, `ExplainType`

**已知缺陷**:
- `GetSlowQueries` 返回空列表, 完全未实现 (query_analyzer.go:707-711)
- `parseExplainResult` 使用自定义 `Rows` 接口进行类型断言, 兼容性差 (query_analyzer.go:188-204)
- `extractTables` 仅提取第一个FROM后的表名, 无法处理多表JOIN和子查询 (query_analyzer.go:590-607)
- `AnalyzeQuery` 不需要数据库连接, 纯文本分析, 精度有限 (query_analyzer.go:549-587)
- `parsePostgresExplainText` 的缩进级别计算假设2空格缩进, 不适用所有情况 (query_analyzer.go:387-388)
- `GetExplainPlan` 对PostgreSQL使用 `EXPLAIN ANALYZE` 会实际执行查询 (query_analyzer.go:138)

**安全注意事项**:
- `GetExplainPlan` 仅允许SELECT查询 (query_analyzer.go:90-96)
- EXPLAIN操作记录审计日志 (query_analyzer.go:163-169)
- PostgreSQL `EXPLAIN ANALYZE` 会执行查询, 可能产生副作用
- 应提供 `EXPLAIN` (不执行) 和 `EXPLAIN ANALYZE` (执行) 两种模式

---

### 2.10 SQL格式化

**功能列表**:
- ✅ SQL美化 (`FormatSQL`, 支持缩进/关键字大小写/对齐选项)
- ✅ SQL压缩 (`MinifySQL`, 移除注释和多余空白)
- ✅ SQL验证 (`ValidateSQL`, 括号匹配/引号匹配/起始关键字检查)
- ✅ 快捷美化 (`BeautifySQL`, 使用默认选项)
- ✅ 紧凑格式 (`CompactSQL`, 小缩进+宽行)
- ✅ SQL结构分析 (`GetSQLStructure`, 检测查询类型/子句)
- 🚧 SQL语法高亮增强
- 📝 正则替换支持
- 📝 多光标编辑

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `FormatSQL` | 格式化SQL(自定义选项) | ✅ |
| `BeautifySQL` | 快捷美化 | ✅ |
| `CompactSQL` | 紧凑格式 | ✅ |
| `MinifySQL` | 压缩SQL(移除注释) | ✅ |
| `ValidateSQL` | 基础语法验证 | ✅ |
| `GetSQLStructure` | SQL结构分析 | ✅ |

**数据模型**: `FormatOptions`, `SQLFormatter`

**已知缺陷**:
- `ValidateSQL` 仅做基础检查(起始关键字/括号/引号), 不做真正语法解析 (sql_formatter.go:322-347)
- `removeSQLComments` 正则无法处理嵌套注释和字符串内的注释 (sql_formatter.go:309-319)
- `formatTokens` 的换行逻辑对子查询嵌套处理不完善 (sql_formatter.go:162-197)

---

### 2.11 自动补全

**功能列表**:
- ✅ SQL关键字补全 (70+关键字, `sqlKeywords`)
- ✅ SQL函数补全 (100+通用函数 + MySQL/PG特定函数)
- ✅ 表名补全 (`getTableSuggestions`)
- ✅ 数据库名补全 (`getDatabaseSuggestions`)
- ✅ 上下文分析 (`analyzeQueryContext`)
- ✅ 当前单词提取 (`extractCurrentWord`)
- ✅ 快速补全(无需连接, `GetQuickSuggestions`)
- 🚧 列名补全 (当前返回空列表)
- 📝 智能提示(上下文相关)
- 📝 代码片段(Snippet)库
- 📝 多表JOIN列补全

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetAutoCompleteSuggestions` | 上下文感知自动补全 | ✅(列名空) |
| `GetQuickSuggestions` | 快速关键字/函数补全 | ✅ |
| `GetTableColumnsForAutoComplete` | 获取指定表的列补全 | ✅ |

**数据模型**: `AutoCompleteItem`, `AutoCompleteResult`, `AutoCompleteType`, `SQLKeyword`

**已知缺陷**:
- `getColumnSuggestions` 返回空列表, 核心功能未实现 (autocomplete.go:352-358)
- `analyzeQueryContext` 仅检查最后一个关键字, 无法处理嵌套上下文 (autocomplete.go:296-323)
- `extractCurrentWord` 不支持 `.` 分隔的限定名(如 `schema.table`) (autocomplete.go:270-288)
- 补全结果限制50条, 大表可能不够 (autocomplete.go:464-466)

---

### 2.12 审计日志

**功能列表**:
- ✅ 单例模式初始化 (`sync.Once`, `GetAuditLogger`)
- ✅ 多级别日志 (INFO/WARNING/ERROR/CRITICAL)
- ✅ 事件类型分类 (CONNECT/DISCONNECT/QUERY/QUERY_TIMEOUT/QUERY_ERROR/CONNECTION_SAVE/CONNECTION_DELETE/LOGIN/LOGOUT/CONFIG_CHANGE/SENSITIVE_DATA_ACCESS)
- ✅ 查询日志 (`LogQuery`)
- ✅ 连接日志 (`LogConnection`)
- ✅ 敏感数据访问日志 (`LogSensitiveData`)
- ✅ 日志查询 (`GetLogs`, 支持级别/类型过滤)
- ✅ 日志导出 (`ExportLogs`, 支持时间范围)
- ✅ 旧日志清理 (`ClearOldLogs`, 按天数)
- 🚧 日志轮转
- 📝 实时日志推送
- 📝 日志搜索
- 📝 日志统计仪表盘

**API方法映射**: 审计日志不直接暴露Wails API, 通过其他操作间接触发。

**数据模型**: `AuditLog`, `AuditLogLevel`, `AuditEventType`, `AuditLogger`

**已知缺陷**:
- `writeToFile` 每次Log都序列化整个日志数组+写磁盘, O(n)I/O瓶颈 (audit.go:196-213)
- `truncateQuery` 按字节截断, 可截断多字节中文字符 (audit.go:296-301)
- 日志条目ID用 `UnixNano`, 无UUID保证唯一性 (audit.go:120)
- `loadTodayLogs` 加载时无大小限制, 大文件启动慢 (audit.go:94-108)
- `ClearOldLogs` 不会自动调用, 需手动触发 (audit.go:260-293)

---

### 2.13 Redis API

**功能列表**:
- ✅ 获取键信息 (`GetRedisKeyInfo`, 类型/值/TTL)
- ✅ 设置键值 (`SetRedisKeyValue`, 支持TTL)
- ✅ 删除键 (`DeleteRedisKey`, 支持多键)
- ✅ 执行命令 (`ExecuteRedisCommand`, 任意Redis命令)
- ✅ 服务器信息 (`GetRedisInfo`, 按section)
- ✅ 数据库大小 (`GetRedisDBSize`)
- ✅ 键扫描 (`ScanRedisKeys`, 游标分页)
- ✅ 审计日志记录 (键操作/命令执行)
- 🚧 Redis集群支持
- 📝 Redis流(Redis Stream)支持
- 📝 Redis发布/订阅
- 📝 Redis管道(Pipeline)批量操作

**API方法映射**:

| API方法 | 功能 | 状态 |
|---------|------|------|
| `GetRedisKeyInfo` | 获取键详细信息 | ✅ |
| `SetRedisKeyValue` | 设置键值(带TTL) | ✅ |
| `DeleteRedisKey` | 删除键 | ✅ |
| `ExecuteRedisCommand` | 执行任意Redis命令 | ✅ |
| `GetRedisInfo` | 获取服务器信息 | ✅ |
| `GetRedisDBSize` | 获取键数量 | ✅ |
| `ScanRedisKeys` | 扫描键(分页) | ✅ |

**数据模型**: `db.RedisKeyInfo`, `db.RedisDriver`

**已知缺陷**:
- `getRedisDriver` 类型断言 `pooled.driver.(*db.RedisDriver)` 可panic (redis_api.go:218)
- Redis `GetRedisKeyInfo` 内部类型断言 `value.([]string)` 等可panic (db/redis.go:183-199)
- 数据库数量硬编码16, 无法动态获取 (db/redis.go:120-125)
- `fmt.Sscanf` 解析DB号失败时静默返回0 (db/redis.go:33,51)
- `ExecuteRedisCommand` 允许执行任意命令, 无安全限制 (redis_api.go:101-134)

**安全注意事项**:
- `ExecuteRedisCommand` 可执行危险命令(FLUSHALL/CONFIG等), 应添加命令白名单
- Redis键值可能包含敏感数据, 审计日志应脱敏处理

---

### 2.14 国际化

**功能列表**:
- ✅ MessageKey枚举 (17个消息键)
- ✅ 中文消息映射
- ✅ 英文消息映射
- ✅ 默认回退到中文
- ✅ 环境变量控制语言 (`DB_CLIENT_LANG`)
- ✅ 语言设置持久化 (`SetLanguage`, config.json)
- 🚧 消息键覆盖不完整
- 📝 更多语言支持
- 📝 前端i18n与后端i18n统一

**已知缺陷**:
- 后端仍有大量硬编码中文字符串, 未走i18n (如 data_editor.go 的错误消息)
- 前端i18n.js与后端i18n.go独立维护, 可能不同步

---

### 2.15 窗口管理

**功能列表**:
- ✅ 窗口最小化 (`WindowMinimize`)
- ✅ 窗口最大化/还原 (`WindowMaximize`, `WindowIsMaximized`)
- ✅ 窗口关闭 (`WindowClose`)
- ✅ Frameless窗口拖拽和缩放 (8个resize handle)
- ✅ 主题切换 (深色/浅色)

**已知缺陷**: 无重大缺陷, 功能完整。

---

### 2.16 文件对话框

**功能列表**:
- ✅ 打开文件对话框 (`OpenFileDialog`, 支持过滤器)
- ✅ 保存文件对话框 (`SaveFileDialog`, 支持过滤器)

**已知缺陷**: 无重大缺陷。

---

### 2.17 测试服务

**功能列表**:
- ✅ 运行所有测试 (`RunAllTests`)
- ✅ 连接测试 (`RunConnectionTest`)
- ✅ 服务器信息查询 (`GetServerInfo`)

**已知缺陷**:
- `GetServerInfo` 静默忽略密码解密错误 (test.go:94-99)
- 测试覆盖面不足, 仅连接测试

---

## 3. 功能追踪矩阵

| # | 功能 | 模块 | API方法 | 数据模型 | 状态 | 优先级 |
|---|------|------|---------|----------|------|--------|
| 1 | 多数据库连接 | 连接管理 | ConnectToDatabase | Connection, ConnectionConfig | ✅ | P0 |
| 2 | 连接池管理 | 连接管理 | pool.getOrCreate | pooledDriver, connectionPool | ✅ | P0 |
| 3 | 密码加密存储 | 连接管理 | SaveConnection | Connection | ✅ | P0 |
| 4 | SQL查询执行 | SQL编辑器 | ExecuteQuery | QueryResult | ✅ | P0 |
| 5 | 多语句执行 | SQL编辑器 | ExecuteMultiQuery | MultiQueryResult | ✅ | P0 |
| 6 | 查询超时控制 | SQL编辑器 | ExecuteQueryWithTimeout | QueryOptions | ✅ | P0 |
| 7 | Schema浏览 | Schema检查 | GetTables/GetViews/GetFunctions | TableInfo | ✅ | P0 |
| 8 | 表数据查看 | 数据查询 | ExecuteQuery + dataViewPanel | QueryResult | ✅ | P0 |
| 9 | 数据编辑 | 数据编辑 | EditTableData | EditRequest/EditResult | ✅ | P1 |
| 10 | 数据导出 | 数据导出 | ExportData | ExportRequest/ExportResult | ✅ | P1 |
| 11 | 数据导入 | 数据导入 | ImportData | ImportRequest/ImportResult | ✅ | P1 |
| 12 | 数据对比 | 数据对比 | CompareTables/CompareQueries | CompareRequest/CompareResult | ✅ | P1 |
| 13 | 事务管理 | 事务管理 | BeginTransaction/Commit/Rollback | TransactionOptions/TransactionResult | ✅ | P1 |
| 14 | EXPLAIN分析 | 查询分析 | GetExplainPlan | ExplainResult/ExplainNode | ✅ | P1 |
| 15 | SQL格式化 | SQL格式化 | FormatSQL/BeautifySQL/MinifySQL | FormatOptions | ✅ | P1 |
| 16 | 自动补全 | 自动补全 | GetAutoCompleteSuggestions | AutoCompleteResult | 🚧 | P1 |
| 17 | 审计日志 | 审计日志 | (内部) | AuditLog | ✅ | P1 |
| 18 | Redis操作 | Redis API | GetRedisKeyInfo/SetRedisKeyValue/etc | RedisKeyInfo | ✅ | P1 |
| 19 | i18n支持 | 国际化 | GetLanguage/SetLanguage | - | ✅ | P2 |
| 20 | WhereClause参数化 | 数据编辑 | EditTableData | EditRequest | 📝需修复 | P0 |
| 21 | 前端XSS防护 | 前端 | (前端改造) | - | 📝需修复 | P0 |
| 22 | encryptionKey同步 | 连接管理 | initEncryptionKey | - | 📝需修复 | P0 |
| 23 | ExecuteQuery废弃 | SQL编辑器 | ExecuteQuery | - | 📝需修复 | P0 |
| 24 | 事务自动清理 | 事务管理 | cleanupStaleTransactions | - | 📝需修复 | P1 |
| 25 | 列名自动补全 | 自动补全 | getColumnSuggestions | AutoCompleteItem | 📝需实现 | P1 |
| 26 | 慢查询分析 | 查询分析 | GetSlowQueries | - | 📝需实现 | P1 |
| 27 | MySQL SSL支持 | 数据库驱动 | db/mysql.go | ConnectionConfig.SSLMode | 📝需实现 | P1 |
| 28 | 审计日志追加写入 | 审计日志 | writeToFile | - | 📝需修复 | P2 |
| 29 | 统一池访问模式 | 连接池 | poolMutex使用 | - | 📝需修复 | P2 |
| 30 | 连接分组管理 | 连接管理 | - | - | 📝待开发 | P2 |

---

## 4. 未完成功能清单

| # | 功能 | 模块 | 当前状态 | 需要的工作 | 优先级 | 预估工时 |
|---|------|------|----------|------------|--------|----------|
| 1 | WhereClause参数化 | 数据编辑 | 原文拼入SQL | 解析WhereClause为参数化条件,或强制使用PrimaryKey | P0 | 4h |
| 2 | 前端XSS防护 | 前端 | 71处innerHTML | 替换为textContent/createElement | P0 | 16h |
| 3 | encryptionKey sync.Once | 加密 | 全局变量无保护 | 改用sync.Once初始化 | P0 | 2h |
| 4 | ExecuteQuery添加超时 | 查询 | 无超时 | 添加context.WithTimeout或废弃此方法 | P0 | 2h |
| 5 | 事务自动清理 | 事务 | cleanup函数存在但未调用 | 添加定时器或启动时调用 | P1 | 2h |
| 6 | 列名自动补全 | 自动补全 | 返回空列表 | 分析FROM子句提取表名→获取列名 | P1 | 8h |
| 7 | 慢查询分析 | 查询分析 | 空实现 | 需查询pg_stat_statements/MySQL slow_log | P1 | 16h |
| 8 | MySQL SSL/TLS | MySQL驱动 | 忽略SSLMode | 解析SSLMode→添加tls.Config | P1 | 4h |
| 9 | 审计日志追加写入 | 审计 | 每次全量序列化 | 改为append-only行写入 | P2 | 4h |
| 10 | 统一池访问 | 连接池 | 双重锁模式 | 移除poolMutex,统一用getOrCreate | P2 | 8h |
| 11 | Redis类型安全 | Redis API | 原始类型断言 | 改用safe type switch | P2 | 4h |
| 12 | truncateQuery按字符 | 审计 | 按字节截断 | 使用utf8.RuneCountInString | P2 | 1h |
| 13 | 连接分组管理 | 连接管理 | 未实现 | Connection添加Group字段+前端分组UI | P2 | 16h |
| 14 | SSH隧道连接 | 连接管理 | 未实现 | 添加SSH tunnel库+连接配置 | P2 | 24h |
| 15 | 数据虚拟滚动 | 前端 | 未实现 | 实现虚拟滚动组件 | P2 | 16h |

---

## 5. 模块间依赖关系

```
连接管理 (connection.go, pool.go, config.go, crypto.go)
  ├──→ SQL编辑器 (query.go, query_timeout.go) [依赖: pool, config解密]
  ├──→ Schema检查 (schema.go) [依赖: pool, config解密]
  ├──→ 数据编辑 (data_editor.go) [依赖: pool, config解密, 审计]
  ├──→ 数据导出导入 (data_export.go) [依赖: pool, query, config解密, 审计]
  ├──→ 数据对比 (data_compare.go) [依赖: query, config解密]
  ├──→ 事务管理 (transaction.go) [依赖: pool, config解密]
  ├──→ 查询分析 (query_analyzer.go) [依赖: pool, config解密, 审计]
  ├──→ Redis API (redis_api.go) [依赖: pool, config解密, 审计]
  └──→ 自动补全 (autocomplete.go) [依赖: schema, config解密]

审计日志 (audit.go) [横切: 被几乎所有模块调用]
国际化 (i18n.go) [横切: 被connection.go等使用]
窗口管理 (window.go) [独立: 仅前端调用]
文件对话框 (filedialog.go) [独立: 仅前端调用]
```

关键依赖链:
1. **查询路径**: Frontend → WailsAPI → ExecuteQuery → decryptPassword → pool.getOrCreate → driver.Query
2. **编辑路径**: Frontend → WailsAPI → EditTableData → decryptPassword → pool double-check → driver.Exec → audit.Log
3. **导出路径**: Frontend → WailsAPI → ExportData → ExecuteQuery → write file → audit.Log
4. **连接路径**: Frontend → WailsAPI → ConnectToDatabase → decryptPassword → pool.getOrCreate → driver.Ping(3x retry)