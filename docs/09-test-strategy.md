# D09 — Test Strategy / 测试策略文档

> 文档版本: v1.0 | 最后更新: 2026-05-11
> 联动: D07-development-guide, D08-migration-plan, ROADMAP(BUG-009)

---

## 1. 现状评估

### 1.1 当前测试覆盖

| 模块 | 测试文件 | 覆盖率 | 关键缺失 |
|------|---------|--------|---------|
| crypto.go | 无 | 0% | 加密/解密正确性、key竞态 |
| pool.go | 无 | 0% | 并发getOrCreate、淘汰策略、GetHealthy竞态 |
| connection.go | 无 | 0% | 连接CRUD、密码加密/解密流程 |
| query.go | 无 | 0% | 查询执行、splitQueries |
| query_timeout.go | 无 | 0% | 超时机制、行扫描中断 |
| schema.go | 无 | 0% | sanitizeIdentifier、escapeStringLiteral |
| data_editor.go | 无 | 0% | SQL注入防护、参数化值 |
| data_export.go | 无 | 0% | CSV/JSON/Excel导出正确性 |
| data_compare.go | 无 | 0% | 对比逻辑、浮点比较 |
| transaction.go | 无 | 0% | 事务生命周期、过期清理 |
| audit.go | 无 | 0% | 日志记录、append写入 |
| redis_api.go | 无 | 0% | 类型断言安全、命令执行 |
| autocomplete.go | 无 | 0% | 上下文分析、补全排序 |
| sql_formatter.go | 无 | 0% | 格式化正确性 |
| i18n.go | 无 | 0% | 消息键完整性 |
| app.go | app_test.go | ~30% | 部分集成测试 |

**总体覆盖率**: <30% (D01指标: 目标>80%)

### 1.2 测试基础设施

- 测试命令: `go test ./...`
- 无CI/CD配置
- 无测试覆盖率报告
- 无mock数据库驱动
- 前端无测试

---

## 2. 测试分层策略

```
┌─────────────────────────────────────┐
│  E2E Tests (手动)                    │  连接→查询→编辑→导出→对比
│  — 完整用户流程冒烟测试              │
├─────────────────────────────────────┤
│  Integration Tests                   │  需要真实数据库连接
│  — 连接建立、查询执行、Schema浏览     │  可选: Docker测试数据库
├─────────────────────────────────────┤
│  Unit Tests (核心目标)                │  纯Go, 无外部依赖
│  — 加密/池/查询分割/格式化/对比逻辑  │  需: mock driver
├─────────────────────────────────────┤
│  Static Analysis                     │  go vet, golangci-lint
│  — 竞态检测、未处理错误、SQL注入模式  │
└─────────────────────────────────────┘
```

---

## 3. 单元测试计划 (核心模块, v1.5)

### 3.1 优先级P0模块 (必须先测)

#### crypto.go — 加密/解密正确性

```
TestEncryptDecrypt:
  - 加密→解密还原原始密码
  - 空字符串加密返回空
  - 密钥错误时解密失败
  - 并发调用initEncryptionKey不覆盖key

TestEncryptPassword:
  - 正常密码加密返回Base64
  - 空密码返回空字符串

TestDecryptPassword:
  - 正常加密密文可解密
  - 空密文返回空
  - 无效Base64返回错误
  - 截断密文返回错误
```

#### pool.go — 连接池并发安全

```
TestConnectionPool_GetOrCreate:
  - 首次创建新driver
  - 已有健康连接时复用
  - 不健康连接时重新创建
  - 并发getOrCreate不panic

TestConnectionPool_EvictOldest:
  - 超MaxPoolSize时淘汰最旧
  - 空pool时evict不panic

TestConnectionPool_Remove:
  - 移除存在/不存在的key
  - 移除时调用driver.Close

TestConnectionPool_GetHealthy:
  - 健康连接返回true
  - 不健康连接移除并返回false
  - 不存在的key返回false

TestBuildKey:
  - 键格式正确: {type}:{host}:{port}:{user}:{db}
```

#### schema.go — SQL注入防护

```
TestSanitizeIdentifier:
  - 正常标识符原样返回
  - 空字符串返回invalid_identifier
  - 含路径遍历(..)返回invalid_identifier
  - 含危险字符(;--*\等)返回invalid_identifier
  - 非法字符被过滤
  - 超过64字符截断
  - schema.table格式允许(1个点)
  - 超过1个点返回invalid_identifier

TestEscapeStringLiteral:
  - 单引号替换为双单引号
  - 无引号字符串不变
```

#### data_editor.go — 编辑操作安全性

```
TestPerformInsert:
  - 正常插入使用参数化值
  - 列名经sanitize处理
  - 空数据返回错误

TestPerformUpdate:
  - 更新必须指定主键
  - 主键列经sanitize处理
  - 无主键返回错误

TestPerformDelete:
  - 删除必须指定主键
  - 无主键返回错误

TestValidateEditRequest:
  - 空表名返回错误
  - 空数据库名返回错误
  - 无效表名返回错误

TestFormatValueForSQL:
  - 字符串值加引号并转义内部引号
  - nil返回NULL
  - bool返回1/0
  - 数字原样返回
```

#### query.go — 查询分割

```
TestSplitQueries:
  - 单条查询
  - 多条分号分隔查询
  - 引号内分号不分割
  - 反斜杠转义处理
  - 末尾无分号的查询
  - 空查询返回空数组
  - 仅空白+分号返回空数组
```

### 3.2 优先级P1模块

#### audit.go

```
TestAuditLogger_Log:
  - 日志追加到内存
  - 超maxLogs时截断

TestTruncateQuery:
  - 短查询不截断
  - 长查询按rune截断(中文安全)
  - 空查询返回空
```

#### transaction.go

```
TestBeginTransaction:
  - 返回有效txID
  - 事务存储在globalTransactions中

TestCommitTransaction:
  - 提交后从事务map中删除
  - 不存在的txID返回错误

TestRollbackTransaction:
  - 回滚后从事务map中删除

TestExecuteTransactionBatch:
  - 全部成功时自动提交
  - 中间失败时自动回滚

TestCleanupStaleTransactions:
  - 过期事务被清理
  - 未过期事务保留
```

#### data_compare.go

```
TestCompareValues:
  - 相同值返回true
  - nil对比
  - 不同类型对比

TestBuildDataMap:
  - 键列正确映射
  - 键列不存在时返回空map

TestBuildCompareQuery:
  - 表名经sanitize
  - 有compareColumns时使用指定列
  - 无compareColumns时使用*
```

#### sql_formatter.go

```
TestFormatSQL:
  - SELECT语句格式化
  - 关键字大小写转换
  - 缩进宽度配置

TestMinifySQL:
  - 移除注释
  - 压缩空白

TestValidateSQL:
  - 有效SQL返回true
  - 括号不匹配返回false
  - 引号不匹配返回false
```

#### i18n.go

```
TestTranslation:
  - 所有MessageKey在zh和en映射中存在
  - 默认语言为zh
  - 无效key返回空字符串
```

---

## 4. Mock Driver 实现

为支持无外部依赖的单元测试，需要实现 `MockDriver`:

```go
type MockDriver struct {
    db.DatabaseDriver
    QueryFn    func(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
    ExecFn     func(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
    PingFn     func(ctx context.Context) error
    ConnectFn  func(config db.ConnectionConfig) error
    CloseFn    func() error
    TablesFn   func(ctx context.Context) ([]string, error)
    ColumnsFn  func(ctx context.Context, tableName string) ([]db.ColumnInfo, error)
    DatabasesFn func(ctx context.Context) ([]string, error)
}
```

所有方法使用函数字段，测试时注入行为。未设置的方法返回零值/nil。

---

## 5. 覆盖率提升路线图

### v1.5 — 核心模块覆盖 (目标>60%)

| 模块 | 目标覆盖率 | 测试数量(估) |
|------|-----------|-------------|
| crypto.go | 90% | 8 |
| pool.go | 80% | 10 |
| schema.go (sanitize/escape) | 90% | 12 |
| data_editor.go | 80% | 10 |
| query.go (splitQueries) | 90% | 7 |
| audit.go | 70% | 5 |
| transaction.go | 70% | 6 |
| sql_formatter.go | 70% | 6 |
| i18n.go | 80% | 4 |
| **总计** | **>60%** | **~68** |

### v2.0 — 全面覆盖 (目标>80%)

| 模块 | 目标覆盖率 | 新增测试 |
|------|-----------|---------|
| connection.go | 80% | 10 |
| query_timeout.go | 80% | 6 |
| data_export.go | 70% | 8 |
| data_compare.go | 70% | 6 |
| redis_api.go (mock) | 70% | 8 |
| autocomplete.go | 60% | 6 |
| config.go | 80% | 6 |
| **新增总计** | — | **~50** |

### v3.0 — 持续维护 (目标>85%)

- 回归测试: 每个BUG修复必须附带测试
- 集成测试: Docker化PostgreSQL/MySQL/Redis测试容器
- 前端测试: 引入Playwright或类似E2E框架

---

## 6. CI集成

### GitHub Actions 配置 (待创建)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.24' }
      - run: go vet ./...
      - run: go test -race -coverprofile=coverage.out ./...
      - run: go test -race ./...
```

### 质量门禁

| 指标 | 阈值 | 动作 |
|------|------|------|
| 测试覆盖率 | <60% | 阻止合并 |
| go vet | 任何警告 | 阻止合并 |
| 竞态检测 | 任何race | 阻止合并 |
| 测试通过率 | <100% | 阻止合并 |

---

## 7. 测试命名规范

```
Test{功能}_{场景}_{预期}

示例:
TestEncryptDecrypt_Normal_RestoresOriginal
TestGetOrCreate_Concurrent_NoPanic
TestSanitizeIdentifier_PathTraversal_ReturnsInvalid
TestSplitQueries_QuotedSemicolon_DoesNotSplit
TestFormatValueForSQL_Null_ReturnsNULL
```

---

## 8. 文档交叉引用

| 文档 | 关联内容 |
|------|---------|
| D01-overview | 测试覆盖率指标(<30%→>80%) |
| D07-development-guide | 构建配置、测试命令 |
| D08-migration-plan | 每步迁移前需补测试 |
| ROADMAP | BUG-009(测试覆盖率不足) |
