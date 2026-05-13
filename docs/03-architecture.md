# D03 - 架构设计文档

> 文档版本: v2.0 | 最后更新: 2026-05-12 | 已验证行数

---

## 1. 目录树

```
db-server/                                 # Go module: db-server
├── main.go                                 # 入口点，Wails v2 配置（L1-51）
├── app.go                                  # App 结构体，生命周期管理（L1-107）
├── types.go                                # 共享数据结构定义（L1-114）
│
├── db/                                     # 数据库驱动抽象层（Go package: db）
│   ├── db.go                               # DatabaseDriver 接口 + DriverManager + DBType 枚举（L1-92）
│   ├── types.go                            # db 包内类型：TableInfo, ViewInfo, FunctionInfo（L1-24）
│   ├── postgresql.go                       # PostgreSQL/PolarDB/GaussDB 驱动实现（L1-193）
│   ├── mysql.go                            # MySQL 驱动实现（L1-141）
│   ├── sqlite.go                           # SQLite 驱动实现（L1-129）
│   └── redis.go                            # Redis 驱动 + 专用 API（L1-272）
│
├── pool.go                                 # 连接池实现，max 50，double-check locking（L1-166）
├── connection.go                           # 连接 CRUD + TestConnection + ConnectToDatabase（L1-265）
├── query.go                                # ExecuteQuery / ExecuteMultiQuery / splitQueries（L1-86）
├── query_timeout.go                        # 带超时查询执行，Default=30s, Max=300s（L1-280）
├── schema.go                               # Schema 检查：表/视图/函数/索引/外键/统计（L1-555）
├── data_editor.go                          # 表数据编辑：INSERT/UPDATE/DELETE（L1-350）
├── data_export.go                          # 数据导入/导出：CSV/JSON/Excel/SQL（L1-394）
├── data_compare.go                         # 表/查询数据对比（L1-360）
├── transaction.go                          # 事务管理 + 批量执行（L1-249）
├── redis_api.go                            # Redis 专用 API 端点（L1-136）
├── autocomplete.go                         # SQL 自动补全建议（L1-459）
├── query_analyzer.go                       # EXPLAIN 计划 + 查询分析 + 复杂度评估（L1-565）
├── sql_formatter.go                        # SQL 格式化/压缩/验证（L1-473）
├── audit.go                                # AuditLogger 单例，日志持久化（L1-304）
├── crypto.go                               # AES-256-GCM 加密/解密密码（L1-119）
├── i18n.go                                 # 国际化消息映射 zh/en（L1-81）
├── config.go                               # 配置加载/保存 + getDriverForConfig（L1-87）
├── window.go                               # Wails 窗口控制：最小化/最大化/关闭（L1-29）
├── filedialog.go                           # 文件对话框：打开/保存（L1-28）
├── test.go                                 # 连接测试 + 服务器信息（L1-121）
├── app_test.go                             # 应用测试（L1-479）
│
├── frontend/                               # 前端资源
│   ├── dist/                               # 编译后的前端
│   │   ├── index.html                      # 主 HTML（toolbar/sidebar/workspace/modal）
│   │   ├── app.js                          # 主 JS（state/WailsAPI/连接管理/查询执行/数据视图）
│   │   ├── i18n.js                         # 前端翻译 zh/en（317行）
│   │   ├── styles.css                      # CSS（dark/light 主题，Navicat 风格数据网格）
│   │   └── lib/monaco-editor/              # Monaco Editor 预构建包
│   └── wailsjs/                            # Wails 自动生成的 JS 绑定
│       ├── go/main/App.js                  # JS 调用代理
│       ├── go/main/App.d.ts                # 69 API 类型声明（L1-142）
│       ├── go/models.ts                    # 共享模型类型声明
│       └── runtime/runtime.js              # Wails runtime API
│
├── go.mod                                  # Go 1.24, 6个直接依赖
├── go.sum
├── wails.json                              # Wails 项目配置
├── build.bat                               # Windows 构建脚本
├── build.sh                                # Linux/Mac 构建脚本
└── CLAUDE.md                               # AI 开发指引
```

---

## 2. 模块边界图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (JavaScript)                         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  index.html │  │   app.js     │  │ i18n.js  │  │ styles.css   │ │
│  │  (DOM 结构) │  │ (状态+交互)  │  │ (翻译)   │  │ (主题+布局)  │ │
│  └─────┬──────┘  └──────┬───────┘  └────┬─────┘  └──────┬───────┘ │
│        │                │                │               │          │
│        └────────────────┼────────────────┼───────────────┘          │
│                         │                                           │
│              ┌──────────▼──────────┐                                │
│              │    WailsAPI Bridge   │  window.go.main.App.*         │
│              │  (app.js:24-73)      │  ← App.d.ts 定义的 69 API   │
│              └──────────┬──────────┘                                │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ IPC (Wails Bindings)
                          │ Go struct 方法 → JS Promise
                          │ 类型自动映射 (JSON serialization)
┌─────────────────────────┼───────────────────────────────────────────┐
│                  Backend (Go, package main)                          │
│                         │                                           │
│  ┌──────────────────────▼──────────────────────┐                    │
│  │               App struct                      │                    │
│  │  (app.go:13-19)                               │                    │
│  │  ┌─────────┬──────────┬──────────┬─────────┐ │                    │
│  │  │ ctx     │ driverMgr│ pool     │ conns   │ │                    │
│  │  │ Context │ *DrvMgr  │ *Pool    │ []Conn  │ │                    │
│  │  └─────────┴──────────┴──────────┴─────────┘ │                    │
│  └──────────┬───────┬──────────┬────────────────┘                    │
│             │       │          │                                      │
│  ┌──────────▼──┐ ┌──▼──────┐ ┌▼───────────────┐                     │
│  │ Connection  │ │ Query   │ │ Schema         │                     │
│  │ Management  │ │ Engine  │ │ Inspection     │                     │
│  │ (conn.go)   │ │(query.go│ │ (schema.go)    │                     │
│  │             │ │+timeout)│ │                │                     │
│  └──────┬──────┘ └──┬──────┘ └──┬─────────────┘                     │
│         │           │          │                                     │
│  ┌──────▼───────────▼──────────▼──────────────────────────┐         │
│  │               Connection Pool (pool.go)                  │         │
│  │  sync.RWMutex | map[string]*pooledDriver | MaxPool=50  │         │
│  │  buildKey: "{type}:{host}:{port}:{username}:{database}"          │         │
│  │  getOrCreate: double-check locking (L32-77)             │         │
│  │  eviction: 按 createdAt 排序淘汰最旧 (L83-109)          │         │
│  └──────────────────────┬─────────────────────────────────┘         │
│                         │                                             │
│  ┌──────────────────────▼─────────────────────────────────┐         │
│  │               db/ Package (Driver Abstraction Layer)     │         │
│  │                                                          │         │
│  │  ┌─────────────────────────────────────────────────┐    │         │
│  │  │  DatabaseDriver interface (db.go:42-53)          │    │         │
│  │  │  Connect | Close | Ping | UseDatabase            │    │         │
│  │  │  Query | Exec | GetTables | GetTableStructure    │    │         │
│  │  │  GetDatabases | BeginTx                          │    │         │
│  │  └──────────┬──────┬──────┬──────┬─────────────────┘    │         │
│  │             │      │      │      │                       │         │
│  │  ┌──────────▼──┐ ┌─▼────┐ ┌▼────┐ ┌▼──────────────┐   │         │
│  │  │ PostgreSQL  │ │MySQL │ │SQLite│ │ Redis          │   │         │
│  │  │ +PolarDB    │ │      │ │      │ │ (+RedisAPI)   │   │         │
│  │  │ +GaussDB    │ │      │ │      │ │                │   │         │
│  │  └─────────────┘ └──────┘ └──────┘ └───────────────┘   │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                      │
│  ┌── Feature Modules ──────────────────────────────────────────┐     │
│  │                                                             │     │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │     │
│  │  │ Data Editor  │  │ Data Export   │  │ Data Compare     │ │     │
│  │  │(data_editor) │  │(data_export)  │  │(data_compare)    │ │     │
│  │  └──────────────┘  └───────────────┘  └──────────────────┘ │     │
│  │                                                             │     │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │     │
│  │  │ Transaction  │  │ Autocomplete  │  │ Query Analyzer   │ │     │
│  │  │(transaction) │  │(autocomplete) │  │(query_analyzer)  │ │     │
│  │  └──────────────┘  └───────────────┘  └──────────────────┘ │     │
│  │                                                             │     │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │     │
│  │  │SQL Formatter │  │ Redis API     │  │ Test/Diagnostic  │ │     │
│  │  │(sql_formatter│  │(redis_api)    │  │(test.go)         │ │     │
│  │  └──────────────┘  └───────────────┘  └──────────────────┘ │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌── Cross-Cutting Concerns ────────────────────────────────────┐    │
│  │                                                             │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │     │
│  │  │ Crypto   │  │ Audit    │  │  i18n    │  │ Window    │  │     │
│  │  │(crypto)  │  │(audit)   │  │(i18n)    │  │(window)   │  │     │
│  │  │AES-256   │  │singleton │  │zh/en map │  │+filedialog│  │     │
│  │  │-GCM      │  │sync.Once │  │          │  │           │  │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据流图

### 3.1 连接流程 (Connection Flow)

```
Frontend                    Wails IPC                     Backend
─────────                   ─────────                     ───────

用户点击"连接"
     │
     ▼
WailsAPI.connectToDatabase(conn)
     │                          │
     │                          ▼
      │              ConnectToDatabase() (connection.go:178)
     │                          │
     │                  ┌───────▼────────┐
      │                  │ decryptPassword │ (crypto.go:84)
     │                  │ AES-256-GCM     │
     │                  └───────┬────────┘
     │                          │
     │                  ┌───────▼────────┐
      │                  │  buildKey()     │ (pool.go:79)
     │                  │ "{type}:{host}:│
     │                  │ {port}:{user}: │
     │                  │ {database}"    │
     │                  └───────┬────────┘
     │                          │
     │                  ┌───────▼──────────────────┐
      │                  │ pool.getOrCreate(key, fn) │ (pool.go:32)
     │                  │                           │
     │                  │  1. RLock → 查 map        │
     │                  │     找到? → Ping 3s超时    │
     │                  │     有效? → return        │
     │                  │  2. RUnlock               │
     │                  │  3. Lock → double-check   │
     │                  │     找到有效? → return     │
     │                  │  4. createFunc()           │
     │                  │     → DriverManager.Connect│
     │                  │     → driver.Connect()     │
     │                  │  5. Ping retry 3x 200ms   │
     │                  │  6. pool超50? evictOldest  │
     │                  │  7. set → return           │
     │                  └──────────┬────────────────┘
     │                          │
     │                          ▼
     │                  AuditLogger.LogConnection()
     │                          │
     ▼                          ▼
  Promise<true, "Connected successfully">
```

### 3.2 查询流程 (Query Flow)

```
Frontend                    Wails IPC                     Backend
─────────                   ─────────                     ───────

用户输入SQL，按F5
     │
     ▼
WailsAPI.executeMultiQuery(conn, db, sql)
     │                          │
     │                          ▼
      │              ExecuteMultiQuery() (query.go:14)
     │                          │
     │                  ┌───────▼────────┐
     │                  │ decryptPassword │ ← 每次查询都解密
     │                  └───────┬────────┘
     │                          │
     │                  ┌───────▼──────────┐
     │                  │ poolMutex.RLock   │ ← 注意: 此处
     │                  │ pool.get(key)     │   使用 App.poolMutex
     │                  │                   │   而非 pool 内部 mu
     │                  │ 不存在?           │
     │                  │ poolMutex.Lock    │ ← double-check
     │                  │ pool.get(key)     │
     │                  │ DriverManager     │
     │                  │  .Connect()       │
     │                  │ pool.set(key)     │
     │                  │ poolMutex.Unlock  │
     │                  └───────┬──────────┘
     │                          │
     │                  ┌───────▼────────┐
      │                  │ splitQueries() │ (query.go:18)
     │                  │ 分号分割，处理  │
     │                  │ 引号/转义       │
     │                  └───────┬────────┘
     │                          │
     │                  ┌───────▼──────────────┐
     │                  │ 遍历每个子查询:        │
     │                  │                       │
     │                  │ isSELECT?             │
     │                  │   ├─ Yes: driver.Query│
     │                  │   │   → rows.Columns()│
     │                  │   │   → rows.Scan()   │
     │                  │   │   → NULL→"NULL"   │
     │                  │   │   → []byte→string │
     │                  │   │                   │
     │                  │   ├─ No:  driver.Exec │
     │                  │   │   → RowsAffected  │
     │                  └───────┬──────────────┘
     │                          │
     │                          ▼
      │              MultiQueryResult (types.go:37-45)
     │              {results, total, success, error, duration}
     │                          │
     ▼                          ▼
  Promise<MultiQueryResult>
     │
     ▼
  state.tabs[activeTab].results = result
  渲染结果面板 (表格/消息)
```

### 3.3 编辑流程 (Edit Flow)

```
Frontend                    Wails IPC                     Backend
─────────                   ─────────                     ───────

用户编辑表格行
     │
     ▼
WailsAPI.editTableData(conn, editReq)
     │                          │
     │                          ▼
      │              EditTableData() (data_editor.go:18)
     │                          │
     │                  ┌───────▼────────────┐
      │                  │ validateEditRequest │ (L89)
     │                  │   table非空?        │
     │                  │   database非空?     │
     │                  │   sanitizeIdentifier│
     │                  └───────┬────────────┘
     │                          │
     │                  ┌───────▼──────────────┐
     │                  │ 获取 pool 连接         │
     │                  │ (poolMutex double-check│
     │                  │  同 query.go 模式)     │
     │                  └───────┬──────────────┘
     │                          │
     │                  ┌───────▼────────────┐
     │                  │ switch operation:   │
     │                  │                     │
     │                  │ INSERT:              │
     │                  │  performInsert()     │
     │                  │  → sanitizeIdentifier│
     │                  │  → `INSERT INTO     │
     │                  │    {table} ({cols})  │
     │                  │    VALUES ({?})`     │
     │                  │  → driver.Exec(ctx)  │
     │                  │                     │
     │                  │ UPDATE:              │
     │                  │  performUpdate()     │
     │                  │  → WHERE/PrimaryKey  │
     │                  │  → `UPDATE {table}   │
     │                  │    SET {col=?} WHERE │
     │                  │    {conditions}`     │
     │                  │                     │
     │                  │ DELETE:              │
     │                  │  performDelete()     │
     │                  │  → WHERE/PrimaryKey  │
     │                  │  → `DELETE FROM     │
     │                  │    {table} WHERE     │
     │                  │    {conditions}`     │
     │                  └───────┬────────────┘
     │                          │
     │                  ┌───────▼────────────┐
     │                  │ AuditLogger.Log    │
     │                  │  (成功/失败)        │
     │                  └───────┬────────────┘
     │                          │
     ▼                          ▼
  Promise<EditResult>
  {success, message, rowsAffected, error}
```

### 3.4 导出流程 (Export Flow)

```
Frontend                    Wails IPC                     Backend
─────────                   ─────────                     ───────

用户点击"导出"
     │
     ▼
WailsAPI.exportData(conn, exportReq)
     │                          │
     │                          ▼
      │              ExportData() (data_export.go:43)
     │                          │
     │                  ┌───────▼────────────┐
     │                  │ 验证 format+table  │
     │                  │ 构建 SELECT 查询   │
     │                  │ (sanitizeIdentifier│
     │                  │  + LIMIT/OFFSET)   │
     │                  └───────┬────────────┘
     │                          │
     │                  ┌───────▼────────────┐
     │                  │ ExecuteQuery()     │ ← 嵌套调用
     │                  │ 获取 QueryResult   │
     │                  └───────┬────────────┘
     │                          │
     │                  ┌───────▼──────────────────┐
     │                  │ switch format:            │
     │                  │                           │
     │                  │ CSV:  exportToCSV()        │
     │                  │   → csv.Writer.Write       │
     │                  │                           │
     │                  │ JSON: exportToJSON()       │
     │                  │   → json.MarshalIndent     │
     │                  │                           │
     │                  │ Excel: exportToExcel()     │
     │                  │   → excelize.NewFile       │
     │                  │   → SetCellValue           │
     │                  │                           │
     │                  │ SQL:  exportToSQL()        │
     │                  │   → per-row INSERT INTO    │
     │                  └───────┬──────────────────┘
     │                          │
     │                  ┌───────▼────────────┐
     │                  │ 写入 ~/.db-client/ │
     │                  │   exports/ 目录    │
     │                  │ AuditLogger.Log   │
     │                  └───────┬────────────┘
     │                          │
     ▼                          ▼
  Promise<ExportResult>
  {success, fileName, rowsCount, filePath}
```

---

## 4. 组件职责矩阵

| 文件 | 行数 | 核心职责 | 对外 API 方法 | 依赖关系 |
|------|------|----------|---------------|----------|
| `main.go` | 51 | 入口，Wails窗口配置 | 无 | app.go |
| `app.go` | 107 | App 结构体，生命周期 | `GetLanguage`, `SetLanguage` | db, pool, crypto, audit, config |
| `types.go` | 114 | 共享数据结构 | 无 | 无（纯定义） |
| `db/db.go` | 92 | 驱动接口+管理器 | `DriverManager.Connect` | postgresql, mysql, sqlite, redis |
| `db/postgresql.go` | 193 | PG/PolarDB/GaussDB驱动 | `DatabaseDriver` 接口实现 | lib/pq |
| `db/mysql.go` | 141 | MySQL驱动 | `DatabaseDriver` 接口实现 | go-sql-driver/mysql |
| `db/sqlite.go` | 129 | SQLite驱动 | `DatabaseDriver` 接口实现 | go-sqlite3 |
| `db/redis.go` | 272 | Redis驱动+专用API | `DatabaseDriver` + `RedisKeyInfo/Set/Delete/Scan/Info` | go-redis/v9 |
| `pool.go` | 166 | 连接池管理 | `getOrCreate`, `get`, `set`, `remove`, `closeAll`, `GetHealthy`, `SetWithHealth` | db |
| `connection.go` | 265 | 连接管理CRUD | `GetSupportedDatabases`, `GetConnections`, `SaveConnection`, `DeleteConnection`, `TestConnection`, `ConnectToDatabase`, `DisconnectFromDatabase` | db, pool, crypto, audit, i18n |
| `query.go` | 86 | 查询执行 | `ExecuteQuery`, `ExecuteMultiQuery`, `ExecuteNonQuery` | pool, db, crypto |
| `query_timeout.go` | 280 | 带超时查询 | `ExecuteQueryWithTimeout`, `ExecuteMultiQueryWithTimeout` | pool, db, crypto |
| `schema.go` | 555 | Schema检查 | `GetDatabases`, `GetTables`, `GetViews`, `GetFunctions`, `GetTableColumns`, `GetTableIndexes`, `GetTableForeignKeys`, `GetTableStats` | db, pool, config, crypto |
| `data_editor.go` | 350 | 表数据编辑 | `EditTableData`, `GetEditableColumns`, `BatchEdit`, `GenerateInsertStatement`, `GenerateUpdateStatement` | pool, db, crypto, audit, schema |
| `data_export.go` | 394 | 导入/导出 | `ExportData`, `ImportData` | pool, query, excelize, audit |
| `data_compare.go` | 360 | 数据对比 | `CompareTables`, `CompareQueries`, `GetCompareReport`, `ExportCompareResult` | pool, query, audit |
| `transaction.go` | 249 | 事务管理 | `BeginTransaction`, `ExecuteInTransaction`, `CommitTransaction`, `RollbackTransaction`, `ExecuteTransactionBatch` | pool, db, crypto |
| `redis_api.go` | 136 | Redis专用端点 | `GetRedisKeyInfo`, `SetRedisKeyValue`, `DeleteRedisKey`, `ExecuteRedisCommand`, `GetRedisInfo`, `GetRedisDBSize`, `ScanRedisKeys` | pool, db, crypto, audit |
| `autocomplete.go` | 459 | SQL补全 | `GetAutoCompleteSuggestions`, `GetQuickSuggestions`, `GetTableColumnsForAutoComplete` | schema, db |
| `query_analyzer.go` | 565 | 查询分析 | `GetExplainPlan`, `AnalyzeQuery`, `GetSlowQueries`, `GetTableStatistics`, `AnalyzeTableUsage` | pool, db, crypto, audit |
| `sql_formatter.go` | 473 | SQL格式化 | `FormatSQL`, `MinifySQL`, `ValidateSQL`, `BeautifySQL`, `CompactSQL`, `GetSQLStructure` | 无外部依赖 |
| `audit.go` | 304 | 审计日志 | `GetAuditLogger`, `Log`, `LogQuery`, `LogConnection`, `LogSensitiveData`, `GetLogs`, `ExportLogs`, `ClearOldLogs` | 无外部依赖 |
| `crypto.go` | 119 | 密码加密 | `encryptPassword`, `decryptPassword`, `initEncryptionKey` | 无外部依赖（stdlib crypto） |
| `i18n.go` | 81 | 国际化 | `t()`, `getCurrentLang` | 无外部依赖 |
| `config.go` | 87 | 配置管理 | `connectionToDBConfig`, `getDriverForConfig`, `loadConnections`, `saveConnections` | db, pool, crypto |
| `window.go` | 29 | 窗口控制 | `WindowMinimize`, `WindowMaximize`, `WindowClose`, `WindowIsMaximized` | wails runtime |
| `filedialog.go` | 28 | 文件对话框 | `OpenFileDialog`, `SaveFileDialog` | wails runtime |
| `test.go` | 121 | 诊断测试 | `RunConnectionTest`, `RunAllTests`, `GetSupportedFeatures`, `GetServerInfo` | db, crypto, i18n |

---

## 5. IPC 机制 (Wails Bindings)

### 5.1 绑定原理

Wails v2 的 IPC 机制基于 **Go struct 方法自动绑定**：

1. `main.go:43-45` 中 `Bind: []interface{}{app}` 将 `App` struct 注册到 Wails runtime
2. Wails 在构建时扫描 `App` 的所有 **exported method**（以大写字母开头）
3. 自动生成 JS 代理代码到 `frontend/wailsjs/go/main/App.js` 和 `App.d.ts`
4. 前端通过 `window.go.main.App.MethodName(args)` 调用
5. Wails runtime 将 JS 调用转为 Go 方法调用，参数通过 JSON 序列化传递
6. Go 方法返回值再通过 JSON 反序列化回 JS Promise

### 5.2 类型映射

| Go 类型 | JS 类型 | 示例 |
|---------|---------|------|
| `string` | `string` | `TestConnection() → Promise<boolean\|string>` |
| `bool` | `boolean` | `WindowIsMaximized() → Promise<boolean>` |
| `int64` | `number` | `ExecuteNonQuery() → Promise<number>` |
| `[]T` | `Array<T>` | `GetTables() → Promise<Array<main.TableInfo>>` |
| `map[string]interface{}` | `Record<string, any>` | `GetServerInfo() → Promise<Record<string, string>>` |
| struct | 对象 | `ExportData() → Promise<main.ExportResult>` |
| `error` | JS Error | Go error → Promise rejection |
| `void` | `Promise<void>` | `DeleteConnection() → Promise<void>` |

### 5.3 API 方法分类 (App.d.ts 共 69 方法)

| 类别 | 方法 | 数量 |
|------|------|------|
| 连接管理 | `GetConnections`, `SaveConnection`, `DeleteConnection`, `TestConnection`, `ConnectToDatabase`, `DisconnectFromDatabase`, `GetSupportedDatabases` | 7 |
| 查询执行 | `ExecuteQuery`, `ExecuteMultiQuery`, `ExecuteNonQuery`, `ExecuteQueryWithTimeout`, `ExecuteMultiQueryWithTimeout` | 5 |
| Schema检查 | `GetDatabases`, `GetTables`, `GetViews`, `GetFunctions`, `GetTableColumns`, `GetTableIndexes`, `GetTableForeignKeys`, `GetTableStats`, `GetTableStatistics` | 9 |
| 数据编辑 | `EditTableData`, `GetEditableColumns`, `BatchEdit`, `GenerateInsertStatement`, `GenerateUpdateStatement` | 5 |
| 导入/导出 | `ExportData`, `ImportData` | 2 |
| 数据对比 | `CompareTables`, `CompareQueries`, `GetCompareReport`, `ExportCompareResult` | 4 |
| 事务管理 | `BeginTransaction`, `ExecuteInTransaction`, `CommitTransaction`, `RollbackTransaction`, `ExecuteTransactionBatch` | 5 |
| Redis专用 | `GetRedisKeyInfo`, `SetRedisKeyValue`, `DeleteRedisKey`, `ExecuteRedisCommand`, `GetRedisInfo`, `GetRedisDBSize`, `ScanRedisKeys` | 7 |
| 查询分析 | `GetExplainPlan`, `AnalyzeQuery`, `GetSlowQueries`, `AnalyzeTableUsage` | 4 |
| SQL工具 | `FormatSQL`, `MinifySQL`, `ValidateSQL`, `BeautifySQL`, `CompactSQL`, `GetSQLStructure` | 6 |
| 自动补全 | `GetAutoCompleteSuggestions`, `GetQuickSuggestions`, `GetTableColumnsForAutoComplete` | 3 |
| 系统功能 | `GetLanguage`, `SetLanguage`, `WindowMinimize`, `WindowMaximize`, `WindowClose`, `WindowIsMaximized`, `OpenFileDialog`, `SaveFileDialog`, `RunConnectionTest`, `RunAllTests`, `GetSupportedFeatures`, `GetServerInfo` | 12 |

### 5.4 前端 WailsAPI 模式 (app.js:24-73)

前端使用统一的 `WailsAPI` 对象封装所有调用：

```javascript
const WailsAPI = {
    getConnections: () => window.go.main.App.GetConnections(),
    executeQuery: (conn, db, query) => window.go.main.App.ExecuteQuery(conn, db, query),
    // ... 69 方法
};
```

所有调用返回 `Promise`，前端通过 `await` 或 `.then()` 处理。

---

## 6. 横切关注点 (Cross-Cutting Concerns)

### 6.1 密码加密 (crypto.go)

| 项目 | 详情 |
|------|------|
| 算法 | AES-256-GCM (`crypto/aes` + `crypto/cipher`) |
| 密钥存储 | `~/.db-client/.key`（Base64编码的32字节随机密钥） |
| 密钥文件权限 | `0600`（crypto.go:51） |
| 加密流程 | `initEncryptionKey()` → `aes.NewCipher` → `cipher.NewGCM` → `Seal(nonce+ ciphertext)` → Base64 |
| nonce | 每次加密随机生成（crypto.go:75-78），prepend 到 ciphertext |
| 解密流程 | Base64 decode → 分离 nonce → `Open()` 解密 |
| 保存时机 | `SaveConnection()` 在 connection.go:36-41 调用 |
| 解密时机 | 每次连接/查询操作前都调用 `decryptPassword()` |

**已知问题**: `encryptionKey` 是全局 `var`（crypto.go:16），虽有 `sync.Once` 保护但仍有潜在问题。`initEncryptionKey()` 使用 `encryptionOnce.Do()` 保护初始化（L21-54）。

### 6.2 审计日志 (audit.go)

| 项目 | 详情 |
|------|------|
| 单例模式 | `sync.Once` + `GetAuditLogger()` (audit.go:69-87) |
| 日志级别 | INFO / WARNING / ERROR / CRITICAL |
| 事件类型 | CONNECT / DISCONNECT / QUERY / QUERY_ERROR / QUERY_TIMEOUT / CONNECTION_SAVE / CONNECTION_DELETE / LOGIN / LOGOUT / SENSITIVE_DATA |
| 存储 | `~/.db-client/logs/audit_YYYY-MM-DD.log` |
| 内存缓存 | `[]AuditLog`，maxLogs=10000（L80） |
| 持久化策略 | 每次 `Log()` 调用后执行 `appendToFile()`，追加写入单条 JSON（L189-206） |
| 文件写入 | `os.OpenFile` O_APPEND 方式追加（L196-205） |
| 启动加载 | `loadTodayLogs()` 加载今日已有日志（L89-109） |
| 调用位置 | 几乎所有 App 方法：连接保存/删除、查询执行、数据编辑、导出等 |

**已知问题**: `appendToFile()` 每次追加写入单条日志（L189），已优化为追加模式。`truncateQuery()` 已使用 `utf8.RuneCountInString` 按 rune 截断（L280-286），修复了多字节字符截断问题。

### 6.3 国际化 (i18n.go)

| 项目 | 详情 |
|------|------|
| 模式 | Go 侧 map 结构，前端 JS `translations` 对象 |
| Go 侧 | `messages` map (i18n.go:26-67)，`MessageKey` enum，`t()` 函数 |
| 前端侧 | `frontend/dist/i18n.js`，`translations.zh` / `translations.en` |
| 语言检测 | `GetLanguage()` 读取 `DB_CLIENT_LANG` env var，默认 "zh" (app.go:62-66) |
| 语言保存 | `SetLanguage()` → `~/.db-client/config.json` (app.go:69-93) |
| 覆盖范围 | Go 侧仅覆盖连接/查询错误消息（12条），前端覆盖 UI 全部文本（~150条） |
| 不足 | Go 侧大量硬编码中文（如 "验证失败"、"连接失败"、"编辑数据"），未走 i18n |

### 6.4 连接池 (pool.go)

| 项目 | 详情 |
|------|------|
| 结构 | `connectionPool` { `sync.RWMutex`, `map[string]*pooledDriver` } |
| 最大容量 | `MaxPoolSize = 50` (pool.go:13) |
| key 格式 | `buildKey()` → `"{type}:{host}:{port}:{username}:{database}"` (pool.go:79-81) |
| 核心方法 | `getOrCreate(key, createFunc)` — double-check locking (L32-77) |
| 淘汰策略 | `evictOldest()` — 按 `createdAt` 排序，删除最早连接 (L83-109) |
| 健康检查 | `getHealthy()` — ping 3s超时验证 (L135-166) |
| 关闭 | `closeAll()` — shutdown 时调用 (app.go:41) |

**关键设计差异**: `pool.go` 内部有自己的 `sync.RWMutex` (`mu`)，所有调用方现在统一通过 `pool.getOrCreate()` 访问连接池。`getDriverForConfig()` (config.go:32-42) 封装了 `pool.getOrCreate()` 调用，消除了旧的双层锁问题。`ConnectToDatabase()` (connection.go:178) 也使用 `pool.getOrCreate()`。

---

## 7. 已知架构问题与重构优先级

### P0 - 严重 (影响稳定性/安全性)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | **encryptionKey race condition** | `crypto.go:16` (`var encryptionKey []byte`) | 已使用 `sync.Once` 保护初始化（crypto.go:17 `encryptionOnce`），但 `encryptionKey` 变量本身仍为全局 var，理论上有读取竞争风险 | 使用 `sync.RWMutex` 保护 `encryptionKey` 读写，或改为通过函数返回 |
| 2 | **双重锁体系已统一** | 旧代码中 `query.go`、`data_editor.go`、`transaction.go` 使用 `App.poolMutex` + `pool.get/set()`；现在统一使用 `pool.getOrCreate()` 通过 `getDriverForConfig()` (config.go:32-42)。旧的双层锁问题已解决 | 两条路径现已统一为 `pool.getOrCreate()` 模式，消除了死锁风险 | 继续保持统一模式，确保新代码也使用 `getDriverForConfig()` |
| 3 | **truncateQuery byte截断** | `audit.go:280-286` | 已修复：现使用 `utf8.RuneCountInString` 和 rune 切片，正确处理多字节 UTF-8 字符 | 已解决 |

### P1 - 高 (影响性能/可维护性)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 4 | **审计日志追加写入** | `audit.go:189-206` 每次 `Log()` 调用 `appendToFile()` 序列化单条日志 | 已优化为追加写入模式，每条日志单独序列化并追加到文件，性能 O(1) | 已解决 |
| 5 | **密码解密重复调用** | `connection.go:179-183`、`query_timeout.go:38-39`、`data_editor.go:29-30`、`config.go:14-18`、`redis_api.go:118` 等几乎所有方法 | 每次查询/操作都解密密码，即使同一连接已在池中（池中 driver 保存的是解密后密码建立的连接）。解密本身不慢，但模式重复导致代码冗余 | 在 `ConnectToDatabase()` 解密一次后缓存明文密码到 session，或 `connectionToDBConfig()` 统一处理 |
| 6 | **pool double-check 代码已统一** | 旧代码中 `query.go`、`data_editor.go`、`transaction.go` 等有手动 double-check 模式；现在统一使用 `getDriverForConfig()` (config.go:32-42) | 已通过 `pool.getOrCreate()` 统一解决，消除了代码重复 | 已解决 |
| 7 | **cleanupStaleTransactions 已自动调用** | `transaction.go:69` | `BeginTransaction()` 现在自动调用 `startStaleTransactionCleanup()`（L82），使用定时 goroutine 每5分钟清理过期事务 | 已解决 |
| 8 | **GetSlowQueries 返回空** | `query_analyzer.go:300-302` | API 已声明但未实现，前端调用永远返回空数组 | 实现慢查询日志读取（PG: `pg_stat_statements`，MySQL: `slow_query_log`） |

### P2 - 中 (影响完整性/质量)

| # | 问题 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 9 | **getColumnSuggestions 返回空** | `autocomplete.go` "简化版本返回空" | 列名自动补全永远不工作，SELECT/WHERE 后无法补全当前表的列 | 实现 FROM 子句表名提取 + 列名查询，或至少调用 `GetTableColumnsForAutoComplete` |
| 10 | **i18n 覆盖不完整** | Go 侧大量硬编码中文 | `data_editor.go` "验证失败"/"连接数据库失败"、`connection.go:227` "连接失败"、`transaction.go:116` "开始事务失败" 等硬编码中文，`SetLanguage()` 改为英文后这些消息不变 | 将所有 Go 侧用户可见消息纳入 `i18n.go` messages map |
| 11 | **MySQL/PG identifier 引号不一致** | `data_editor.go:126` 使用反引号 `` ` `` 包裹标识符（MySQL 风格），`schema.go` PG 使用双引号 `"` | data_editor 的 INSERT/UPDATE/DELETE 语句在 PostgreSQL 上使用反引号会语法错误 | 根据 `config.Type` 动态选择引号：MySQL → 反引号，PG → 双引号 |
| 12 | **事务超时 context 设计** | `transaction.go:111-127` | `BeginTx` 使用 10s timeout context 创建事务，但事务本身使用 `context.Background()`（无超时）。如果事务长时间持有，DB 端可能已超时，Go 侧事务仍存活 | 事务使用可取消的 context，前端 Commit/Rollback 时 cancel |
| 13 | **front-end 纯 JS 无构建步骤** | `frontend/dist/app.js` 3502行单文件 | 无模块化、无 tree-shaking、无 lint/type check，维护困难 | 引入 Vite + TypeScript，拆分模块 |

### P3 - 低 (改善建议)

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 14 | **所有代码在 package main** | 20+ 文件全部在 `package main` | 拆分为子 package: `internal/pool`, `internal/crypto`, `internal/audit` 等 |
| 15 | **Connection struct 与 db.ConnectionConfig 重复** | `types.go:3-17` vs `db/db.go:22-30` | 统一为单一类型，或明确转换层 |
| 16 | **import 路径使用 `db-server`** | `go.mod:1` `module db-server` | 改为更规范的 `github.com/user/db-client` 风格 |
| 17 | **Excel 导出列宽固定 15** | `data_export.go` | 根据内容长度自适应列宽 |
| 18 | **app_test.go 测试覆盖度低** | 仅 1 个测试文件 | 扩展单元测试覆盖核心路径 |

---

## 8. 依赖关系图

```
                    ┌──────────────┐
                    │   main.go    │
                    │  (Wails Run) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   app.go     │
                    │  App struct  │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────────┐
            │              │                  │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────────▼──────┐
     │   db/       │ │ pool.go  │ │ crypto.go       │
     │ (驱动层)    │ │(连接池)  │ │ (AES-256-GCM)   │
     └──────┬──────┘ └────┬─────┘ └──────────┬──────┘
            │              │                  │
            │     ┌────────▼──────────────────┘
            │     │
     ┌──────▼─────▼──────────────────────────────────┐
     │          Feature Modules                        │
     │                                                │
     │  connection.go ←──→ config.go                 │
     │       │               │                        │
     │  query.go ←──── query_timeout.go              │
     │       │                                        │
     │  schema.go                                     │
     │       │                                        │
     │  data_editor.go ←─→ data_export.go             │
     │                        │                       │
     │  data_compare.go ←─────┘                       │
     │                                                │
     │  transaction.go                                │
     │  redis_api.go                                  │
     │  autocomplete.go ←── schema.go                 │
     │  query_analyzer.go                             │
     │  sql_formatter.go                              │
     │  test.go                                       │
     └────────────┬───────────────────────────────────┘
                  │
     ┌────────────▼───────────────────────────────────┐
     │          Cross-Cutting                          │
     │                                                │
     │  audit.go (singleton, 被所有 feature 调用)     │
     │  i18n.go  (被 connection.go 调用)              │
     │  window.go / filedialog.go (独立)              │
     └────────────────────────────────────────────────┘

外部依赖 (go.mod):
  ├── github.com/wailsapp/wails/v2       # 桌面框架
  ├── github.com/lib/pq                  # PostgreSQL 驱动
  ├── github.com/go-sql-driver/mysql     # MySQL 驱动
  ├── github.com/mattn/go-sqlite3        # SQLite 驱动 (CGO)
  ├── github.com/redis/go-redis/v9      # Redis 客户端
  ├── github.com/xuri/excelize/v2       # Excel 生成
  └── stdlib: crypto/aes, crypto/cipher, encoding/csv, encoding/json, database/sql
```

---

## 9. 关键设计决策记录

| 决策 | 选择 | 替代方案 | 原因 |
|------|------|----------|------|
| 桌面框架 | Wails v2 | Electron, Tauri | Go 生态原生，无需 Node runtime |
| 前端技术 | 纯 JS + Monaco | React/Vue + Monaco | 简单直接，减少构建步骤 |
| 连接池 | 自实现 double-check locking | sql.DB 内置池 | 需要跨多种数据库类型的统一池，sql.DB 池只适用于单连接 |
| 密码加密 | AES-256-GCM | bcrypt, argon2 | GCM 提供加密+认证，bcrypt/argon2 是 hash 不可逆（需解密用于连接） |
| 淘汰策略 | 按创建时间 FIFO | LRU, LFU | 简单实现，桌面应用并发低，FIFO 足够 |
| 事务管理 | 全局 map + 手动 cleanup | per-connection transactions | 当前架构连接池共享，事务需跨请求状态保持 |
| Query 分割 | 自实现分号解析 | sqlparse 库 | 减少外部依赖，处理引号/转义的简单场景足够 |
| 日志持久化 | 全量 JSON + atomic rename | append-only, SQLite, loki | 简单可靠，但性能问题待优化 |
| 窗口模式 | Frameless + 自定义标题栏 | 系统标题栏 | 美观控制，跨平台一致体验 |

---

## 10. 架构演进路线图

### Phase 1 - 稳定性修复 (1-2周)
- ✅ 修复 `encryptionKey` race condition → `sync.Once`
- ✅ 统一连接池锁策略 → 全部使用 `pool.getOrCreate()`
- ✅ 修复 `truncateQuery` UTF-8 截断 → `utf8.RuneCountInString`
- ✅ 审计日志改为追加写入 → `appendToFile()`
- ✅ 消除 pool double-check 重复代码 → `getDriverForConfig()`
- ✅ 实现 `cleanupStaleTransactions` 自动调用 → 定时 goroutine

### Phase 2 - 性能优化 (2-4周)
- 密码解密统一到 `connectionToDBConfig`

### Phase 3 - 功能完善 (4-8周)
- 实现 `getColumnSuggestions` 列名补全
- 实现 `GetSlowQueries` 慢查询功能
- i18n 覆盖 Go 侧所有用户消息
- 标识符引号按数据库类型动态选择

### Phase 4 - 架构重构 (8-12周)
- 拆分 package main → `internal/pool`, `internal/crypto`, `internal/audit` 等
- 前端引入 Vite + TypeScript
- Connection 与 ConnectionConfig 类型统一
- go.mod 模块路径规范化