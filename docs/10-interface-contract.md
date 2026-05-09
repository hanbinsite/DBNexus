# 10 — 接口契约文档

> 文档版本: v2.0 | 定义前后端接口契约、Wails Bindings 签名一致保证
> 联动: D02 功能设计, D04 API参考, U01 设计系统

---

## 1. 契约原则

1. **所有接口从Design出发定义**，不依赖现有代码实现。接口契约是设计文档，**可覆盖**现有实现。
2. **前端调用**统一通过 `WailsAPI` 封装层，**禁止**直接调用 `window.go.main.App.*`。
3. 每个接口必须定义：输入类型、输出类型、错误类型、超时设置、安全要求。

---

## 2. 前后端数据类型对照

### 2.1 基础类型映射

| Go Type | TypeScript Type | JSON | 说明 |
|---------|----------------|------|------|
| `string` | `string` | `"xxx"` | 直接映射 |
| `int` / `int64` | `number` | `123` | int64可能在JS中丢失精度，超过 `2^53-1` 的ID应用string传输 |
| `float64` | `number` | `3.14` | — |
| `bool` | `boolean` | `true/false` | — |
| `[]byte` | `number[]` 或 base64 `string` | `[1,2,3]` | Excel导出使用 `[]byte` 返回二进制 |
| `map[string]interface{}` | `Record<string, any>` | `{...}` | Wails自动序列化 |
| `[]interface{}` | `any[]` | `[...]` | — |
| `*StructType` | `StructType \| null` | `{...}` | nil指针→null |
| `error` | `string` (在返回struct中) | `"error text"` | Go error不直接暴露给前端，通过struct.Error字段 |

### 2.2 核心接口类型

所有接口类型定义参见 D02 功能和 D04 API参考。这里仅列出**关键修正**（偏离现有实现的改动）：

| 现有问题 | 修正设计 | 理由 |
|---------|---------|------|
| `[][]interface{}` 作为行数据 | `Array<Record<string, any>>` (按列名索引) | 前端无需通过columns数组间接引用 |
| NULL值序列化为 `interface{}` 字符串 "NULL" | NULL→null, 前端 `<span class="null-value">NULL</span>` 统一渲染 | 类型安全 |
| `byte[]` 不加处理返回 | 全部 `byte[]` → `string` (假定UTF-8) | 前端无需处理二进制 |
| 错误返回为 `string` 字段 in struct | 统一 { success: bool, data?: T, error?: string } 模式 | 一致的错误处理 |

---

## 3. 数据表编辑接口修订

### 3.1 当前问题

```go
// 现有 EditRequest — WhereClause 为 SQL 注入源
type EditRequest struct {
    WhereClause string `json:"whereClause"` // ← UNSAFE
}
```

### 3.2 修订设计

```ts
// 新 EditRequest — 强制使用 PrimaryKey
interface EditRequestV2 {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  database: string;
  /**
   * Row data. Required for INSERT + UPDATE.
   * Keys = column names, Values = cell values.
   * NULL values: omit key entirely or set value to `null`.
   */
  data?: Record<string, string | number | boolean | null>;
  /**
   * Primary key for WHERE condition. Required for UPDATE + DELETE.
   * Example: { "id": 42 } → WHERE "id" = $1
   * Multi-column PK: { "id": 42, "tenant": "acme" }
   */
  primaryKey?: Record<string, string | number>;
}
```

**变更**: 删除 `WhereClause`，强制使用 `primaryKey`。后端构建参数化 SQL：
```sql
UPDATE "table" SET "col1"=$1, "col2"=$2 WHERE "pk1"=$3 AND "pk2"=$4
```

### 3.3 前→后端调用

```ts
// Frontend API
function editTableData(operation, table, database, rowData, primaryKey) {
  return WailsAPI.EditTableData({
    operation,
    table,
    database,
    data: operation !== 'DELETE' ? rowData : undefined,
    primaryKey,
  });
}
```

---

## 4. 查询结果超时保证

### 4.1 当前问题

前端 `WailsAPI.executeQuery` 调用无超时版。后端 `ExecuteQuery` 无 context deadline。

### 4.2 修订设计

**废弃** `ExecuteQuery`（保留向后兼容但不推荐）。
**统一**使用 `ExecuteQueryWithTimeout`。

```ts
// WailsAPI 封装层强制默认超时
function executeQuery(conn, db, query) {
  return WailsAPI.ExecuteQueryWithTimeout(conn, db, query, {
    timeout: 30  // 默认30s, 可在设置中修改
  });
}
```

---

## 5. 前端组件与后端API对应表

| 前端组件 | 后端API | 调用频率 |
|---------|---------|---------|
| ConnectionList 渲染 | `GetConnections()` | 启动时 + 保存/删除后 |
| ConnectionList 连接 | `ConnectToDatabase(conn)` | 用户点击 |
| DatabaseTree DB列表 | `GetDatabases()` | 展开连接后 |
| DatabaseTree Tables | `GetTables(conn, db)` | 展开Tables分支 |
| DatabaseTree Views | `GetViews(conn, db)` | 展开Views分支 |
| DatabaseTree Functions | `GetFunctions(conn, db)` | 展开Functions分支 |
| QueryEditor Run Button | `ExecuteQueryWithTimeout(conn, db, sql, opts)` | 每次执行 |
| DataViewPanel 内容 | `ExecuteQuery("SELECT * FROM {t} LIMIT {n} OFFSET {o}")` | 翻页/过滤 |
| DataViewPanel 保存 | `BatchEdit([]EditRequestV2)` | 点击保存 |
| DataExportDialog 导出 | `ExportData(ExportRequest)` | 点击导出 |
| TableStructure | `GetTableColumns(conn, db, table)` | 点击结构tab |
| TableIndexes | `GetTableIndexes(conn, db, table)` | 点击索引tab |
| TableForeignKeys | `GetTableForeignKeys(conn, db, table)` | 点击外键tab |
| ComparePanel 对比 | `CompareTables(CompareRequest)` | 点击对比 |
| Transaction 开启 | `BeginTransaction(conn, db, options)` | 点击事务 |
| Transaction 执行 | `ExecuteInTransaction(txID, query)` | 每次事务内查询 |
| Transaction 提交 | `CommitTransaction(txID)` | 点击提交 |
| Transaction 回滚 | `RollbackTransaction(txID)` | 点击回滚 |

---

## 6. 前端缓存策略

| 数据 | 缓存位置 | 过期策略 |
|------|---------|---------|
| 数据库列表 | `tab.state.databases` | 用户刷新 / 切换连接 |
| 表列表(Schema) | `tab.state.tables[db]` | 展开分支时自动重新获取 |
| 列信息 | `tab.state.columns[table]` | 表结构更新时重取 |
| 查询结果 | `tab.state.lastResult` | 每次新查询替换 |
| 语言设置 | `localStorage` | 持久化 |
| 主题设置 | `localStorage` | 持久化 |

**不缓存的数据**: 审计日志、对比结果、查询分析(EXPLAIN) — 每次都最新。

---

## 7. Wails IPC性能约定

| 场景 | 要求 |
|------|------|
| 单次查询超时 | 前端默认30s, 用户可在设置中调整 (max 300s) |
| 自动补全延迟 | <200ms (后端关键词在内存中, 无需数据库) |
| Schema元数据 | <500ms per request |
| 数据表分页 | <2s (每页100行) |
| 大数据导出 | 流式处理, 支持取消 |

---

## 8. 接口一致性检查

**新增接口检查清单**: 实现任一API方法时, 验证以下项:

- [ ] Go方法在 `App` struct上定义 (exported → Wails bindable)
- [ ] TypeScript声明在 `App.d.ts` 中自动生成 (Wails auto-gen)
- [ ] 前端WailsAPI封装层有对应方法
- [ ] 方法名一致 (Go: `ExportData` → TS: `ExportData` → WailsAPI: `exportData`)
- [ ] 参数顺序一致 (Go → Wails bindings顺序)
- [ ] 错误处理: Go返回的error在前端能正确处理
- [ ] 审计日志: Go方法内部有 `auditLogger.Log(...)` 调用 (安全相关操作)
- [ ] 密码解密: 任何使用 `config.SavePassword` 的操作 — Go自动调用 `decryptPassword`
- [ ] 连接池: 使用 `pool.getOrCreate()` 而非手动锁模式