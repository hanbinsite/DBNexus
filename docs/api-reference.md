# DBNexus API 文档

## 后端 API (Wails Bindings)

所有 API 通过 Wails v2 前端绑定调用，格式为 `window.go.main.App.MethodName(params)`。

### 连接管理

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `SaveConnection` | `Connection` | `error` | 保存/更新连接 |
| `GetConnections` | - | `[]Connection` | 获取所有连接 |
| `DeleteConnection` | `id: string` | `error` | 删除连接 |
| `TestConnection` | `Connection` | `(bool, string)` | 测试连接 |
| `ConnectToDatabase` | `Connection` | `error` | 连接数据库 |
| `DisconnectFromDatabase` | `Connection` | `error` | 断开连接 |

### 数据库操作

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetDatabases` | `Connection` | `[]DatabaseInfo` | 获取数据库列表 |
| `GetTables` | `Connection, database` | `[]TableInfo` | 获取表列表 |
| `GetTableColumns` | `Connection, db, table` | `[]ColumnInfo` | 获取表结构 |
| `GetTableIndexes` | `Connection, db, table` | `[]IndexInfo` | 获取索引 |
| `GetTableForeignKeys` | `Connection, db, table` | `[]ForeignKeyInfo` | 获取外键 |
| `GetTableData` | `Connection, db, table, page, pageSize` | `QueryResult` | 获取表数据 |
| `GetTablePartitions` | `Connection, db, table` | `[]PartitionInfo` | 获取分区信息 |

### 查询执行

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `ExecuteQuery` | `Connection, db, query` | `QueryResult` | 执行单条查询 |
| `ExecuteMultiQuery` | `Connection, db, query` | `MultiQueryResult` | 执行多条查询 |
| `ExecuteNonQuery` | `Connection, db, query` | `(rows, lastId, error)` | 执行非查询语句 |
| `ExplainQuery` | `Connection, db, query` | `ExplainResult` | EXPLAIN 分析 |
| `CancelQuery` | `Connection, pid` | `error` | 取消查询 |
| `BeautifySQL` | `sql: string` | `string` | SQL 格式化 |
| `ValidateSQLSyntax` | `sql: string` | `SQLValidationResult` | SQL 语法验证 |
| `DebugSQL` | `Connection, db, query` | `DebugResult` | SQL 调试 |

### 数据编辑

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `EditTableData` | `Connection, EditRequest` | `EditResult` | 编辑单行 |
| `BatchEdit` | `Connection, []EditRequest` | `[]EditResult` | 批量编辑 |
| `BatchEditTransactional` | `Connection, []EditRequest` | `[]EditResult` | 事务批量编辑 |

### 导出导入

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `ExportData` | `Connection, ExportRequest` | `ExportResult` | 导出数据 |
| `ImportData` | `Connection, ImportRequest` | `ImportResult` | 导入数据 |
| `OpenFileDialog` | - | `string` | 打开文件对话框 |
| `SaveFileDialog` | - | `string` | 保存文件对话框 |

### 事务管理

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `BeginTransaction` | `Connection, db, TransactionOptions` | `(txID, error)` | 开始事务 |
| `ExecuteInTransaction` | `txID, query` | `(result, error)` | 事务内执行 |
| `CommitTransaction` | `txID` | `error` | 提交事务 |
| `RollbackTransaction` | `txID` | `error` | 回滚事务 |
| `CreateSavepoint` | `txID, name` | `error` | 创建保存点 |
| `RollbackToSavepoint` | `txID, name` | `error` | 回滚到保存点 |
| `GetActiveTransactions` | - | `[]TransactionInfo` | 活跃事务列表 |

### Redis

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetRedisDBSize` | `Connection` | `int` | Redis 数据库数量 |
| `ScanRedisKeys` | `Connection, pattern, cursor, count` | `ScanResult` | 扫描 Key |
| `GetRedisKeyType` | `Connection, key` | `string` | 获取 Key 类型 |
| `GetRedisKeyValue` | `Connection, key` | `KeyValueResult` | 获取 Key 值 |
| `SetRedisKey` | `Connection, key, value` | `error` | 设置 Key |
| `DeleteRedisKey` | `Connection, key` | `error` | 删除 Key |
| `GetRedisInfo` | `Connection` | `string` | Redis 服务器信息 |

### AI 功能

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `AIChat` | `AIChatRequest` | `AIChatResponse` | AI 对话 |
| `ExplainSQL` | `sql: string` | `string` | AI 解释 SQL |
| `SuggestOptimizations` | `Connection, db, sql` | `string` | AI 优化建议 |
| `NaturalLanguageToSQL` | `Connection, db, nl` | `string` | NL2SQL |
| `RecommendIndexes` | `Connection, db, table` | `IndexAnalysisResult` | 索引推荐 |
| `AIOptimizeQuery` | `Connection, db, sql` | `AIOptimizationResult` | AI 查询优化 |
| `TestAIConnection` | - | `(bool, string)` | 测试 AI 连接 |
| `SetAIConfig` | `provider, apiKey, baseURL, model, enable` | `error` | 配置 AI |

### 性能监控

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetSystemInfo` | - | `map` | 系统信息 |
| `GetPoolStats` | - | `map` | 连接池统计 |
| `GetSlowQueries` | `Connection, db, threshold` | `[]map` | 慢查询列表 |
| `GetActiveQueries` | `Connection` | `[]map` | 活跃查询 |
| `GetPerformanceMetrics` | - | `PerformanceMetrics` | 性能指标 |
| `HealthCheck` | - | `map` | 健康检查 |

### 安全 & 审计

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetAuditLogs` | `limit, level, eventType` | `[]AuditLog` | 审计日志 |
| `ExportAuditLogs` | `format, path` | `error` | 导出审计日志 |
| `ClearOldAuditLogs` | `days` | `int` | 清理旧日志 |
| `RunSecurityScan` | - | `SecurityScanResult` | 安全扫描 |
| `Login` | `username, password` | `LoginResult` | 登录认证 |
| `Logout` | - | `error` | 登出 |

### SSH 隧道

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `CreateSSHTunnel` | `SSHTunnelConfig` | `(tunnelID, error)` | 创建 SSH 隧道 |
| `CloseSSHTunnel` | `tunnelID` | `error` | 关闭隧道 |
| `GetActiveSSHTunnels` | - | `[]SSHTunnelInfo` | 活跃隧道列表 |

### 备份恢复

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `BackupDatabase` | `Connection, options` | `BackupResult` | 备份数据库 |
| `RestoreDatabase` | `Connection, options` | `RestoreResult` | 恢复数据库 |

### Git 集成

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetGitRepos` | - | `[]GitRepo` | 仓库列表 |
| `AddGitRepo` | `path` | `error` | 添加仓库 |
| `GetGitRepoInfo` | `repo` | `GitRepoInfo` | 仓库信息 |
| `GetGitChanges` | `repo` | `[]GitChange` | 文件变更 |
| `GetGitLog` | `repo, limit` | `[]GitCommit` | 提交历史 |
| `GitPull` | `repo` | `error` | Pull |
| `GitPush` | `repo` | `error` | Push |
| `GitCommit` | `repo, message` | `error` | Commit |
| `GitCreateBranch` | `repo, name` | `error` | 新建分支 |

### 报表

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetReportTemplates` | - | `[]ReportTemplate` | 模板列表 |
| `SaveReportTemplate` | `ReportTemplate` | `error` | 保存模板 |
| `DeleteReportTemplate` | `id` | `error` | 删除模板 |
| `ExecuteReportTemplate` | `Connection, db, id, params` | `ReportResult` | 执行报表 |

### 插件

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetPlugins` | - | `[]Plugin` | 插件列表 |
| `RegisterPlugin` | `name, ver, desc, type` | `error` | 注册插件 |
| `TogglePlugin` | `id, enabled` | `error` | 启用/禁用 |
| `RemovePlugin` | `id` | `error` | 删除插件 |
| `LoadNativePlugin` | `path` | `error` | 加载原生插件 |
| `GetPluginManifests` | - | `[]PluginManifest` | 插件清单 |

### 定时任务

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `GetScheduledTasks` | - | `[]ScheduledTask` | 任务列表 |
| `CreateScheduledTask` | `ScheduledTask` | `error` | 创建任务 |
| `DeleteScheduledTask` | `id` | `error` | 删除任务 |
| `ToggleScheduledTask` | `id, enabled` | `error` | 启用/禁用 |

### 事件总线

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `PublishEvent` | `eventType, data` | `error` | 发布事件 |
| `SubscribeToEvents` | `eventType` | `[]Event` | 订阅事件 |
| `GetEventHistory` | `limit` | `[]Event` | 事件历史 |
| `ClearEventHistory` | - | `error` | 清空历史 |

### 窗口控制

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `WindowMinimize` | - | `error` | 最小化 |
| `WindowMaximize` | - | `error` | 最大化 |
| `WindowClose` | - | `error` | 关闭 |
| `WindowIsMaximized` | - | `bool` | 是否最大化 |
| `WindowSetSize` | `w, h` | `error` | 设置窗口大小 |

---

## 前端模块 API

### modules/dom-utils.js
- `DomUtils.escapeHtml(str)`: HTML 转义
- `DomUtils.createElement(tag, props, children)`: 创建元素
- `DomUtils.debounce(fn, delay)`: 防抖

### modules/theme.js
- `initTheme()`: 初始化主题
- `toggleTheme()`: 切换主题
- `setTheme(theme)`: 设置主题
- `setDensity(value)`: 设置密度

### modules/error-handler.js
- `handleError(error, context)`: 统一错误处理
- `safeAsync(fn, context)`: 安全异步包装
- `AppError`: 错误类

### modules/keyboard-shortcuts.js
- `initKeyboardShortcuts()`: 初始化快捷键
- `getShortcutList()`: 获取快捷键列表
- `setShortcut(action, shortcut)`: 自定义快捷键

### modules/performance.js
- `StreamingTableRenderer`: 流式表格渲染器
- `debounce(fn, delay)`: 防抖
- `throttle(fn, limit)`: 节流
- `PerfMonitor`: 性能监控器

### modules/ai-chat.js
- `openAIChatPanel()`: 打开 AI 面板
- `sendAIChatMessage()`: 发送消息
- `analyzeIndexes()`: 分析索引

### modules/accessibility.js
- `initAccessibility()`: 初始化无障碍
- `announce(message)`: 屏幕阅读器通知
