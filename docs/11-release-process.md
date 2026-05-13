# D11 — Release Process / 发布流程与版本规范

> 文档版本: v1.0 | 最后更新: 2026-05-11
> 联动: D07-development-guide, D08-migration-plan, ROADMAP

---

## 1. 版本号规范

### 1.1 格式

```
MAJOR.MINOR.PATCH[-PRERELEASE]

示例:
1.0.0        — 正式发布
1.5.0-beta.1 — 测试版
1.5.0-rc.1   — 发布候选
1.5.0        — 正式发布
1.5.1        — 补丁修复
```

### 1.2 版本递增规则

| 递增 | 条件 | 示例 |
|------|------|------|
| MAJOR | 破坏性API变更、架构重写 | 1.x → 2.0 |
| MINOR | 新功能、功能改进 | 1.5 → 1.6 |
| PATCH | BUG修复、安全补丁、无新功能 | 1.5.0 → 1.5.1 |
| PRERELEASE | beta/RC版本 | 1.5.0-beta.1 |

### 1.3 版本号来源

版本号定义在以下位置（发布前需同步更新）:

| 位置 | 文件 | 字段 |
|------|------|------|
| Go代码 | app.go:99 | `"version": "1.0.0"` (GetServerInfo() 方法内) |
| Wails配置 | wails.json | `"outputfilename"` |
| CHANGELOG | CHANGELOG.md | 版本标题 |
| 构建脚本 | build.bat / build.sh | 文件名 |

---

## 2. 发布分支策略

```
main ──────────────────────────────────────→ (稳定)
  │
  ├── release/1.5.0 ──→ 修复only → v1.5.0 tag
  │
  └── feature/xxx ──→ 合并到main → cherry-pick到release分支
```

| 分支 | 用途 | 合并方向 |
|------|------|---------|
| `main` | 开发主线 | feature→main |
| `release/x.y.z` | 发布准备 | main→release (cherry-pick) |
| `feature/xxx` | 功能开发 | feature→main |
| `hotfix/x.y.z` | 紧急修复 | hotfix→main+release |
| `migration/M#` | 迁移步骤(D08) | migration→main |

---

## 3. 发布检查清单

### 3.1 代码质量检查

- [ ] `go vet ./...` 无警告
- [ ] `go test -race ./...` 全部通过
- [ ] 测试覆盖率达标(v1.5: >60%, v2.0: >80%)
- [ ] 无未处理的TODO/FIXME/HACK注释
- [ ] 无调试日志残留（fmt.Printf等）
- [ ] golangci-lint通过

### 3.2 安全检查

- [ ] 无已知的P0安全问题（参见D06-security.md）
- [ ] `sanitizeIdentifier` 覆盖所有用户输入的SQL标识符
- [ ] 无 `innerHTML`/`insertAdjacentHTML` 插入未清理数据（参见SEC-008）
- [ ] 无 `context.Background()` 在查询路径中（参见D08 M1-7）
- [ ] 密码不在前端JS上下文中暴露（参见SEC-001）
- [ ] 文件权限正确（0600/0700）

### 3.3 功能测试（手动冒烟）

- [ ] 连接PostgreSQL → 查询 → 编辑 → 导出
- [ ] 连接MySQL → 查询 → 编辑 → 导出
- [ ] 连接SQLite → 查询
- [ ] 连接Redis → 键浏览 → 命令执行
- [ ] 多查询批量执行
- [ ] 查询超时（>30s自动终止）
- [ ] 数据对比功能
- [ ] 事务管理功能
- [ ] 中英文切换
- [ ] 深色/浅色主题切换
- [ ] 窗口最小化/最大化/关闭

### 3.4 构建与打包

- [ ] `wails build` 成功
- [ ] 可执行文件启动正常
- [ ] 安装包体积 < 15MB
- [ ] 内存基线 < 50MB
- [ ] 启动时间 < 2s

### 3.5 文档更新

- [ ] CHANGELOG.md 更新
- [ ] 版本号在代码中更新
- [ ] D02-feature-design.md 完成度更新
- [ ] D10-interface-contract.md 契约状态更新
- [ ] ROADMAP.md 状态更新
- [ ] AGENTS.md 陷阱列表更新（如有新发现）

---

## 4. 发布流程

### 4.1 正式发布

```
1. 创建 release/x.y.z 分支
2. 执行发布检查清单
3. 更新版本号（app.go, wails.json, CHANGELOG.md）
4. 提交版本变更: git commit -m "chore: release vx.y.z"
5. 打标签: git tag -a vx.y.z -m "Release vx.y.z"
6. 推送: git push origin vx.y.z
7. 构建发布包: wails build
8. 测试发布包
9. 创建 GitHub Release（附构建产物）
10. 合并 release 分支到 main
```

### 4.2 热修复发布

```
1. 从 vx.y.z 标签创建 hotfix/x.y.(z+1) 分支
2. 修复BUG + 添加回归测试
3. 执行精简版发布检查清单
4. 更新版本号为 x.y.(z+1)
5. 提交 + 打标签 + 构建 + 发布
6. 合并到 main 和 release 分支
```

---

## 5. CHANGELOG 格式

```markdown
## [x.y.z] - YYYY-MM-DD

### Added
- 新功能描述 (#PR号)

### Changed
- 变更描述

### Fixed
- 修复描述 (BUG-XXX)

### Security
- 安全修复描述 (SEC-XXX)

### Deprecated
- 废弃API描述

### Removed
- 移除功能描述
```

---

## 6. 文档交叉引用

| 文档 | 关联内容 |
|------|---------|
| D01-overview | 版本路线图、里程碑 |
| D07-development-guide | 构建命令、环境配置 |
| D08-migration-plan | 迁移步骤对应的版本 |
| D09-test-strategy | 覆盖率门禁 |
| ROADMAP | 版本规划、功能优先级 |
