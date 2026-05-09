# U03 — 交互流程定义

> 文档版本: v2.0 | Terminal Noir交互设计 | 覆盖所有核心用户流程
> 基于 U01+U02 设计系统定义

---

## 1. 交互设计原则

| 原则 | 说明 |
|------|------|
| **即时反馈** | 任何操作100ms内必须有视觉反馈。查询执行有即时状态变化。 |
| **中断可控** | 用户随时可以取消/关闭/回退。Esc是通用关闭键。 |
| **数据安全** | 破坏性操作(DELETE/DROP等)必须二次确认。SQL预览不可跳过。 |
| **键盘可用** | 所有高频操作支持键盘快捷键。Tab导航在模态框内循环。 |
| **上下文感知** | 右键菜单内容根据选中对象动态变化。工具按钮根据当前上下文启用/禁用。 |

---

## 2. 用户流程：首次使用→首次查询

### 2.1 流程概述

```
启动应用 → 欢迎页 → 新建连接 → 测试连接 → 保存连接 → 
展开数据库树 → 双击表 → 查看数据 → 新建查询标签 → 编写SQL → 
运行查询 → 查看结果
```

### 2.2 首次启动（无保存连接）

```
┌─ 启动 ──────────────────────────────────────────────────┐
│                                                           │
│ 1. App启动 (startup lifeCycle)                            │
│    - 加载配置 (~/.db-client/config.json)                   │
│    - 初始化加密密钥                                        │
│    - 加载连接列表 (connections.json 为空)                   │
│    - 初始化审计日志系统                                    │
│    - 窗口显示 1280×800                                     │
│                                                           │
│ 2. 前端初始化 (DOMContentLoaded)                           │
│    - 等待Wails Ready (轮询, max 5s)                        │
│    - GetLanguage() 设置i18n                               │
│    - 加载主题设置 (localStorage)                           │
│    - state.connections = []                               │
│                                                           │
│ 3. 渲染欢迎页 (welcomePanel)                               │
│    - Logo淡入(200ms)                                      │
│    - 标题淡入(100ms later)                                │
│    - 按钮淡入(100ms later)                                │
│    - 空连接列表 → sidebar显示"暂无连接"                    │
│    - 空数据库树 → "选择连接以查看数据库"                   │
│                                                           │
│ 用户操作: Click [新建连接]                                  │
│ → 进入连接对话框流程                                       │
└───────────────────────────────────────────────────────────┘
```

### 2.3 连接对话框交互流程

```
┌─ 连接对话框 ───────────────────────────────────────────┐
│                                                          │
│ 触发: ①欢迎页"新建连接" ②工具栏"新建" ③侧边栏[+]     │
│                                                          │
│ State 0: 对话框打开                                       │
│   - overlay opacity 0→1 (120ms)                         │
│   - container scale(0.97)→1 (200ms)                     │
│   - 默认选择: PostgreSQL (active)                        │
│   - 默认端口: 5432                                       │
│   - Focus → connName input                               │
│                                                          │
│ State 1: 切换数据库类型                                    │
│   - User clicks DB-type-btn                             │
│   - 旧按钮active→inactive, 新按钮inactive→active         │
│   - (80ms transition)                                   │
│   - 端口自动变更为该DB默认值:                              │
│     PG=5432 / MySQL=3306 / Redis=6379 / SQLite=none      │
│   - SQLite类型: 隐藏host/port, 显示file-path row         │
│                                                          │
│ State 2: 填写表单                                         │
│   - Name: 输入中 → validation on blur                    │
│   - Host: 默认"localhost"                                │
│   - Port: 自动填充, 可手动修改                            │
│   - User/Password: 输入                                  │
│   - Database: 留空或手动输入                              │
│   - SavePassword: checked (default)                      │
│   - AutoConnect: checked (default)                       │
│                                                          │
│ State 3: 点击"测试连接"                                    │
│   - 按钮 → "测试中..." + spinner + disabled              │
│   - WailsAPI.TestConnection(conn)                        │
│   - 后端: validate → decrypt → Connect → Ping → Close   │
│                                                          │
│ State 3a: 测试成功                                        │
│   - 按钮旁: "连接成功 ✓" 绿色文字(fade-in 200ms)         │
│   - 自动执行 GetDatabases(conn)                          │
│   - 填充数据库下拉框 (select options)                     │
│   - 按钮恢复: "测试连接" enabled                         │
│   - 3秒后绿色文字淡出                                    │
│                                                          │
│ State 3b: 测试失败                                        │
│   - 按钮旁: "连接失败: {error}" 红色文字                  │
│   - 可点击展开查看详细错误 + 建议                         │
│   - 按钮恢复: "测试连接" enabled                         │
│                                                          │
│ State 4: 点击"保存"                                       │
│   - 表单验证（客户端）                                    │
│   - WailsAPI.SaveConnection(conn)                        │
│   - 后端: encrypt password → save to connections.json    │
│   - 关闭对话框 (100ms fade-out)                          │
│   - 侧边栏连接列表刷新 (loadSavedConnections)             │
│   - 如AutoConnect=true → 自动连接                        │
│                                                          │
│ State 5: 关闭对话框                                       │
│   方式: ✕按钮 / ESC / 点击overlay                        │
│   - overlay opacity 1→0 (100ms)                         │
│   - container scale(1)→0.97 (100ms)                     │
│   - 表单数据不保留                                       │
└──────────────────────────────────────────────────────────┘
```

### 2.4 连接数据库交互流程

```
触发: ①点击连接项的expand按钮 ②双击连接项 ③右键"连接"

State: 连接中
  - 连接项状态指示: ○→◉ (蓝色脉冲动画)
  - 状态栏: "正在连接..." 蓝色
  - WailsAPI.ConnectToDatabase(conn)
  - 后端: decrypt → pool.getOrCreate → ping(3次重试)

State: 连接成功
  - 状态指示: ◉→● (绿色, 80ms transition)
  - 状态栏: "已连接: {name}"
  - 自动展开数据库树: loadDatabaseTree()
  - 树加载: GetDatabases() → 每个DB展开一级
  - 加载指示: tree-loading item (spinner)

State: 连接失败
  - 状态指示: ◉→◎ (红色, flash 250ms)
  - 错误通知: 右上角红色toast (slide-in 200ms, auto-dismiss 5s)
  - 重试选项: toast内"重试"按钮
```

### 2.5 首次查询完整的时序

```
用户操作                                UI                          后端
──────────────────────────────────────────────────────────────────────
点击[新建查询]                → 创建新标签页                          |
                              标签: "Query 1"                        |
                              编辑器: 空白 + cursor                  |
                              Welcome panel → hide                   |

输入SQL: "SELECT * FROM users;"  | Monaco 实时语法高亮               |
                              状态: autocomplete popup (打字2字符后) |

点击[▶ 运行] / Ctrl+Enter     → Run按钮 → 停止按钮                   |
                              编辑器底部→ 蓝色进度条(2px动画)         |
                              状态栏指示→ 蓝色脉冲                    |
                                                                      | WailsAPI.ExecuteQueryWithTimeout()
                                                                      | decrypt → pool → Query(ctx)
                                                                      | rows → columns → scan → result
查询完成(42行12ms)             → Run按钮恢复                          | return QueryResult
                              进度条消失 (animate width→100%→0)       |
                              状态栏指示→ 绿色                        |
                                                                      |
                              结果面板:                               |
                              消息: "✓ 查询执行成功 (42行, 12ms)"    |
                              结果: 数据表格呈现(42行)                |
                              信息栏: "总计: 42行 | 耗时: 12ms"      |
```

---

## 3. 用户流程：数据编辑

### 3.1 数据编辑时序

```
双击表名"users"(DB树)         
  → 切换到Data View标签页
  → WailsAPI.ExecuteQuery("SELECT * FROM users LIMIT 100")
  → 渲染数据表格(100行)

用户滚动到第42行 → 双击email单元格
  → 输入框覆盖td
  → 用户输入: "new@email.com"
  → 按Enter
  → 行标记为Modified (蓝色竖线 + 蓝色背景)
  → 💾 保存按钮高亮(pulse一次, 提示用户有未保存修改)

用户点击工具栏[+]
  → 表格顶部插入空行
  → 行标记为Inserted (绿色竖线)
  → 行号显示"NEW"(斜体绿色)
  → 第一个单元格获得焦点
  → 用户输入数据

勾选第7行、第9行 → 点击[-]
  → 选中行标记为Deleted (红色竖线 + 删除线 + 红色文字)
  → cells变为不可编辑

点击[💾 保存]
  → 弹出SQL预览确认对话框
  → 展示: INSERT 1条 + UPDATE 1条 + DELETE 2条
  → 用户点击[确认执行]
  → BatchEdit(requests) → execute
  → 成功: 对话框关闭 → 刷新表格 → toast "保存成功"
  → 失败: 对话框显示错误详情 → 用户修正或取消

点击[↺ 刷新]
  → 丢弃所有未保存修改
  → 重新加载表格数据
```

### 3.2 内联编辑 - 键盘交互

```
双击单元格                   → 进入编辑模式
编辑中:
  Enter                      → 确认修改，跳到下一行同列单元格
  Tab                        → 确认修改，跳到下一列
  Shift+Tab                  → 确认修改，跳到上一列
  Esc                        → 取消修改，退出编辑
  Ctrl+Enter                 → 确认修改，不移动
  ↑/↓                        → 确认修改，跳上/下一行
```

---

## 4. 用户流程：导出数据

```
触发: ①结果右键菜单→"导出" ②工具栏 ③Data View工具栏

State 0: 导出对话框
  - 4种格式tab按钮
  - 数据源选择 (查询结果 / 指定表)
  - 文件路径 (自动生成默认名: export_{table}_{timestamp}.csv)
  - 格式选项 (动态变化)

State 1: 点击[导出]
  - 按钮 → 进度模式: "导出中... [已导出 1,234/10,000行]"
  - 进度条动画
  - [取消]按钮可用

State 1a: 导出完成
  - 按钮 → "导出完成 ✓" 绿色
  - "共导出 10,000 行到 {path}"
  - [打开文件夹]按钮

State 1b: 用户取消
  - 文件不完整 → 删除临时文件
  - 按钮恢复

State 1c: 导出失败
  - 显示错误
  - [重试]按钮
```

---

## 5. 用户流程：数据对比

```
触发: 菜单→"工具"→"数据对比" 或独立标签页

State 0: 配置参数
  选择对比类型: ●表对比 / ○查询对比
  选择源连接→源数据库→源表
  选择目标连接→目标数据库→目标表
  [🔄 交换源/目标]
  选择对比模式: ●数据对比 / ○结构对比
  选择键列: id, email
  选择对比列: 全部/指定

State 1: 点击[开始对比]
  → 配置区折叠
  → 结果区展开 (slide-down 250ms)
  → 执行对比: WailsAPI.CompareTables(config, req)
  → 加载中: spinner + "正在对比..."
  
  → 完成:
  ┌─────────────────────────────┐
  │ 987行 │ 992行 │ 95.2% │ 47 │ ← 摘要卡片
  └─────────────────────────────┘
  ↓ 差异表格 (47行)
  ↓ 导出按钮

State 2: 导出报告
  选择格式: JSON/CSV/TXT
  → ExportCompareResult(result, format)
  → SaveFileDialog → 写入文件
  → toast "报告已导出"
```

---

## 6. 用户流程：事务管理

```
触发: 工具栏→"事务" 或编辑器输入 BEGIN;

State 0: 开启事务
  → WailsAPI.BeginTransaction(conn, db, options)
  → 隔离级别: READ COMMITTED (默认)
  → 返回 txID
  → 状态栏显示: "🔴 事务中 (ID: a1b2c3) — 未提交的修改" (红色警告)
  → 事务中的所有查询通过 ExecuteInTransaction(txID, query) 执行

State 1: 事务中执行操作
  - INSERT/UPDATE/DELETE → ExecuteInTransaction
  - 受影响行数累计显示在状态栏

State 2: 提交
  → WailsAPI.CommitTransaction(txID)
  → 状态栏→绿色 "事务已提交 ✓"
  → 3秒后消失

State 3: 回滚
  → WailsAPI.RollbackTransaction(txID)
  → 确认对话框: "确定回滚事务？所有未提交修改将丢失"
  → 确定→回滚
  → 状态栏→灰色 "事务已回滚"

Automatic: 事务超时(默认5分钟无操作) → 自动回滚
```

---

## 7. 键盘快捷键映射

### 7.1 全局快捷键

| 快捷键 | 操作 | 条件 |
|--------|------|------|
| `Ctrl+Enter` | 执行当前查询 | 编辑器有焦点 |
| `Ctrl+N` | 新建连接 | 全局 |
| `Ctrl+T` | 新建查询标签 | 全局 |
| `Ctrl+W` | 关闭当前标签 | 有标签打开 |
| `Ctrl+Shift+T` | 恢复刚关闭的标签 | 全局 |
| `F5` | 刷新当前连接 | 已连接 |
| `Ctrl+B` | 切换侧边栏 | 全局 |
| `Ctrl+,` | 打开设置 | 全局 |
| `Ctrl+1..9` | 切换到标签1-9 | 有对应标签 |
| `Escape` | 关闭对话框/弹出菜单/退出编辑 | 有打开态 |
| `Ctrl+Shift+I` | 切换信息密度 (Relaxed→Compact→Dense) | 全局 |
| `Ctrl+Shift+D` | 切换主题 (dark↔light) | 全局 |

### 7.2 编辑器快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+Shift+F` | 格式化SQL |
| `Ctrl+Shift+M` | 压缩SQL |
| `Ctrl+/` | 切换行注释 |
| `Ctrl+D` | 复制当前行 |
| `Ctrl+Space` | 触发自动补全 |
| `Alt+↑/↓` | 移动当前行 |
| `Ctrl+[ / ]` | 减少/增加缩进 |

### 7.3 数据表快捷键

| 快捷键 | 操作 |
|--------|------|
| `↑/↓` | 上下行导航 |
| `←/→` | 左右列导航 |
| `Tab` | 跳到下一列 |
| `Enter` | 编辑当前单元格 |
| `Escape` | 退出编辑 |
| `Space` | 勾选/取消当前行 |
| `Ctrl+A` | 全选行 |
| `Delete` | 删除选中行 (标记为删除) |
| `Ctrl+Z` | 撤销编辑 |
| `Ctrl+Y` | 重做编辑 |

---

## 8. 拖拽交互

### 8.1 面板调整

```
Sidebar Resize:  鼠标移到分隔线 → cursor=col-resize → drag水平调整(180-420px)
Editor/Results Split: cursor=row-resize → drag垂直调整(编辑器min=120px, 结果min=80px)
数据表列宽调整:  鼠标移到表头列边界 → cursor=col-resize → drag(最小60px)
```

### 8.2 标签页拖拽

- 标签页支持拖拽重新排序
- 拖出标签栏 → 创建新窗口 (Wails限制，可能仅支持排序)

### 8.3 对象树拖拽

- 表名可拖入SQL编辑器 → 自动插入 `"schema"."table"`
- 列名可拖入SQL编辑器 → 自动插入列名
- 函数名可拖入SQL编辑器 → 自动插入函数调用模板

---

## 9. 通知系统

### 9.1 通知类型与位置

```
┌──────────────────────────────────────────────────────────┐
│ 右上角 Toast (z-index: 10000)                              │
│                                                           │
│  ┌──────────────────────────────────────┐                │
│  │ [icon] 消息文字                  [✕] │ ← slide-in 右  │
│  │        操作按钮 (如果适用)           │    200ms       │
│  └──────────────────────────────────────┘                │
│                                                           │
│  自动消失: success=3s, info=4s, warning=5s, error=需手动关闭 │
└──────────────────────────────────────────────────────────┘
```

| 类型 | 图标 | 背景 | 场景 |
|------|------|------|------|
| Success | ✓ 绿色 | transparent + success左边框 | 连接成功/保存成功/导出完成 |
| Info | ℹ 蓝色 | transparent + accent左边框 | 查询完成/刷新完成 |
| Warning | ⚠ 黄色 | transparent + warning左边框 | 慢查询警告/事务未提交 |
| Error | ✗ 红色 | transparent + danger左边框 | 连接失败/查询错误 |

### 9.2 查询完成时的通知

仅多查询且有错误时显示Error toast。单查询成功不弹toast——结果面板本身即是反馈。

---

## 10. 主题切换交互

```
状态: 深色主题 (data-theme="dark")
  触发: 工具栏太阳图标点击 / Ctrl+Shift+D
  
  切换流程:
    1. document.documentElement.setAttribute('data-theme', 'light')
    2. CSS变量即时切换 (0ms — 无过渡动画, Terminal Noir不需要主题过渡)
    3. Monaco editor theme → light variant
    4. localStorage.setItem('db-client-theme', 'light')
    5. 图标切换: ☀ → ☽
  
  颜色切换: Instant (0ms)
  图标切换: rotate-out 120ms + rotate-in 120ms = 总计240ms
```

---

## 11. 错误处理流程

### 11.1 查询错误

```
用户执行: SELECT * FORM users; (拼写错误)

后端返回: QueryResult{Error: "syntax error at or near 'FORM'"}

UI处理:
  1. Run按钮恢复
  2. 进度条消失
  3. 结果面板:
     ┌──────────────────────────────────────────────┐
     │ ✗ 查询错误                                    │
     │                                               │
     │ SELECT * FORM users;                          │ ← 灰底代码块
     │          ^^^^                                 │ ← 错误位置标红(如果Monaco支持)
     │                                               │
     │ 错误详情:                                     │
     │ syntax error at or near "FORM"               │
     │ Position: 14                                 │
     │                                               │
     │ 💡 建议: 是否想输入 "FROM" 而不是 "FORM"?      │
     └──────────────────────────────────────────────┘
```

### 11.2 连接断开

```
检测到: Wails API调用失败 (网络断开/服务停止)

处理:
  1. 状态栏指示: ●→◎ (红色)
  2. Toast: "连接已断开 — My PostgreSQL" (Error, 需手动关闭)
     Toast按钮: [重连]
  3. 所有标签页的编辑器 → 只读模式
  4. 数据库树 → 折叠
```

---

## 12. 信息密度切换

用户通过快捷键或设置菜单切换信息密度。

```
触发: Ctrl+Shift+I 或 设置→外观→信息密度

循环切换: Relaxed → Compact → Dense → Relaxed

实现:
  document.documentElement.setAttribute('data-density', density)
  CSS变量即时响应 (0ms transition)
  
Relaxed → Compact: 36px → 28px 行高, 10px→6px cell padding
Compact → Dense: 28px → 22px 行高, 6px→3px cell padding

仅影响: 数据表行、树节点、标签页高度
不影响: 工具栏、状态栏、模态框
```

---

## 13. SQL自动补全时序

```
用户在Monaco编辑器中输入: "SELECT * FROM us"

触发: 输入≥2字符
  → GetAutoCompleteSuggestions(conn, db, query, cursorPosition)
  → 后端: extractCurrentWord("us") → analyzeQueryContext(FROM后→表名补全)
  → getTableSuggestions(db) = ["users", "user_roles", "user_sessions"]
  → 返回 AutoCompleteResult{Suggestions: [3项]}

UI: Monaco内建补全弹出
  选项1: users (Table) [i icon]
  选项2: user_roles (Table)
  选项3: user_sessions (Table)

用户选择"users" → 输入替换为"users"
用户继续输入"." → "SELECT * FROM users."
  → 上下文: 表名后+"." → 列名补全
  → getColumnSuggestions("users") = ["id", "name", "email", ...]
  → 弹出列名补全列表
```

**补全优先级**:
1. 别名/表名匹配 (最相关)
2. 关键字 (SELECT/FROM/WHERE后的关键字)
3. 函数名 (SELECT后的函数)
4. 数据库名 (USE/连接切换时)

---

## 14. DDL执行安全确认流程

### 14.1 流程概述
执行DDL语句 (CREATE/DROP/ALTER/TRUNCATE) 或危险DML (DELETE without WHERE) 时必须经过二次确认。

### 14.2 完整时序

```
┌─ DDL 安全确认 ──────────────────────────────────────────┐
│                                                           │
│ State 0: 用户编写DDL语句                                    │
│   用户在编辑器中输入: "DROP TABLE users;"                   │
│   Monaco 实时语法高亮                                      │
│                                                           │
│ State 1: 点击Run / Ctrl+Enter                              │
│   → 前端 DDL检测: 解析SQL首关键字                          │
│     DDL关键字: CREATE, DROP, ALTER, TRUNCATE              │
│     (前端正则: /^(CREATE|DROP|ALTER|TRUNCATE)\s/i)         │
│   匹配 → 拦截执行, 弹出确认对话框                           │
│                                                           │
│ State 2: 确认对话框                                        │
│   ┌──────────────────────────────────────────────┐       │
│   │ ⚠ 危险操作确认                           [✕]  │       │
│   ├──────────────────────────────────────────────┤       │
│   │                                               │       │
│   │  即将执行 DDL 语句:                            │       │
│   │  ┌──────────────────────────────────┐        │       │
│   │  │ DROP TABLE users;                 │        │       │
│   │  └──────────────────────────────────┘        │       │
│   │                                               │       │
│   │  ⚡ 此操作不可撤销!                             │       │
│   │  将永久删除 'users' 表及其所有数据。             │       │
│   │                                               │       │
│   │  ☐ 我确认要执行此操作                           │       │
│   │                                               │       │
│   ├──────────────────────────────────────────────┤       │
│   │               [取消]  [确认执行]              │       │
│   └──────────────────────────────────────────────┘       │
│                                                           │
│ State 3a: 用户取消                                        │
│   → 对话框关闭, 查询不执行                                │
│                                                           │
│ State 3b: 用户勾选确认 + 点击[确认执行]                     │
│   → 对话框关闭                                            │
│   → 执行查询 (同正常流程)                                  │
│   → 审计日志: AUDIT_LEVEL=CRITICAL, EVENT=DDL_EXEC        │
│   → 结果面板显示                                          │
│                                                           │
│ DDL 检测规则:                                              │
│ - CREATE xxx → DDL确认                                    │
│ - DROP xxx → DDL确认                                      │
│ - ALTER xxx → DDL确认                                     │
│ - TRUNCATE xxx → DDL确认                                  │
│ - DELETE FROM xxx (无WHERE) → DML危险确认                 │
│ - UPDATE xxx (无WHERE) → DML危险确认                      │
│                                                           │
│ 用户可在设置中禁用此确认 (不推荐):                           │
│   设置 → 编辑器 → ☐ DDL执行前确认 (默认开启)              │
└───────────────────────────────────────────────────────────┘
```

---

## 15. 数据导入流程

触发: 菜单→"工具"→"导入数据" 或 DataView 工具栏

### State 0: 导入对话框
- 选择格式: CSV / JSON
- 选择目标表或输入表名
- 选择文件 (OpenFileDialog)
- 显示前5行预览
- 自动列映射 (CSV表头→DB列名)
- 用户调整列映射 (下拉选择)

### State 1: 点击[导入]
- 按钮: "导入中... [已导入 1,234 / 10,000 行]"
- 进度条
- [取消]按钮 (取消已导入的行不回滚 — 显示warning)

### State 1a: 导入完成
- "导入完成 ✓: 成功 9,998 行, 失败 2 行"
- 失败详情表格 (行号+原始数据+错误原因)
- [重试失败行]按钮

### State 1b: 错误处理
- ☐ "遇到错误时继续" checked: 跳过错误行, 继续导入, 最后汇总
- ☐ unchecked: 遇到第一个错误即停止, 显示详情

---

## 16. Monaco编辑器初始化序列

### 16.1 正常加载流程

```
1. 页面DOMContentLoaded →
2. require.config({ paths: { vs: 'lib/monaco-editor/min/vs' } }) →
3. require(['vs/editor/editor.main'], callback) →
4. callback: monaco.editor.create(container, options) →
5. 注册补全提供器 + 主题定义 →
6. 编辑器就绪, toast消失
```

### 16.2 加载失败降级

- 触发: AMD模块加载超时(>3s) 或 require() 抛出异常
- UI: 替换为 textarea fallback (`#fallbackEditor`)
- 降级功能: 无语法高亮/无补全/无行号 → 基本查询仍可执行
- 恢复: 用户手动"重新加载编辑器"按钮 → 重试Monaco加载

---

## 17. 数据表格复制粘贴流程

### 17.1 复制 (Ctrl+C)

State: 用户选中数据表格中的单元格或行

复制行为 (按优先级):
  1. 单单元格选中 → 复制该单元格原始值 (不含格式)
  2. 多单元格矩形选中 → TSV格式(制表符分隔)
     格式: "val1\tval2\tval3\nval4\tval5\tval6"
     首行自动包含列名
  3. 整行选中 → TSV格式, 一行
  4. 多行选中 → TSV格式, 多行

粘贴到外部应用:
  - 文本编辑器: 纯文本TSV
  - Excel/Google Sheets: TSV自动解析到单元格
  - 终端/CLI: 纯文本显示

### 17.2 粘贴 (Ctrl+V)

State: 用户选中可编辑的数据表格单元格

流程:
  1. 从剪贴板读取文本
  2. 检测格式 (TSV → 多单元格, 单行 → 单单元格)
  3. 验证: 目标单元格数 ≥ 粘贴单元格数
  4. 类型转换: string→number (如果是数值列), string→date (如果是日期列)
  5. 粘贴到单元格 (标记为 Modified)
  6. 验证失败: toast "无法粘贴: 第3列期望numeric类型"

---

## 18. 边界情况处理

### 18.1 Monaco编辑器加载失败

- 触发: AMD模块加载超时(>3s) 或 require() 抛出异常
- UI: 替换为 textarea fallback (#fallbackEditor)
- 降级功能: 无语法高亮/无补全/无行号 → 基本查询仍可执行
- 恢复: 用户手动"重新加载编辑器"按钮 → 重试Monaco加载

### 18.2 浏览器Mock模式 (Wails不可用)

- 触发: Wails在5s内未就绪 (非桌面环境)
- UI: 右上角黄色badge "模拟模式"
- 功能: 所有Wails API调用返回mock数据
- Mock连接: 3条预设连接 (PostgreSQL/MySQL/SQLite)
- Mock查询: 返回5行固定数据

### 18.3 超宽结果集 (50+列)

- 表格: 水平滚动 (overflow-x: auto)
- 列宽: 最小60px, 超出省略
- 列选择器: 表头右键 → "显示/隐藏列" → 多选列表
- 快捷导航: Ctrl+←/→ 快速跳列

### 18.4 长单元格值

- 默认: text-overflow: ellipsis, max-width: 500px
- Hover: tooltip显示全文 (max-width: 400px, word-break)
- 双击: 弹出cell detail对话框 (textarea, 只读)
- BLOB: 显示为 "[BLOB: 1.2KB]", 双击下载

### 18.5 连接池耗尽

- 触发: 50个并发连接均在使用
- 新连接请求: 返回 error "连接池已满(50/50)"
- 建议: toast "请关闭不用的连接后重试"
- 超时机制: 等待队列(最多5s), 超时则放弃

### 18.6 大Schema (10000+表)

- 数据库树: 仅加载前100张表 (虚拟滚动)
- 搜索: 树顶部搜索框 → 过滤表名
- 分类折叠: Tables/Views/Functions 默认折叠
- 懒加载: 展开分支时才加载子节点