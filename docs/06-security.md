# D06 - Security Documentation / 安全文档

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于 crypto.go, data_editor.go, schema.go, audit.go, config.go, app.js 撰写

---

## 1. Encryption / 加密

### 1.1 Algorithm: AES-256-GCM (crypto.go)

**实现**: `crypto/aes` + `crypto/cipher` 标准库

**密钥规格**:
- 长度: 32 bytes (256 bits)
- 生成: `crypto/rand.Read(key)` (crypto.go:39-41)
- 存储: `~/.db-client/.key` (Base64 编码, 0600 权限) (crypto.go:50)

**加密流程** (crypto.go:53-79):
```
1. initEncryptionKey() → 读取或生成密钥
2. aes.NewCipher(encryptionKey) → AES cipher block
3. cipher.NewGCM(block) → AES-GCM mode
4. io.ReadFull(rand.Reader, nonce) → 随机 nonce (12 bytes)
5. aesGCM.Seal(nonce, nonce, plaintext, nil) → nonce prepended to ciphertext
6. base64.StdEncoding.EncodeToString(ciphertext) → Base64 output
```

**解密流程** (crypto.go:81-116):
```
1. base64.StdEncoding.DecodeString(encrypted) → raw bytes
2. 分离 nonce (前 NonceSize bytes) 和 ciphertext
3. aesGCM.Open(nil, nonce, ciphertext, nil) → plaintext
4. string(plaintext) → 明文密码
```

**GCM 特性**: 提供加密 + 认证 (AEAD)，篡改 ciphertext 会解密失败

### 1.2 Key Storage

| 属性 | 值 | 源码位置 |
|------|-----|---------|
| 文件路径 | `~/.db-client/.key` | crypto.go:26 |
| 文件权限 | `0600` (owner read/write only) | crypto.go:50 |
| 编码格式 | Base64 | crypto.go:49 |
| 目录权限 | `0755` | crypto.go:48 |

### 1.3 Key Race Condition ⚠️

**问题**: `encryptionKey` 是全局 `var` (crypto.go:14), 无 `sync` 保护

```go
var encryptionKey []byte  // crypto.go:14

func initEncryptionKey() error {
    if encryptionKey != nil {   // L17: 非原子性检查
        return nil
    }
    // ... 读取或生成密钥 ...
    encryptionKey = key  // L44: 非原子性赋值
}
```

**风险场景**:
1. 两个 goroutine 同时调用 `initEncryptionKey()` → 两个都生成新密钥 → 后者覆盖前者 → `.key` 文件与内存中的 key 不一致 → 已保存的密码无法解密
2. 一个 goroutine 在 `encryptionKey = key` 赋值过程中 → 另一个 goroutine 读取 `encryptionKey` → 读取到部分初始化的 key

**修复建议**: 使用 `sync.Once` 保护初始化:
```go
var encryptionKey []byte
var encryptionKeyOnce sync.Once

func initEncryptionKey() error {
    var initErr error
    encryptionKeyOnce.Do(func() {
        // ... 读取或生成密钥 ...
        encryptionKey = key
    })
    return initErr
}
```

### 1.4 Encryption Timing

| 操作 | 调用位置 | 说明 |
|------|----------|------|
| `encryptPassword()` | connection.go:36-39 | `SaveConnection()` 时加密 |
| `decryptPassword()` | connection.go:103-109 | `TestConnection()` 时解密 |
| `decryptPassword()` | connection.go:202-207 | `ConnectToDatabase()` 时解密 |
| `decryptPassword()` | query.go:13-17 | `ExecuteQuery()` 时解密 |
| `decryptPassword()` | query.go:102-107 | `ExecuteMultiQuery()` 时解密 |
| `decryptPassword()` | query.go:293-298 | `ExecuteNonQuery()` 时解密 |
| `decryptPassword()` | query_timeout.go:47-52 | 带超时查询时解密 |
| `decryptPassword()` | query_timeout.go:171-176 | 带超时多查询时解密 |
| `decryptPassword()` | data_editor.go:54-59 | 编辑操作时解密 |
| `decryptPassword()` | transaction.go:71-76 | 事务操作时解密 |
| `decryptPassword()` | redis_api.go:15-20 | Redis 操作时解密 |
| `decryptPassword()` | schema.go:176-181 | GetTableColumns 时解密 |
| `decryptPassword()` | query_analyzer.go:99-104 | ExplainPlan 时解密 |
| `decryptPassword()` | config.go:14-19 | `connectionToDBConfig()` 时解密 |
| `decryptPassword()` | test.go:15-20 | 连接测试时解密 |
| `decryptPassword()` | test.go:94-99 | GetServerInfo 时解密 |

**问题**: 12 处独立调用 `decryptPassword()`，每次操作都解密密码，即使连接已在池中（池中 driver 使用的是明文密码建立的连接）

---

## 2. SQL Injection Prevention / SQL 注入防护

### 2.1 sanitizeIdentifier (schema.go:195-234)

**用途**: 清理 SQL 标识符（表名、列名）

**过滤规则**:
| 规则 | 实现 | 行号 |
|------|------|------|
| 空输入 | 返回 "invalid_identifier" | L198 |
| 路径遍历 (`..`) | 返回 "invalid_identifier" | L202 |
| 危险字符 (`;--/*\\=(){}[]&|!<>`) | 返回 "invalid_identifier" | L207 |
| 字符过滤 (仅允许 `[a-zA-Z0-9_.]`) | `strings.Map()` 清理 | L212-216 |
| 长度限制 (64 chars) | 截断过长标识符 | L224 |
| Schema.table 格式 (最多1个点) | 验证 dot 数量 | L228 |

**调用位置**:
- `data_editor.go:168-173` — validateEditRequest
- `data_editor.go:186` — performInsert (表名)
- `data_editor.go:192-195` — performInsert (列名)
- `data_editor.go:241-248` — performUpdate (表名+列名)
- `data_editor.go:302` — performDelete (表名)
- `data_export.go:68` — ExportData (表名)
- `data_compare.go:133` — buildCompareQuery (表名)
- `schema.go:258` — GetTableIndexes (表名)
- `schema.go:375` — GetTableForeignKeys (表名)
- `schema.go:459-464` — GetTableStats (表名)
- `data_editor.go:372-388` — GenerateInsertStatement (表名+列名)
- `data_editor.go:393-407` — GenerateUpdateStatement (表名+列名)

### 2.2 escapeStringLiteral (schema.go:237-240)

**用途**: SQL 字符串值引号替换

```go
func escapeStringLiteral(s string) string {
    return strings.ReplaceAll(s, "'", "''")
}
```

**调用位置**:
- `schema.go:76` — GetViews (MySQL database name)
- `schema.go:131` — GetFunctions (MySQL database name)
- `schema.go:376` — GetTableForeignKeys (database name)
- `schema.go:395` — GetTableForeignKeys (MySQL table+database)

### 2.3 WHERE Clause Vulnerability ⚠️

**问题**: `EditRequest.WhereClause` 直接拼接进 SQL，未经参数化或清理

**data_editor.go:255-256**:
```go
var whereClause string
if req.WhereClause != "" {
    whereClause = req.WhereClause  // ⚠️ 直接拼接
}
```

**data_editor.go:270**:
```go
query := fmt.Sprintf("UPDATE `%s` SET %s WHERE %s",
    safeTable, strings.Join(setClauses, ", "), whereClause)
```

**data_editor.go:306-307** (DELETE):
```go
if req.WhereClause != "" {
    whereClause = req.WhereClause  // ⚠️ 直接拼接
}
```

**data_editor.go:320**:
```go
query := fmt.Sprintf("DELETE FROM `%s` WHERE %s", safeTable, whereClause)
```

**攻击场景**:
- 前端传递 `whereClause = "1=1; DROP TABLE users"` → 执行 `DELETE FROM table WHERE 1=1; DROP TABLE users`
- 前端传递 `whereClause = "id = 1 OR 1=1"` → 删除所有行

**修复建议**:
1. 使用参数化查询: `WHERE id = ?` + 传递主键值
2. 或添加 WHERE clause 白名单验证: 仅允许 `{safeColumn} = ?` 格式
3. 或始终使用 PrimaryKey 而非 WhereClause

---

## 3. XSS Risks / XSS 风险

### 3.1 Frontend innerHTML/insertAdjacentHTML Usage

app.js 中有 **57 处** `innerHTML` / `insertAdjacentHTML` 调用，其中多处使用数据库返回的未清理数据:

| 风险级别 | 位置 | 代码 |
|----------|------|------|
| **高危** | app.js:1702 | `tbody.insertAdjacentHTML('beforeend', row)` — 行数据包含数据库值 |
| **高危** | app.js:1182 | `connectionList.insertAdjacentHTML('beforeend', html)` — 连接名等 |
| **高危** | app.js:1456 | `dbTree.insertAdjacentHTML('beforeend', dbHtml)` — 数据库/表名 |
| **高危** | app.js:1590 | `selector.insertAdjacentHTML('beforeend', \`<option value="${databaseName}">${databaseName}</option>\`)` — 数据库名 |
| **高危** | app.js:1672-1673 | `filterColumn.insertAdjacentHTML('beforeend', \`<option value="${col.name}">${col.name}</option>\`)` — 列名 |
| **高危** | app.js:2915-2917 | `rvMessages.innerHTML = ...` / `rvSummary.innerHTML = summaryHtml` / `rvResults.innerHTML = resultTabsSection` — 查询结果数据 |
| **中危** | app.js:1276 | `currentConnection.innerHTML = \`<span>${connection.name} (${connection.type})</span>\`` — 连接信息 |
| **中危** | app.js:2048-2060 | 索引/外键视图渲染 — 使用数据库返回数据 |
| **中危** | app.js:2308 | `container.innerHTML = html` — 外键关系图 |

**攻击场景**:
- 数据库列名/值包含 `<script>alert('XSS')</script>` → 通过 innerHTML 注入执行
- 数据库名包含 `<img onerror=alert(1) src=x>` → 通过 insertAdjacentHTML 注入

**修复建议**:
1. 使用 `textContent` 替代 `innerHTML` 设置纯文本
2. 使用 `createElement` + `appendChild` 构建 DOM
3. 引入 HTML sanitizer (如 DOMPurify) 处理所有动态内容
4. 对所有数据库返回的数据进行 HTML entity 编码: `&lt;` `&gt;` `&amp;` `&quot;`

### 3.2 Template Literal Injection

多处使用模板字符串直接嵌入数据库返回数据:

```javascript
// app.js:1590 — 数据库名未编码
selector.insertAdjacentHTML('beforeend', `<option value="${databaseName}">${databaseName}</option>`);
```

如果 `databaseName` 包含 `">` 可以闭合 option 标签并注入属性。

---

## 4. Credential Handling / 凭据处理

### 4.1 Password Exposure to Frontend ⚠️

**问题**: `GetConnections()` 直接返回 `a.connections` (connection.go:24)，其中包含加密后的 Password 字段

**风险**:
- 加密后的 Base64 字符串暴露给前端 JS → 可通过开发者工具查看
- 前端每次操作都传递完整的 Connection 对象（含 Password）到后端 → 加密密码在 IPC 通道中传输

**修复建议**:
1. `GetConnections()` 返回时清空 Password 字段: `conn.Password = ""`
2. 前端保存连接 ID，仅传递 ID 到后端 → 后端从内部状态查找完整配置
3. 或使用 session token 代替完整 Connection 传递

### 4.2 Password in IPC Channel

**问题**: 每个 API 方法都传递完整的 `Connection` 对象作为参数，包含加密密码

**影响**: Wails IPC 通道传输的数据可以通过 WebView2 开发者工具查看

**修复建议**: 使用连接 ID + 后端查找模式，避免前端持有任何密码数据

---

## 5. Audit Logging / 审计日志

### 5.1 Audit System Design (audit.go)

| 属性 | 值 | 源码位置 |
|------|-----|---------|
| 日志级别 | INFO / WARNING / ERROR / CRITICAL | audit.go:15-20 |
| 事件类型 | 11 种 (见 D03-data-models.md) | audit.go:26-37 |
| 单例模式 | `sync.Once` + `GetAuditLogger()` | audit.go:72-92 |
| 内存缓存 | maxLogs=10000 | audit.go:84 |
| 文件路径 | `~/.db-client/logs/audit_YYYY-MM-DD.log` | audit.go:79 |
| 文件权限 | 0600 (通过 tmp+rename) | audit.go:205 |
| 持久化频率 | 每次 Log() 调用 | audit.go:138 |

### 5.2 Audited Operations

| 操作 | 审计级别 | 事件类型 | 调用位置 |
|------|----------|----------|----------|
| 应用启动 | INFO | LOGIN | app.go:44 |
| 应用关闭 | INFO | LOGOUT | app.go:54 |
| 保存连接 | INFO | CONNECTION_SAVE | connection.go:64-71 |
| 删除连接 | WARNING | CONNECTION_DELETE | connection.go:88-93 |
| 数据编辑(成功) | INFO | QUERY | data_editor.go:132-141 |
| 数据编辑(失败) | ERROR | QUERY_ERROR | data_editor.go:143-151 |
| 数据导出 | INFO | QUERY | data_export.go:138-145 |
| 数据导出(失败) | ERROR | QUERY_ERROR | data_export.go:123-129 |
| 数据对比 | INFO | QUERY | data_compare.go:118-126 |
| Redis SET | INFO | QUERY | redis_api.go:57-64 |
| Redis DELETE | WARNING | QUERY | redis_api.go:90-97 |
| Redis 命令 | INFO | QUERY | redis_api.go:125-132 |
| Explain Plan | INFO | QUERY | query_analyzer.go:163-169 |

### 5.3 Missing Audit Coverage

以下操作缺少审计记录:

| 操作 | 源码位置 | 风险 |
|------|----------|------|
| ExecuteQuery | query.go:10-97 | 高 — 核心查询操作未审计 |
| ExecuteMultiQuery | query.go:99-236 | 高 — 多查询执行未审计 |
| ExecuteNonQuery | query.go:292-329 | 高 — DDL/DML 操作未审计 |
| ExecuteQueryWithTimeout | query_timeout.go:27-152 | 中 |
| BeginTransaction | transaction.go:70-138 | 高 — 事务开始未审计 |
| CommitTransaction | transaction.go:157-174 | 中 |
| RollbackTransaction | transaction.go:176-193 | 中 |
| GetDatabases | schema.go:11-30 | 低 |
| GetTables | schema.go:33-60 | 低 |
| GetViews | schema.go:63-115 | 低 |
| DeleteRedisKey (单键) | redis_api.go:69-99 | WARNING级 — 已审计 |
| ImportData | data_export.go:281-373 | 中 |

### 5.4 Audit Log Performance ⚠️

**问题**: `writeToFile()` (audit.go:196-214) 每次 `Log()` 都全量序列化 `al.logs` 数组

```go
func (al *AuditLogger) writeToFile() {
    data, err := json.MarshalIndent(al.logs, "", "  ")  // ⚠️ O(n) 全量序列化
    // ...
    os.WriteFile(tmpFile, data, 0600)
    os.Rename(tmpFile, al.logFile)
}
```

**影响**: 日志积累到 10000 条后，每条新日志写入耗时 ~100ms+，在高频查询场景下影响性能

**修复建议**: 改为追加写入 (每条日志一行 JSON, `json.Marshal` 单条 + `os.AppendFile`)

### 5.5 truncateQuery UTF-8 Issue ⚠️

**问题**: `truncateQuery(query, maxLen)` (audit.go:296-300) 使用 `len(query)[:maxLen]` 按 byte 截断

```go
func truncateQuery(query string, maxLen int) string {
    if len(query) <= maxLen {
        return query
    }
    return query[:maxLen] + "..."  // ⚠️ byte截断，可能切断UTF-8多字节字符
}
```

**影响**: 对中文 SQL (如 `SELECT * FROM 用户表`) 截断可能在字符中间切断，产生无效 UTF-8

**修复建议**: `[]rune(query)[:maxLen]` 或 `utf8.RuneCountInString(query)` + rune 截断

---

## 6. Config File Permissions / 配置文件权限

### 6.1 File Permission Settings

| 文件 | 权限 | 设置位置 | 说明 |
|------|------|----------|------|
| `connections.json` | `0600` | config.go:114 | owner read/write only |
| `.key` | `0600` | crypto.go:50 | encryption key |
| `config.json` | `0644` | app.go:90 | language config — ⚠️ 权限过于宽松 |
| `audit_YYYY-MM-DD.log` | `0600` | audit.go:205 | audit logs (via tmp+rename) |
| `config directory` | `0700` | config.go:65,105 | ~/.db-client/ |
| `export directory` | `0755` | data_export.go:97 | ~/.db-client/exports/ — ⚠️ 导出文件可能含敏感数据 |

### 6.2 Permission Issues ⚠️

| 问题 | 位置 | 说明 |
|------|------|------|
| `config.json` 权限 0644 | app.go:90 | 语言配置文件所有用户可读，可能泄露语言偏好 |
| `exports/` 目录权限 0755 | data_export.go:97 | 导出文件所有用户可读，可能含数据库敏感数据 |
| `imports/` 目录未创建权限检查 | data_export.go:303 | 导入目录未显式设置权限 |
| Windows 权限模型不同 | 全部 | Unix 权限 (0600等) 在 Windows NTFS 上含义不同，0600 不限制其他用户访问 |

---

## 7. Known Security Issues / 已知安全问题

### P0 — Critical

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 1 | **encryptionKey race condition** | crypto.go:14 | Key corruption → saved passwords irrecoverable | `sync.Once` |
| 2 | **WhereClause SQL injection** | data_editor.go:255-256, 306-307 | Arbitrary SQL execution via crafted WHERE clause | Parameterized queries or validate WHERE format |
| 3 | **Frontend XSS via innerHTML** | app.js (57 locations) | Script injection via database data | textContent / createElement / DOMPurify |
| 4 | **MySQL plaintext credentials** | db/mysql.go:23 | Credentials sent unencrypted over network (SSLMode ignored) | Parse SSLMode config, add tls=true to DSN |
| 5 | **No query timeout by default** | query.go:10-97 | Long-running queries block UI indefinitely | Always use ExecuteQueryWithTimeout (default 30s) |
| 6 | **Password exposed to frontend** | connection.go:24 | Encrypted passwords viewable in DevTools | Clear Password in GetConnections() response |

### P1 — High

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 7 | **ExecuteRedisCommand arbitrary commands** | redis_api.go:102-134 | FLUSHALL/CONFIG SET etc. | Command whitelist (allow only safe commands) |
| 8 | **Connection password in IPC** | All API methods | Full Connection object transmitted per call | Use connection ID + backend lookup |
| 9 | **Audit log not covering queries** | query.go, transaction.go | Core operations untracked | Add audit logging to all query/transaction methods |
| 10 | **Audit log O(n) performance** | audit.go:196-214 | Performance degradation at scale | Append-only JSON lines |

### P2 — Medium

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 11 | **truncateQuery UTF-8 truncation** | audit.go:296-300 | Corrupted audit log entries | rune-level truncation |
| 12 | **config.json 0644 permissions** | app.go:90 | Other users can read config | Change to 0600 |
| 13 | **exports directory 0755** | data_export.go:97 | Other users can read exported data | Change to 0700 |
| 14 | **SQLite identifier backticks for PG** | data_editor.go:196-204 | Syntax errors → potential error-based information leak | Dynamic quote selection |
| 15 | **No rate limiting on Redis commands** | redis_api.go:102 | Repeated FLUSHALL via loop | Rate limit + command whitelist |

### P3 — Low

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 16 | **Windows file permissions different semantics** | config.go, crypto.go | Unix permissions (0600) don't fully restrict on Windows | Use Windows ACL APIs |
| 17 | **No CSRF protection** | Wails IPC | Desktop app, low risk | Wails v2 IPC is internal, not HTTP-based |
| 18 | **No input validation on language param** | app.go:71 | SetLanguage accepts any string | Validate "zh"/"en" only |
| 19 | **AutoConnect not implemented** | types.go:16 | Flag exists but not used | Implement or remove field |

---

## 8. Security Recommendations / 安全建议

### 8.1 Immediate Fixes (v1.5)

1. **encryptionKey sync.Once** — 防止密码丢失
2. **WhereClause parameterization** — 使用 PrimaryKey 替代 WhereClause，或验证 WHERE 格式
3. **Password clearing in GetConnections** — 返回时清空 Password 字段
4. **XSS prevention** — 对所有数据库返回数据使用 textContent 或 HTML encoding

### 8.2 Short-term (v2.0)

1. **Audit log append-only** — 改为 JSON lines 格式
2. **Redis command whitelist** — 仅允许安全命令
3. **Query audit logging** — 所有 ExecuteQuery/ExecuteMultiQuery 添加审计
4. **Config file permissions** — 全部改为 0600

### 8.3 Long-term (v3.0)

1. **Connection ID mode** — 前端仅传递 ID，后端查找配置
2. **Windows ACL** — 使用 Windows 特有权限控制
3. **HTML sanitizer** — 引入 DOMPurify 或类似库
4. **Sensitive data masking** — 查询结果中的敏感字段自动脱敏
5. **Dangerous operation confirmation** — DROP/TRUNCATE 等操作二次确认