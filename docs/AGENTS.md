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
├── app.go               # App struct: ctx, driverManager, connections, pool, poolMutex
├── types.go             # Connection, QueryResult, TableInfo, IndexInfo, ForeignKeyInfo, etc.
├── config.go            # connectionToDBConfig, getDriverForConfig, load/saveConnections
├── pool.go              # connectionPool, getOrCreate, buildKey, evictOldest, GetHealthy
├── crypto.go            # AES-256-GCM encrypt/decrypt, initEncryptionKey (global var)
├── connection.go        # CRUD, TestConnection, ConnectToDatabase, GetSupportedDatabases
├── query.go             # ExecuteQuery, ExecuteMultiQuery, splitQueries
├── query_timeout.go     # ExecuteQueryWithTimeout (Default=30s, Max=300s)
├── schema.go            # GetTables/Views/Functions/Columns/Indexes/ForeignKeys/Stats, sanitizeIdentifier
├── data_editor.go       # EditTableData, EditRequest (WhereClause!), BatchEdit
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
│   ├── mysql.go         # MySQL driver (no SSLMode support)
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
│   ├── 04-api-reference.md  # Full Wails API (52 methods)
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

### 1. WhereClause in EditRequest is NOT sanitized (SQL injection)

**File**: `data_editor.go:255-256`

`req.WhereClause` is used raw in SQL string: `whereClause = req.WhereClause`. This is a direct SQL injection vector. Must parameterize or reject raw whereClause.

```go
// VULNERABLE: whereClause is raw user input injected into SQL
whereClause = req.WhereClause  // data_editor.go:256
query := fmt.Sprintf("UPDATE `%s` SET %s WHERE %s", ...) // data_editor.go:270
```

**Fix**: Parse WhereClause into parameterized conditions, or force frontend to always send PrimaryKey instead.

### 2. Frontend uses insertAdjacentHTML/innerHTML with unsanitized data (XSS)

**File**: `frontend/dist/app.js` (71 matches)

Extensive use of `innerHTML` and `insertAdjacentHTML` with data from server responses (connection names, database names, query results, error messages). Any malicious data from a database could inject HTML/JS.

**Fix**: Replace with `textContent` or `createElement` + `setAttribute`.

### 3. encryptionKey global has no sync.Once protection (race condition)

**File**: `crypto.go:14,16-19`

`var encryptionKey []byte` is a global with nil-check in `initEncryptionKey()`. Two concurrent calls can both see `nil`, generate different keys, and one overwrites the other's key file. `AuditLogger` correctly uses `sync.Once` (audit.go:67-68) but `encryptionKey` does not.

**Fix**: Use `sync.Once` for `initEncryptionKey`, like `auditLoggerOnce`.

### 4. ExecuteQuery has no timeout (blocks UI indefinitely)

**File**: `query.go:10-97`

`ExecuteQuery` uses `a.ctx` with no deadline. A long-running query will block the Wails IPC call, freezing the WebView UI. `ExecuteQueryWithTimeout` exists in `query_timeout.go` with configurable timeout (default 30s).

**Fix**: Always call `ExecuteQueryWithTimeout` from frontend; deprecate or remove `ExecuteQuery`.

### 5. globalTransactions never auto-cleaned (memory leak)

**File**: `transaction.go:51-53`

`globalTransactions` map accumulates transactions. `cleanupStaleTransactions()` exists (transaction.go:57-68) but is never called automatically. Abandoned transactions (e.g., user closes tab) stay forever.

**Fix**: Call `cleanupStaleTransactions()` periodically (e.g., in App startup or on a timer).

### 6. Dual pool locking pattern (poolMutex + pool.mu)

**Files**: `data_editor.go:66-99`, `query.go:24-43`, `transaction.go:82-98`

Some code manually does double-check locking with `a.poolMutex` + `a.pool.get/set`, while `pool.go` already has `getOrCreate()` with its own `pool.mu`. This creates two lock layers and risk of inconsistency. `redis_api.go:210-213` and `connection.go:229` correctly use `pool.getOrCreate`.

**Fix**: Replace all manual double-check patterns with `a.pool.getOrCreate(key, createFunc)`.

### 7. Redis type assertions can panic

**File**: `redis_api.go:218`, `db/redis.go:183-199`

`pooled.driver.(*db.RedisDriver)` will panic if driver is not Redis type. Inside `GetRedisKeyInfo`, `value.([]string)` and similar assertions on interface{} values from redis commands will panic if type doesn't match expectation.

**Fix**: Use safe type switch with default case: `switch v := value.(type) { case []string: ... default: ... }`.

### 8. Audit writeToFile serializes entire log array on every event

**File**: `audit.go:196-213`

Every `Log()` call triggers `json.MarshalIndent(al.logs, "", "  ")` + write entire file. With 10000 max logs, this becomes O(n) per event, causing disk I/O bottleneck under load.

**Fix**: Change to append-only write: serialize only the new entry, append to file with newline separator.

### 9. truncateQuery truncates by bytes not chars (breaks Chinese text)

**File**: `audit.go:296-301`

`len(query)` counts bytes, `query[:maxLen]` slices bytes. Multi-byte Chinese characters get cut mid-character, producing invalid UTF-8. Same bug exists for identifier length in `sanitizeIdentifier` (schema.go:224).

**Fix**: Use `utf8.RuneCountInString()` for length and slice by rune index, not byte index.

### 10. MySQL driver ignores SSLMode (plaintext credentials over network)

**File**: `db/mysql.go:23`

Connection string has no TLS config: `%s:%s@tcp(%s:%d)/%s`. SSLMode field is defined in ConnectionConfig but MySQL driver never uses it. Credentials transmitted plaintext.

**Fix**: Parse `config.SSLMode` and add `tls=true` or custom TLS config to MySQL connection string.

### 11. GetHealthy has stale reference race between read and re-validate

**File**: `pool.go:197-223`

`GetHealthy` reads `pooled` under RLock, releases lock, pings, then re-acquires Lock to update `lastPing`. Between releasing RLock and acquiring Lock, another goroutine could remove the entry, making the `pooled` reference stale.

**Fix**: After ping succeeds, re-read `pooled` under Lock before updating, or re-validate existence.

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
| `docs/04-api-reference.md` | Full Wails bindings API (52 implemented + 20 planned = 72 total) with signatures, params, error handling |
| `docs/05-ui-pages.md` | UI layout, panels, components, modal list (9 modal + 2 panel), modular refactor plan |
| `docs/06-security.md` | AES-256-GCM encryption, SQL injection defense, audit logging, known vulnerabilities |
| `docs/07-development-guide.md` | Build setup, testing, CGO, contributing, design→implementation traceability |
| `docs/ui-01-design-system.md` | Terminal Noir design system: color tokens (2 themes), typography, spacing, motion, DPI scaling |
| `docs/ui-02-visual-spec.md` | 15 pixel-level visual specs (panels, dialogs, Redis browser, query history, about) |
| `docs/ui-03-interaction-flow.md` | 18 interaction flows (DDL confirm, import, Monaco fallback, copy-paste, edge cases) |
| `docs/10-interface-contract.md` | Frontend-backend interface contracts, type mapping, EditRequest V2 (PrimaryKey), Wails IPC perf |