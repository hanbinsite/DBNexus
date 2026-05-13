# D08 — Migration Plan / 设计→实施迁移计划

> 文档版本: v1.0 | 最后更新: 2026-05-11
> 本文档是设计文档(U01/U02/U03/D10)与当前代码实现之间的"施工桥梁"
> 联动: D10-interface-contract, D05-ui-pages, U01-design-system, ROADMAP

---

## 1. 问题诊断

当前项目存在**设计-实施鸿沟**:

| 维度 | 设计文档描述 | 代码实际状态 | 差距 |
|------|------------|------------|------|
| 接口契约(D10) | EditRequestV2(删除WhereClause) | EditRequest仍有WhereClause | 契约未落地 |
| 接口契约(D10) | NULL→null, 前端统一渲染 | NULL→字符串"NULL" | 契约未落地 |
| 接口契约(D10) | 统一 {success,data?,error?} 错误模式 | 各API错误格式不一致 | 契约未落地 |
| 接口契约(D10) | 前端强制ExecuteQueryWithTimeout | app.js仍调用无超时版 | 契约未落地 |
| 接口契约(D10) | 行数据 Array<Record<string,any>> | [][]interface{} 按索引访问 | 契约未落地 |
| 设计系统(U01) | Terminal Noir (CRT/微光/扫描线) | 通用GitHub暗色主题 | 设计0%实施 |
| 安全 | 57处innerHTML需替换 | 仍在使用 | 安全隐患未修 |

**根因**: 设计文档定义了"目标态"，代码停留在"当前态"，中间缺少分阶段、可验证的迁移步骤。

---

## 2. 迁移原则

1. **每个迁移步骤独立可交付** — 不依赖后续步骤即可编译运行
2. **向后兼容** — 旧API保留但标记Deprecated，新API并行存在
3. **测试先行** — 每步迁移前先补测试，确保不引入回归
4. **渐进式** — 不做一次性大重构，按优先级分阶段推进
5. **追踪矩阵** — 每步关联D10契约项和ROADMAP安全项

---

## 3. 阶段1: 安全修复与契约落地 (v1.5, 预估4周)

### 3.1 后端安全修复 (1.5周)

| # | 任务 | 关联契约/安全 | 文件 | 验收标准 | 状态 |
|---|------|-------------|------|---------|------|
| M1-1 | encryptionKey sync.Once | SEC-002 | crypto.go:17 | 并发init不覆盖key | ✅ 已完成 |
| M1-2 | GetConnections() 清空Password | SEC-001/D10-4.1 | connection.go:26 | 返回JSON无password字段 | ✅ 已完成 |
| M1-3 | EditRequest删除WhereClause, 强制PrimaryKey | SEC-006/D10-3.2 | types.go:91 | UPDATE/DELETE必须传primaryKey | ✅ 已完成 |
| M1-4 | MySQL DESCRIBE参数化/sanitize | SEC-005 | db/mysql.go:88 | 恶意表名不执行 | 待实施 |
| M1-5 | SQLite PRAGMA sanitize | SEC-005 | db/sqlite.go:92 | 恶意表名不执行 | 待实施 |
| M1-6 | ImportData路径遍历检查 | SEC-007 | data_export.go:281 | `..`和绝对路径被拒绝 | 待实施 |
| M1-7 | context.Background() → WithTimeout | D10-4.2 | redis_api.go(7处), autocomplete.go, query_analyzer.go | 所有查询30s超时 | 待实施 |
| M1-8 | connections切片加sync.RWMutex | TECH-007 | app.go | 并发读写不panic | 待实施 |
| M1-9 | MySQL SSLMode解析 | SEC-003 | db/mysql.go:23-32 | ssl_mode=required时tls=true | ✅ 部分已完成 |
| M1-10 | 事务自动清理定时器 | ROADMAP-8 | transaction.go:57 | 5分钟清理过期事务 | ✅ 部分已完成(代码存在, 未自动调用) |

### 3.2 前端安全修复 (1.5周)

| # | 任务 | 关联契约/安全 | 文件 | 验收标准 | 状态 |
|---|------|-------------|------|---------|------|
| M1-11 | WailsAPI.executeQuery切换到WithTimeout | SEC-004/D10-4.2 | app.js:42 | 默认30s超时 | ✅ 已完成(后端ExecuteQuery已委托WithTimeout) |
| M1-12 | innerHTML→textContent替换(连接名/数据库名/表名) | SEC-008 | app.js(~20处纯文本场景) | 数据库返回名无XSS | 待实施 |
| M1-13 | innerHTML→createElement替换(表格数据渲染) | SEC-008 | app.js:1702等 | 查询结果数据无XSS | 待实施 |
| M1-14 | insertAdjacentHTML→createElement替换(选项列表) | SEC-008 | app.js:1590等 | 选项值无XSS | 待实施 |
| M1-15 | 错误消息显示使用textContent | SEC-008 | app.js:2105等 | 错误消息无XSS | 待实施 |

### 3.3 审计日志优化 (0.5周)

| # | 任务 | 关联契约/安全 | 文件 | 验收标准 | 状态 |
|---|------|-------------|------|---------|------|
| M1-16 | writeToFile改为append-only JSON lines | SEC-009 | audit.go:189 | 每次Log只写1行 | ✅ 已完成 |
| M1-17 | truncateQuery改用rune截断 | SEC-010 | audit.go:280 | 中文截断不乱码 | ✅ 已完成 |
| M1-18 | ExecuteQuery/ExecuteMultiQuery添加审计 | SEC-009 | query.go, query_timeout.go | 查询操作有审计记录 |

### 3.4 契约API落地 (0.5周)

| # | 任务 | 关联契约 | 验收标准 |
|---|------|---------|---------|
| M1-19 | NULL→null (后端返回null而非字符串"NULL") | D10-2.2 | QueryResult中null值为JS null |
| M1-20 | 前端null渲染: `<span class="null-value">NULL</span>` | D10-2.2 | UI显示斜体NULL |

---

## 4. 阶段2: 前端模块化与设计系统落地 (v2.0, 预估6周)

### 4.1 前端模块化拆分 (2周)

将 `app.js` (3241行) 拆分为模块:

```
frontend/dist/
├── app.js              (入口, <200行, 初始化+路由)
├── modules/
│   ├── state.js        (全局状态管理)
│   ├── api.js          (WailsAPI封装层, 含超时默认值)
│   ├── connection.js   (连接管理UI)
│   ├── database-tree.js (数据库树浏览)
│   ├── query-editor.js (Monaco编辑器集成)
│   ├── result-panel.js  (查询结果展示)
│   ├── data-view.js    (数据浏览面板)
│   ├── data-edit.js    (数据编辑)
│   ├── export.js       (导出对话框)
│   ├── compare.js      (数据对比面板)
│   ├── transaction.js  (事务管理面板)
│   ├── redis.js        (Redis浏览)
│   ├── audit.js        (审计日志面板)
│   ├── settings.js     (设置对话框)
│   └── utils.js        (DOM操作工具, sanitizeHTML等)
└── styles.css
```

| # | 任务 | 验收标准 |
|---|------|---------|
| M2-1 | 提取 `state.js` + `api.js` | 全局state对象可从各模块访问 |
| M2-2 | 提取 `connection.js` | 连接管理功能不退化 |
| M2-3 | 提取 `database-tree.js` | 数据库树展开/折叠正常 |
| M2-4 | 提取 `query-editor.js` | Monaco初始化+执行不退化 |
| M2-5 | 提取 `result-panel.js` | 结果表格/消息/摘要正常 |
| M2-6 | 提取 `data-view.js` | 数据浏览分页/过滤正常 |
| M2-7 | 提取其余模块 | 所有功能不退化 |
| M2-8 | 创建 `utils.js` 含 `sanitizeHTML()` | 所有模块使用工具函数 |

### 4.2 Terminal Noir 设计系统落地 (3周)

| # | 任务 | U01映射 | 验收标准 |
|---|------|---------|---------|
| M2-9 | CSS变量替换为U01设计令牌 | U01-12 | --bg-primary → --terminal-bg等 |
| M2-10 | NULL值暗绿色微光渲染 | U01-1.2 | null-value class + 微弱glow动画 |
| M2-11 | 选中行扫描线效果 | U01-1.2 | 行选中时1px水平线动画 |
| M2-12 | 字体替换为JetBrains Mono优先 | U01-3 | 代码区域等宽，UI区域Inter |
| M2-13 | 间距对齐U01间距系统(8px grid) | U01-4 | 所有padding/margin为8的倍数 |
| M2-14 | 组件状态(聚焦/悬停/禁用)对齐U01-9 | U01-9 | 所有按钮/输入框状态一致 |
| M2-15 | 色彩方案从GitHub暗色→Terminal Noir | U01-2 | 绿色点缀+暗底+极小彩色 |
| M2-16 | 图标系统对齐U01-7 | U01-7 | SVG图标统一尺寸16px/20px |

### 4.3 U02像素级规格落地 (1周)

| # | 任务 | U02映射 | 验收标准 |
|---|------|---------|---------|
| M2-17 | 全局框架尺寸(Toolbar 44px, StatusBar 26px等) | U02-1 | 精确到px |
| M2-18 | 连接对话框尺寸/字段布局 | U02-2 | 对话框宽度/间距精确 |
| M2-19 | 查询工作区(Editor高度/结果面板比例) | U02-4 | Resize handle 4px |
| M2-20 | 数据浏览面板(表格行高/列宽/工具栏) | U02-5 | 行高32px, 表头36px |
| M2-21 | 设置/导出/编辑对话框 | U02-6/7/9 | 弹窗尺寸/按钮布局 |

---

## 5. 阶段3: 架构优化与高级功能 (v3.0, 预估8周)

### 5.1 后端架构优化

| # | 任务 | 验收标准 |
|---|------|---------|
| M3-1 | 统一pool访问模式(删除poolMutex, 全用getOrCreate) | query/editor/transaction/analyzer无手动双重检查 |
| M3-2 | 错误码体系(定义ErrorCode enum, 统一错误返回) | 所有API返回 {success, data?, error?, code?} |
| M3-3 | Connection ID模式(前端只传ID, 后端查找配置) | IPC通道无密码传输 |
| M3-4 | 包结构重构(package main → internal/pool, internal/crypto等) | 编译通过+测试通过 |
| M3-5 | DatabaseDriver泛型抽取(减少4驱动重复代码) | 公共逻辑在base_driver中 |

### 5.2 高级功能

| # | 任务 | ROADMAP映射 | 验收标准 |
|---|------|------------|---------|
| M3-6 | SSH隧道连接 | P1-6 | SSH隧道连接PostgreSQL成功 |
| M3-7 | 慢查询分析 | P1-7 | pg_stat_statements数据展示 |
| M3-8 | 性能监控仪表盘 | P1-7 | 实时查询列表+慢查询TOP10 |
| M3-9 | Redis命令白名单 | SEC-009 | FLUSHALL/CONFIG等被阻止 |
| M3-10 | 敏感数据脱敏 | P1-5 | 手机号/身份证自动脱敏 |
| M3-11 | 虚拟滚动 | PERF-003 | 10万行数据不卡顿 |
| M3-12 | 流式导出 | PERF-001 | 100万行导出<30s |

---

## 6. 迁移追踪矩阵

### D10契约实施状态

| 契约项 | 目标态 | 当前态 | 迁移步骤 | 预计版本 |
|--------|--------|--------|---------|---------|
| EditRequestV2 (删除WhereClause) | primaryKey强制 | WhereClause可传入 | M1-3 | v1.5 |
| NULL→null | 后端返回null | 字符串"NULL" | M1-19, M1-20 | v1.5 |
| 统一错误模式 | {success,data?,error?} | 各API格式不一致 | M3-2 | v3.0 |
| ExecuteQuery废弃 | 前端只调WithTimeout | 仍调用无超时版 | M1-11 | v1.5 |
| 行数据Record化 | Array<Record<string,any>> | [][]interface{}按索引 | M3-2(延后) | v3.0 |

### 安全问题修复追踪

| 安全项 | 严重性 | 迁移步骤 | 预计版本 |
|--------|--------|---------|---------|
| SEC-001 GetConnections暴露密码 | P0 | M1-2 | v1.5 |
| SEC-002 encryptionKey竞态 | P0 | M1-1 | v1.5 |
| SEC-003 MySQL SSL | P0 | M1-9 | v1.5 |
| SEC-004 ExecuteQuery无超时 | P0 | M1-11 | v1.5 |
| SEC-005 MySQL/SQLite未sanitize | P0 | M1-4, M1-5 | v1.5 |
| SEC-006 WhereClause注入 | P0 | M1-3 | v1.5 |
| SEC-007 路径遍历 | P0 | M1-6 | v1.5 |
| SEC-008 前端XSS | P0 | M1-12~M1-15 | v1.5 |
| SEC-009 审计O(n)写入 | P1 | M1-16 | v1.5 |
| SEC-010 truncateQuery中文 | P2 | M1-17 | v1.5 |

---

## 7. 每步迁移的前置条件

```
M1-1~M1-10 (后端安全) — 无前置，可并行
M1-11~M1-15 (前端安全) — 依赖M1-3(EditRequest V2)的API变更
M1-16~M1-18 (审计优化) — 无前置
M1-19~M1-20 (NULL→null) — 需前后端同步发布

M2-1~M2-8 (前端模块化) — 依赖M1-12~M1-15(XSS修复完成, 确保迁移的是干净代码)
M2-9~M2-16 (设计系统) — 依赖M2-8(utils.js提供sanitizeHTML)
M2-17~M2-21 (像素规格) — 依赖M2-9~M2-16(设计令牌到位)

M3-1~M3-5 (架构优化) — 依赖阶段1完成
M3-6~M3-12 (高级功能) — 依赖M3-1~M3-5
```

---

## 8. 回滚策略

每个迁移步骤必须:
1. 在独立分支执行: `git checkout -b migration/M{#}`
2. 通过全量测试: `go test ./...`
3. 前端手动冒烟测试: 连接→查询→编辑→导出→对比
4. 合并前Code Review
5. 如引入回归，立即revert该分支，不修复合并

---

## 9. 文档更新联动

每步迁移完成后，同步更新以下文档:

| 文档 | 更新内容 |
|------|---------|
| D10-interface-contract.md | 契约实施状态表更新 |
| ROADMAP.md | 完成度/安全项状态更新 |
| D06-security.md | 安全问题修复状态更新 |
| D02-feature-design.md | 模块完成度更新 |
| AGENTS.md | 如有新陷阱，添加到Critical Pitfalls |
