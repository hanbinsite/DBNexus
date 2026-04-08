# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Security

- **CRITICAL**: Fixed SQL injection vulnerabilities in `GetViews`, `GetFunctions`, `GetTableIndexes`, and `GetTableForeignKeys` methods
- Added `sanitizeIdentifier()` function to properly sanitize SQL identifiers before use in queries
- Fixed SQL injection in `GetTableStructure` for MySQL and SQLite drivers
- Fixed config file permissions from `0644` to `0600` for better security
- Improved Redis driver: replaced dangerous `KEYS *` with safe `SCAN` command to prevent blocking on large datasets
- Added proper error handling for nil driver checks in connection pool

### Added

- **SQL Auto-Complete System**: Comprehensive auto-completion for SQL queries
  - Keyword suggestions (70+ SQL keywords)
  - Function suggestions (100+ built-in functions)
  - Table and column name suggestions
  - Database name suggestions
  - Context-aware completion based on query position
  - Support for MySQL and PostgreSQL specific functions
  - `GetAutoCompleteSuggestions()` API for frontend integration
  
- **Data Editing**: Full CRUD operations for table data
  - Insert new rows with validation
  - Update existing rows with WHERE clause or primary key
  - Delete rows with safety checks
  - Batch edit operations
  - SQL statement preview before execution
  - `EditTableData()` API with full audit logging
  
- **Data Export**: Multiple format support for query results
  - CSV export with proper escaping
  - JSON export with formatting
  - Excel (.xlsx) export with auto-column-width
  - SQL INSERT statement generation
  - Export to `~/.db-client/exports/` directory
  - `ExportData()` API with audit logging
  
- **Data Import**: Import data from external files
  - CSV import with header detection
  - JSON import with array/object support
  - Batch insert with error handling
  - Import from `~/.db-client/imports/` directory
  - `ImportData()` API with progress tracking
  
- **Query Timeout Control**: Configurable timeout to prevent interface freezing
  - Default 30 seconds timeout
  - Maximum 300 seconds timeout
  - Helpful timeout messages with optimization suggestions
  - `ExecuteQueryWithTimeout()` and `ExecuteMultiQueryWithTimeout()` APIs
  
- **Audit Logging System**: Comprehensive audit trail for enterprise compliance
  - Records all SQL query executions (success/failure)
  - Tracks connection events (connect/disconnect)
  - Logs connection configuration changes (save/delete)
  - Captures application lifecycle events (startup/shutdown)
  - Supports log filtering, export, and automatic cleanup
  - Logs stored in `~/.db-client/logs/audit_YYYY-MM-DD.log`

### Changed

- **CRITICAL FIX**: Fixed connection pool cache key inconsistency
  - Unified connection pool to use `buildKey()` (includes database name) instead of `buildConnectionKey()` (excludes database name)
  - This fix prevents querying wrong database when switching databases
  - Updated `config.go:getDriverForConfig()` and `connection.go:ConnectToDatabase()` to use consistent key strategy
- Refactored `app.go` (1565 lines) into multiple smaller files for better maintainability:
  - `app.go` - App struct, lifecycle, i18n
  - `config.go` - Configuration management
  - `connection.go` - Connection management methods
  - `schema.go` - Database schema operations
  - `query.go` - Query execution
  - `query_timeout.go` - Query timeout control
  - `audit.go` - Audit logging system
  - `autocomplete.go` - SQL auto-completion
  - `data_editor.go` - Data editing operations
  - `data_export.go` - Data import/export
  - `test.go` - Test services
  - `window.go` - Window controls
  - `filedialog.go` - File dialogs
  - `types.go` - Type definitions
- Fixed module name inconsistency (`db-client` → `db-server`)
- Added excelize/v2 dependency for Excel export functionality
- Upgraded Go version to 1.24.0 for better performance
- Added `pooledDriver` wrapper struct for connection pool with health tracking
- Added connection health check with ping timeout (3 seconds)
- Replaced hardcoded Chinese error messages with i18n system

### Added

- Added comprehensive test suite with 18 test cases covering:
  - `sanitizeIdentifier` (including dangerous input tests)
  - `parsePostgresArray`
  - `convertRefAction`
  - `splitQueries`
  - Connection pool operations
  - Connection save/delete
  - `getDefaultDatabase`
  - `connectionToDBConfig`
  - `GetSupportedDatabases`
  - `GetSupportedFeatures`
- Added GitHub Actions CI workflow (`.github/workflows/ci.yml`)
- Added golangci-lint configuration (`.golangci.yml`)
- Added proper error types for Redis unsupported operations (`ErrRedisUnsupportedOperation`)

### Fixed

- Fixed hardcoded Chinese strings to use i18n system (`app.go:397,412`)
- Fixed config file permissions (`0644` → `0600`)
- Fixed potential nil pointer dereference in connection pool `remove` and `closeAll` methods
- Removed unused functions: `contains` wrapper, `getDriverForConnection`

## [1.0.0] - Initial Release

### Added

- Cross-platform desktop database client
- Support for PostgreSQL, MySQL, PolarDB, GaussDB, SQLite, Redis
- SQL editor with Monaco Editor
- Connection management with password encryption (AES-256-GCM)
- Multi-tab interface
- Query history
- Data viewer
- Internationalization (Chinese/English)
