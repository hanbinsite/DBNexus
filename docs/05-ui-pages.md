# D05 — UI 页面与组件定义

> 文档版本: v2.0 | Terminal Noir设计方向 | 完全重新设计
> 联动文档: U01设计系统, U02视觉规格, U03交互流程

---

## 1. UI架构总览

### 1.1 页面层次结构

```
DB Client Window (1280×800, frameless)
├── Toolbar (44px)                     — 全局操作
├── Main Content (flex:1)
│   ├── Sidebar (260px, resizable)
│   │   ├── ConnectionList             — 连接列表 + 操作
│   │   └── DatabaseTree               — 数据库对象浏览
│   ├── Resize Handle (4px)
│   └── Workspace (flex:1)
│       ├── TabBar (34px)              — 标签页管理
│       ├── WelcomePanel               — 空状态首页
│       ├── QueryWorkspace             — SQL编辑+查询执行+结果
│       │   ├── EditorToolbar (32px)
│       │   ├── MonacoEditor
│       │   ├── Resize Handle
│       │   └── ResultsPanel
│       │       ├── ResultsViewTabs
│       │       ├── ResultMessages
│       │       ├── ResultSummary
│       │       └── ResultTable
│       ├── DataViewPanel              — Navicat风格数据浏览
│       │   ├── DataViewToolbar
│       │   ├── FilterBar
│       │   ├── DataTable
│       │   ├── StructureView
│       │   ├── IndexesView
│       │   └── ForeignKeysView
│       ├── ComparePanel               — 数据对比
│       ├── AuditPanel                 — 审计日志
│       └── TransactionPanel           — 事务管理
├── Resize Handles (8 handles, border)
└── StatusBar (26px)                   — 持久信息
```

### 1.2 标签页管理

工作区通过标签页组织。标签页类型：

| 类型 | 标识 | 关闭行为 |
|------|------|---------|
| Query Tab | 📝 "Query N" | 如有未保存结果→确认 |
| Data Tab | 📊 "Table: name" | 如有未保存修改→确认 |
| Compare Tab | ⇔ "Compare" | 无需确认 |
| Audit Tab | 📋 "Audit" | 无需确认 |
| Transaction Tab | 🔴 "TX: id..." | 如有未提交事务→确认 |

### 1.3 前端路由

不使用传统路由。通过 `state.activeTab` 和 DOM显示/隐藏控制。

```js
// 简化的状态机
const viewStates = {
  WELCOME:   { welcomePanel: 'flex', editorPanel: 'none', dataViewPanel: 'none', comparePanel: 'none' },
  QUERY:     { welcomePanel: 'none', editorPanel: 'flex', dataViewPanel: 'none', comparePanel: 'none' },
  DATA_VIEW: { welcomePanel: 'none', editorPanel: 'none', dataViewPanel: 'flex', comparePanel: 'none' },
  COMPARE:   { welcomePanel: 'none', editorPanel: 'none', dataViewPanel: 'none', comparePanel: 'flex' },
};
```

---

## 2. 各页/面板详细规格

### 2.1 WelcomePanel

**何时渲染**: `state.activeTab == null` 且无可用连接时

**内容**: 垂直居中排列
```
(80px)  [DB Logo SVG]       — var(--fg-muted), opacity 0.6
(16px gap)
(20px)  DB Client            — Semibold 600, var(--fg-primary)
(8px gap)  
(14px)  数据库管理工具         — var(--fg-muted)
(24px gap)
[Primary]  新建连接            — 蓝色按钮
(12px gap)
[Secondary] 新建查询            — 灰色按钮
```

**动画入场**: 
- Logo: fade-in + translateY(-8px) 200ms
- 标题: 同上, +100ms delay
- 按钮: 同上, +200ms delay

---

### 2.2 QueryWorkspace (编辑+执行+结果)

**何时渲染**: 创建查询标签页

**核心状态机**:

```
┌── QueryWorkSpace State Machine ───────────────────────┐
│                                                        │
│ IDLE ──[Run]──→ RUNNING ──[complete]──→ RESULT       │
│  │                │                      │             │
│  │                │ [error]              │ [Run again]│
│  │                ↓                      ↓             │
│  │              ERROR ──[Run]──→ RUNNING              │
│  │                │                                    │
│  │                │ [Run again]                        │
│  └────────────────┘                                    │
│                                                        │
│ IDLE状态:                                              │
│  - Editor: editable, cursor visible                    │
│  - Run按钮: enabled [▶]                                │
│  - 进度条: hidden                                      │
│  - 状态栏: 绿色/灰色连接态 (无查询脉冲)                 │
│                                                        │
│ RUNNING状态:                                            │
│  - Editor: readonly (非必要，保留可编辑)                 │
│  - Run按钮: [◼ 停止] danger color                      │
│  - 进度条: indeterminate animation 显示                │
│  - 状态栏: 蓝色脉冲 ●◉●◉                               │
│                                                        │
│ RESULT状态:                                             │
│  - Run按钮: [▶] enabled                                │
│  - 结果面板: 显示数据/摘要                              │
│  - 信息栏: "总计: N行 | 耗时: Xms"                     │
│                                                        │
│ ERROR状态:                                              │
│  - Run按钮: [▶] enabled                                │
│  - 结果面板: 红色错误信息 + SQL回显                     │
└────────────────────────────────────────────────────────┘
```

**Result Panel详细规格** (见 U02 第4节), 核心信息：

| 元素 | 位置 | 内容 |
|------|------|------|
| ResultsViewTabs | Sticky top | 消息/摘要/结果 切换 |
| MessagesView | 结果视图 | SQL回显 + success/error标记 + 受影响行数 |
| SummaryView | 结果视图 | 多查询卡片网格(3列) |
| ResultTableView | 结果视图 | 数据表格 (共享 DataViewPanel 的表格组件) |
| ResultInfo | Bottom | "总计: N 行 | 耗时: Xms" |

---

### 2.3 DataViewPanel (数据浏览与编辑)

**何时渲染**: 双击数据库树中的表名

**子视图切换** (data-view-tabs，高度32px):
```
[内容]  [表结构]  [索引]  [外键]
```

**Content View详细规格**:
- 数据表格 (共用 DataTable 组件) — 参见 U02 第5.4节
- 过滤栏 — 参见 U02 第5.3节
- 分页器 — 参见 U02 第5.5节
- 底栏: 记录数 + 已选数 + 表引擎

**Structure View** (见 U02 5.6节):
- 列名/类型/非空/主键/默认值/注释
- 可编辑: 双击修改列属性(未来)

**Indexes View** (见 U02 5.7节):
- 索引列表 + 新建/删除按钮
- 底栏: 索引数量 + 总大小

**Foreign Keys View** (见 U02 5.8节):
- FK列表 + 新建/删除按钮

---

### 2.4 ConnectionList (侧边栏)

**组件树**:
```
<div id="connectionList">
  ├── <div class="sidebar-header">
  │     ├── "连接" (11px uppercase fg-muted, font-weight:600)
  │     └── [+] 按钮 (24×24, icon-only)
  ├── {connections.map(conn =>
  │     <div class="connection-item" id="{conn.id}">
  │       ├── status-dot (8×8, success/danger/neutral)
  │       ├── connection-icon (28×28, 渐变色圆形+类型图标)
  │       ├── <div class="connection-info">
  │       │     ├── name (12px semibold)
  │       │     └── type@host (11px fg-muted)
  │       ├── expand-btn (→箭头)
  │     </div>
  │   )}
</div>
```

**交互**: 见 U03 第2.4节

---

### 2.5 DatabaseTree

**组件树**:
```
<div id="dbTree">
  ├── <div class="tree-header">
  │     ├── expand-btn (chevron, 旋转90deg)
  │     └── "数据库" (10px uppercase)
  ├── <div class="tree-content">
  │     {dbs.map(db =>
  │       <div class="tree-node db-item">
  │         ├── chevron + db-icon (16×16)
  │         ├── db_name (12px medium)
  │         └── <div class="tree-children">
  │               <div class="tree-node branch-item">
  │                 ├── "Tables ({count})"
  │                 └── <div class="tree-children">
  │                       {tables.map(table =>
  │                         <div class="tree-node leaf-item">
  │                           table-icon + table_name
  │                         )}
  │               </div>
  │               <div class="tree-node branch-item">"Views ({count})" ...</div>
  │               <div class="tree-node branch-item">"Functions ({count})" ...</div>
  │             </div>
  │     )}
  ├── <div class="tree-empty-hint">(空状态)</div>
</div>
```

**递归渲染**: 每层缩进16px, 节点高度26px

**加载状态**: `<div class="tree-loading">加载中...</div>` (spinner + italic text)

---

### 2.6 模态框组件

所有模态框共享基础结构：

```html
<!-- 模态框基础模板 -->
<div class="modal-overlay {active}" onclick="closeModal(event)">
  <div class="modal-container" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2>{title}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      {content}
    </div>
    <div class="modal-footer">
      {footer_buttons}
    </div>
  </div>
</div>
```

**所有模态框清单**:

| ID | 触发 | 尺寸 |
|----|------|------|
| connectionModal | 新建/编辑连接 | max-width: 560px |
| languageModal | 工具栏语言按钮 | max-width: 400px |
| settingsModal | 工具栏设置按钮 | max-width: 720px |
| sqlPreviewModal | 编辑保存确认 | max-width: 560px |
| exportModal | 导出操作 | max-width: 560px |
| importModal | 导入操作 | max-width: 480px |
| confirmDialog | 各种确认操作 | max-width: 400px |
| aboutDialog | 关于菜单 | max-width: 360px |
| queryHistoryPanel | 工具栏"历史"按钮 | 工作区面板 (非模态) |
| redisBrowser | Redis连接展开 | 工作区右侧面板 (非模态) |

**ConfirmDialog (确认框)**:
```
┌────────────────────────────┐
│ 确认操作               [✕] │
├────────────────────────────┤
│                            │
│   {message}                 │
│   操作不可撤销。            │
│                            │
├────────────────────────────┤
│               [取消] [确认] │
└────────────────────────────┘
```
仅破坏性操作弹出 (DELETE表行, DROP表, 关闭未保存标签)。

---

### 2.7 ContextMenu (上下文菜单)

**动态上下文菜单**:

```js
const contextMenuItems = {
  'connection': [
    { label: '连接', icon: 'link', action: connect },
    { label: '断开', icon: 'unlink', action: disconnect },
    { divider: true },
    { label: '编辑', icon: 'edit', action: editConnection },
    { label: '删除', icon: 'trash', action: deleteConnection, danger: true },
  ],
  'database': [
    { label: '新建查询', icon: 'file-plus', action: newTab },
    { divider: true },
    { label: '刷新', icon: 'refresh', action: refreshDb },
    { divider: true },
    { label: '复制名称', icon: 'copy', action: copyDbName },
  ],
  'table': [
    { label: '打开', icon: 'open', action: openTable },
    { label: '在新标签中打开', icon: 'open-tab', action: openTableNewTab },
    { divider: true },
    { label: '导出数据...', icon: 'download', action: exportTable },
    { label: '复制表名', icon: 'copy', action: copyName },
    { divider: true },
    { label: '刷新', icon: 'refresh', action: refreshTable },
    { label: '清空表', icon: 'trash-empty', action: truncateTable, danger: true },
    { label: '删除表', icon: 'trash', action: dropTable, danger: true },
  ],
};
```

**规格**: 见 U01 第8.7节

---

### 2.8 Toast通知 (右上角)

**ToastStack**: position=fixed, top-right, z-index=10000

```
┌───────────────────────────────────────┐
│  ┌── Toast 1 (entering) ──────────┐  │
│  │ ✓ 操作成功                    ✕│  │ ← auto-dismiss 3s
│  └────────────────────────────────┘  │
│  ┌── Toast 2 ────────────────────┐  │
│  │ ✗ 连接失败                     │  │
│  │   [重连] [关闭]                │  │ ← 手动关闭
│  └────────────────────────────────┘  │
└───────────────────────────────────────┘
```

**Toast规格**: 见 U03 第9节

---

### 2.9 Monaco Editor

**初始化**: `require(['vs/editor/editor.main'], initEditor)`

**配置**:
```js
const editorConfig = {
  value: '',
  language: 'sql',
  theme: getCurrentTheme() === 'dark' ? 'vs-dark' : 'vs',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineNumbers: 'on',
  minimap: { enabled: false },          // Terminal Noir: 关闭小地图
  scrollBeyondLastLine: false,
  automaticLayout: true,                // 自动响应容器resize
  wordWrap: 'off',
  tabSize: 2,
  renderWhitespace: 'none',
  bracketPairColorization: { enabled: true },
  suggest: {                             // 自动补全设置
    snippetsPreventQuickSuggestions: false,
    showWords: false,                   // 不显示文档词汇补全
    showFunctions: true,
    showKeywords: true,
  },
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'line',
  contextmenu: false,                    // 使用自定义右键菜单
};
```

**resize监听**: 
```js
// 拖拽分割线后必须调用
new ResizeObserver(() => editor.layout()).observe(editorContainer);
```

---

## 3. 组件状态规范

### 3.1 Empty States (空状态)

| 场景 | 视觉 | 操作引导 |
|------|------|---------|
| 无连接 | 连接列表区域居中显示 "暂无连接" + database icon (48px, opacity 0.3) | "点击 [+] 新建连接" |
| 未展开数据库 | Tree区居中显示 "选择连接以浏览数据库" | — |
| SQL编辑器空白 | WelcomePanel (仅无标签页时) | 新建连接/查询按钮 |
| 查询结果为空 | "查询返回0行" (fg-muted, italic) | — |
| 表为空 | "表为空" + 添加行按钮 | "点击 [+] 添加第一行" |
| 审计日志空 | "暂无日志记录" + clock icon | — |
| 对比结果空 | "选择两个数据源进行对比" | 表单配置 |

### 3.2 Loading States (加载)

| 场景 | Spinner | 骨架屏 | 其他 |
|------|---------|--------|------|
| 连接测试 | ✓ (14×14px, 2px accent border) | | 按钮disabled |
| 加载数据库列表 | ✓ (16×16px, tree-loading item) | | |
| 查询执行 | ✓ 状态栏脉冲 | | 进度条 |
| 分页加载数据 | | ✓ (3行灰色骨架行) |  |
| 导出 | | | 进度条+行数 |

**骨架屏规格**:
```css
.skeleton-row {
  height: var(--row-height);
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 3.3 Error States

| 场景 | 视觉 | 恢复 |
|------|------|------|
| 连接超时 | 红色错误文字 + 建议："检查防火墙/网络" | [重试]按钮 |
| 连接被拒绝 | "访问被拒绝: 检查用户名/密码" | [重试]按钮 |
| 查询语法错误 | 红色左边框卡片 + SQL回显 + 建议 | 修正后重新执行 |
| 查询超时 | "查询超时(30s)，建议添加LIMIT或索引" + 已返回行 | 调整超时设置 |
| 网络断开 | 状态栏变红 + Toast通知 | [重连]按钮 |

---

## 4. 前端State管理

### 4.1 全局State

```js
const state = {
  // Theme
  currentTheme: 'dark',         // 'dark' | 'light'
  currentDensity: 'compact',    // 'relaxed' | 'compact' | 'dense'
  currentLanguage: 'zh',        // 'zh' | 'en'

  // Connections
  connections: [],              // Array<Connection>
  activeConnectionId: null,     // string | null
  connectionStatuses: {},       // { [id]: 'connected'|'disconnected'|'connecting'|'error' }

  // Tabs
  tabs: [],                     // Array<Tab>
  activeTabId: null,            // string | null

  // UI
  sidebarWidth: 260,
  sidebarVisible: true,

  // Wails
  wailsReady: false,
};
```

### 4.2 Tab State

```js
const TabState = {
  query: {
    content: '',                // SQL text
    results: null,              // MultiQueryResult | null
    executionState: 'idle',     // 'idle' | 'running' | 'complete' | 'error'
    currentDatabase: '',        // selected database
    isModified: false,          // unsaved changes flag
    isSaved: false,             // saved to file flag
  },

  dataView: {
    table: '',                  // table name
    database: '',
    // edit state
    rows: [],
    columns: [],
    totalRows: 0,
    currentPage: 1,
    pageSize: 100,
    // pending changes
    insertedRows: [],           // Array<{row, index}>
    modifiedRows: [],           // Array<{row, index, originalRow}>
    deletedRows: [],            // Array<{row, index}>
    isModified: false,
    // filter/sort
    filterQuery: '',            // Raw WHERE
    sortColumn: '',
    sortOrder: '',              // 'ASC' | 'DESC' | ''
  },
};
```

### 4.3 持久化的State (localStorage)

| Key | Value |
|-----|-------|
| `db-client-theme` | 'dark' / 'light' |
| `db-client-density` | 'relaxed' / 'compact' / 'dense' |
| `db-client-sidebar-width` | number (px) |
| `db-client-editor-font-size` | 12/13/14/16/18 |

---

## 5. 面板切换

### 5.1 标签页创建

```
CreateQueryTab() -> new tab { type:'query', content:'' }
  → state.tabs.push(tab)
  → state.activeTabId = tab.id
  → 隐藏WelcomePanel
  → 显示EditorPanel
  → Monaco Editor获得焦点

CreateDataTab(table, db) -> new tab { type:'dataView', table, db }
  → WailsAPI.ExecuteQuery("SELECT * FROM {table} LIMIT 100")
  → dataViewPanel显示
```

### 5.2 切换表的数据视图

点击侧边栏另一个表:
- 如果已有标签页(同类型dataView) -> 切换
- 如果没有 -> 新建DataView tab

### 5.3 面板冲突

DataView 和 QueryEditor 不能同时占用WorkSpace。DataView替换当前的QueryTab（或合并为一个混合tab）：

```
用户双击表名:
  → 找到第一个QueryTab → 转为DataView tab
  → 保留原SQLeditor内容在后台

用户点击QueryTab返回:
  → 恢复原SQL编辑器内容
```

---

## 6. 前端代码组织 (推荐重构)

**当前**: 单文件 `app.js` (3502行)
**推荐**: 模块化前端

```
frontend/src/
├── main.js              # 入口: 初始化, Wails polling, 注册全局事件
├── state.js             # 全局state对象, mutations
├── theme.js             # 主题切换, 密度切换
├── api.js               # WailsAPI 封装层 (统一错误处理/超时)
├── components/
│   ├── toolbar.js       # 工具栏初始化
│   ├── statusbar.js     # 状态栏(连接指示/时钟/窗口尺寸)
│   ├── sidebar.js       # 侧边栏: 连接列表渲染
│   ├── db-tree.js       # 数据库树: 展开/折叠/加载/右键
│   ├── tab-bar.js       # 标签栏: 创建/切换/关闭/拖拽
│   ├── modal.js         # 模态框基类: open/close/focus-trap
│   ├── toast.js         # Toast通知系统
│   ├── context-menu.js  # 上下文菜单
│   └── confirm.js       # 确认对话框
├── panels/
│   ├── welcome.js       # 欢迎面板
│   ├── editor.js        # Monaco编辑器 + toolbar
│   ├── results.js       # 结果面板(消息/摘要/表格)
│   ├── data-grid.js     # 数据表格(含过滤/排序/分页/编辑)
│   └── data-view.js     # 数据浏览面板(内容/表结构/索引/FK)
├── dialogs/
│   ├── connection.js    # 连接对话框(含表单验证)
│   ├── settings.js      # 设置对话框
│   ├── export.js        # 导出对话框
│   └── language.js      # 语言选择对话框
└── utils/
    ├── dom.js           # 安全的DOM操作 (createElement, no innerHTML)
    ├── format.js        # 数字/大小/时间格式化
    ├── escape.js        # HTML/SQL 转义
    └── keyboard.js      # 键盘快捷键注册
```

**DOM安全规则**: 
- 禁止 `innerHTML` / `insertAdjacentHTML` 与用户/数据库数据
- 使用 `createElement('div')` + `textContent` 或 `setAttribute`
- 仅静态HTML模板可使用innerHTML (在初始化时使用)

---

## 7. 前端与后端API 数据流

```
Frontend Component → state mutation → WailsAPI method → Go backend
                       ↑                                   │
                       └────── Promise resolve ────────────┘
```

**示例**: 执行查询的完整数据流:
```
1. EditorToolbar "Run" click → handleRunQuery()
2. handleRunQuery:
   a. tab.executionState = 'running' → UI更新
   b. WailsAPI.executeQueryWithTimeout(conn, db, sql, {timeout:30})
   c. .then(result => {
        tab.results = result
        tab.executionState = 'complete'
        renderResults(result)
      })
   d. .catch(err => {
        tab.executionState = 'error'
        showError(err)
      })
3. Go backend (query_timeout.go):
   a. decrypt password
   b. pool.getOrCreate → driver.Query(ctx, sql)
   c. rows.Scan → populate QueryResult
   d. audit.Log
   e. return QueryResult
```

---

## 8. 主题与密度切换实现

```js
// Theme
function setTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('db-client-theme', theme);
  // Monaco editor theme
  if (editor) {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }
}

// Density (信息密度)
function setDensity(density) {
  state.currentDensity = density;
  document.documentElement.setAttribute('data-density', density);
  localStorage.setItem('db-client-density', density);
  // CSS variables handle everything (no JS DOM manipulation required)
}
```

**密度CSS变量**:
```css
[data-density="relaxed"] {
  --row-height: 36px;
  --cell-padding: 10px 12px;
  --tree-node-height: 32px;
}
[data-density="compact"] {
  --row-height: 28px;
  --cell-padding: 6px 8px;
  --tree-node-height: 26px;
}
[data-density="dense"] {
  --row-height: 22px;
  --cell-padding: 3px 6px;
  --tree-node-height: 22px;
  /* Dense模式下显示网格线 */
  --grid-line: 1px solid var(--table-grid);
}
```