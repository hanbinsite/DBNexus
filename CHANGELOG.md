# Changelog

All notable changes to DBNexus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-06-26

### Added — 核心功能
- 跨平台桌面应用 (Go + Wails v2)
- 支持 6 种数据库: PostgreSQL, MySQL, SQLite, Redis, PolarDB, GaussDB
- Monaco SQL 编辑器 (语法高亮, 自动补全, 代码片段, 多光标)
- 连接池 (最大50连接, 健康检查, FIFO淘汰)
- AES-256-GCM 密码加密存储
- 审计日志系统 (追加写入, rune截断)
- 连接管理 (分组/搜索/导入导出/SSH隧道/SSL-TLS)
- 数据查看 (虚拟滚动, 分页, 筛选, 排序, 列调整)
- 数据编辑 (双击编辑, 行级锁, 冲突检测, 事务批量编辑)
- 表结构/索引/外键查看与管理
- 导出导入 (CSV/JSON/Excel/SQL/流式导出)
- 数据对比 (表对比/查询对比/结构对比/结果同步)
- 事务管理 (Begin/Commit/Rollback/Savepoint)
- Redis 浏览器 (Key扫描/SET/DEL/Server Info/命令白名单)
- 全文搜索 (跨表搜索)
- 查询历史 + 书签
- SQL 格式化/验证/调试 (分步执行)
- EXPLAIN 可视化 + 慢查询分析
- 用户管理 (CREATE/DROP/GRANT)
- 备份/恢复 (mysqldump/pg_dump)
- 性能监控仪表盘
- 角色权限管理 (4种默认角色)
- 数据脱敏
- 登录认证 (SHA-256 + Session)
- 安全配置扫描

### Added — AI 助手
- NL2SQL (自然语言转SQL)
- SQL 解释
- 错误诊断
- 优化建议 (EXPLAIN + 索引分析)
- OpenAI Compatible + Ollama 本地 Provider
- AI 配置加密存储

### Added — 高级功能
- Git 版本控制集成 (仓库管理/提交/分支/Pull/Push)
- 定时任务调度器
- 报表设计器 (多区块/图表/参数化)
- 插件系统 (Go plugin 动态加载 + 8种钩子)
- 云数据库连接 (6云厂商)
- NoSQL 框架 (MongoDB/Elasticsearch)
- 事件总线 (pub/sub + 持久化)
- 配置热重载
- 图表可视化 (柱状图/折线图/饼图)
- 键盘快捷键系统 (28个默认 + 自定义)
- 无障碍访问 (ARIA/键盘导航/焦点管理)

### Added — 工程质量
- 121 个测试 (含集成测试)
- 前端模块化 (14个JS模块)
- Go Service 层架构 (ServiceContainer)
- 统一错误处理 (10种错误码)
- Docker 容器化 (多阶段构建)
- CI/CD 管道 (GitHub Actions)
- i18n 国际化 (zh/en, 300+ keys)
- TypeScript 配置 (tsconfig.json)

### Security
- SQL 注入防护 (sanitizeIdentifier + 参数化查询)
- 前端 XSS 防护 (textContent + escapeHtml)
- Redis 命令白名单
- 路径遍历防护
- 文件权限 0600
- 危险操作二次确认 (DDL)
