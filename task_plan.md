# Task Plan: DB Client Full Rewrite

## Goal
根据文档体系(14份docs/)完全重写DB Client，消除所有已知安全漏洞和架构问题。

## Key Design Decisions (from docs)
1. **EditRequest V2**: 删除WhereClause，使用PrimaryKey参数化 (10-interface-contract.md §3)
2. **强制ExecuteQueryWithTimeout**: 废弃ExecuteQuery (10-interface-contract.md §4)
3. **encryptionKey sync.Once**: 修复竞态 (06-security.md P0#1)
4. **MySQL SSLMode**: 支持TLS (06-security.md P0#4)
5. **前端textContent/createElement**: 替换所有innerHTML (06-security.md P0#3)
6. **Audit append-only**: JSON lines替代全量序列化 (06-security.md P1#10)
7. **truncateQuery rune-level**: UTF-8安全截断 (06-security.md P2#11)
8. **pool.getOrCreate统一**: 消除双重锁 (AGENTS.md #6)
9. **Redis安全类型断言**: type switch替代direct assertion (AGENTS.md #7)
10. **Terminal Noir前端**: 完整CSS设计系统 (ui-01-design-system.md)

## Phase 1: Backend Foundation (types + pool + crypto + config + connection)
- [ ] types.go: 增加EditRequestV2 (PrimaryKey替代WhereClause), 增加统一响应格式
- [ ] crypto.go: sync.Once保护, 文件权限0600→0700
- [ ] pool.go: 移除set()/get()，统一getOrCreate(), 移除poolMutex
- [ ] config.go: 密码不在GetConnections中返回
- [ ] connection.go: 统一pool.getOrCreate, GetConnections清空密码
- [ ] app.go: 移除poolMutex, 清理startup/shutdown

## Phase 2: Backend Query + Schema
- [ ] query.go: 标记ExecuteQuery为deprecated, 使用timeout wrapper
- [ ] query_timeout.go: 强制默认30s超时
- [ ] schema.go: rune-level sanitizeIdentifier, UTF-8安全

## Phase 3: Backend Data Operations
- [ ] data_editor.go: EditRequestV2 PrimaryKey参数化, 移除WhereClause
- [ ] data_export.go: 目录权限0700
- [ ] data_compare.go: 保留

## Phase 4: Backend Advanced Features
- [ ] transaction.go: 自动清理stale transactions, 统一pool.getOrCreate
- [ ] audit.go: append-only写入, rune-level截断, sync.Once
- [ ] redis_api.go: 安全type switch, 统一pool.getOrCreate
- [ ] autocomplete.go: 保留
- [ ] query_analyzer.go: 保留
- [ ] sql_formatter.go: 保留

## Phase 5: Backend Utilities
- [ ] i18n.go: 18 MessageKeys, SetLanguage验证zh/en
- [ ] window.go: 保留
- [ ] filedialog.go: 保留
- [ ] test.go: 保留

## Phase 6: Frontend - Terminal Noir CSS
- [ ] styles.css: 完整Terminal Noir设计系统(ui-01 tokens + DPI + 动画)

## Phase 7: Frontend - Modular JS
- [ ] app.js拆分: modules(WailsAPI, state, connections, query, dataView, tree, tabs, modals, settings, theme, i18n, utils)
- [ ] innerHTML→textContent/createElement全量替换
- [ ] Monaco Editor集成 + fallback

## Phase 8: Frontend - HTML Structure
- [ ] index.html: Terminal Noir布局(1280x800, frameless)

## Phase 9: Build + Test
- [ ] wails build编译验证
- [ ] 修复编译错误

## Errors Encountered
(none yet)
