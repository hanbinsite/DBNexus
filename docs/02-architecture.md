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
│  │         │  (app.js:24-73)     │  69 methods from App.d.ts      │   │
│  │         └──────────┬──────────┘                                │   │
│  └─────────────────────┼──────────────────────────────────────────┘   │
│                        │ IPC (Wails Bindings)                       │
│                        │ JSON serialization / Promise-based         │
│  ┌─────────────────────┼──────────────────────────────────────────┐   │
│  │              Backend Layer (Go, package main)                   │   │
│  │                    │                                           │   │
│  │  ┌─────────────────▼────────────────────┐                      │   │
│  │  │  App struct                 │                      │   │
│  │  │  (app.go:13)                          │                      │   │
│  │  │  Fields: ctx, driverManager,          │                      │   │
│  │  │          connections, configPath,     │                      │   │
│  │  │          pool, poolMutex              │                      │   │
│  │  └─────────────────┬────────────────────┘                      │   │
│  │                    │                                           │   │
│  │  ┌─────────────────▼──────────────────────────────────────┐   │   │
│  │  │            Connection Pool (pool.go)                     │   │   │
│  │  │  sync.RWMutex + map[string]*pooledDriver                 │   │   │
│  │  │  MaxPoolSize=50, key="{type}:{host}:{port}:{username}:{database}" │   │   │
│  │  │  getOrCreate: double-check locking (L32)               │   │   │
│  │  │  eviction: FIFO by createdAt (L83)                     │   │   │
│  │  │  health: Ping 3s timeout (L135)                        │   │   │
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

### 2.2 App Core: app.go (L1-107)

**App struct** (L13):
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
- `startup(ctx)` (L33): 初始化加密密钥、加载连接配置、记录启动审计日志
- `shutdown(ctx)` (L41): 关闭连接池(`pool.closeAll()`)、保存连接配置、记录关闭日志

**语言管理**:
- `GetLanguage()` (L48): 读取 `DB_CLIENT_LANG` env var，默认 "zh"
- `SetLanguage(lang)` (L69): 写入 `~/.db-client/config.json`

**已知问题**: `poolMutex` (app.go:19) 与 `pool.mu` (pool.go:16) 构成双重锁体系（详见 Section 7）

---

### 2.3 Connection Pool: pool.go (L1-166)

**核心常量**: `MaxPoolSize = 50` (L13)

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

**Key 格式**: `buildKey()` → `"{type}:{host}:{port}:{username}:{database}"` (L79)
- 例: `"postgresql:localhost:5432:postgres:mydb"`

**核心方法**:

| 方法 | 行号 | 职责 |
|------|------|------|
| `getOrCreate(key, createFunc)` | L32 | 原子性获取或创建连接，double-check locking，Ping 验证 |
| `buildKey(config)` | L79 | 构建 pool key |
| `evictOldest()` | L83 | 按 createdAt 排序 FIFO 淘汰 |
| `remove(key)` | L111 | 关闭并删除指定连接 |
| `closeAll()` | L123 | shutdown 时关闭全部连接 |
| `GetHealthy(ctx, key)` | L135 | Ping 3s 超时验证后返回 |

**淘汰策略**: FIFO (按 `createdAt` 排序，删除最早创建的连接)

---

### 2.4 Connection Management: connection.go (L1-265)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetSupportedDatabases` | L11 | `() []map[string]string` | 返回 6 种数据库类型及默认端口 |
| `GetConnections` | L22 | `() []Connection` | 返回已保存连接列表 |
| `SaveConnection` | L31 | `(conn Connection) error` | 加密密码、保存、审计记录 |
| `DeleteConnection` | L73 | `(id string) error` | 删除、审计记录 |
| `TestConnection` | L90 | `(config Connection) (bool, string)` | 解密密码→验证→连接→Ping→关闭 |
| `ConnectToDatabase` | L178 | `(config Connection) (bool, string)` | 解密→pool.getOrCreate→Ping retry 3x |
| `DisconnectFromDatabase` | L233 | `(config Connection) error` | pool.remove(key) |

**辅助方法**:
- `formatError(prefix, err, dbType, lang)` (L141): 错误消息+提示建议
- `getDefaultDatabase(dbType)` (L163): 默认数据库映射

---

### 2.5 Query Engine: query.go (L1-86)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExecuteQuery` | L10 | `(config, database, query) QueryResult` | 委托 ExecuteQueryWithTimeout |
| `ExecuteMultiQuery` | L14 | `(config, database, query) MultiQueryResult` | 委托 ExecuteMultiQueryWithTimeout |
| `ExecuteNonQuery` | L70 | `(config, database, query) (int64, string, error)` | 非查询语句执行 |
| `splitQueries` | L18 | `(query string) []string` | 分号分割，处理引号/转义 |

**查询类型判断** (query_timeout.go L177): SELECT / SHOW / DESCRIBE / EXPLAIN / WITH → `driver.Query()`，其余 → `driver.Exec()`

**NULL 处理**: `nil → "NULL"`, `[]byte → string(b)` (query_timeout.go L102-103, L104)

---

### 2.6 Query Timeout: query_timeout.go (L1-280)

**常量**: `DefaultQueryTimeout=30`, `MaxQueryTimeout=300`, `MinQueryTimeout=1`

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExecuteQueryWithTimeout` | L21 | `(config, db, query, QueryOptions) QueryResult` | 带超时 context 的查询 |
| `ExecuteMultiQueryWithTimeout` | L121 | `(config, db, query, QueryOptions) MultiQueryResult` | 带超时的多查询 |

**超时机制**: `context.WithTimeout(a.ctx, timeoutSeconds*time.Second)`，每行扫描时检查 `ctx.Done()`

---

### 2.7 Schema Inspection: schema.go (L1-555)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetDatabases` | L12 | `(config) ([]DatabaseInfo, error)` | 获取数据库列表 |
| `GetTables` | L33 | `(config, database) ([]TableInfo, error)` | UseDatabase + GetTables |
| `GetViews` | L59 | `(config, database) ([]TableInfo, error)` | 查询视图列表 |
| `GetFunctions` | L113 | `(config, database) ([]TableInfo, error)` | 查询存储函数 |
| `GetTableColumns` | L168 | `(config, database, table) ([]db.ColumnInfo, error)` | 表结构信息 |
| `GetTableIndexes` | L220 | `(config, database, table) ([]IndexInfo, error)` | MySQL/PG 索引查询 |
| `GetTableForeignKeys` | L337 | `(config, database, table) ([]ForeignKeyInfo, error)` | 外键查询 |
| `GetTableStats` | L420 | `(config, database, table) (TableStats, error)` | 表统计信息 |

**SQL 注入防护**:
- `sanitizeIdentifier(identifier)` (L180): 过滤非法字符、路径遍历、长度限制 64
- `escapeStringLiteral(s)` (L216): SQL 字符串引号替换

---

### 2.8 Data Editor: data_editor.go (L1-350)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `EditTableData` | L18 | `(config, EditRequest) EditResult` | INSERT/UPDATE/DELETE 操作 |
| `GetEditableColumns` | L261 | `(config, db, table) ([]db.ColumnInfo, error)` | 排除 AUTO_INCREMENT 列 |
| `BatchEdit` | L278 | `(config, []EditRequest) []EditResult` | 批量编辑 |
| `GenerateInsertStatement` | L289 | `(table, data) string` | SQL 预览 |
| `GenerateUpdateStatement` | L309 | `(table, data, primaryKey) string` | SQL 预览 |

**内部方法**: `validateEditRequest` (L89), `performInsert` (L108), `performUpdate` (L151), `performDelete` (L216)

**已知问题**: 无 — WhereClause SQL 注入已修复，EditRequest 现使用 PrimaryKey 字段 (types.go:91) 参数化 WHERE 条件

---

### 2.9 Data Export/Import: data_export.go (L1-394)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `ExportData` | L43 | `(config, ExportRequest) ExportResult` | 导出 CSV/JSON/Excel/SQL |
| `ImportData` | L259 | `(config, ImportRequest) ImportResult` | 导入 CSV/JSON |

**导出路径**: `~/.db-client/exports/{fileName}.{format}`
**导入路径**: `~/.db-client/imports/{fileName}`

**依赖**: `excelize/v2` 用于 Excel 导出 (L192)

---

### 2.10 Data Compare: data_compare.go (L1-360)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `CompareTables` | L66 | `(config, CompareRequest) CompareResult` | 表数据对比 |
| `CompareQueries` | L273 | `(config, CompareRequest) CompareResult` | 查询结果对比 |
| `GetCompareReport` | L307 | `(result) string` | 生成文本对比报告 |
| `ExportCompareResult` | L333 | `(result, format) ([]byte, error)` | JSON/CSV/TXT 导出 |

**对比逻辑**: `buildDataMap` → 按键列构建映射 → 遍历比对 → 生成 DifferenceItem 列表

---

### 2.11 Transaction Management: transaction.go (L1-249)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `BeginTransaction` | L82 | `(config, database, options) (string, error)` | 开始事务，返回 txID |
| `ExecuteInTransaction` | L132 | `(txID, query) (int64, error)` | 事务内执行 SQL |
| `CommitTransaction` | L149 | `(txID) error` | 提交事务 |
| `RollbackTransaction` | L168 | `(txID) error` | 回滚事务 |
| `ExecuteTransactionBatch` | L187 | `(TransactionRequest) TransactionResult` | 批量事务执行 |

**事务存储**: `globalTransactions map[string]*activeTransaction` + `globalTxMutex sync.RWMutex` (L51)
**超时**: `TransactionTimeout = 30 * time.Minute` (L41)

**已知问题**: `cleanupStaleTransactions()` (L69) 已定义但未自动调用

---

### 2.12 Redis API: redis_api.go (L1-136)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetRedisKeyInfo` | L10 | `(config, key) (*db.RedisKeyInfo, error)` | 键详情（类型/TTL/值/编码） |
| `SetRedisKeyValue` | L20 | `(config, key, value, ttl) error` | 设置键值+TTL |
| `DeleteRedisKey` | L43 | `(config, keys...) error` | 删除键（支持多键） |
| `ExecuteRedisCommand` | L64 | `(config, cmd, args...) (interface{}, error)` | 执行任意 Redis 命令 |
| `GetRedisInfo` | L87 | `(config, section) (string, error)` | Redis INFO 命令 |
| `GetRedisDBSize` | L97 | `(config) (int64, error)` | DBSIZE 命令 |
| `ScanRedisKeys` | L107 | `(config, pattern, cursor, count) ([]string, uint64, error)` | SCAN 分页 |

**内部方法**: `getRedisDriver(config)` (L117) — getDriverForConfig + 类型断言为 `*db.RedisDriver`

---

### 2.13 Autocomplete: autocomplete.go (L1-459)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetAutoCompleteSuggestions` | L210 | `(config, db, query, position) AutoCompleteResult` | 上下文感知补全 |
| `GetQuickSuggestions` | L398 | `(prefix) []AutoCompleteItem` | 关键字+函数补全（无连接） |
| `GetTableColumnsForAutoComplete` | L422 | `(config, db, tableName) ([]AutoCompleteItem, error)` | 表列补全 |

**上下文分析**: `analyzeQueryContext(query, position)` → FROM/JOIN→表名补全, SELECT/WHERE→列名+函数补全, USE→数据库补全

**数据源**: `sqlKeywords` (L41, 65条), `sqlFunctions` (L114, 55条), `mysqlFunctions` (L184), `postgresFunctions` (L195)

**已知问题**: `getColumnSuggestions()` (L317) 返回空数组，列名补全未实现

---

### 2.14 Query Analyzer: query_analyzer.go (L1-565)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `GetExplainPlan` | L79 | `(config, database, query) ExplainResult` | EXPLAIN ANALYZE 执行 |
| `AnalyzeQuery` | L158 | `(query) QueryAnalysis` | 静态查询分析（复杂度/类型/推荐） |
| `GetSlowQueries` | L300 | `(config, database, threshold) ([]map[string]interface{}, error)` | 未实现，返回空 |
| `GetTableStatistics` | L304 | `(config, database, table) (map[string]interface{}, error)` | 表统计+索引使用率 |
| `AnalyzeTableUsage` | L327 | `(config, database) ([]map[string]interface{}, error)` | 全表使用情况汇总 |

**EXPLAIN 解析**: MySQL (L358) 和 PostgreSQL (L462) 分别解析，使用预编译正则 (L23)

---

### 2.15 SQL Formatter: sql_formatter.go (L1-473)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `FormatSQL` | L58-60 | `(sql, FormatOptions) string` | 自定义选项格式化 |
| `MinifySQL` | L293-305 | `(sql) string` | 移除注释+空白压缩 |
| `ValidateSQL` | L322-347 | `(sql) (bool, []string)` | 基础语法验证 |
| `BeautifySQL` | L426-428 | `(sql) string` | 默认选项美化 |
| `CompactSQL` | L431-438 | `(sql) string` | 紧凑格式 |
| `GetSQLStructure` | L442-398 | `(sql) map[string]interface{}` | SQL 结构分析 |

**FormatOptions** (L9-16): indentWidth, keywordCase, lineBreakStyle, alignClauses, formatFunctions, maxLineLength

---

### 2.16 Audit Logging: audit.go (L1-304)

**单例模式**: `GetAuditLogger()` + `sync.Once` (L69-87)

**日志级别**: INFO / WARNING / ERROR / CRITICAL (L14-21)
**事件类型**: CONNECT / DISCONNECT / QUERY / QUERY_ERROR / QUERY_TIMEOUT / CONNECTION_SAVE / CONNECTION_DELETE / LOGIN / LOGOUT / SENSITIVE_DATA (L25-37)

**AuditLog struct** (L39-54): ID, Timestamp, Level, EventType, User, Connection, Database, Query, Duration, Success, Message, Details, ClientIP, UserAgent

**内存缓存**: `logs []AuditLog`, `maxLogs = 10000`
**持久化**: 每次 `Log()` → `appendToFile()` → 单条 JSON 序列化 → append 写入 (L189-206)

**已知问题**: 全量序列化 O(n) 性能问题；`truncateQuery` byte 截断对中文有风险（已修复为 rune 级截断 L280-286）

---

### 2.17 Crypto: crypto.go (L1-119)

**算法**: AES-256-GCM (32字节密钥)
**密钥存储**: `~/.db-client/.key` (0600权限, Base64编码)
**密钥初始化**: `initEncryptionKey()` (L21-54) — 读已有 key 或生成新 key
**加密**: `encryptPassword()` (L56-82) — nonce 随机生成 + Seal + Base64
**解密**: `decryptPassword()` (L84-119) — Base64 decode → nonce 分离 → Open

**已知问题**: `encryptionKey` (L16) 是全局 var，有 `sync.Once` 保护 (L17)，但初始化错误通过 `encryptionErr` (L18) 传播

---

### 2.18 Config: config.go (L1-87)

| 方法 | 行号 | 说明 |
|------|------|------|
| `connectionToDBConfig(conn)` | L12-30 | Connection → db.ConnectionConfig 转换（含解密） |
| `getDriverForConfig(dbConfig)` | L32-42 | pool 获取或创建驱动（使用 pool.getOrCreate） |
| `loadConnections()` | L44-69 | 读取 connections.json |
| `saveConnections()` | L71-87 | 写入 connections.json (0600权限) |

---

### 2.19 i18n: i18n.go (L1-81)

**Go 侧**: `MessageKey` enum (19条), `messages map[string]map[MessageKey]string` (zh/en)
**方法**: `t(key, lang)` (L69-81), `getCurrentLang()` ~ `GetLanguage()` (app.go:48)

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

### 2.22 Test: test.go (L1-121)

| 方法 | 行号 | 签名 | 说明 |
|------|------|------|------|
| `RunConnectionTest` | L11-59 | `(config) TestResult` | 单连接测试 |
| `RunAllTests` | L62-71 | `() []TestResult` | 所有已保存连接测试 |
| `GetSupportedFeatures` | L74-83 | `() map[string][]string` | 各数据库支持功能列表 |
| `GetServerInfo` | L86-103 | `(config) map[string]string` | 服务器版本+表数量 |

---

### 2.23 Types: types.go (L1-114)

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

所有 69 后端方法通过 `window.go.main.App.*` 调用，封装在 `WailsAPI` 对象中。Mock 模式支持浏览器开发（L104-127 polling 5s）。

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

### 4.3 MySQL Driver: db/mysql.go (L1-141)

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

1. **pool.mu** (pool.go:16): pool 内部 RWMutex，`getOrCreate()` 使用
2. **App.poolMutex** (app.go:19): App 层级 RWMutex，`query.go`/`data_editor.go`/`transaction.go` 使用

不同代码路径使用不同锁策略:

| 路径 | 使用锁 | 代码位置 |
|------|--------|----------|
| `ConnectToDatabase()` | 仅 pool.mu (通过 `getOrCreate`) | connection.go:203 |
| `redis_api.go` | 仅 pool.mu (通过 `getDriverForConfig`) | redis_api.go:125 |
| `ExecuteQuery()` | App.poolMutex + pool.get/set | query.go:10-12 |
| `ExecuteMultiQuery()` | App.poolMutex + pool.get/set | query.go:14-16 |
| `EditTableData()` | App.poolMutex + pool.get/set | data_editor.go:32 |
| `BeginTransaction()` | App.poolMutex + pool.get/set | transaction.go:88 |
| `GetExplainPlan()` | App.poolMutex + pool.get/set | query_analyzer.go:95 |
| `getDriverForConfig()` | App.poolMutex + pool.get/set | config.go:32-42 |

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
| 1 | **encryptionKey race condition** | `crypto.go:16` | Multi-goroutine init may corrupt key | Use `sync.Once`（已修复，L17 `encryptionOnce`） |
| 2 | **Dual locking inconsistency** | `App.poolMutex` vs `pool.mu` | Deadlock risk, inconsistent locking | Unify to `pool.getOrCreate()` |
| 3 | **WhereClause SQL injection (已修复)** | `data_editor.go:159,180,217,228` | Raw WhereClause 已被 PrimaryKey 字段替代 | EditRequest 现使用 PrimaryKey (types.go:91) 参数化 WHERE 条件 |

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
| 11 | **GetSlowQueries stub** | `query_analyzer.go:300-302` | Always returns empty | Implement pg_stat_statements/slow_query_log |
| 12 | **Frontend XSS risk** | 57 `innerHTML`/`insertAdjacentHTML` calls | Unsanitized data injection | Use textContent or sanitize |

### P3 — Low (Improvement)

| # | Issue | Suggestion |
|---|-------|------------|
| 13 | All code in `package main` | Split to `internal/pool`, `internal/crypto`, etc |
| 14 | Connection vs ConnectionConfig duplication | Unify or add explicit conversion layer |
| 15 | `go.mod` module name `db-server` | Use `github.com/user/db-client` style |
| 16 | `truncateQuery` byte truncation | Use rune-level truncation for UTF-8 |
| 17 | Frontend 3502-line single JS file | Introduce Vite + TypeScript |