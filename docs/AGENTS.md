# AGENTS.md — AI Agent Entry Point

> For AI agents working on this project. Read this first, then consult docs/ for details.

---

## Commands

| Command | Purpose |
|---------|---------|
| `wails dev` | Dev mode with hot reload |
| `wails build` | Production build (or `build.bat` / `build.sh`) |
| `go test ./...` | Run all tests |
| `go test -run TestName ./...` | Run specific test |
| `go vet ./...` | Static analysis |

---

## Project Structure (Key Files)

```
db-server/
├── main.go              # Entry point, Wails v2 config
├── app.go               # App struct: ctx, driverManager, connections, pool
├── types.go             # Connection, QueryResult, TableInfo, IndexInfo, ForeignKeyInfo, etc.
├── config.go            # connectionToDBConfig, getDriverForConfig, load/saveConnections
├── pool.go              # connectionPool, getOrCreate, buildKey, evictOldest, getHealthy
├── crypto.go            # AES-256-GCM encrypt/decrypt, initEncryptionKey (global var)
├── connection.go        # CRUD, TestConnection, ConnectToDatabase, GetSupportedDatabases
├── query.go             # ExecuteQuery, ExecuteMultiQuery, splitQueries
├── query_timeout.go     # ExecuteQueryWithTimeout (Default=30s, Max=300s)
├── schema.go            # GetTables/Views/Functions/Columns/Indexes/ForeignKeys/Stats, sanitizeIdentifier
├── data_editor.go       # EditTableData, EditRequest (PrimaryKey!), BatchEdit
├── data_export.go       # ExportData CSV/JSON/Excel/SQL
├── data_compare.go      # CompareTableData, CompareQueryData
├── transaction.go       # Begin/Commit/Rollback, globalTransactions map
├── audit.go             # AuditLogger, Log, writeToFile, truncateQuery
├── redis_api.go         # Redis-specific Wails bindings, getRedisDriver (type assertion)
├── i18n.go              # MessageKey enum, a.t(key, lang) pattern, zh/en
├── autocomplete.go      # GetAutoCompleteSuggestions
├── query_analyzer.go    # AnalyzeQuery, ExplainQuery
├── sql_formatter.go     # FormatSQL, MinifySQL
├── window.go            # WindowMinimize/Maximize/Close/IsMaximized
├── filedialog.go        # OpenFileDialog, SaveFileDialog
├── db/
│   ├── db.go            # DatabaseDriver interface, DriverManager, ConnectionConfig, ColumnInfo
│   ├── types.go         # TableInfo, ViewInfo, FunctionInfo (db package types)
│   ├── postgresql.go    # PostgreSQL/PolarDB/GaussDB driver
│   ├── mysql.go         # MySQL driver (SSLMode support: disabled/preferred/required/verify-ca/verify-full)
│   ├── sqlite.go        # SQLite driver
│   └── redis.go         # Redis driver + RedisKeyInfo, type assertions on value
├── frontend/dist/
│   ├── app.js           # Main app logic, WailsAPI bridge, global state object
│   ├── index.html       # Main HTML
│   ├── i18n.js          # Frontend translations
│   └── lib/monaco-editor/ # SQL editor
├── docs/
│   ├── 01-overview.md       # Vision, priorities, metrics
│   ├── 02-architecture.md   # System architecture, component diagrams
│   ├── 03-architecture.md   # Directory tree
│   ├── 03-data-models.md    # All Go struct definitions
│   ├── 04-api-reference.md  # Full Wails API (72 methods)
│   ├── 05-ui-pages.md       # UI layout, panels, components
│   ├── 06-security.md       # Encryption, injection, audit details
│   ├── 07-development-guide.md # Build setup, testing, contributing
```

---

## Code Conventions

- **Go**: All backend code is `package main` (except `db/` which is `package db`)
- **Frontend**: Pure JavaScript (no React/Vue), global `state` object, `WailsAPI` bridge
- **Wails bindings**: All exported methods on `App` struct → `window.go.main.App.MethodName()` in frontend
- **i18n**: Use `a.t(MsgXxx, lang)` for user-facing messages; never hardcode Chinese/English strings in new code
- **SQL identifiers**: Always pass through `sanitizeIdentifier()` before using in SQL strings
- **Encryption**: AES-256-GCM for passwords; key stored at `~/.db-client/.key` (0600 perms)
- **Connection pool key**: `buildKey(config)` → `{type}:{host}:{port}:{username}:{database}`
- **No comments in Go code unless explicitly asked**

---

## Principles

1. Never use unsanitized user input in SQL — always `sanitizeIdentifier` for identifiers, parameterize for values
2. Never use `innerHTML`/`insertAdjacentHTML` with user data in frontend — use `textContent` or `createElement`
3. Use `pool.getOrCreate()` for pool access, not manual double-check locking with `poolMutex`
4. Always decrypt password before passing to driver: `decryptPassword(config.Password)` when `config.SavePassword`
5. Audit log every security-relevant operation via `GetAuditLogger().Log(...)`
6. Always use `ExecuteQueryWithTimeout` instead of `ExecuteQuery` (no timeout = can block UI forever)
7. Follow existing i18n pattern: `a.t(MsgXxx, lang)`, not hardcoded strings

---

## Critical Pitfalls

### 1. WhereClause in EditRequest — RESOLVED (was SQL injection)

**Status**: **已修复**. EditRequest (types.go:91) now uses `PrimaryKey` field instead of `WhereClause`. data_editor.go:159/180/217/228 build parameterized WHERE conditions from PrimaryKey.

```go
// FIXED: EditRequest now uses PrimaryKey for parameterized WHERE
type EditRequest struct {
    Operation  string                 `json:"operation"`
    Table      string                 `json:"table"`
    Database   string                 `json:"database"`
    Data       map[string]interface{} `json:"data,omitempty"`
    PrimaryKey map[string]interface{} `json:"primaryKey,omitempty"` // replaces WhereClause
}
```

### 2. Frontend uses insertAdjacentHTML/innerHTML with unsanitized data (XSS)

**File**: `frontend/dist/app.js` (57 matches: 46 innerHTML + 11 insertAdjacentHTML)

Extensive use of `innerHTML` and `insertAdjacentHTML` with data from server responses (connection names, database names, query results, error messages). Any malicious data from a database could inject HTML/JS.

**Fix**: Replace with `textContent` or `createElement` + `setAttribute`.

### 3. encryptionKey now has sync.Once protection — RESOLVED

**Status**: **已修复**. `crypto.go:15-17` now uses `var encryptionOnce sync.Once` alongside `var encryptionKey []byte`. The race condition has been resolved.

**Fix**: Use `sync.Once` for `initEncryptionKey`, like `auditLoggerOnce`.

### 4. ExecuteQuery now delegates to WithTimeout — RESOLVED

**Status**: **已修复**. `query.go:10-11` now delegates `ExecuteQuery` to `ExecuteQueryWithTimeout` with default `QueryOptions{}` (30s timeout). `ExecuteMultiQuery` similarly delegates at query.go:14-15. The old direct implementation with no timeout has been removed.

### 5. globalTransactions cleanup implemented — RESOLVED

**Status**: **已修复**. `cleanupStaleTransactions()` exists at transaction.go:69 and `startStaleTransactionCleanup()` at transaction.go:57. It is now auto-started on first `BeginTransaction()` call at transaction.go:83.

### 6. Dual pool locking pattern — RESOLVED

**Status**: **已修复**. All pool access now uses `getDriverForConfig` (config.go:32) which internally uses `pool.getOrCreate`. The manual double-check patterns with `poolMutex` have been removed from query.go, data_editor.go, and transaction.go.

### 7. Redis type assertions can panic

**File**: `redis_api.go:218`, `db/redis.go:183-199`

`pooled.driver.(*db.RedisDriver)` will panic if driver is not Redis type. Inside `GetRedisKeyInfo`, `value.([]string)` and similar assertions on interface{} values from redis commands will panic if type doesn't match expectation.

**Fix**: Use safe type switch with default case: `switch v := value.(type) { case []string: ... default: ... }`.

### 8. Audit writeToFile now uses append-only — RESOLVED

**Status**: **已修复**. `audit.go:189` `appendToFile()` uses incremental append instead of full-file serialization. The old O(n) per event approach has been replaced.

### 9. truncateQuery now uses rune-based truncation — RESOLVED

**Status**: **已修复**. `audit.go:280-285` now uses `utf8.RuneCountInString()` for length and `[]rune` slicing, correctly handling Chinese and other multi-byte characters.

### 10. MySQL driver now supports SSLMode — RESOLVED (basic modes)

**Status**: **已修复**. `db/mysql.go:23-32` now parses `config.SSLMode` and adds `?tls=false/preferred/true` to the MySQL connection string. Note: Default (empty SSLMode) still means no TLS, credentials sent plaintext by default.

### 11. getHealthy has stale reference race between read and re-validate

**File**: `pool.go:135-168`

`getHealthy` reads `pooled` under RLock, releases lock, pings, then re-acquires Lock to update `lastPing`. Between releasing RLock (L144) and re-acquiring Lock (L150), another goroutine could remove the entry. The `driver` variable is snapshotted at L143 before release though, so the ping uses a valid (possibly stale) reference. After ping, L151-165 re-checks existence under Lock.

### 12. Don't add comments to Go code unless asked

Code convention. Existing comments are Chinese; new code should match style only if asked.

### 13. Follow i18n pattern for user-facing strings

Use `a.t(MsgXxx, lang)`, add new `MessageKey` constants and translations to `i18n.go`. Never hardcode Chinese or English error messages.

### 14. Frontend must use WailsAPI for all data operations

`WailsAPI` object in `app.js:24-73` bridges all calls. Never mock data or bypass Wails in production code.

### 15. Import/BatchEdit uses per-row INSERT (slow for bulk)

**File**: `data_editor.go:359-367`

`BatchEdit` loops calling `EditTableData` individually — each is a separate INSERT statement. For bulk imports this is very slow.

**Fix**: Implement multi-row INSERT: `INSERT INTO t (cols) VALUES (row1), (row2), ...`.

### 16. New drivers must implement DatabaseDriver AND register AND add to GetSupportedDatabases

Three-step requirement: (1) implement `DatabaseDriver` interface in `db/`, (2) register in `newDriver()` switch in `db/db.go:65-78`, (3) add entry to `GetSupportedDatabases()` in `connection.go:11-20`.

---

## Dependencies

### Go (direct)

| Package | Version | Purpose |
|---------|---------|---------|
| `github.com/wailsapp/wails/v2` | 2.12.0 | Desktop framework, IPC |
| `github.com/redis/go-redis/v9` | 9.7.0 | Redis client |
| `github.com/lib/pq` | 1.10.9 | PostgreSQL driver |
| `github.com/go-sql-driver/mysql` | 1.8.1 | MySQL driver |
| `github.com/mattn/go-sqlite3` | 1.14.24 | SQLite driver (CGO) |
| `github.com/xuri/excelize/v2` | 2.10.1 | Excel export |

### JavaScript

| Library | Purpose |
|---------|---------|
| Monaco Editor 0.45.0 | SQL editor, syntax highlighting, IntelliSense |

---

## Documentation Index

| File | Content |
|------|---------|
| `docs/01-overview.md` | Project vision, priorities matrix, tech stack, metrics, risks, business model |
| `docs/02-feature-design.md` | 17 feature modules, 30 traceability matrix, 15 unfinished items |
| `docs/02-architecture.md` | System architecture diagrams, IPC flow, module boundaries, concurrency model |
| `docs/03-architecture.md` | Directory tree with line-number references |
| `docs/03-data-models.md` | All Go struct definitions (Connection, QueryResult, EditRequest, etc.) with field docs |
| `docs/04-api-reference.md` | Full Wails bindings API (72 implemented) with signatures, params, error handling |
| `docs/05-ui-pages.md` | UI layout, panels, components, modal list (8 modal + 2 panel), modular refactor plan |
| `docs/06-security.md` | AES-256-GCM encryption, SQL injection defense, audit logging, known vulnerabilities |
| `docs/07-development-guide.md` | Build setup, testing, CGO, contributing, design→implementation traceability |
| `docs/ui-01-design-system.md` | Terminal Noir design system: color tokens (2 themes), typography, spacing, motion, DPI scaling |
| `docs/ui-02-visual-spec.md` | 15 pixel-level visual specs (panels, dialogs, Redis browser, query history, about) |
| `docs/ui-03-interaction-flow.md` | 18 interaction flows (DDL confirm, import, Monaco fallback, copy-paste, edge cases) |
| `docs/10-interface-contract.md` | Frontend-backend interface contracts, type mapping, EditRequest V2 (PrimaryKey), Wails IPC perf, 契约实施状态追踪(C1-C7) |
| `docs/08-migration-plan.md` | 设计→实施迁移计划: 3阶段(M1-M3), 37个迁移步骤, 安全修复追踪, 契约→迁移映射 |
| `docs/09-test-strategy.md` | 测试分层策略, P0/P1模块测试计划(68+50测试), Mock Driver设计, 覆盖率路线图(<30%→>80%) |
| `docs/11-release-process.md` | 版本号规范, 分支策略, 发布检查清单(代码/安全/功能/构建/文档5类) |
| `ROADMAP.md` | 项目路线图: 完成度同步(代码源关联), 安全问题(SEC-001~010), 技术债, 版本规划(v1.5/v2.0/v3.0) |

---

## 文档闭环指引

> 所有设计文档(D01-D11/U01-U03)与代码实现之间必须可追踪。闭环原则: **设计→契约→迁移→测试→发布**。

### 闭环流程

```
1. 需求定义 → D02-feature-design (模块分解+追踪矩阵)
2. 接口契约 → D10-interface-contract (契约实施状态C1-C7)
3. 迁移计划 → D08-migration-plan (37步骤M1-M3, 关联契约项)
4. 测试验证 → D09-test-strategy (P0/P1覆盖, 契约关联测试)
5. 发布上线 → D11-release-process (检查清单, 安全/契约验证)
6. 状态同步 → ROADMAP.md (完成度+问题追踪)
```

### 闭环断裂检测

修改任何代码时, 检查:
- 该改动是否涉及D10中的契约项? → 更新9.1状态表
- 该改动是否有D08迁移步骤? → 更新迁移步骤状态
- 该改动是否影响ROADMAP完成度? → 更新ROADMAP
- 该改动是否需要测试? → 在D09中补充测试用例