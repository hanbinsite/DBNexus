# GAP-ANALYSIS.md — 完整差距分析与修复计划

> 生成时间: 2026-06-24 | 基于全维度审计 (前端15流程 + 后端71API + 4驱动 + AI对接)

---

## 一、前端体验差距 (15个用户流程)

### 1.1 流程状态总览

| # | 流程 | 状态 | 核心问题 |
|---|------|------|---------|
| 1 | 首次启动 | PARTIAL | 无空连接列表提示; auto_connect 保存但不读取 |
| 2 | 数据库浏览 | PARTIAL | 视图/函数树分支永远"加载中..." |
| 3 | 数据查看 | PARTIAL | LIMIT 10000 无提示; 筛选仅客户端; 表引擎硬编码 InnoDB |
| 4 | **数据编辑** | **BROKEN** | 无单元格双击编辑; DELETE 静默丢弃 (primaryKey 未设置) |
| 5 | SQL 查询 | WORKS | Monaco fallback 死代码; formatSQL 未调用后端 |
| 6 | Schema 检查 | PARTIAL | 字符集硬编码; SQL预览生成空 INSERT 而非 DDL |
| 7 | 导出/导入 | WORKS | 无进度条; 无"先清空"选项 |
| 8 | Redis | PARTIAL | Key详情显示在toast(截断120字); 无TTL编辑; 无分页 |
| 9 | 数据对比 | PARTIAL | 表名手动输入无下拉; 无导出报告 |
| 10 | 事务管理 | WORKS | 关闭面板不自动回滚; 仅1个活动事务 |
| 11 | **设置** | **BROKEN** | 5字段(timeout/fontSize/tabSize/lineNumbers)无保存; Monaco硬编码 |
| 12 | 快捷键 | PARTIAL | F5仅刷新数据视图 |
| 13 | 右键菜单 | PARTIAL | "创建表"无case; 无tab/结果右键 |
| 14 | 标签管理 | PARTIAL | **查询tab切换后内容丢失** (共享单个Monaco) |
| 15 | 窗口控制 | PARTIAL | 8个resize handle无事件; 标题栏无法拖拽 |

### 1.2 前端 Top 5 必修 (P0)

| # | 问题 | 影响 | 修复方案 |
|---|------|------|---------|
| F1 | 数据编辑流程崩溃 | 单元格不可编辑 + DELETE静默丢弃 | 添加 dblclick 编辑模式; renderDataView 设置 row.dataset.primaryKey |
| F2 | Settings 不保存 | 5/8设置项无效 | 添加 saveSettings(); Monaco 动态读取 fontSize/tabSize/lineNumbers |
| F3 | Tab 内容丢失 | 切换查询tab后SQL消失 | per-tab content 缓存 (tab object 存储 editor content) |
| F4 | 视图/函数树不加载 | 永远显示"加载中..." | 实现 loadViewsForDatabase / loadFunctionsForDatabase |
| F5 | i18n 仅30% | 英文模式70%仍为中文 | 为所有硬编码中文添加 data-i18n 属性 |

### 1.3 前端 P1 修复

| # | 问题 | 修复方案 |
|---|------|---------|
| F6 | 窗口无法拖拽 | header 添加 mousedown drag handler (Wails runtime.WindowDrag) |
| F7 | 8个 resize handle 无效 | 绑定 mousedown → 计算方向 → Wails WindowResize |
| F8 | 空连接列表无提示 | 添加 "暂无连接，点击新建" empty state |
| F9 | 右键"创建表"无反应 | contextAction switch 添加 'create_table' case |
| F10 | Redis key详情在toast | 改为面板内详情区域显示 |
| F11 | 对比表名无下拉 | 从 GetTables 填充 select 下拉 |
| F12 | 大结果集无警告 | >10000行时显示提示 banner |

---

## 二、后端 API 差距 (71个方法)

### 2.1 质量指标

| 维度 | 当前 | 目标 |
|------|------|------|
| 错误处理一致性 | 混用 i18n/中文/英文/裸err | 全部 i18n |
| 输入验证 | 45/71 无验证 | 0 无验证 |
| 审计日志覆盖 | ~40% | 100% 敏感操作 |
| 测试覆盖 | 12/71 (16%) | >60% |
| Context传播 | 5处用 Background() | 0处 |

### 2.2 P0 后端修复

| # | 问题 | 文件 | 修复方案 |
|---|------|------|---------|
| B1 | App.connections 无mutex | app.go | 添加 sync.RWMutex connectionsMu |
| B2 | ReadFile/WriteFile 路径遍历 | filedialog.go | 限制路径到 ~/.db-client/ 或用户选择路径 |
| B3 | MySQL SSL tls=preferred 无效 | db/mysql.go | preferred→false, required→true, verify-ca→skip-verify+custom |
| B4 | SQLite GetFunctions 查询错误 | schema.go:142 | 改为查询 SQLite 无函数支持, 返回空 |
| B5 | parseExplainResult 空壳 | query_analyzer.go:142 | 调用 parseMySQLExplainFromRows / parsePostgresExplainText |

### 2.3 P1 后端修复

| # | 问题 | 修复方案 |
|---|------|---------|
| B6 | Context传播缺失 | data_editor/redis_api/transaction 改用 a.ctx + WithTimeout |
| B7 | 审计日志补全 | MultiQuery/Begin/Commit/Rollback/Connect/Disconnect 加 Log |
| B8 | PG UseDatabase 竞态 | 不要 close+reconnect, 改为 pool 按 database key 隔离 |
| B9 | MySQL UseDatabase SQL注入 | sanitizeIdentifier(database) |
| B10 | ExecuteMultiQueryWithTimeout 无审计 | 添加 auditLogger.Log |
| B11 | 错误处理不一致 | 所有 fmt.Errorf 中文 → a.t(MsgXxx, lang) |
| B12 | 测试覆盖不足 | 新增 schema/data_editor/transaction/redis mock 测试 |

### 2.4 缺失功能

| # | 功能 | 优先级 | 实现方案 |
|---|------|--------|---------|
| B13 | 查询取消 | P1 | CancelQuery(queryID) + context.CancelFunc map |
| B14 | 查询历史 | P1 | ~/.db-client/history.json, 最近100条 |
| B15 | 已保存查询/书签 | P1 | ~/.db-client/bookmarks.json |
| B16 | 连接导入/导出 | P1 | ExportConnections() / ImportConnections(path) |
| B17 | SSH 隧道 | P2 | golang.org/x/crypto/ssh + Connection.SSHConfig |
| B18 | 备份/恢复 | P2 | 调用 pg_dump / mysqldump |
| B19 | 用户管理 | P2 | CREATE USER / GRANT SQL 模板 |
| B20 | 全文搜索 | P2 | SearchTableData API |

---

## 三、数据库驱动差距

### 3.1 驱动矩阵

| 功能 | PostgreSQL | MySQL | SQLite | Redis |
|------|-----------|-------|--------|-------|
| Connect+SSL | ✅ sslmode | ❌ tls=preferred无效 | ✅ | ⚠️ 无TLS |
| GetTables | ✅ | ✅ | ✅ | ✅ |
| GetTableStructure | ✅ | ✅ | ✅ | ⚠️ 硬编码 |
| GetDatabases | ✅ | ✅ | ⚠️ ["main"] | ⚠️ 硬编码 |
| GetViews | ✅ | ✅ | ✅ | N/A |
| GetFunctions | ✅ | ✅ | ❌ 查view | N/A |
| BeginTx | ✅ | ✅ | ✅ | ❌ |
| UseDatabase | ⚠️ 竞态 | ⚠️ 注入 | N/A | ✅ |

### 3.2 驱动修复计划

| # | 驱动 | 问题 | 修复 |
|---|------|------|------|
| D1 | MySQL | tls=preferred 无效 | 映射: preferred→false, required→true, verify-ca→skip-verify |
| D2 | MySQL | UseDatabase SQL注入 | sanitizeIdentifier(database) |
| D3 | PostgreSQL | UseDatabase 重连竞态 | 移除 close+reconnect, 依赖 pool 按 DB key 隔离 |
| D4 | SQLite | GetFunctions 查 view | 返回空 (SQLite 无存储函数) |
| D5 | Redis | GetTableStructure 硬编码 | 返回 key/type/ttl/size 动态信息 |
| D6 | Redis | GetDatabases 硬编码 | 调用 INFO keyspace 获取实际 DB 列表 |

---

## 四、AI 对接差距 (从零开始)

### 4.1 现状: 零 AI 基础设施

| 检查项 | 状态 |
|--------|------|
| go.mod LLM 库 | ❌ |
| API key 配置 | ❌ (crypto.go 可复用) |
| LLM provider 抽象 | ❌ |
| Prompt 模板 | ❌ |
| Schema context builder | ❌ (schema.go 可复用) |
| 聊天 UI | ❌ |
| 流式响应 | ❌ (Wails EventsEmit 可用) |
| AI 审计 | ❌ (audit.go 可扩展) |

### 4.2 AI 实现路线图

#### Phase 0: 基础设施 (前置依赖)

```
ai/
├── client.go         # LLMClient 接口 + OpenAI/Ollama provider
├── config.go         # 配置存储 (复用 crypto.go 加密)
├── schema_context.go # Schema→文本 (token 预算管理)
├── prompts.go        # Prompt 模板
└── audit.go          # AI 调用审计
```

| 任务 | 复杂度 |
|------|--------|
| LLM client 接口 + OpenAI provider | 中 |
| Ollama provider (本地, 隐私) | 小 |
| 配置存储 (config.json + AES key) | 小 |
| Schema context builder | 中 |
| Prompt 模板系统 | 小 |
| 前端 Settings "AI" section | 小 |

#### Phase 1: 快速赢 (v2.5)

| # | 功能 | 复杂度 | 现有基础 |
|---|------|--------|---------|
| A1 | SQL 解释 | 小 | AnalyzeQuery fallback |
| A2 | 错误诊断 | 小-中 | GetTableColumns + extractTables |
| A3 | SQL 优化建议 | 中 | generateOptimizationSuggestions + EXPLAIN |

#### Phase 2: 核心差异化 (v3.0)

| # | 功能 | 复杂度 |
|---|------|--------|
| A4 | 自然语言转 SQL (NL2SQL) | 中-大 |
| A5 | AI 增强自动补全 | 中 |
| A6 | 数据洞察 | 中-大 |

#### Phase 3: 高级 (v3.5)

| # | 功能 | 复杂度 |
|---|------|--------|
| A7 | Schema 感知聊天 | 大 |
| A8 | 意图→查询报告 | 大 |

### 4.3 AI 安全要求

| 风险 | 缓解措施 |
|------|---------|
| API key 泄露 | AES-256-GCM 加密存储, 永不返回前端 |
| 数据外泄 | 默认 Ollama 本地; 云端需用户确认; 审计日志 |
| AI 生成 SQL 注入 | 必须经 ExecuteQueryWithTimeout (相同保护) |
| AI 输出 XSS | textContent / DOMPurify, 禁止 innerHTML |
| 成本失控 | 防抖 1000ms+; 缓存; 限流; 默认关闭 |

---

## 五、执行计划

### Sprint 1: P0 致命修复 (前端3+后端5)

| 任务 | 文件 | 预估 |
|------|------|------|
| F1 数据编辑流程 | app.js renderDataView + saveDataChanges | 4h |
| F2 Settings 持久化 | app.js saveSettings + Monaco 应用 | 2h |
| F3 Tab 内容持久化 | app.js per-tab content 缓存 | 3h |
| F4 视图/函数加载 | app.js loadViews/loadFunctions | 2h |
| B1 App.connections mutex | app.go + connection.go | 1h |
| B2 路径遍历修复 | filedialog.go | 1h |
| B3 MySQL SSL 修复 | db/mysql.go | 1h |
| B4 SQLite GetFunctions | schema.go | 0.5h |
| B5 EXPLAIN 解析 | query_analyzer.go | 2h |

### Sprint 2: P1 功能补全

| 任务 | 预估 |
|------|------|
| F5 i18n 完整覆盖 | 4h |
| F6-F7 窗口拖拽+resize | 3h |
| F8-F12 前端体验补全 | 4h |
| B6 Context传播 | 2h |
| B7 审计日志补全 | 2h |
| B8-B9 驱动竞态修复 | 3h |
| B13 查询取消 | 2h |
| B14 查询历史 | 2h |
| B15 书签 | 2h |
| B16 连接导入导出 | 2h |

### Sprint 3: P2 AI 集成

| 任务 | 预估 |
|------|------|
| AI Phase 0 基础设施 | 8h |
| A1 SQL 解释 | 3h |
| A2 错误诊断 | 4h |
| A3 SQL 优化建议 | 5h |

### Sprint 4: 测试+文档

| 任务 | 预估 |
|------|------|
| 后端测试覆盖 >60% | 8h |
| 文档全面更新 | 4h |

---

## 六、完成度目标

| 维度 | 当前 | 目标 |
|------|------|------|
| 前端 UX | 55% | 95% |
| 后端 API 质量 | 75% | 95% |
| 数据库驱动 | 80% | 95% |
| 安全 | 85% | 98% |
| AI 对接 | 0% | 40% (Phase 0+1) |
| 测试覆盖 | 16% | 60%+ |
| 并发安全 | 70% | 95% |
