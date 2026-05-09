# D05 - UI Pages & Components / UI 页面与组件文档

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于 frontend/dist/index.html (870行) + app.js (3502行) 撰写

---

## 1. Main Layout / 主布局

### 1.1 Application Container (index.html:28)

```
┌──────────────────────────────────────────────────────────┐
│ Toolbar (header.toolbar)               [1280×40px]        │
│ ├─ Logo "DB Client" + New/Query/Run/Refresh buttons      │
│ ├─ Language/Settings/Theme toggle                        │
│ └─ Window controls: minimize/maximize/close              │
├──────────────┬───────────────────────────────────────────┤
│ Sidebar      │ Workspace                                 │
│ (260px)      │                                           │
│ ├─ Conn List │ ├─ Tab Bar                                │
│ ├─ DB Tree   │ ├─ Welcome Panel (default)                │
│              │ ├─ Editor Panel (SQL editor)               │
│              │ ├─ Results Panel (below editor)            │
│              │ ├─ Data View Panel (Navicat style)         │
│              │                                           │
├──────────────┴───────────────────────────────────────────┤
│ Status Bar (footer.status-bar)                           │
│ ├─ Connection status + name                             │
│ └─ Language + Window size + Clock                        │
└──────────────────────────────────────────────────────────┘
```

**Frameless Window**: Custom title bar via `toolbar` (main.go:32 `Frameless: true`)
**Resize Handles**: 8 resize handles for window borders (index.html:18-26)

---

## 2. Toolbar / 工具栏 (index.html:30-116)

### 2.1 Left Section (toolbar-left)

| Button | Icon | Action | i18n Key |
|--------|------|--------|----------|
| New Connection | Circle+ | `openConnectionDialog()` | newConnection |
| New Query | Document+ | `createNewTab()` | newQuery |
| Run Query | Triangle (play) | `executeQuery()` | executeQuery |
| Refresh | Arrows | `refreshConnection()` | refresh |

### 2.2 Right Section (toolbar-right)

| Button | Icon | Action |
|--------|------|--------|
| Language | Globe | `openLanguageSettings()` |
| Settings | Gear | `openSettings()` |
| Theme Toggle | Sun/Moon | `toggleTheme()` |
| Minimize | — | `minimizeWindow()` |
| Maximize | Square | `maximizeWindow()` |
| Close | X | `closeWindow()` |

---

## 3. Sidebar / 侧边栏 (index.html:122-152)

### 3.1 Connection List (connectionList)

**HTML**: `<div class="connection-list" id="connectionList">` (index.html:133)

**渲染**: `loadSavedConnections()` (app.js:1131+) → 遍历 state.connections → 生成 HTML

**每项显示**: Connection name, type icon, color indicator, expand button

**交互**:
- Click → `selectConnection(conn)` → 加载数据库树
- Double-click → `connectAndExpand(conn)`
- 右键 → 上下文菜单

### 3.2 Database Tree (dbTree)

**HTML**: `<div class="db-tree" id="dbTree">` (index.html:138)

**结构**:
```
└─ Databases (tree-header + expand-btn)
   ├─ db_name_1 (database node)
   │  ├─ Tables (expand section)
   │  │  ├─ table_1
   │  │  ├─ table_2
   │  │  └─ ...
   │  ├─ Views (expand section)
   │  ├─ Functions (expand section)
   │  ├─ Indexes (expand section)
   │  └─ ...
   ├─ db_name_2
   └─ ...
```

**渲染**: `loadDatabaseTree()` (app.js:1407+)
- `WailsAPI.getDatabases()` → 遍历每个数据库
- `WailsAPI.getTables()` / `getViews()` / `getFunctions()` → 子节点

**交互**:
- Click database → `selectDatabase(name)` → 刷新 editor database selector
- Click table → `openDataView(table)` → 显示 Data View Panel
- 右键 → 上下文菜单 (新查询/刷新/删除)

---

## 4. Workspace / 工作区 (index.html:157)

### 4.1 Tab Bar (tabBar)

**HTML**: `<div class="tab-bar" id="tabBar">` (index.html:159)

**Tab 结构**: `<div class="tab" data-id="{id}">` → label + close button

**交互**:
- Click tab → `switchTab(id)` → 显示对应面板
- Click close → `closeTab(id)`
- Click "+" → `createNewTab()`

**State**: `state.tabs[]` — 每个 tab 保存 {id, name, connection, database, editorContent, results}

---

### 4.2 Welcome Panel (welcomePanel)

**HTML**: `<div class="welcome-panel" id="welcomePanel">` (index.html:173-197)

**默认显示**: 初始状态，无活动 tab 时显示

**内容**: Logo + "DB Client" 标题 + "数据库管理工具" 描述 + 两个按钮:
- "新建连接" → `openConnectionDialog()`
- "新建查询" → `createNewTab()`

---

## 5. SQL Editor Panel / SQL 编辑器面板 (index.html:200-243)

### 5.1 Editor Toolbar (editor-toolbar)

**HTML**: `<div class="editor-toolbar">` (index.html:201)

| Button | Icon | Action |
|--------|------|--------|
| Format | Lines | `formatSQL()` |
| Execute | Play triangle | `executeQuery()` |
| Explain | Circle+info | `explainQuery()` |
| — divider — | | |
| Save | Document | `saveQuery()` |
| Load | Folder | `loadQuery()` |

**Database Selector**: `<select id="queryDatabase">` (index.html:234-236) — 选择当前数据库

### 5.2 Editor Container (editorContainer)

**HTML**: `<div class="editor-container" id="editorContainer">` (index.html:239)

**主编辑器**: `<div id="monacoEditor">` — Monaco Editor 渲染目标

**降级编辑器**: `<textarea id="fallbackEditor">` (index.html:241) — Monaco 加载失败时使用

**初始化**: `initEditor()` (app.js)
- 加载 Monaco: `require(['vs/editor/editor.main'], callback)`
- 创建实例: `monaco.editor.create(document.getElementById('monacoEditor'), options)`
- 主题: `vs-dark` (dark) / `vs` (light)

**功能**: 语法高亮, IntelliSense, 多光标, 代码折叠, 搜索替换

---

## 6. Results Panel / 结果面板 (index.html:249-268)

### 6.1 Results View Tabs

**HTML**: `<div class="results-view-tabs" id="resultViewTabs">` (index.html:251)

| Tab | ID | Default | Content |
|-----|----|---------|---------|
| Messages | rv-messages | 显示 | 查询执行消息 (成功/失败/时间) |
| Summary | rv-summary | 隐藏 | 查询统计摘要 |
| Results | rv-results | 隐藏 | 数据表格 (有结果时显示) |

### 6.2 Messages View (rv-messages)

**渲染**: `displayQueryResults()` (app.js:2915)

**内容**:
- 成功消息: "查询成功, 返回 N 行, 耗时 Xms"
- 错误消息: 红色显示错误详情
- 多查询: 每条查询结果逐一显示

### 6.3 Summary View (rv-summary)

**内容**: 查询统计 (行数/耗时/查询类型/数据库)

### 6.4 Results View (rv-results)

**内容**: HTML 表格渲染查询结果数据

### 6.5 Results Info Bar (results-info)

**HTML**: `<div class="results-info">` (index.html:263)

**显示**: `result-count` (行数) + `result-time` (耗时)

---

## 7. Data View Panel / 数据查看面板 (index.html:273-525)

Navicat 风格的表格数据查看器，点击数据库树中的表时显示。

### 7.1 Data View Toolbar (data-view-toolbar)

**HTML**: `<div class="data-view-toolbar">` (index.html:275)

**Tabs** (data-view-tabs):
| Tab | data-view | Content |
|-----|-----------|---------|
| 内容 (Content) | content | 数据网格 |
| 表结构 (Structure) | structure | 列信息 |
| 索引 (Indexes) | indexes | 索引信息 |
| 外键 (Foreign Keys) | foreign-keys | 外键信息 |

**Actions** (data-view-actions):
| Button | Action |
|--------|--------|
| + 添加记录 | `addNewRow()` |
| 🗑 删除选中 | `deleteSelectedRows()` |
| — divider — | |
| 💾 保存更改 | `saveDataChanges()` |
| ↩ 撤销更改 | `discardChanges()` |
| — divider — | |
| 🔄 刷新 | `refreshDataView()` |

### 7.2 Filter Bar (data-view-filter)

**HTML**: `<div class="data-view-filter">` (index.html:316)

**Left (筛选)**:
- Column selector (`filterColumn`) — 列名下拉
- Operator selector (`filterOperator`) — =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL
- Value input (`filterValue`)
- Apply/Clear buttons

**Right (排序)**:
- Column selector (`sortColumn`)
- Order toggle (`sortOrder`) — ASC/DESC

### 7.3 Data Grid (data-view-grid)

**HTML**: `<div class="data-view-grid" id="dataViewGrid">` (index.html:352)

**表格结构**: `<table class="dv-table" id="dvTable">`

**渲染**: `loadDataView(connection, database, table)` (app.js:1640+)
- `WailsAPI.getTableColumns()` → 构建列头
- `WailsAPI.executeQuery()` → `SELECT * FROM table LIMIT N OFFSET M` → 渲染行

**特性**:
- 列宽可拖拽调整
- 行选中 (checkbox)
- 双击行 → 行内编辑模式
- NULL 值灰色显示

### 7.4 Status Bar (data-view-status)

**HTML**: `<div class="data-view-status">` (index.html:364)

**Left**: Record count + Selected count + Table engine

**Right**: Pagination controls:
| Button | Action |
|--------|--------|
| << First | `dataViewFirstPage()` |
| < Prev | `dataViewPrevPage()` |
| > Next | `dataViewNextPage()` |
| >> Last | `dataViewLastPage()` |
| Page size selector | 50/100/200/500/1000 条/页 |
| Go to page input | `dvGoToPage` |

**默认页大小**: 100 条/页 (index.html:398)

### 7.5 Structure View (structureView)

**HTML**: `<div class="structure-view" id="structureView">` (index.html:412)

**列定义** (index.html:414-427):
| 列 | 宽度 | 内容 |
|----|------|------|
| # | 40px | 序号 |
| 列名 | 180px | Column Name |
| 数据类型 | 150px | Data Type |
| 长度 | 80px | Length |
| 小数点 | 80px | Decimal |
| 不是 null | 80px | Nullable |
| 主键 | 80px | Primary Key |
| 自增 | 80px | Auto Increment |
| 默认值 | - | Default Value |
| 注释 | 150px | Comment |
| 字符集 | 80px | Charset |
| 排序规则 | 120px | Collation |

### 7.6 Indexes View (indexesView)

**HTML**: `<div class="indexes-view" id="indexesView">` (index.html:437)

**工具栏**: "新建索引" / "删除索引"

**列定义**:
| 列 | 宽度 | 内容 |
|----|------|------|
| Checkbox | 40px | 多选 |
| 索引名 | 180px | Index Name |
| 类型 | 100px | Type (PRIMARY/UNIQUE/INDEX/FULLTEXT) |
| 唯一 | 80px | Unique |
| 列 | - | Columns (comma separated) |
| 基数 | 120px | Cardinality |
| 注释 | 150px | Comment |
| 操作 | 100px | Actions |

**底部信息**: 索引数量 + 索引大小

### 7.7 Foreign Keys View (foreignKeysView)

**HTML**: `<div class="foreign-keys-view" id="foreignKeysView">` (index.html:482)

**工具栏**: "新建外键" / "删除外键"

**列定义**:
| 列 | 宽度 | 内容 |
|----|------|------|
| Checkbox | 40px | 多选 |
| 外键名 | 180px | FK Name |
| 列名 | 150px | Column |
| → | 50px | Arrow icon |
| 引用表 | 150px | Referenced Table |
| 引用列 | 150px | Referenced Column |
| 更新规则 | 100px | On Update |
| 删除规则 | 100px | On Delete |
| 操作 | 100px | Actions |

**底部**: 外键数量 + 关系图 (`fkVisual`)

---

## 8. Connection Dialog / 连接对话框 (index.html:567-708)

### 8.1 Modal Structure

**HTML**: `<div class="modal-overlay" id="connectionModal">`

**触发**: `openConnectionDialog()` → 显示 modal

**关闭**: `closeConnectionDialog()` / 点击关闭按钮

### 8.2 Database Type Selector

**HTML**: `<div class="connection-type-selector">` (index.html:578)

**6 种类型按钮**: PostgreSQL, MySQL, PolarDB, GaussDB, SQLite, Redis

**交互**: `selectDbType(type)` → 更新默认端口, 显示/隐藏 SQLite 文件路径行

### 8.3 Connection Form

| Field | ID | Placeholder | Default |
|-------|----|------------|---------|
| 连接名称 | connName | "我的数据库" | — |
| 主机 | connHost | "localhost" | "localhost" |
| 端口 | connPort | "5432" | 根据类型变化 |
| 用户名 | connUser | "postgres" | 根据类型变化 |
| 密码 | connPassword | "••••••••" | — |
| 数据库 | connDatabase | — | "连接后选择数据库" |

**SQLite 特殊字段**: `<div id="sqlitePathRow">` (index.html:668) — 文件路径 + "浏览" 按钮

**Checkbox 字段** (index.html:677-686):
- 保存密码 (`connSavePassword`)
- 启动时自动连接 (`connAutoConnect`, 默认选中)

### 8.4 Footer Actions

| Button | Action | Side |
|--------|--------|------|
| 测试连接 | `testConnection()` | Left |
| 取消 | `closeConnectionDialog()` | Right |
| 保存 | `saveConnection()` | Right (primary) |

---

## 9. Transaction Dialog / 事务对话框

**当前状态**: 事务功能在后端已实现，但前端 UI 对话框尚未在 index.html 中定义。事务操作通过 `ExecuteTransactionBatch()` API 调用执行，前端需要新建 Transaction Dialog。

---

## 10. Export/Import Dialog / 导出导入对话框

**当前状态**: 导出/导入后端 API 已实现，但前端 UI 对话框尚未在 index.html 中定义。需要新建 Export/Import Dialog。

---

## 11. Data Compare Dialog / 数据对比对话框

**当前状态**: 数据对比后端 API 已实现，但前端 UI 对话框尚未在 index.html 中定义。需要新建 Compare Dialog。

---

## 12. Context Menus / 上下文菜单 (index.html:836-865)

### 12.1 Context Menu Structure

**HTML**: `<div class="context-menu" id="contextMenu">` (index.html:836)

**菜单项**:

| Item | Icon | Action | Context |
|------|------|--------|---------|
| 打开 (Open) | External link | `contextAction('open')` | Connection/Table |
| 新查询 (New Query) | Document | `contextAction('new_query')` | Connection/Table/DB |
| — divider — | | | |
| 刷新 (Refresh) | Arrows | `contextAction('refresh')` | Connection/Table/DB |
| — divider — | | | |
| 删除 (Delete) | Trash | `contextAction('delete')` | Connection |

**动态生成**: `showConnectionContextMenu(conn)` / `showTableContextMenu(table, conn, db)` (app.js:593+)

### 12.2 Connection Context Menu

**菜单项**: 打开, 新查询, 刷新, 删除

### 12.3 Table Context Menu

**菜单项**: 打开数据视图, 新查询, 刷新

### 12.4 Database Context Menu

**菜单项**: 新查询, 刷新

---

## 13. Modal Dialogs / 模态对话框

### 13.1 Language Dialog (languageModal)

**HTML**: `<div class="modal-overlay" id="languageModal">` (index.html:711)

**内容**: 两个语言按钮:
- 🇨🇳 简体中文 (`data-lang="zh"` → `setLanguage('zh')`)
- 🇺🇸 English (`data-lang="en"` → `setLanguage('en')`)

### 13.2 Settings Dialog (settingsModal)

**HTML**: `<div class="modal-overlay" id="settingsModal">` (index.html:737)

**左侧导航** (settings-sidebar):
| Button | Section | Icon |
|--------|---------|------|
| 常规 (General) | general | Gear |
| 编辑器 (Editor) | editor | Document |
| 外观 (Appearance) | appearance | Sun |

**常规设置** (index.html:772-790):
- Language selector (zh/en)
- 连接超时 (秒): number input
- 查询超时 (秒): number input

**编辑器设置** (index.html:792-815):
- 字体大小: 12/14/16/18px
- Tab 大小: 2/4 空格
- 行号: checkbox

**外观设置** (index.html:817-829):
- 主题: 深色/浅色/跟随系统

### 13.3 Error Details Dialog

**渲染**: `showErrorDetails(message, details)` (app.js)

**触发**: 点击错误消息展开按钮

---

## 14. Settings Panel / 设置面板

见 Section 13.2 — Settings Dialog 即为 Settings Panel

---

## 15. Welcome/Home Panel / 首页

见 Section 4.2 — Welcome Panel

---

## 16. Notification System / 通知系统

**实现**: `showNotification(message, type)` (app.js)

**类型**: success / error / warning / info

**渲染**: 临时 DOM 元素，自动消失 (3s timeout)

---

## 17. Frontend State Management / 前端状态管理

### 17.1 Global State Object (app.js:9-19)

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

### 17.2 Mock Mode (app.js:104-127)

Wails 未就绪时使用 mock 数据:

```javascript
function loadMockConnections() {
    state.connections = [
        {id: "1", name: "Local PostgreSQL", type: "postgresql", host: "localhost", ...},
        {id: "2", name: "Local MySQL", type: "mysql", ...},
        ...
    ];
    renderConnectionList();
}
```

**触发条件**: 5秒内 Wails API 未就绪 (L114-126)

---

## 18. Panel Resizing / 面板调整大小

### 18.1 Sidebar Resize (sidebarResize)

**HTML**: `<div class="resize-handle" id="sidebarResize">` (index.html:154)

**实现**: `initResizablePanels()` (app.js) → 拖拽调整 sidebarWidth

### 18.2 Editor/Results Split (splitHandle / editorResultsSplit)

**HTML**: `<div class="split-handle" id="splitHandle">` (index.html:246)

**实现**: 拖拽调整 editorHeight / resultsHeight

---

## 19. Missing UI Components / 缺失的 UI 组件

以下后端 API 已实现但前端 UI 尚未创建:

| 功能 | 后端 API | 缺失 UI |
|------|----------|---------|
| 事务管理 | BeginTransaction, ExecuteInTransaction, Commit/Rollback, ExecuteTransactionBatch | Transaction Dialog |
| 数据导出 | ExportData | Export Dialog |
| 数据导入 | ImportData | Import Dialog |
| 数据对比 | CompareTables, CompareQueries | Compare Dialog |
| 查询分析 | GetExplainPlan, AnalyzeQuery | Explain/Analysis Panel |
| SQL 格式化 | FormatSQL, BeautifySQL | 已集成到 editor toolbar |
| SQL 验证 | ValidateSQL | 验证结果展示 |
| 自动补全 | GetAutoCompleteSuggestions | Monaco Editor 内置集成 |
| 审计日志 | AuditLogger.GetLogs (内部) | Audit Log Viewer Dialog |
| Redis 专用 | GetRedisKeyInfo, SetRedisKeyValue, etc. | Redis Key Viewer Panel |
| 查询超时 | ExecuteQueryWithTimeout | Timeout setting in query toolbar |