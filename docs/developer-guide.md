# DBNexus 开发指南

## 开发环境搭建

### 环境要求
- Go 1.24+
- Node.js 16+ (前端构建)
- CGO (SQLite 支持)
- Git
- Wails CLI v2

### 安装 Wails CLI
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 克隆并运行
```bash
git clone git@github.com:hanbinsite/DBNexus.git
cd DBNexus
go mod download
wails dev
```

### Docker 开发环境
```bash
docker-compose up -d
```

---

## 项目架构

```
DBNexus/
├── main.go              # 应用入口
├── app.go               # App 结构体 + 生命周期
├── version.go           # 版本号常量
├── config.go            # 连接配置持久化
├── pool.go              # 连接池
├── pool_warmer.go       # 连接池预热
├── crypto.go            # AES-256-GCM 加密
├── connection.go        # 连接管理
├── connection_ext.go    # 连接扩展(分区/安全扫描)
├── connection_groups.go # 连接分组
├── query.go             # 查询执行
├── query_timeout.go     # 查询超时控制
├── query_analyzer.go    # 查询分析
├── schema.go            # Schema 操作
├── schema_ext.go        # Schema 扩展
├── schema_ext2.go       # 查询缓存
├── data_editor.go       # 数据编辑
├── data_export.go       # 数据导出
├── data_compare.go      # 数据对比
├── transaction.go       # 事务管理
├── batch_transactional.go # 事务批量编辑
├── audit.go             # 审计日志
├── redis_api.go         # Redis API
├── ai_client.go         # AI 客户端 (OpenAI/Ollama)
├── ai_features.go       # AI 功能
├── ai_chat.go           # AI 对话 + 索引推荐
├── ssh_tunnel.go        # SSH 隧道
├── backup_restore.go    # 备份恢复
├── search.go            # 全文搜索
├── user_management.go   # 用户管理
├── performance.go       # 性能监控
├── data_masking.go      # 数据脱敏
├── auth.go              # 认证
├── scheduler.go         # 定时任务
├── service_container.go # Service 层
├── nosql_driver.go      # NoSQL 驱动
├── plugin_loader.go     # 插件加载
├── constants.go         # 常量 + 事件总线 + 配置监听
├── window.go            # 窗口控制
├── autocomplete.go      # SQL 自动补全
├── sql_formatter.go     # SQL 格式化
├── stream_export.go     # 流式导出
├── blob_preview.go      # BLOB 预览
├── sprint9-16.go        # 高级功能 (分Sprint)
├── db/                  # 数据库驱动层
│   ├── db.go            # 接口定义
│   ├── mysql.go         # MySQL 驱动
│   ├── postgresql.go    # PostgreSQL 驱动
│   ├── sqlite.go        # SQLite 驱动
│   └── redis.go         # Redis 驱动
├── frontend/            # 前端
│   ├── dist/            # 构建产物 (直接服务)
│   │   ├── app.js       # 主应用 (4800行)
│   │   ├── index.html   # HTML
│   │   ├── styles.css   # 样式 (2793行)
│   │   ├── i18n.js      # 国际化
│   │   └── modules/     # 16个JS模块
│   ├── src/             # TypeScript 源码 (迁移中)
│   │   ├── types/       # 类型定义
│   │   └── modules/     # TS 模块
│   └── package.json     # TS 构建配置
├── assets/              # 图标资源
├── docs/                # 文档
├── .github/workflows/   # CI/CD
├── Dockerfile           # Docker 构建
├── docker-compose.yml   # 开发环境
├── tsconfig.json        # TypeScript 配置
└── ROADMAP.md           # 开发路线图
```

---

## 后端开发

### 添加新的 Wails API 方法

1. 在 `.go` 文件中添加方法:
```go
// 在 app.go 或对应文件中
func (a *App) MyNewFeature(param string) (string, error) {
    // 业务逻辑
    result, err := doSomething(param)
    if err != nil {
        return "", fmt.Errorf("操作失败: %w", err)
    }
    return result, nil
}
```

2. 前端调用:
```javascript
if (isWailsAvailable()) {
    const result = await WailsAPI.myNewFeature("param");
}
```

3. 在 `app.js` 的 `initWails()` 中添加 WailsAPI 映射:
```javascript
myNewFeature: (param) => api.MyNewFeature(param),
```

### 添加新的数据库类型

1. 在 `db/db.go` 中实现 `DatabaseDriver` 接口
2. 在 `db/` 目录创建新驱动文件
3. 在 `connection.go` 的 `connectionToDBConfig` 中添加类型映射

### 安全规范

- **SQL 注入防护**: 所有表名/列名必须经过 `sanitizeIdentifier()`
- **密码加密**: 使用 `encryptPassword()` / `decryptPassword()`
- **审计日志**: 重要操作调用 `GetAuditLogger().Log()`
- **路径遍历**: 文件操作验证路径不包含 `..`
- **权限检查**: 敏感操作检查角色权限

### 连接池使用

```go
// 获取连接
dbConfig := a.connectionToDBConfig(conn)
driver, err := a.getDriverForConfig(dbConfig)
if err != nil {
    return err
}

// 使用 context 超时
ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
defer cancel()
rows, err := driver.Query(ctx, query)
```

### 事件总线

```go
// 发布事件
eventBus.Publish("query.executed", map[string]interface{}{
    "query": sql,
    "duration": duration,
})

// 事件自动持久化到 ~/.dbnexus/event_log.json
```

---

## 前端开发

### 模块化规范

1. 独立功能提取到 `modules/` 目录
2. 每个模块文件以功能注释开头
3. 全局函数直接定义 (非 ES module)
4. 在 `index.html` 中添加 `<script>` 标签加载

### 创建新模块

```javascript
// modules/my-module.js

/**
 * My Module — Description
 */

function initMyModule() {
    // 初始化逻辑
}

function myFeature() {
    // 功能实现
}
```

在 `index.html` 中加载:
```html
<script src="modules/my-module.js"></script>
```

在 `app.js` 的 `DOMContentLoaded` 中调用:
```javascript
initMyModule();
```

### 安全规范

- **XSS 防护**: 使用 `textContent` 或 `DomUtils.escapeHtml()` 代替 `innerHTML`
- **事件绑定**: 使用 `addEventListener` 代替内联 `onclick`
- **变量声明**: 使用 `const` / `let`, 不使用 `var`
- **错误处理**: 使用 `safeAsync()` 包装异步调用

### TypeScript 迁移

1. 在 `frontend/src/types/index.ts` 中定义类型
2. 在 `frontend/src/modules/` 中创建 `.ts` 文件
3. 使用 `declare global` 声明全局变量
4. 运行 `npm run build` 编译到 `dist/`

---

## 测试

### 运行测试
```bash
# 全部测试
go test ./... -count=1 -v

# 跳过集成测试 (无 CGO)
go test ./... -count=1 -short

# 特定测试
go test -run TestSanitizeIdentifier ./...

# 性能测试
go test -bench=. ./...
```

### 添加测试

```go
func TestMyFeature(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {"case1", "input1", "expected1"},
        {"case2", "input2", "expected2"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := myFeature(tt.input)
            if result != tt.expected {
                t.Errorf("got %q, want %q", result, tt.expected)
            }
        })
    }
}
```

### 集成测试

- 使用 SQLite 内存数据库
- 标记 `if testing.Short() { t.Skip(...) }`
- 测试完整流程: 连接 → 操作 → 验证 → 清理

---

## 构建发布

### 本地构建
```bash
wails build -clean
```

### Docker 构建
```bash
docker build -t dbnexus .
```

### GitHub Actions 自动构建
- 推送 `v*` tag 触发 release 构建
- 自动构建 Windows / macOS / Linux 三平台
- 自动创建 GitHub Release

```bash
git tag v0.0.2
git push github v0.0.2
```

---

## 调试

### 后端调试
```bash
# 启用详细日志
DBNEXUS_DEBUG=1 wails dev

# 查看审计日志
cat ~/.dbnexus/audit.log

# 查看事件日志
cat ~/.dbnexus/event_log.json
```

### 前端调试
- 使用浏览器开发者工具 (F12)
- `console.log()` 调试
- `perfMonitor` 性能监控

### 配置文件位置
- 连接配置: `~/.dbnexus/connections.json`
- 应用配置: `~/.dbnexus/config.json`
- 审计日志: `~/.dbnexus/audit.log`
- 事件日志: `~/.dbnexus/event_log.json`
- 插件目录: `~/.dbnexus/plugins/`

---

## 性能优化指南

### 后端
- 使用连接池 (`getDriverForConfig`)
- 查询超时 (`context.WithTimeout`)
- 流式导出大数据集
- 查询结果缓存 (`QueryResultCache2`)

### 前端
- 虚拟滚动 (`StreamingTableRenderer`)
- 防抖搜索输入 (`debounce`)
- 节流滚动事件 (`throttle`)
- 批量 DOM 更新 (`batchDOMUpdates`)
- 懒加载模块 (`lazyLoadScript`)

---

## 贡献流程

1. Fork 仓库
2. 创建功能分支: `git checkout -b feat/my-feature`
3. 编写代码 + 测试
4. 确保通过: `go vet ./... && go test ./... -count=1`
5. 提交: `git commit -m 'feat: my feature'`
6. 推送: `git push origin feat/my-feature`
7. 提交 PR 到 `master` 分支

### Commit 规范
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具
