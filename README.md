<div align="center">

# DBNexus

### 跨平台数据库客户端 — AI 驱动 · 开源 · 全功能

[![Go](https://img.shields.io/badge/Go-1.24+-00ADD8?logo=go)](https://go.dev/)
[![Wails](https://img.shields.io/badge/Wails-v2-00ADD8)](https://wails.io/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.0.1-orange)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/Tests-121-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

</div>

---

## 概述

DBNexus 是一个跨平台桌面数据库客户端，支持 PostgreSQL、MySQL、SQLite、Redis、PolarDB、GaussDB，并集成 AI 助手功能。使用 Go + Wails v2 构建，提供原生级性能体验。

## 特性

### 数据库管理
- **6 种数据库**: PostgreSQL / MySQL / SQLite / Redis / PolarDB / GaussDB
- **连接管理**: 分组 / 搜索 / 导入导出 / 自动连接 / SSH 隧道 / SSL/TLS
- **连接池**: 最大 50 连接，自动健康检查，FIFO 淘汰
- **NoSQL**: MongoDB / Elasticsearch 框架支持

### SQL 工具
- **Monaco 编辑器**: 语法高亮 / 自动补全 / 代码片段 / 多光标
- **查询执行**: 多语句 / 超时控制 / 取消查询 / 查询历史 / 书签
- **SQL 调试**: 分步执行 / 预览 / 错误追踪
- **格式化**: SQL 美化 / 压缩 / 语法验证
- **查询分析**: EXPLAIN 可视化 / 慢查询分析 / 优化建议

### 数据操作
- **数据编辑**: 双击编辑 / 行级锁 / 冲突检测 / 事务批量编辑
- **虚拟滚动**: 大数据集 (>500行) 高性能渲染
- **高级筛选**: 多条件组合 / AND-OR 逻辑
- **导出导入**: CSV / JSON / Excel / SQL / 流式导出
- **数据对比**: 表对比 / 查询对比 / 结构对比 / 结果同步
- **全文搜索**: 跨表搜索 / 正则匹配

### AI 助手
- **NL2SQL**: 自然语言转 SQL
- **SQL 解释**: AI 解析复杂查询
- **错误诊断**: 智能错误分析 + 修复建议
- **优化建议**: EXPLAIN + 索引 + 统计分析
- **多 Provider**: OpenAI 兼容 / Ollama 本地

### 安全 & 审计
- **加密存储**: AES-256-GCM 密码加密
- **审计日志**: 全操作记录 / 追加写入 / 导出
- **Redis 白名单**: 80+ 安全命令
- **角色权限**: 4 种默认角色 / 连接级分配
- **数据脱敏**: 敏感列自动遮罩
- **登录认证**: SHA-256 + Session

### 高级功能
- **Git 集成**: 仓库管理 / 提交 / 分支 / Pull / Push
- **定时任务**: 间隔执行 / 自动重调度
- **报表设计器**: 多区块 / 图表 / 参数化
- **性能监控**: 系统信息 / 连接池 / 慢查询 / 健康检查
- **插件系统**: Go plugin 动态加载 / 8 种钩子
- **云数据库**: AWS / GCP / Azure / 阿里云 / 腾讯云 / 华为云

## 快速开始

### 环境要求
- Go 1.24+
- Node.js 16+ (前端构建)
- CGO (SQLite 支持)

### 开发模式
```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 开发运行
wails dev

# 生产构建
wails build
```

### Docker
```bash
docker-compose up -d
```

## 截图

<!-- TODO: 添加截图 -->

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Go 1.24, Wails v2 |
| 前端 | 原生 JavaScript, Monaco Editor |
| 数据库驱动 | lib/pq, go-sql-driver/mysql, mattn/go-sqlite3, go-redis |
| 加密 | AES-256-GCM, SHA-256 |
| AI | OpenAI Compatible, Ollama |

## 项目结构

```
db-server/
├── main.go              # 入口
├── app.go               # App 结构体
├── config.go            # 连接配置
├── pool.go              # 连接池
├── crypto.go            # 加密
├── query*.go            # 查询执行
├── schema*.go           # Schema 操作
├── data_*.go            # 数据编辑/导出/对比
├── transaction.go       # 事务管理
├── audit.go             # 审计日志
├── redis_api.go         # Redis API
├── ai_*.go              # AI 功能
├── ssh_tunnel.go        # SSH 隧道
├── backup_restore.go    # 备份恢复
├── service_container.go # Service 层
├── nosql_driver.go      # NoSQL 驱动
├── plugin_loader.go     # 插件加载
├── db/                  # 数据库驱动层
├── frontend/dist/       # 前端
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   ├── i18n.js
│   └── modules/         # 14 个 JS 模块
├── docs/                # 文档
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/   # CI/CD
```

## 贡献

欢迎提交 Issue 和 PR！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
