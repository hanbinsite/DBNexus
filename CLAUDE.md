# CLAUDE.md This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DB Client is a cross-platform desktop database client built with Go and Wails v2. It provides a modern UI for managing multiple database systems including PostgreSQL, MySQL, SQLite, Redis, PolarDB, and GaussDB.

## Build Commands

```bash
# Development mode with hot reload
wails dev

# Build for production
wails build
# Or use platform-specific scripts:
# Windows: build.bat
# Linux/Mac: ./build.sh

# Run tests
go test ./...

# Run specific test
go test -run TestFunctionName ./...
```

## Architecture

### Backend (Go)

The backend follows a modular architecture with clear separation of concerns:

**Core Components:**
- `main.go` - Application entry point, Wails configuration
- `app.go` - Main App struct with Wails bindings, startup/shutdown lifecycle
- `types.go` - Shared data structures (Connection, QueryResult, TableInfo, etc.)

**Database Layer (`db/` package):**
- `db.go` - DatabaseDriver interface, DriverManager, ConnectionConfig, ColumnInfo types
- `postgresql.go` - PostgreSQL/PolarDB/GaussDB driver implementation
- `mysql.go` - MySQL driver implementation
- `sqlite.go` - SQLite driver implementation
- `redis.go` - Redis driver with specialized key/value operations

**Feature Modules (root package):**
- `connection.go` - Connection management, testing, CRUD operations
- `query.go` - Query execution, multi-query splitting, results handling
- `transaction.go` - Transaction management with isolation level support
- `schema.go` - Schema inspection (tables, views, functions, indexes, foreign keys)
- `pool.go` - Connection pooling with max 50 connections and eviction
- `data_editor.go` - Table data editing (INSERT/UPDATE/DELETE operations)
- `data_compare.go` - Table and query comparison functionality
- `audit.go` - Audit logging for security tracking
- `crypto.go` - AES-256 encryption for stored passwords
- `config.go` - Configuration file loading/saving
- `redis_api.go` - Redis-specific API endpoints
- `autocomplete.go` - SQL autocomplete suggestions
- `query_analyzer.go` - Query analysis and complexity scoring
- `data_export.go` - Data export to CSV/JSON/Excel formats
- `sql_formatter.go` - SQL beautification and minification
- `i18n.go` - Internationalization (Chinese/English)
- `window.go` - Window state management

### Frontend (JavaScript)

Pure JavaScript frontend in `frontend/dist/`:
- `app.js` - Main application logic, state management, Wails API integration
- `index.html` - Main HTML structure
- `i18n.js` - Translation handling
- `lib/monaco-editor/` - Monaco Editor for SQL editing with syntax highlighting

The frontend uses a global `state` object and communicates with Go backend via `window.go.main.App.*` bindings.

### Connection Pool

- Maximum 50 pooled connections (`MaxPoolSize` in pool.go)
- Key format: `{type}:{host}:{port}:{username}:{database}`
- Automatic eviction of oldest connections when pool is full
- Health checking via Ping before returning connections

### Security

- Passwords encrypted with AES-256-GCM before storage
- Encryption key stored in `~/.db-client/.key`
- Audit logging tracks all queries and sensitive data access
- SQL injection prevention via identifier sanitization

## Database Driver Interface

All drivers implement `DatabaseDriver` interface (db/db.go):
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

Redis driver has additional specialized methods for key operations.

## Configuration Storage

User data stored in:
- Windows: `%APPDATA%\db-client\` or `~/.db-client/`
- Connections: `connections.json`
- Encryption key: `.key`
- Audit logs: `logs/audit_YYYY-MM-DD.log`

## Wails Bindings

All exported methods on `App` struct are available to frontend via `window.go.main.App.MethodName()`. See `frontend/wailsjs/go/main/App.d.ts` for full API.

## Adding New Database Drivers

1. Create driver file in `db/` (e.g., `mongodb.go`)
2. Implement `DatabaseDriver` interface
3. Register in `db/db.go` `newDriver()` switch statement
4. Add to `GetSupportedDatabases()` in `connection.go`
5. Update frontend if special UI handling needed
