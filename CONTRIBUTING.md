# Contributing to DBNexus

感谢你对 DBNexus 的关注！欢迎提交 Issue 和 PR。

## 开发环境

### 环境要求
- Go 1.24+
- Node.js 16+
- CGO (SQLite 支持)
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 本地开发
```bash
# 克隆仓库
git clone git@github.com:hanbinsite/DBNexus.git
cd DBNexus

# 安装依赖
go mod download

# 开发模式 (热重载)
wails dev

# 运行测试
go test ./... -count=1

# 静态分析
go vet ./...

# 生产构建
wails build
```

## 提交规范

### Commit Message 格式
```
<type>: <description>

[optional body]
```

### Type 列表
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具变更

### 示例
```
feat: 添加 MongoDB 连接支持
fix: 修复连接池竞态条件
docs: 更新 README 截图
refactor: 提取 theme 模块到独立文件
test: 添加事务回滚集成测试
```

## PR 流程

1. Fork 仓库
2. 创建分支: `git checkout -b feat/your-feature`
3. 提交变更: `git commit -m 'feat: your feature'`
4. 推送: `git push origin feat/your-feature`
5. 提交 PR 到 `master` 分支

## 代码规范

### Go
- `package main` (根目录), `package db` (db/ 目录)
- 不添加注释 (除非明确要求)
- SQL 标识符必须经过 `sanitizeIdentifier()`
- 密码必须经过 `decryptPassword()` 后再传给 driver
- 连接池访问使用 `getDriverForConfig()`

### JavaScript
- 使用 `addEventListener` 代替内联 `onclick`
- 使用 `textContent` / `DomUtils.escapeHtml()` 代替 `innerHTML`
- 使用 `const` / `let`, 不使用 `var`
- 模块化: 提取到 `modules/` 目录

### CSS
- 使用 CSS 变量 (`var(--xxx)`)
- 暗色主题为主, 亮色主题为辅
- 统一间距: `var(--space-1)` ~ `var(--space-6)`

## 测试

```bash
# 运行所有测试
go test ./... -count=1 -v

# 运行特定测试
go test -run TestSanitizeIdentifier ./...

# 跳过集成测试 (无 CGO 环境)
go test ./... -count=1 -short
```

## 文件结构

详见 [README.md](README.md) 的项目结构部分。

## License

提交即表示你同意将代码以 [MIT License](LICENSE) 发布。
