# D07 - Development Guide / 开发指南

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于项目实际配置与代码撰写

---

## 1. Prerequisites / 前置条件

### 1.1 Required Tools

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| Go | 1.24.0+ | Backend compilation | https://go.dev/dl/ |
| Wails CLI | v2.12.0+ | Desktop framework + dev server | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| Node.js | Any recent | Frontend npm packages (Monaco) | https://nodejs.org/ |
| GCC/MinGW | Required | CGO for go-sqlite3 | Windows: MinGW-w64, Linux: gcc |

### 1.2 Wails Installation Verification

```bash
wails doctor
```

输出应显示: GO ✓, Node ✓, Platform ✓, CGO ✓

### 1.3 CGO Requirement

SQLite 驱动 (`github.com/mattn/go-sqlite3`) 需要 C 编译器:
- Windows: 安装 MinGW-w64 (推荐通过 MSYS2)
- Linux: `apt-get install gcc`
- macOS: Xcode Command Line Tools

---

## 2. Setup and Build / 构建配置

### 2.1 Development Mode

```bash
wails dev
```

**行为**: 启动开发服务器，Go 后端 + 前端热重载。窗口标题带 "[DEV]" 前缀。

### 2.2 Production Build

```bash
wails build
```

**输出**: `build/bin/db-client.exe` (Windows) 或对应平台可执行文件

**平台脚本**:
- Windows: `build.bat`
- Linux/Mac: `build.sh`

### 2.3 Build Configuration (wails.json)

```json
{
  "name": "db-server",
  "outputfilename": "db-server",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": "hanbin"
}
```

### 2.4 Go Module Configuration (go.mod)

```
module db-server
go 1.24.0
```

**6 个直接依赖**: wails/v2, lib/pq, go-sql-driver/mysql, go-sqlite3, go-redis/v9, excelize/v2

---

## 3. Project Structure / 项目结构

```
db-server/
├── main.go                 # Entry point, Wails configuration
├── app.go                  # App struct, lifecycle, language management
├── types.go                 # Shared data structures (Connection, QueryResult, etc.)
│
├── db/                     # Database driver abstraction layer
│   ├── db.go               # DatabaseDriver interface + DriverManager + DBType
│   ├── types.go            # db package types (TableInfo, ViewInfo, FunctionInfo)
│   ├── postgresql.go        # PostgreSQL/PolarDB/GaussDB driver
│   ├── mysql.go            # MySQL driver
│   ├── sqlite.go           # SQLite driver (CGO)
│   └── redis.go            # Redis driver + specialized API
│
├── pool.go                 # Connection pool (MaxPoolSize=50)
├── connection.go           # Connection CRUD + test + connect
├── query.go                # Query execution + multi-query + split
├── query_timeout.go        # Timeout-controlled query execution
├── schema.go               # Schema inspection (tables/views/functions/indexes/FK/stats)
├── data_editor.go          # Table data editing (INSERT/UPDATE/DELETE)
├── data_export.go           # Data import/export (CSV/JSON/Excel/SQL)
├── data_compare.go          # Data comparison (tables/queries)
├── transaction.go           # Transaction management
├── redis_api.go             # Redis-specific API endpoints
├── autocomplete.go          # SQL auto-completion
├── query_analyzer.go        # EXPLAIN plan + query analysis
├── sql_formatter.go         # SQL formatting/validation
├── audit.go                 # Audit logging singleton
├── crypto.go               # AES-256-GCM encryption
├── i18n.go                 # Internationalization (zh/en)
├── config.go               # Config loading/saving + driver helper
├── window.go               # Window controls (Wails runtime)
├── filedialog.go           # File dialogs (Wails runtime)
├── test.go                 # Connection testing + server info
├── app_test.go             # Unit tests
│
├── frontend/
│   ├── dist/               # Compiled frontend assets
│   │   ├── index.html      # Main HTML (870 lines)
│   │   ├── app.js          # Main JS (3502 lines)
│   │   ├── i18n.js         # Frontend translations (321 lines)
│   │   ├── styles.css      # CSS themes
│   │   └── lib/monaco-editor/  # Monaco Editor prebuilt
│   └── wailsjs/            # Auto-generated Wails bindings
│       ├── go/main/App.js   # JS call proxy (279 lines)
│       ├── go/main/App.d.ts # Type declarations (142 lines)
│       └── go/models.ts     # Shared model types
│
├── go.mod / go.sum
├── wails.json
├── build.bat / build.sh
├── CLAUDE.md
└── docs/
```

---

## 4. Adding New Database Drivers / 添加新的数据库驱动

### Step-by-step Process

**Step 1**: Create driver file in `db/` package

例: `db/mongodb.go`

```go
package db

import (
    "context"
    "database/sql"
)

type MongoDBDriver struct {
    // driver-specific fields
}

func NewMongoDBDriver() DatabaseDriver {
    return &MongoDBDriver{}
}

func (d *MongoDBDriver) Connect(config ConnectionConfig) error {
    // implementation
}

func (d *MongoDBDriver) Close() error { /* ... */ }
func (d *MongoDBDriver) Ping(ctx context.Context) error { /* ... */ }
func (d *MongoDBDriver) UseDatabase(ctx context.Context, database string) error { /* ... */ }
func (d *MongoDBDriver) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) { /* ... */ }
func (d *MongoDBDriver) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) { /* ... */ }
func (d *MongoDBDriver) GetTables(ctx context.Context) ([]string, error) { /* ... */ }
func (d *MongoDBDriver) GetTableStructure(ctx context.Context, tableName string) ([]ColumnInfo, error) { /* ... */ }
func (d *MongoDBDriver) GetDatabases(ctx context.Context) ([]string, error) { /* ... */ }
func (d *MongoDBDriver) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) { /* ... */ }
```

**Step 2**: Register in `db/db.go` `newDriver()` switch (db.go:65-78)

```go
func (dm *DriverManager) newDriver(dbType DBType) (DatabaseDriver, error) {
    switch dbType {
    case PostgreSQL, PolarDB, GaussDB:
        return NewPostgreSQLDriver(), nil
    case MySQL:
        return NewMySQLDriver(), nil
    case SQLite:
        return NewSQLiteDriver(), nil
    case Redis:
        return NewRedisDriver(), nil
    case MongoDB:  // ← 新增
        return NewMongoDBDriver(), nil
    default:
        return nil, fmt.Errorf("driver not found for database type: %s", dbType)
    }
}
```

**Step 3**: Add DBType constant in `db/db.go` (db.go:12-19)

```go
const (
    MongoDB DBType = "mongodb"  // ← 新增
)
```

**Step 4**: Add to `GetSupportedDatabases()` in `connection.go` (connection.go:11-20)

```go
{"id": "mongodb", "name": "MongoDB", "default_port": "27017"},  // ← 新增
```

**Step 5**: Update frontend if special UI handling needed
- Connection type selector buttons (index.html:578-619)
- Default port auto-fill logic (app.js)
- Database tree rendering for MongoDB collections

---

## 5. Adding New API Endpoints / 添加新的 API 端点

### 5.1 Backend Method

所有 exported 方法（大写字母开头）自动成为 Wails bindings:

```go
// 在任意 .go 文件中添加 (package main)
func (a *App) GetAuditLogs(limit int) []AuditLog {
    auditLogger := GetAuditLogger()
    return auditLogger.GetLogs(limit, "", "")
}
```

**Wails 自动生成**: 构建时 Wails 扫描 App struct 的 exported methods → 生成 `frontend/wailsjs/go/main/App.js` 和 `App.d.ts`

### 5.2 Frontend Integration

**app.js WailsAPI 添加**:
```javascript
const WailsAPI = {
    getAuditLogs: (limit) => window.go.main.App.GetAuditLogs(limit),
};
```

**调用**:
```javascript
const logs = await WailsAPI.getAuditLogs(100);
```

### 5.3 Rebuilding Bindings

修改 Go 方法后需要重新构建:
```bash
wails generate module
```

或重新 `wails dev` / `wails build`

---

## 6. Frontend Development Patterns / 前端开发模式

### 6.1 Global State Pattern

所有状态存储在 `state` 对象 (app.js:9-19):

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

**访问**: `state.connections`, `state.activeTab`
**修改**: 直接赋值 + 手动 DOM 更新 (无响应式框架)

### 6.2 Wails API Call Pattern

```javascript
try {
    const result = await WailsAPI.executeQuery(conn, db, sql);
    if (result.error) {
        showError(result.error);
    } else {
        renderResults(result);
    }
} catch (e) {
    showNotification(e.message, 'error');
}
```

**所有 WailsAPI 方法返回 Promise** → 使用 `await` 或 `.then()/.catch()`

### 6.3 Mock Mode for Browser Development

Wails 不可用时自动切换 mock 模式 (app.js:104-127):

```javascript
function initWails() {
    if (isWailsAvailable()) {
        state.wailsReady = true;
        loadSavedConnections();
        return;
    }
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        if (isWailsAvailable()) {
            clearInterval(poll);
            state.wailsReady = true;
            loadSavedConnections();
        } else if (attempts >= 50) {  // 5s timeout
            clearInterval(poll);
            loadMockConnections();  // ← mock data
        }
    }, 100);
}
```

**Mock 数据** (app.js:128+): 预定义的连接配置，用于浏览器内开发调试

### 6.4 Theme Pattern

```javascript
function setTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('db-client-theme', theme);
    updateEditorTheme(theme);  // Monaco theme sync
}
```

CSS 使用 `data-theme` attribute 选择器:
```css
[data-theme="dark"] { --bg-primary: #1e1e1e; }
[data-theme="light"] { --bg-primary: #ffffff; }
```

---

## 7. Testing / 测试

### 7.1 Running Tests

```bash
# All tests
go test ./...

# Specific test
go test -run TestFunctionName ./...

# With coverage
go test -cover ./...

# Verbose output
go test -v ./...
```

### 7.2 Test Coverage

**当前测试文件**: `app_test.go` (508 lines)

| Test | 行号 | 测试内容 |
|------|------|----------|
| TestSanitizeIdentifier | L9-31 | 标识符清理正常输入 |
| TestSanitizeIdentifierBlocksDangerous | L33-53 | SQL 注入字符过滤 |
| TestParsePostgresArray | L55-80 | PG 数组格式解析 |
| TestConvertRefAction | L82-101 | FK 动作码映射 |
| TestContains | L103-122 | 字符串包含 |
| TestConnectionPool | L124-142 | 连接池初始化 |
| TestConnectionPoolSetAndGet | L144-155 | 池 set/get |
| TestConnectionPoolRemove | L157-167 | 池 remove |
| TestConnectionPoolCloseAll | L169-179 | 池 closeAll |
| TestBuildKey | L181-207 | 连接键格式 |
| TestSplitQueries | L209-234 | 查询分割 |
| TestGetDefaultDatabase | L236-258 | 默认数据库映射 |
| TestConnectionSaveAndDelete | L260-301 | 连接 CRUD |
| TestGetSupportedDatabases | L303-317 | 支持的数据库列表 |
| TestGetSupportedFeatures | L319-329 | 功能列表 |
| TestConnectionToDBConfig | L331-363 | Connection→ConnectionConfig 转换 |
| TestPoolMaxSize | L365-388 | 连接池大小限制 |
| TestTransactionOptions | L390-402 | 事务选项 |
| TestTransactionResult | L404-418 | 事务结果 |
| TestCalculateComplexity | L420-436 | 查询复杂度 |
| TestExtractTables | L438-454 | 表名提取 |
| TestCountKeyword | L456-462 | 关键字计数 |
| TestGenerateRecommendations | L464-478 | 优化建议生成 |
| TestQueryAnalysisStruct | L480-508 | QueryAnalysis 结构 |

**覆盖范围**: 仅测试纯函数和 struct 操作，**未测试**需要数据库连接的方法 (ExecuteQuery, ConnectToDatabase, etc.)

**当前覆盖率**: <30% (核心模块 pool, crypto, query 缺少集成测试)

### 7.3 Adding New Tests

测试文件放在 root package (因为所有代码在 `package main`):

```go
// app_test.go 或新文件 xxx_test.go
package main

import "testing"

func TestMyNewFunction(t *testing.T) {
    result := myNewFunction("input")
    if result != "expected" {
        t.Errorf("got %q, want %q", result, "expected")
    }
}
```

---

## 8. Code Style Conventions / 代码风格约定

### 8.1 Go Style

| Convention | Example | Source |
|------------|---------|--------|
| All code in `package main` | `package main` in every .go file | 全项目 |
| Chinese comments mixed with English | `// 审计日志级别` / `// AuditLogLevel` | audit.go, many others |
| Error messages in Chinese | `"连接失败: %v"` | connection.go, data_editor.go |
| Method names: Go exported → PascalCase | `ExecuteQuery`, `GetTables` | All API methods |
| Variable names: camelCase | `poolMutex`, `dbConfig` | Throughout |
| JSON tags: snake_case | `json:"row_count"` | types.go |
| Global singletons | `auditLogger` (sync.Once), `encryptionKey` (⚠️ no sync) | audit.go, crypto.go |
| SQL identifiers: backticks for all | `` `table_name` `` | data_editor.go ⚠️ |

### 8.2 Frontend Style

| Convention | Example |
|------------|---------|
| Global state object | `const state = {...}` (app.js:9-19) |
| WailsAPI wrapper | `const WailsAPI = {...}` (app.js:24-73) |
| DOM manipulation: innerHTML | `element.innerHTML = html` (⚠️ XSS risk) |
| No module system | Single 3502-line app.js file |
| No TypeScript | Pure JavaScript ES6+ |
| CSS custom properties | `var(--bg-primary)` (theme-driven) |
| i18n data attributes | `data-i18n="connectionName"` on elements |

---

## 9. Common Patterns / 常见模式

### 9.1 Password Decryption Pattern (12 处重复)

```go
if config.SavePassword && config.Password != "" {
    decrypted, err := decryptPassword(config.Password)
    if err == nil {
        config.Password = decrypted
    }
}
```

**出现位置**: connection.go:103, connection.go:202, query.go:13, query.go:102, query.go:293, query_timeout.go:47, query_timeout.go:171, data_editor.go:54, transaction.go:71, redis_api.go:15, schema.go:176, test.go:15, test.go:94

**建议**: 统一到 `connectionToDBConfig()` (config.go:12-30)，此方法已包含解密逻辑

### 9.2 Pool Double-Check Pattern (6 处重复)

```go
a.poolMutex.RLock()
pooledDriver, exists := a.pool.get(key)
a.poolMutex.RUnlock()

if !exists {
    a.poolMutex.Lock()
    if pooledDriver, exists = a.pool.get(key); !exists {
        newDriver, err := a.driverManager.Connect(dbConfig)
        if err != nil { ... }
        a.pool.set(key, newDriver)
        pooledDriver, _ = a.pool.get(key)
    }
    a.poolMutex.Unlock()
}
```

**出现位置**: query.go:24-43, query.go:113-129, query_timeout.go:58-77, data_editor.go:66-99, transaction.go:82-97, query_analyzer.go:110-130

**建议**: 统一使用 `pool.getOrCreate(key, createFunc)` (pool.go:24-74)，已实现原子性获取+创建

### 9.3 Audit Logging Pattern

```go
auditLogger := GetAuditLogger()
auditLogger.Log(AuditLevelInfo, AuditEventQuery,
    fmt.Sprintf("操作描述: %s", detail),
    map[string]interface{}{
        "field1": value1,
        "field2": value2,
    })
```

---

## 10. Anti-Patterns / 反模式

### 10.1 Dual Locking

**问题**: `App.poolMutex` + `pool.mu` 构成双层锁 (详见 02-architecture.md Section 7)

**修复**: 移除 `App.poolMutex`，统一使用 `pool.getOrCreate()`

### 10.2 Global Mutable State

**问题**: `encryptionKey` (crypto.go:14), `globalTransactions` (transaction.go:52) 是全局可变状态

**修复**: `encryptionKey` → `sync.Once`; `globalTransactions` → App struct field

### 10.3 No Dependency Injection

**问题**: `GetAuditLogger()` 使用 singleton，无法替换为 mock 进行测试

**修复**: 将 AuditLogger 作为 App struct 字段，通过构造函数注入

### 10.4 All Code in package main

**问题**: 20+ 文件全部在 `package main`，无法独立导入/测试

**修复**: 拆分为 `internal/pool`, `internal/crypto`, `internal/audit` 等子 package

---

## 11. Debugging Tips / 调试技巧

### 11.1 Wails Dev Mode

```bash
wails dev
```

**特性**: WebView2 开发者工具可用 (F12)，Go 后端日志输出到终端

### 11.2 WebView2 DevTools

在 `wails dev` 模式下，按 **F12** 打开 WebView2 DevTools:
- Console: 查看 JS 错误和 Wails API 调用结果
- Network: 无 IPC 请求 (Wails 使用 WebView2 内部通信)
- Sources: 查看 app.js, 设置断点

### 11.3 Go Logging

```go
fmt.Printf("调试信息: %v\n", value)
```

输出到 `wails dev` 终端（不在 WebView2 Console 中显示）

### 11.4 Frontend Console Logging

```javascript
console.log('Debug:', result);
console.error('Error:', error);
```

输出到 WebView2 DevTools Console

### 11.5 Connection Pool Debugging

```go
// 查看连接池状态 (临时调试代码)
a.pool.mu.RLock()
for key, pooled := range a.pool.connections {
    fmt.Printf("Pool key: %s, created: %v, lastPing: %v\n", key, pooled.createdAt, pooled.lastPing)
}
a.pool.mu.RUnlock()
```

### 11.6 Mock Mode Browser Development

直接在浏览器打开 `frontend/dist/index.html` — Wails 不可用时自动使用 mock 数据 (app.js:104-127)

**限制**: Mock 模式下无法执行实际查询，仅可调试 UI 交互

### 11.7 Wails Logger Configuration

在 `wails.json` 中可配置日志级别:
```json
{
  "debug": {
    "openInspectorOnStartup": true
  }
}
```

---

## 12. Build Troubleshooting / 构建问题排查

### 12.1 CGO Compilation Error

**错误**: `cgo: C compiler "gcc" not found`

**修复**:
- Windows: 安装 MinGW-w64
- Linux: `sudo apt-get install build-essential`
- macOS: `xcode-select --install`

### 12.2 Wails Binding Generation Error

**错误**: 前端调用方法不存在

**修复**:
```bash
wails generate module
```
然后重启 `wails dev`

### 12.3 Monaco Editor Loading Failure

**现象**: 编辑器显示为 textarea fallback

**修复**: 确保 `frontend/dist/lib/monaco-editor/` 目录完整，包含 `min/vs/` 子目录

### 12.4 SQLite Driver Build Error

**错误**: `undefined: sqlite3`

**修复**: 确保 CGO 启用 (`CGO_ENABLED=1`)，且 gcc 可用

### 12.5 Windows Build Path Issues

**修复**: 使用 `build.bat` 而非手动 `wails build`，确保路径正确