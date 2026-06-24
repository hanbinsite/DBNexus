# CLAUDE.md — AI Development Guide

> AI agent quick reference. For full documentation see `docs/` directory. Start with `docs/AGENTS.md`.

---

## Project Overview

DB Client is a cross-platform desktop database client built with Go and Wails v2. It provides a modern UI for managing PostgreSQL, MySQL, SQLite, Redis, PolarDB, and GaussDB.

---

## Build & Run Commands

```bash
wails dev                  # Dev mode with hot reload
wails build                # Production build
build.bat                  # Windows build script
go test ./...              # Run all tests
go test -run TestName ./...  # Run specific test
go vet ./...               # Static analysis
```

---

## Architecture

### Backend (Go, package main)

| File | Responsibility |
|------|---------------|
| `main.go` | Entry point, Wails v2 window config |
| `app.go` | App struct: ctx, driverManager, connections, pool. Startup/shutdown lifecycle |
| `types.go` | Connection, QueryResult, MultiQueryResult, TableInfo, DatabaseInfo, IndexInfo, ForeignKeyInfo, TableStats, EditRequest, EditResult |
| `config.go` | connectionToDBConfig, getDriverForConfig (pool-aware), loadConnections, saveConnections |
| `pool.go` | connectionPool with getOrCreate (double-check locking inside pool.mu), buildKey, evictOldest, getHealthy, MaxPoolSize=50 |
| `crypto.go` | AES-256-GCM encrypt/decrypt, initEncryptionKey (global `var encryptionKey []byte`) |
| `connection.go` | GetSupportedDatabases, SaveConnection, DeleteConnection, TestConnection, ConnectToDatabase (uses pool.getOrCreate) |
| `query.go` | ExecuteQuery (delegates to WithTimeout), ExecuteMultiQuery, ExecuteNonQuery, splitQueries |
| `query_timeout.go` | ExecuteQueryWithTimeout (Default=30s, Max=300s), ExecuteMultiQueryWithTimeout |
| `schema.go` | GetDatabases/Tables/Views/Functions/Columns/Indexes/ForeignKeys/Stats, sanitizeIdentifier, escapeStringLiteral |
| `data_editor.go` | EditTableData (INSERT/UPDATE/DELETE), EditRequest with PrimaryKey (parameterized), BatchEdit |
| `data_export.go` | ExportData to CSV/JSON/Excel/SQL, ImportData |
| `data_compare.go` | CompareTableData, CompareQueryData |
| `transaction.go` | BeginTransaction, ExecuteInTransaction, Commit/Rollback, globalTransactions map |
| `audit.go` | AuditLogger singleton (sync.Once), Log, appendToFile, truncateQuery (rune-based), GetLogs |
| `redis_api.go` | Redis Wails bindings, getRedisDriver (type assertion to *db.RedisDriver) |
| `i18n.go` | MessageKey enum, a.t(key, lang), zh/en message maps |
| `autocomplete.go` | GetAutoCompleteSuggestions (table/column/keyword/function/database) |
| `query_analyzer.go` | AnalyzeQuery, ExplainQuery, complexity scoring |
| `sql_formatter.go` | FormatSQL (beautify), MinifySQL |
| `window.go` | WindowMinimize/Maximize/Close/IsMaximized |
| `filedialog.go` | OpenFileDialog, SaveFileDialog |

### Database Driver Layer (`db/` package)

| File | Responsibility |
|------|---------------|
| `db/db.go` | DatabaseDriver interface, DriverManager, newDriver() switch, ConnectionConfig, ColumnInfo |
| `db/types.go` | TableInfo, ViewInfo, FunctionInfo |
| `db/postgresql.go` | PostgreSQL/PolarDB/GaussDB driver |
| `db/mysql.go` | MySQL driver (SSLMode support: Tls=false/preferred/true) |
| `db/sqlite.go` | SQLite driver (CGO) |
| `db/redis.go` | Redis driver + RedisKeyInfo, SetRedisKeyValue, ExecuteRedisCommand, type assertions on value |

### Frontend (Pure JavaScript)

`frontend/dist/` — no React/Vue, global `state` object, `WailsAPI` bridge (app.js:24-73).

| File | Responsibility |
|------|---------------|
| `app.js` | Main logic, state management, WailsAPI calls, 57 innerHTML/insertAdjacentHTML usages |
| `index.html` | Main HTML structure (870 lines) |
| `i18n.js` | Frontend translation |
| `lib/monaco-editor/` | SQL editor |

---

## Database Driver Interface

All drivers implement `DatabaseDriver` (db/db.go:42-53):

```go
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
```

Redis driver adds: `GetRedisKeyInfo`, `SetRedisKeyValue`, `DeleteRedisKey`, `ExecuteRedisCommand`, `GetRedisInfo`, `GetRedisDBSize`, `ScanRedisKeys`.

### Adding New Drivers

1. Create driver file in `db/` implementing `DatabaseDriver` interface
2. Register in `newDriver()` switch (db/db.go:65-78)
3. Add entry to `GetSupportedDatabases()` (connection.go:11-20)
4. Update frontend if special UI handling needed

---

## Connection Pool

- Max 50 connections (`MaxPoolSize` in pool.go:14)
- Key format: `{type}:{host}:{port}:{username}:{database}` (pool.go:79-81)
- `getOrCreate()` uses internal double-check locking with `pool.mu`
- Eviction: oldest by `createdAt` (FIFO)
- Health check: 3s ping timeout
- `getHealthy`: validates with ping, but has stale reference race (see pitfalls)

---

## Security

- Passwords: AES-256-GCM encrypted before storage (crypto.go)
- Key: `~/.db-client/.key` (0600 perms, Base64 encoded, 32 bytes)
- SQL injection: `sanitizeIdentifier()` for table/column names
- Audit: `AuditLogger` tracks all queries and sensitive data access
- Config: `connections.json` stored at `~/.db-client/` (0700 dir, 0600 file)

---

## Known Security Issues (Top 5)

1. **Frontend XSS** — 57 uses of `innerHTML`/`insertAdjacentHTML` (some now fixed, see app.js). Any unsanitized server data in DOM poses XSS risk.
2. **MySQL plaintext credentials by default** — Driver supports SSLMode (disabled/preferred/required/verify-ca/verify-full) but defaults to no TLS. Credentials sent unencrypted over network when SSLMode left empty.
3. **Redis command injection** — `ExecuteRedisCommand` allows arbitrary commands including destructive ones like FLUSHALL. No whitelist applied.
4. **No query audit coverage** — Core query operations (ExecuteQuery, ExecuteMultiQuery, ExecuteNonQuery) are not audit-logged.
5. **Pool getHealthy TOCTOU race** — `getHealthy` reads driver under RLock, releases, pings. Between release and Lock re-acquire, entry could be removed. Stale reference race.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| `docs/AGENTS.md` | AI agent entry point: commands, conventions, pitfalls, dependencies |
| `docs/01-overview.md` | Project vision, priorities, tech stack, metrics, risks, business model |
| `docs/02-feature-design.md` | Feature design with module breakdown, API mapping, traceability matrix |
| `docs/02-architecture.md` | System architecture, IPC flow, module boundaries, data flow diagrams |
| `docs/03-architecture.md` | Directory tree with line-number references |
| `docs/03-data-models.md` | All Go struct definitions with field documentation |
| `docs/04-api-reference.md` | Full Wails bindings API (72 implemented) with signatures and error handling |
| `docs/05-ui-pages.md` | UI layout, panels, components, 8 modal + 2 panel, modular refactor plan |
| `docs/06-security.md` | Encryption, injection defense, audit, vulnerabilities |
| `docs/07-development-guide.md` | Build setup, testing, contributing, design traceability |
| `docs/ui-01-design-system.md` | Terminal Noir design system: color tokens, typography, spacing, motion, DPI scaling |
| `docs/ui-02-visual-spec.md` | 15 pixel-level visual specs with ASCII layouts and state matrices |
| `docs/ui-03-interaction-flow.md` | 18 interaction flows: DDL confirm, import, Monaco fallback, copy-paste, edge cases |
| `docs/10-interface-contract.md` | Frontend-backend contracts, type mapping, EditRequest V2 (PrimaryKey), Wails IPC perf |

### Key Cross-References

- **Data models**: See `docs/03-data-models.md` for all struct definitions
- **API reference**: See `docs/04-api-reference.md` for all Wails bindings
- **Security details**: See `docs/06-security.md` for vulnerability analysis

---

## Code Conventions

- Go backend: `package main` (except `db/` = `package db`)
- Frontend: pure JS, global `state` object, `WailsAPI` bridge
- i18n: use `a.t(MsgXxx, lang)`, never hardcode strings
- SQL identifiers: always `sanitizeIdentifier()` before string interpolation
- Passwords: always `decryptPassword()` before passing to driver
- Pool access: use `pool.getOrCreate()`, not manual double-check with `poolMutex`
- No comments in Go code unless explicitly asked

---

## Wails Bindings

All exported methods on `App` struct are available via `window.go.main.App.MethodName()`. See `frontend/wailsjs/go/main/App.d.ts` for full API (72 methods).

---

## Configuration Storage

| Item | Path |
|------|------|
| Connections | `~/.db-client/connections.json` |
| Encryption key | `~/.db-client/.key` (0600) |
| Audit logs | `~/.db-client/logs/audit_YYYY-MM-DD.log` |
| Language config | `~/.db-client/config.json` |