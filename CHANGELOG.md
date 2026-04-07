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

### Changed

- Refactored `app.go` (1565 lines) into multiple smaller files for better maintainability:
  - `app.go` - App struct, lifecycle, i18n
  - `config.go` - Configuration management
  - `connection.go` - Connection management methods
  - `schema.go` - Database schema operations
  - `query.go` - Query execution
  - `test.go` - Test services
  - `window.go` - Window controls
  - `filedialog.go` - File dialogs
  - `types.go` - Type definitions
- Fixed module name inconsistency (`db-client` → `db-server`)
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
