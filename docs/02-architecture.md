# D02 - Architecture Documentation / 架构文档

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于源码实际结构撰写

---

## 1. System Architecture Diagram / 系统架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Desktop Application (Go+Wails)                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Frontend Layer (WebView2 / JS)                    │   │
│  │                                                                │   │
│  │  index.html ─── app.js ─── i18n.js ─── styles.css             │   │
│  │       │            │          │          │                      │   │
│  │       └────────────┼──────────┼──────────┘                      │   │
│  │                    │                                           │   │
│  │         ┌──────────▼──────────┐                                │   │
│  │         │  WailsAPI Bridge    │  window.go.main.App.*          │   │
│  │         │  (app.js:24-73)     │  50+ methods from App.d.ts    │   │
│  │         └──────────┬──────────┘                                │   │
│  └─────────────────────┼──────────────────────────────────────────┘   │
│                        │ IPC (Wails Bindings)                       │
│                        │ JSON serialization / Promise-based         │
│  ┌─────────────────────┼──────────────────────────────────────────┐   │
│  │              Backend Layer (Go, package main)                   │   │
│  │                    │                                           │   │
│  │  ┌─────────────────▼────────────────────┐                      │   │
│  │  │            App struct                 │                      │   │
│  │  │  (app.go:14-21)                       │                      │   │
│  │  │  Fields: ctx, driverManager,          │                      │   │
│  │  │          connections, configPath,     │                      │   │
│  │  │          pool, poolMutex              │                      │   │
│  │  └─────────────────┬────────────────────┘                      │   │
│  │                    │                                           │   │
│  │  ┌─────────────────▼──────────────────────────────────────┐   │   │
│  │  │            Connection Pool (pool.go)                     │   │   │
│  │  │  sync.RWMutex + map[string]*pooledDriver                 │   │   │
│  │  │  MaxPoolSize=50, key="{type}:{host}:{port}:{user}:{db}" │   │   │
│  │  │  getOrCreate: double-check locking (L24-74)              │   │   │
│  │  │  eviction: FIFO by createdAt (L122-151)                  │   │   │
│  │  │  health: Ping 3s timeout (L197-223)                      │   │   │
│  │  └─────────────────┬──────────────────────────────────────┘   │   │
│  │                    │                                           │   │
│  │  ┌─────────────────▼──────────────────────────────────────┐   │   │
│  │  │       db/ Package (Driver Abstraction Layer)             │   │   │
│  │  │                                                           │   │   │
│  │  │  DatabaseDriver interface (db.go:42-53)                   │   │   │
│  │  │  ├─ PostgreSQLDriver (postgresql.go) ── lib/pq           │   │   │
│  │  │  ├─ MySQLDriver (mysql.go) ── go-sql-driver/mysql        │   │   │
│  │  │  ├─ SQLiteDriver (sqlite.go) ── go-sqlite3 (CGO)        │   │   │
│  │  │  └─ RedisDriver (redis.go) ── go-redis/v9               │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌── Feature Modules ──────────────────────────────────────┐   │   │
│  │  │  connection.go │ query.go │ query_timeout.go │ schema.go │   │   │
│  │  │  data_editor.go │ data_export.go │ data_compare.go        │   │   │
│  │  │  transaction.go │ redis_api.go │ autocomplete.go          │   │   │
│  │  │  query_analyzer.go │ sql_formatter.go │ test.go           │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌── Cross-Cutting ────────────────────────────────────────┐   │   │
│  │  │  crypto.go (AES-256-GCM) │ audit.go (singleton logger)   │   │   │
│  │  │  i18n.go (zh/en) │ config.go │ window.go │ filedialog.go │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌── External Services ──────────────────────────────────────────┐   │
│  │  PostgreSQL / MySQL / SQLite / Redis / PolarDB / GaussDB       │   │
│  │  (User-provided database servers, DB Client is client-side)    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌── Local Storage ──────────────────────────────────────────────┐   │
│  │  ~/.db-client/connections.json (0600) │ ~/.db-client/.key (0600) │
│  │  ~/.db-client/logs/audit_YYYY-MM-DD.log │ ~/.db-client/exports/ │
│  │  ~/.db-client/config.json (language)                           │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Module Breakdown / 后端模块详解

### 2.1 Entry Point: main.go (L1-51)

**职责**: Wails 桌面应用启动配置

**关键配置**:
- Window: 1280×800 (min 800×600), Frameless (自定义标题栏)
- Assets: `//go:embed all:frontend/dist` 编译时嵌入前端
- Lifecycle: `OnStartup: app.startup`, `OnShutdown: app.shutdown`
- Bind: `[]interface{}{app}` — 注册 App struct 所有 exported 方法为 Wails bindings

**启动流程**: `NewApp()` → `wails.Run()` → `app.startup(ctx)` → `initEncryptionKey()` + `loadConnections()` + audit log init

---

### 2.2 App Core: app.go (L1-91)

**App struct** (L14-21):
```go
type App struct {
    ctx           context.Context
    driverManager *db.DriverManager
    connections   []Connection
    configPath    string
    pool          *connectionPool
    poolMutex     sync.RWMutex
}
```

**生命周期方法**:
- `startup(ctx)` (L37-45): 初始化加密密钥、加载连接配置、记录启动审计日志
- `shutdown(ctx)` (L48-55): 关闭连接池(`pool.closeAll()`)、保存连接配置、记录关闭日志

**语言管理**:
- `GetLanguage()` (L62-68): 读取 `DB_CLIENT_LANG` env var，默认 "zh"
- `SetLanguage(lang)` (L71-91): 写入 `~/.db-client/config.json`

**已知问题**: `poolMutex` (L20) 与 `pool.mu` (pool.go:18) 构成双重锁体系（详见 Section 7）

---

### 2.3 Connection Pool: pool.go (L1-234)

**核心常量**: `MaxPoolSize = 50` (L14)

**连接池结构**:
```go
type connectionPool struct {
    mu          sync.RWMutex
    connections map[string]*pooledDriver
}

type pooledDriver struct {
    driver    db.DatabaseDriver
    createdAt time.Time
    lastPing  time.Time
}
```

**Key 格式**: `buildKey()` → `"{type}:{host}:{port}:{username}:{database}"` (L89-91)
- 例: `"postgresql:localhost:5432:postgres:mydb"`

**核心方法**:

| 方法 | 行号 | 职责 |
|------|------|------|
| `getOrCreate(key, createFunc)` | L24-74 | 原子性获取或创建连接，double-check locking，Ping 验证 |
| `get(key)` | L93-98 | 读锁查找 |
| `set(key, driver)` | L100-119 | 写锁设置，超 50 时淘汰最旧 |
| `evictOldest()` | L122-151 | 按 createdAt 排序 FIFO 淘汰 |
| `remove(key)` | L153-163 | 关闭并删除指定连接 |
| `closeAll()` | L165-175 | shutdown 时关闭全部连接 |
| `GetHealthy(ctx, key)` | L197-223 | Ping 3s 超时验证后返回 |
| `SetWithHealth(ctx, key, driver)` | L226-234 | Ping 后才 set |
| `pingWithTimeout(ctx, driver)` | L178-193 | 3s 超时 ping |

**淘汰策略**: FIFO (按 `createdAt` 排序，删除最早创建的连接)

---

### 2.4 Connection Management: connection.go (L1-266)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetSupportedDatabases` | L11-20 | `() []map[string]string` | 返回 6 种数据库类型及默认端口 |
| `GetConnections` | L23-25 | `() []Connection` | 返回已保存连接列表 |
| `SaveConnection` | L28-74 | `(conn Connection) error` | 加密密码、保存、审计记录 |
| `DeleteConnection` | L77-96 | `(id string) error` | 删除、审计记录 |
| `TestConnection` | L99-150 | `(config Connection) (bool, string)` | 解密密码→验证→连接→Ping→关闭 |
| `ConnectToDatabase` | L200-259 | `(config Connection) (bool, string)` | 解密→pool.getOrCreate→Ping retry 3x |
| `DisconnectFromDatabase` | L262-265 | `(config Connection) error` | pool.remove(key) |

**辅助方法**:
- `formatError(prefix, err, dbType, lang)` (L153-176): 错误消息+提示建议
- `getDefaultDatabase(dbType)` (L184-197): 默认数据库映射

---

### 2.5 Query Engine: query.go (L1-329)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExecuteQuery` | L10-97 | `(config, database, query) QueryResult` | 单查询执行，pool double-check |
| `ExecuteMultiQuery` | L99-236 | `(config, database, query) MultiQueryResult` | 多查询分号分割执行 |
| `ExecuteNonQuery` | L292-329 | `(config, database, query) (int64, string, error)` | 非查询语句执行 |
| `splitQueries` | L238-289 | `(query string) []string` | 分号分割，处理引号/转义 |

**查询类型判断** (L150-155): SELECT / SHOW / DESCRIBE / EXPLAIN / WITH → `driver.Query()`，其余 → `driver.Exec()`

**NULL 处理**: `nil → "NULL"`, `[]byte → string(b)` (L79-87)

---

### 2.6 Query Timeout: query_timeout.go (L1-343)

**常量**: `DefaultQueryTimeout=30`, `MaxQueryTimeout=300`, `MinQueryTimeout=1`

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExecuteQueryWithTimeout` | L27-152 | `(config, db, query, QueryOptions) QueryResult` | 带超时 context 的查询 |
| `ExecuteMultiQueryWithTimeout` | L155-322 | `(config, db, query, QueryOptions) MultiQueryResult` | 带超时的多查询 |

**超时机制**: `context.WithTimeout(a.ctx, timeoutSeconds*time.Second)`，每行扫描时检查 `ctx.Done()`

---

### 2.7 Schema Inspection: schema.go (L1-585)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetDatabases` | L11-30 | `(config) ([]DatabaseInfo, error)` | 获取数据库列表 |
| `GetTables` | L33-60 | `(config, database) ([]TableInfo, error)` | UseDatabase + GetTables |
| `GetViews` | L63-115 | `(config, database) ([]TableInfo, error)` | 查询视图列表 |
| `GetFunctions` | L118-171 | `(config, database) ([]TableInfo, error)` | 查询存储函数 |
| `GetTableColumns` | L174-192 | `(config, database, table) ([]db.ColumnInfo, error)` | 表结构信息 |
| `GetTableIndexes` | L243-361 | `(config, database, table) ([]IndexInfo, error)` | MySQL/PG 索引查询 |
| `GetTableForeignKeys` | L364-445 | `(config, database, table) ([]ForeignKeyInfo, error)` | 外键查询 |
| `GetTableStats` | L448-515 | `(config, database, table) (TableStats, error)` | 表统计信息 |

**SQL 注入防护**:
- `sanitizeIdentifier(identifier)` (L195-234): 过滤非法字符、路径遍历、长度限制 64
- `escapeStringLiteral(s)` (L237-240): SQL 字符串引号替换

---

### 2.8 Data Editor: data_editor.go (L1-425)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `EditTableData` | L40-154 | `(config, EditRequest) EditResult` | INSERT/UPDATE/DELETE 操作 |
| `GetEditableColumns` | L341-356 | `(config, db, table) ([]db.ColumnInfo, error)` | 排除 AUTO_INCREMENT 列 |
| `BatchEdit` | L359-368 | `(config, []EditRequest) []EditResult` | 批量编辑 |
| `GenerateInsertStatement` | L371-389 | `(table, data) string` | SQL 预览 |
| `GenerateUpdateStatement` | L392-408 | `(table, data, whereClause) string` | SQL 预览 |

**内部方法**: `performInsert` (L177-221), `performUpdate` (L224-290), `performDelete` (L293-338)

**已知问题**: UPDATE/DELETE 的 `req.WhereClause` 直接拼接进 SQL (L255-256, L306-307)，存在 SQL 注入风险

---

### 2.9 Data Export/Import: data_export.go (L1-423)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExportData` | L47-154 | `(config, ExportRequest) ExportResult` | 导出 CSV/JSON/Excel/SQL |
| `ImportData` | L281-373 | `(config, ImportRequest) ImportResult` | 导入 CSV/JSON |

**导出路径**: `~/.db-client/exports/{fileName}.{format}`
**导入路径**: `~/.db-client/imports/{fileName}`

**依赖**: `excelize/v2` 用于 Excel 导出 (L207-234)

---

### 2.10 Data Compare: data_compare.go (L1-401)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `CompareTables` | L73-129 | `(config, CompareRequest) CompareResult` | 表数据对比 |
| `CompareQueries` | L306-341 | `(config, CompareRequest) CompareResult` | 查询结果对比 |
| `GetCompareReport` | L344-368 | `(result) string` | 生成文本对比报告 |
| `ExportCompareResult` | L371-382 | `(result, format) ([]byte, error)` | JSON/CSV/TXT 导出 |

**对比逻辑**: `buildDataMap` → 按键列构建映射 → 遍历比对 → 生成 DifferenceItem 列表

---

### 2.11 Transaction Management: transaction.go (L1-257)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `BeginTransaction` | L70-138 | `(config, database, options) (string, error)` | 开始事务，返回 txID |
| `ExecuteInTransaction` | L140-155 | `(txID, query) (int64, error)` | 事务内执行 SQL |
| `CommitTransaction` | L157-174 | `(txID) error` | 提交事务 |
| `RollbackTransaction` | L176-193 | `(txID) error` | 回滚事务 |
| `ExecuteTransactionBatch` | L195-257 | `(TransactionRequest) TransactionResult` | 批量事务执行 |

**事务存储**: `globalTransactions map[string]*activeTransaction` + `globalTxMutex sync.RWMutex` (L52-54)
**超时**: `TransactionTimeout = 30 * time.Minute` (L41)

**已知问题**: `cleanupStaleTransactions()` (L57-68) 已定义但未自动调用

---

### 2.12 Redis API: redis_api.go (L1-224)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetRedisKeyInfo` | L13-31 | `(config, key) (*db.RedisKeyInfo, error)` | 键详情（类型/TTL/值/编码） |
| `SetRedisKeyValue` | L34-66 | `(config, key, value, ttl) error` | 设置键值+TTL |
| `DeleteRedisKey` | L69-99 | `(config, keys...) error` | 删除键（支持多键） |
| `ExecuteRedisCommand` | L102-134 | `(config, cmd, args...) (interface{}, error)` | 执行任意 Redis 命令 |
| `GetRedisInfo` | L137-155 | `(config, section) (string, error)` | Redis INFO 命令 |
| `GetRedisDBSize` | L158-176 | `(config) (int64, error)` | DBSIZE 命令 |
| `ScanRedisKeys` | L179-197 | `(config, pattern, cursor, count) ([]string, uint64, error)` | SCAN 分页 |

**内部方法**: `getRedisDriver(config)` (L200-224) — pool.getOrCreate + 类型断言为 `*db.RedisDriver`

---

### 2.13 Autocomplete: autocomplete.go (L1-514)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetAutoCompleteSuggestions` | L226-267 | `(config, db, query, position) AutoCompleteResult` | 上下文感知补全 |
| `GetQuickSuggestions` | L504-514 | `(prefix) []AutoCompleteItem` | 关键字+函数补全（无连接） |
| `GetTableColumnsForAutoComplete` | L472-501 | `(config, db, tableName) ([]AutoCompleteItem, error)` | 表列补全 |

**上下文分析**: `analyzeQueryContext(query, position)` → FROM/JOIN→表名补全, SELECT/WHERE→列名+函数补全, USE→数据库补全

**数据源**: `sqlKeywords` (L46-117, 65条), `sqlFunctions` (L120-195, 55条), `mysqlFunctions` (L198-207), `postgresFunctions` (L210-222)

**已知问题**: `getColumnSuggestions()` (L352-359) 返回空数组，列名补全未实现

---

### 2.14 Query Analyzer: query_analyzer.go (L1-766)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetExplainPlan` | L84-172 | `(config, database, query) ExplainResult` | EXPLAIN ANALYZE 执行 |
| `AnalyzeQuery` | L549-587 | `(query) QueryAnalysis` | 静态查询分析（复杂度/类型/推荐） |
| `GetSlowQueries` | L707-711 | `(config, database, threshold) ([]map[string]interface{}, error)` | 未实现，返回空 |
| `GetTableStatistics` | L714-736 | `(config, database, table) (map[string]interface{}, error)` | 表统计+索引使用率 |
| `AnalyzeTableUsage` | L739-766 | `(config, database) ([]map[string]interface{}, error)` | 全表使用情况汇总 |

**EXPLAIN 解析**: MySQL (L227-336) 和 PostgreSQL (L339-491) 分别解析，使用预编译正则 (L25-31)

---

### 2.15 SQL Formatter: sql_formatter.go (L1-473)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `FormatSQL` | L58-61 | `(sql, FormatOptions) string` | 自定义选项格式化 |
| `MinifySQL` | L293-306 | `(sql) string` | 移除注释+空白压缩 |
| `ValidateSQL` | L322-347 | `(sql) (bool, []string)` | 基础语法验证 |
| `BeautifySQL` | L426-428 | `(sql) string` | 默认选项美化 |
| `CompactSQL` | L431-438 | `(sql) string` | 紧凑格式 |
| `GetSQLStructure` | L442-473 | `(sql) map[string]interface{}` | SQL 结构分析 |

**FormatOptions** (L9-16): indentWidth, keywordCase, lineBreakStyle, alignClauses, formatFunctions, maxLineLength

---

### 2.16 Audit Logging: audit.go (L1-322)

**单例模式**: `GetAuditLogger()` + `sync.Once` (L72-92)

**日志级别**: INFO / WARNING / ERROR / CRITICAL (L15-20)
**事件类型**: CONNECT / DISCONNECT / QUERY / QUERY_ERROR / QUERY_TIMEOUT / CONNECTION_SAVE / CONNECTION_DELETE / LOGIN / LOGOUT / SENSITIVE_DATA (L26-37)

**AuditLog struct** (L40-55): ID, Timestamp, Level, EventType, User, Connection, Database, Query, Duration, Success, Message, Details, ClientIP, UserAgent

**内存缓存**: `logs []AuditLog`, `maxLogs = 10000`
**持久化**: 每次 `Log()` → `writeToFile()` → 全量 JSON 序列化 → 临时文件 → rename (L196-214)

**已知问题**: 全量序列化 O(n) 性能问题；`truncateQuery` byte 截断对中文有风险

---

### 2.17 Crypto: crypto.go (L1-116)

**算法**: AES-256-GCM (32字节密钥)
**密钥存储**: `~/.db-client/.key` (0600权限, Base64编码)
**密钥初始化**: `initEncryptionKey()` (L16-51) — 读已有 key 或生成新 key
**加密**: `encryptPassword()` (L53-79) — nonce 随机生成 + Seal + Base64
**解密**: `decryptPassword()` (L81-116) — Base64 decode → nonce 分离 → Open

**已知问题**: `encryptionKey` (L14) 是全局 var，无 sync 保护，存在 race condition

---

### 2.18 Config: config.go (L1-119)

| 方法 | 行号 | 说明 |
|------|------|------|
| `connectionToDBConfig(conn)` | L12-30 | Connection → db.ConnectionConfig 转换（含解密） |
| `getDriverForConfig(dbConfig)` | L34-59 | pool 获取或创建驱动（double-check locking） |
| `loadConnections()` | L61-99 | 读取 connections.json |
| `saveConnections()` | L101-119 | 写入 connections.json (0600权限) |

---

### 2.19 i18n: i18n.go (L1-89)

**Go 侧**: `MessageKey` enum (12条), `messages map[string]map[MessageKey]string` (zh/en)
**方法**: `t(key, lang)` (L69-81), `getCurrentLang()` (L83-89)

**已知问题**: Go 侧大量硬编码中文未走 i18n

---

### 2.20 Window: window.go (L1-29)

| 方法 | 签名 | 说明 |
|------|------|------|
| `WindowMinimize()` | `()` | `runtime.WindowMinimise(a.ctx)` |
| `WindowMaximize()` | `()` | 最大化/还原切换 |
| `WindowClose()` | `()` | `runtime.Quit(a.ctx)` |
| `WindowIsMaximized()` | `() bool` | `runtime.WindowIsMaximised(a.ctx)` |

---

### 2.21 File Dialog: filedialog.go (L1-28)

| 方法 | 签名 | 说明 |
|------|------|------|
| `OpenFileDialog(title, filters)` | `(string, string) string` | 打开文件选择对话框 |
| `SaveFileDialog(title, defaultName)` | `(string, string) string` | 保存文件对话框 |

---

### 2.22 Test: test.go (L1-136)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `RunConnectionTest` | L11-59 | `(config) TestResult` | 单连接测试 |
| `RunAllTests` | L62-71 | `() []TestResult` | 所有已保存连接测试 |
| `GetSupportedFeatures` | L74-83 | `() map[string][]string` | 各数据库支持功能列表 |
| `GetServerInfo` | L86-136 | `(config) map[string]string` | 服务器版本+表数量 |

---

### 2.23 Types: types.go (L1-106)

核心数据结构定义，详见 D03-data-models.md

---

## 3. Frontend Architecture / 前端架构

### 3.1 Structure

```
frontend/dist/
├── index.html          # 主 HTML (870行, DOM结构+模态框)
├── app.js              # 主 JS (3502行, 全局状态+交互逻辑)
├── i18n.js             # 前端翻译 zh/en (321行)
├── styles.css          # CSS (dark/light 主题)
└── lib/monaco-editor/  # Monaco Editor 预构建包
```

### 3.2 Global State (app.js:9-19)

```javascript
const state = {
    currentTheme: 'dark',
    connections: [],
    tabs: [],
    activeTab: null,
    activeConnection: null,
    sidebarWidth: 260,
    editorHeight: 300,
    isResizing: false,
    wailsReady: false
};
```

### 3.3 WailsAPI Bridge (app.js:24-73)

所有 50+ 后端方法通过 `window.go.main.App.*` 调用，封装在 `WailsAPI` 对象中。Mock 模式支持浏览器开发（L104-127 polling 5s）。

### 3.4 Monaco Editor Integration

- 初始化: `initEditor()` → `require(['vs/editor/editor.main'])` → `monaco.editor.create()`
- 降级: Monaco 加载失败时使用 `<textarea>` 作为 `fallbackEditor` (index.html:241)
- 语言切换: `updateEditorTheme(theme)` → vs-dark / vs-light

### 3.5 Frontend Patterns

- **Theme**: localStorage + `data-theme` attribute (app.js:133-163)
- **Tabs**: `createNewTab()` → state.tabs 管理 (app.js:314+)
- **Connection List**: `loadSavedConnections()` → WailsAPI.getConnections() → DOM 渲染 (app.js:1131+)
- **Database Tree**: `loadDatabaseTree()` → 递归展开数据库/表/视图 (app.js:1407+)
- **Results Panel**: 三视图切换 (messages / summary / results) (app.js:2915+)
- **Data View**: Navicat 风格表格 + 分页 + 过滤 + 排序 (app.js:1640+)

---

## 4. Database Driver Layer / 数据库驱动层

### 4.1 Interface: db/db.go (L1-92)

**DatabaseDriver interface** (L42-53):
```go
type DatabaseDriver interface {
    Connect(config ConnectionConfig) error
    Close() error
    Ping(ctx context.Context) error
    UseDatabase(ctx context.Context, database string) error
    Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
    Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
    GetTables(ctx context.Context) ([]string, error)
    GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error)
    GetDatabases(ctx context.Context) ([]string, error)
    BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
}
```

**DBType enum** (L10-19): PostgreSQL / PolarDB / GaussDB / MySQL / Redis / SQLite

**DriverManager.Connect()** (L81-92): `newDriver()` → `driver.Connect(config)` — 每次创建新实例

### 4.2 PostgreSQL Driver: db/postgresql.go (L1-193)

- 连接字符串: `host=%s port=%d user=%s password=%s dbname=%s sslmode=%s`
- `UseDatabase()`: 关闭旧连接 → 新建连接到目标库（PG 无 USE 命令）
- PolarDB/GaussDB 共享此驱动 (`newDriver()` switch L67-68)

### 4.3 MySQL Driver: db/mysql.go (L1-140)

- 连接字符串: `%s:%s@tcp(%s:%d)/%s`
- `UseDatabase()`: `USE {database}` 命令
- 无 SSL 配置支持（连接字符串未包含 ssl 参数）

### 4.4 SQLite Driver: db/sqlite.go (L1-129)

- 连接: `sql.Open("sqlite3", dbPath)`
- `UseDatabase()`: 空操作（单文件数据库）
- **CGO 依赖**: `go-sqlite3` 需要 C 编译器

### 4.5 Redis Driver: db/redis.go (L1-272)

- **非 SQL 驱动**: `Query()`/`Exec()`/`BeginTx()` 返回 `ErrRedisUnsupportedOperation`
- 连接: `redis.NewClient()` → DB 编号从 "db0-15" 解析
- `GetTables()` → SCAN 获取键列表（MaxRedisKeys=10000）
- `GetDatabases()` → 返回 db0-db15 (16个 Redis 数据库)
- 专用方法: GetRedisKeyInfo, SetRedisKeyValue, DeleteRedisKey, ExecuteRedisCommand, GetRedisInfo, GetRedisDBSize, ScanRedisKeys

---

## 5. Connection Pool Architecture / 连接池架构

### 5.1 Design

```
┌──────────────────────────────────────────────────┐
│              connectionPool                        │
│                                                    │
│  mu: sync.RWMutex                                 │
│  connections: map[string]*pooledDriver             │
│                                                    │
│  ┌──────────────────────────────────────┐         │
│  │ pooledDriver                          │         │
│  │ ├─ driver: db.DatabaseDriver          │         │
│  │ ├─ createdAt: time.Time              │         │
│  │ └─ lastPing: time.Time               │         │
│  └──────────────────────────────────────┘         │
│                                                    │
│  MaxPoolSize: 50                                  │
│  Key: "{type}:{host}:{port}:{user}:{database}"    │
│  Eviction: FIFO by createdAt                      │
│  Health: Ping 3s timeout                          │
└──────────────────────────────────────────────────┘
```

### 5.2 Dual Locking Problem

存在两套锁机制:

1. **pool.mu** (pool.go:18): pool 内部 RWMutex，`getOrCreate()` 使用
2. **App.poolMutex** (app.go:20): App 层级 RWMutex，`query.go`/`data_editor.go`/`transaction.go` 使用

不同代码路径使用不同锁策略:

| 路径 | 使用锁 | 代码位置 |
|------|--------|----------|
| `ConnectToDatabase()` | 仅 pool.mu (通过 `getOrCreate`) | connection.go:229 |
| `redis_api.go` | 仅 pool.mu (通过 `getOrCreate`) | redis_api.go:210 |
| `ExecuteQuery()` | App.poolMutex + pool.get/set | query.go:24-43 |
| `ExecuteMultiQuery()` | App.poolMutex + pool.get/set | query.go:113-129 |
| `EditTableData()` | App.poolMutex + pool.get/set | data_editor.go:66-99 |
| `BeginTransaction()` | App.poolMutex + pool.get/set | transaction.go:82-97 |
| `GetExplainPlan()` | App.poolMutex + pool.get/set | query_analyzer.go:110-130 |
| `getDriverForConfig()` | App.poolMutex + pool.get/set | config.go:34-59 |

**风险**: 两条路径同时操作可能产生死锁或数据不一致

---

## 6. Dependency Flow / 依赖与数据流

### 6.1 Module Dependencies

```
main.go → app.go → {db/, pool, crypto, audit, config}
                         ↓
connection.go ← {pool, db, crypto, audit, i18n}
query.go ← {pool, db, crypto}
query_timeout.go ← {pool, db, crypto}
schema.go ← {db, pool, config, crypto}
data_editor.go ← {pool, db, crypto, audit, schema}
data_export.go ← {pool, query, excelize, audit}
data_compare.go ← {pool, query, audit}
transaction.go ← {pool, db, crypto}
redis_api.go ← {pool, db, crypto, audit}
autocomplete.go ← {schema, db}
query_analyzer.go ← {pool, db, crypto, audit}
sql_formatter.go ← 无外部依赖
audit.go ← 无外部依赖
crypto.go ← stdlib crypto/aes, crypto/cipher
i18n.go ← 无外部依赖
config.go ← {db, pool, crypto}
window.go ← wails runtime
filedialog.go ← wails runtime
test.go ← {db, crypto, i18n}
```

### 6.2 External Dependencies (go.mod)

| 包 | 版本 | 用途 |
|----|------|------|
| `github.com/wailsapp/wails/v2` | 2.12.0 | 桌面框架 |
| `github.com/lib/pq` | 1.10.9 | PostgreSQL/PolarDB/GaussDB 驱动 |
| `github.com/go-sql-driver/mysql` | 1.8.1 | MySQL 驱动 |
| `github.com/mattn/go-sqlite3` | 1.14.24 | SQLite 驱动 (CGO) |
| `github.com/redis/go-redis/v9` | 9.7.0 | Redis 客户端 |
| `github.com/xuri/excelize/v2` | 2.10.1 | Excel 导出 |

---

## 7. Known Architectural Issues / 已知架构问题

### P0 — Critical (Stability/Security)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | **encryptionKey race condition** | `crypto.go:14` | Multi-goroutine init may corrupt key | Use `sync.Once` |
| 2 | **Dual locking inconsistency** | `App.poolMutex` vs `pool.mu` | Deadlock risk, inconsistent locking | Unify to `pool.getOrCreate()` |
| 3 | **WhereClause SQL injection** | `data_editor.go:255-256,306-307` | Raw `req.WhereClause` concatenated into SQL | Use parameterized queries or sanitize |

### P1 — High (Performance/Maintainability)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 4 | **Audit log full serialization** | `audit.go:196-214` | O(n) per log entry | Append-only JSON lines |
| 5 | **Repeated password decryption** | Every method | Code redundancy | Centralize in `connectionToDBConfig()` |
| 6 | **6 duplicate pool double-check blocks** | query/editor/transaction/analyzer | ~120 lines redundant code | Use `pool.getOrCreate()` |
| 7 | **Stale transactions not cleaned** | `transaction.go:57-68` | `globalTransactions` unbounded growth | Auto-cleanup goroutine |
| 8 | **Identifier quotes inconsistent** | `data_editor.go` uses backticks for all | PG syntax error with backticks | Dynamic quote selection by db type |

### P2 — Medium (Completeness/Quality)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 9 | **getColumnSuggestions returns empty** | `autocomplete.go:352-359` | Column completion never works | Implement FROM clause parsing |
| 10 | **i18n incomplete** | Go side hardcoded Chinese | SetLanguage(en) won't change messages | Add all Go messages to i18n map |
| 11 | **GetSlowQueries stub** | `query_analyzer.go:707-711` | Always returns empty | Implement pg_stat_statements/slow_query_log |
| 12 | **Frontend XSS risk** | 57 `innerHTML`/`insertAdjacentHTML` calls | Unsanitized data injection | Use textContent or sanitize |

### P3 — Low (Improvement)

| # | Issue | Suggestion |
|---|-------|------------|
| 13 | All code in `package main` | Split to `internal/pool`, `internal/crypto`, etc |
| 14 | Connection vs ConnectionConfig duplication | Unify or add explicit conversion layer |
| 15 | `go.mod` module name `db-server` | Use `github.com/user/db-client` style |
| 16 | `truncateQuery` byte truncation | Use rune-level truncation for UTF-8 |
| 17 | Frontend 3502-line single JS file | Introduce Vite + TypeScript |