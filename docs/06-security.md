# D06 - Security Documentation / 安全文档

> 文档版本: v1.1 | 最后更新: 2026-05-12 | 基于 crypto.go(119), query.go(86), query_timeout.go(280), schema.go(555), data_editor.go(350), data_export.go(394), data_compare.go(360), transaction.go(249), redis_api.go(136), connection.go(265), audit.go(304), config.go(87), app.go(107), test.go(121), pool.go(166), db/mysql.go(141), db/redis.go(272) 撰写

---

## 1. Encryption / 加密

### 1.1 Algorithm: AES-256-GCM (crypto.go)

**实现**: `crypto/aes` + `crypto/cipher` 标准库

**密钥规格**:
- 长度: 32 bytes (256 bits)
- 生成: `crypto/rand.Read(key)` (crypto.go:40-41)
- 存储: `~/.db-client/.key` (Base64 编码, 0600 权限) (crypto.go:51)

**加密流程** (crypto.go:56-82):
```
1. initEncryptionKey() → 读取或生成密钥
2. aes.NewCipher(encryptionKey) → AES cipher block
3. cipher.NewGCM(block) → AES-GCM mode
4. io.ReadFull(rand.Reader, nonce) → 随机 nonce (12 bytes)
5. aesGCM.Seal(nonce, nonce, plaintext, nil) → nonce prepended to ciphertext
6. base64.StdEncoding.EncodeToString(ciphertext) → Base64 output
```

**解密流程** (crypto.go:84-119):
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
| 文件路径 | `~/.db-client/.key` | crypto.go:29 |
| 文件权限 | `0600` (owner read/write only) | crypto.go:51 |
| 编码格式 | Base64 | crypto.go:50 |
| 目录权限 | `0700` | crypto.go:49 |

### 1.3 Key Race Condition ✅ 已修复

**原问题**: `encryptionKey` 是全局 `var` (crypto.go:16), 无 `sync` 保护

**修复**: crypto.go:17 已添加 `encryptionOnce sync.Once`, initEncryptionKey (crypto.go:21-53) 使用 `encryptionOnce.Do()` 保护初始化

```go
var encryptionKey []byte      // crypto.go:16
var encryptionOnce sync.Once  // crypto.go:17 ✅ 已添加

func initEncryptionKey() error {   // crypto.go:21
    var initErr error
    encryptionOnce.Do(func() {     // crypto.go:22 ✅ 使用 sync.Once
        // ... 读取或生成密钥 ...
        encryptionKey = key
    })
    return initErr
}
```

**修复结果**: 两个 goroutine 同时调用 `initEncryptionKey()` 时，`sync.Once` 保证仅执行一次，密钥不会被覆盖

### 1.4 Encryption Timing

| 操作 | 调用位置 | 说明 |
|------|----------|------|
| `encryptPassword()` | connection.go:37-41 | `SaveConnection()` 时加密 |
| `decryptPassword()` | connection.go:94-98 | `TestConnection()` 时直接解密 |
| `decryptPassword()` | connection.go:180-183 | `ConnectToDatabase()` 时直接解密 |
| `decryptPassword()` | config.go:15-18 | `connectionToDBConfig()` 集中解密 (所有通过此函数的调用均间接使用) |
| `decryptPassword()` | test.go:15-18 | `RunConnectionTest()` 时直接解密 |
| `decryptPassword()` | test.go:80-83 | `GetDatabaseServerInfo()` 时直接解密 |

**间接调用** (通过 `connectionToDBConfig()` → config.go:15-18):
- `query_timeout.go:38` — `ExecuteQueryWithTimeout` 使用 `connectionToDBConfig`
- `query_timeout.go:135` — `ExecuteMultiQueryWithTimeout` 使用 `connectionToDBConfig`
- `data_editor.go:29-30` — `EditTableData` 使用 `connectionToDBConfig`
- `transaction.go:85-86` — `BeginTransaction` 使用 `connectionToDBConfig`
- `redis_api.go:118` — `getRedisDriver` 使用 `connectionToDBConfig`
- `schema.go:13` — `GetDatabases` 使用 `connectionToDBConfig`
- `query_analyzer.go:92-93` — `GetExplainPlan` 使用 `connectionToDBConfig`
- `data_export.go:29-30` — `ExportData` 使用 `connectionToDBConfig` (隐式, 通过 ExecuteQuery)

**问题**: `connectionToDBConfig()` (config.go:12-30) 集中处理解密，但每次操作仍解密密码，即使连接已在池中（池中 driver 使用的是明文密码建立的连接）

---

## 2. SQL Injection Prevention / SQL 注入防护

### 2.1 sanitizeIdentifier (schema.go:180-213)

**用途**: 清理 SQL 标识符（表名、列名）

**过滤规则**:
| 规则 | 实现 | 行号 |
|------|------|------|
| 空输入 | 返回 "invalid_identifier" | L182 |
| 路径遍历 (`..`) | 返回 "invalid_identifier" | L186 |
| 危险字符 (`;--/*\\=(){}[]&|!<>`) | 返回 "invalid_identifier" | L189 |
| 字符过滤 (仅允许 `[a-zA-Z0-9_.]`) | `strings.Map()` 清理 | L193-198 |
| 长度限制 (64 chars) | rune 截断过长标识符 | L204-207 |
| Schema.table 格式 (最多1个点) | 验证 dot 数量 | L209-211 |

**调用位置**:
- `data_editor.go:100` — validateEditRequest
- `data_editor.go:116` — performInsert (表名)
- `data_editor.go:122` — performInsert (列名)
- `data_editor.go:166,171,181` — performUpdate (表名+列名)
- `data_editor.go:224,229` — performDelete (表名+列名)
- `data_export.go:62` — ExportData (表名)
- `data_compare.go:120` — buildCompareQuery (表名)
- `schema.go:234-237` — GetTableIndexes (表名)
- `schema.go:348` — GetTableForeignKeys (表名)
- `schema.go:431` — GetTableStats (表名)
- `data_editor.go:290,295` — GenerateInsertStatement (表名+列名)
- `data_editor.go:310,314,322` — GenerateUpdateStatement (表名+列名)

### 2.2 escapeStringLiteral (schema.go:216-218)

**用途**: SQL 字符串值引号替换

```go
func escapeStringLiteral(s string) string {
    return strings.ReplaceAll(s, "'", "''")
}
```

**调用位置**:
- `schema.go:71` — GetViews (MySQL database name)
- `schema.go:125` — GetFunctions (MySQL database name)
- `schema.go:349` — GetTableForeignKeys (database name)

### 2.3 WHERE Clause Vulnerability ✅ 已修复

**原问题**: `EditRequest.WhereClause` 直接拼接进 SQL，未经参数化或清理

**修复**: EditRequest (types.go:91-97) 已改用 `PrimaryKey` 字段替代 `WhereClause`，data_editor.go 使用参数化 WHERE 条件

**data_editor.go:159-163** (UPDATE 主键检查):
```go
if len(req.PrimaryKey) == 0 {
    return "", EditResult{
        Success: false,
        Error:   "更新操作必须指定主键",  // ✅ 强制要求主键
    }
}
```

**data_editor.go:179-186** (UPDATE 参数化 WHERE):
```go
var whereConditions []string
for col, val := range req.PrimaryKey {       // ✅ 使用 PrimaryKey
    safeCol := sanitizeIdentifier(col)
    if safeCol == "invalid_identifier" {
        continue
    }
    whereConditions = append(whereConditions, fmt.Sprintf("`%s` = ?", safeCol))  // ✅ 参数化
    values = append(values, val)
}
```

**data_editor.go:217-222** (DELETE 主键检查):
```go
if len(req.PrimaryKey) == 0 {
    return "", EditResult{
        Success: false,
        Error:   "删除操作必须指定主键",  // ✅ 强制要求主键
    }
}
```

**data_editor.go:228-234** (DELETE 参数化 WHERE):
```go
for col, val := range req.PrimaryKey {       // ✅ 使用 PrimaryKey
    safeCol := sanitizeIdentifier(col)
    if safeCol == "invalid_identifier" {
        continue
    }
    whereConditions = append(whereConditions, fmt.Sprintf("`%s` = ?", safeCol))  // ✅ 参数化
    values = append(values, val)
}
```

**修复结果**: WHERE 条件不再由前端字符串直接拼接，而是从 PrimaryKey 构建参数化查询，SQL 注入风险已消除

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

### 4.1 Password Exposure to Frontend ✅ 已修复

**原问题**: `GetConnections()` 直接返回 `a.connections` (connection.go:22)，其中包含加密后的 Password 字段

**修复**: connection.go:25-27 在返回前清空 Password 字段:
```go
for i := range safe {
    safe[i].Password = ""  // ✅ 清空密码
}
```

**残余风险**:
- 前端每次操作仍传递完整的 Connection 对象（含其他敏感字段如 Username/Host）到后端 → 信息在 IPC 通道中传输
- 建议进一步采用连接 ID + 后端查找模式

### 4.2 Password in IPC Channel

**问题**: 每个 API 方法都传递完整的 `Connection` 对象作为参数，包含加密密码

**影响**: Wails IPC 通道传输的数据可以通过 WebView2 开发者工具查看

**修复建议**: 使用连接 ID + 后端查找模式，避免前端持有任何密码数据

---

## 5. Audit Logging / 审计日志

### 5.1 Audit System Design (audit.go)

| 属性 | 值 | 源码位置 |
|------|-----|---------|
| 日志级别 | INFO / WARNING / ERROR / CRITICAL | audit.go:16-21 |
| 事件类型 | 11 种 (见 D03-data-models.md) | audit.go:25-37 |
| 单例模式 | `sync.Once` + `GetAuditLogger()` | audit.go:69-87 |
| 内存缓存 | maxLogs=10000 | audit.go:80 |
| 文件路径 | `~/.db-client/logs/audit_YYYY-MM-DD.log` | audit.go:75 |
| 文件权限 | 0600 (os.OpenFile) | audit.go:196 |
| 持久化频率 | 每次 Log() 调用 | audit.go:135 |

### 5.2 Audited Operations

| 操作 | 审计级别 | 事件类型 | 调用位置 |
|------|----------|----------|----------|
| 应用启动 | INFO | LOGIN | app.go:38 |
| 应用关闭 | INFO | LOGOUT | app.go:45 |
| 保存连接 | INFO | CONNECTION_SAVE | connection.go:62-68 |
| 删除连接 | WARNING | CONNECTION_DELETE | connection.go:83-85 |
| 数据编辑(成功) | INFO | QUERY | data_editor.go:66-74 |
| 数据编辑(失败) | ERROR | QUERY_ERROR | data_editor.go:76-83 |
| 数据导出 | INFO | QUERY | data_export.go:128-135 |
| 数据导出(失败) | ERROR | QUERY_ERROR | data_export.go:113-120 |
| 数据对比 | INFO | QUERY | data_compare.go:106-114 |
| Redis SET | INFO | QUERY | redis_api.go:32-39 |
| Redis DELETE | WARNING | QUERY | redis_api.go:55-60 |
| Redis 命令 | INFO | QUERY | redis_api.go:77-83 |
| Explain Plan | INFO | QUERY | query_analyzer.go:131-137 |

### 5.3 Missing Audit Coverage

以下操作缺少审计记录:

| 操作 | 源码位置 | 风险 |
|------|----------|------|
| ExecuteQuery | query.go:10-11 (委托至 WithTimeout) | 高 — 核心查询操作未审计 |
| ExecuteMultiQuery | query.go:14-15 (委托至 WithTimeout) | 高 — 多查询执行未审计 |
| ExecuteNonQuery | query.go:70-86 | 高 — DDL/DML 操作未审计 |
| ExecuteQueryWithTimeout | query_timeout.go:21-119 | 中 |
| BeginTransaction | transaction.go:82-130 | 高 — 事务开始未审计 |
| CommitTransaction | transaction.go:149-166 | 中 |
| RollbackTransaction | transaction.go:168-185 | 中 |
| GetDatabases | schema.go:12-31 | 低 |
| GetTables | schema.go:33-57 | 低 |
| GetViews | schema.go:59-111 | 低 |
| DeleteRedisKey (单键) | redis_api.go:43-62 | WARNING级 — 已审计 |
| ImportData | data_export.go:259-347 | 中 |

### 5.4 Audit Log Performance ✅ 已修复

**原问题**: `writeToFile()` (原 audit.go) 每次 `Log()` 都全量序列化 `al.logs` 数组

**修复**: `appendToFile()` (audit.go:189-206) 改为追加写入，每条日志单独序列化 + append

```go
func (al *AuditLogger) appendToFile(log AuditLog) {  // audit.go:189 ✅ 追加写入
    data, err := json.Marshal(log)                     // ✅ 单条序列化，O(1)
    // ...
    f, err := os.OpenFile(al.logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)  // audit.go:196 ✅ 追加模式
    // ...
    f.Write(append(data, '\n'))                        // audit.go:203 ✅ 写入单行 JSON
}
```

**修复结果**: 写入性能从 O(n) 降至 O(1)，高频查询场景下不再影响性能

### 5.5 truncateQuery UTF-8 Issue ✅ 已修复

**原问题**: `truncateQuery(query, maxLen)` (原 audit.go) 使用 `len(query)[:maxLen]` 按 byte 截断

**修复**: audit.go:280-285 改为 rune 级截断

```go
func truncateQuery(query string, maxLen int) string {  // audit.go:280 ✅ rune截断
    if utf8.RuneCountInString(query) <= maxLen {        // ✅ rune 计数
        return query
    }
    runes := []rune(query)                              // ✅ rune 切片
    return string(runes[:maxLen]) + "..."
}
```

**修复结果**: 对中文 SQL (如 `SELECT * FROM 用户表`) 截断不再切断 UTF-8 多字节字符

---

## 6. Config File Permissions / 配置文件权限

### 6.1 File Permission Settings

| 文件 | 权限 | 设置位置 | 说明 |
|------|------|----------|------|
| `connections.json` | `0600` | config.go:82 | owner read/write only |
| `.key` | `0600` | crypto.go:51 | encryption key |
| `config.json` | `0644` | app.go:92 | language config — ⚠️ 权限过于宽松 |
| `audit_YYYY-MM-DD.log` | `0600` | audit.go:196 | audit logs (append mode) |
| `config directory` | `0700` | config.go:46,72 | ~/.db-client/ |
| `export directory` | `0700` | data_export.go:89 | ~/.db-client/exports/ — ✅ 已改为 0700 |

### 6.2 Permission Issues ⚠️

| 问题 | 位置 | 说明 |
|------|------|------|
| `config.json` 权限 0644 | app.go:92 | 语言配置文件所有用户可读，可能泄露语言偏好 |
| `exports/` 目录权限已改为 0700 | data_export.go:89 | ✅ 已从 0755 改为 0700 |
| `imports/` 目录权限 0700 | data_export.go:280 | 导入目录权限正确 |
| Windows 权限模型不同 | 全部 | Unix 权限 (0600等) 在 Windows NTFS 上含义不同，0600 不限制其他用户访问 |

---

## 7. Known Security Issues / 已知安全问题

### P0 — Critical

| # | Issue | Location | Risk | Fix | Status |
|---|-------|----------|------|-----|--------|
| 1 | **encryptionKey race condition** | crypto.go:16 | Key corruption → saved passwords irrecoverable | `sync.Once` | ✅ 已修复 (crypto.go:17) |
| 2 | **WhereClause SQL injection** | types.go:91, data_editor.go:159/180/217/228 | Arbitrary SQL execution via crafted WHERE clause | Parameterized queries with PrimaryKey | ✅ 已修复 (types.go:96) |
| 3 | **Frontend XSS via innerHTML** | app.js (57 locations, 3502 lines) | Script injection via database data | textContent / createElement / DOMPurify | ⚠️ 待修复 |
| 4 | **MySQL plaintext credentials** | db/mysql.go:23-32 | Credentials sent unencrypted over network | Parse SSLMode config, add tls=true to DSN | 🚧 部分修复 (disabled/preferred/required/verify-ca/verify-full 已支持) |
| 5 | **No query timeout by default** | query.go:10-11 | Long-running queries block UI indefinitely | Always use ExecuteQueryWithTimeout (default 30s) | ✅ 已修复 (query.go:10-11 delegates) |
| 6 | **Password exposed to frontend** | connection.go:22 | Encrypted passwords viewable in DevTools | Clear Password in GetConnections() response | ✅ 已修复 (connection.go:26) |

### P1 — High

| # | Issue | Location | Risk | Fix | Status |
|---|-------|----------|------|-----|--------|
| 7 | **ExecuteRedisCommand arbitrary commands** | redis_api.go:64-85 | FLUSHALL/CONFIG SET etc. | Command whitelist (allow only safe commands) | ⚠️ 待修复 |
| 8 | **Connection password in IPC** | All API methods | Full Connection object transmitted per call | Use connection ID + backend lookup | ⚠️ 待修复 |
| 9 | **Audit log not covering queries** | query.go:10-11/14-15/70-86, transaction.go:82-130 | Core operations untracked | Add audit logging to all query/transaction methods | ⚠️ 待修复 |
| 10 | **Audit log O(n) performance** | audit.go:189 | Performance degradation at scale | Append-only JSON lines | ✅ 已修复 (audit.go:189-206) |

### P2 — Medium

| # | Issue | Location | Risk | Fix | Status |
|---|-------|----------|------|-----|--------|
| 11 | **truncateQuery UTF-8 truncation** | audit.go:280-285 | Corrupted audit log entries | rune-level truncation | ✅ 已修复 (audit.go:280-285) |
| 12 | **config.json 0644 permissions** | app.go:92 | Other users can read config | Change to 0600 | ⚠️ 待修复 |
| 13 | **exports directory was 0755** | data_export.go:89 | Other users could read exported data | Change to 0700 | ✅ 已修复 (now 0700) |
| 14 | **SQLite identifier backticks for PG** | data_editor.go:126/175/185/233 | Syntax errors → potential error-based information leak | ✅ 已修复: `quoteIdentifier()` (data_editor.go:108) 按 dbType 动态选择引号 |
| 15 | **No rate limiting on Redis commands** | redis_api.go:64 | Repeated FLUSHALL via loop | Rate limit + command whitelist | ⚠️ 待修复 |

### P3 — Low

| # | Issue | Location | Risk | Fix | Status |
|---|-------|----------|------|-----|--------|
| 16 | **Windows file permissions different semantics** | config.go, crypto.go | Unix permissions (0600) don't fully restrict on Windows | Use Windows ACL APIs | ⚠️ 待修复 |
| 17 | **No CSRF protection** | Wails IPC | Desktop app, low risk | Wails v2 IPC is internal, not HTTP-based | 低风险 |
| 18 | **No input validation on language param** | app.go:70 | SetLanguage accepts any string | Validate "zh"/"en" only | ✅ 已修复 (app.go:70-72) |
| 19 | **AutoConnect not implemented** | types.go:15 | Flag exists but not used | Implement or remove field | ⚠️ 待实现 |

---

## 8. Security Recommendations / 安全建议

### 8.1 Immediate Fixes (v1.5) — 已完成项

1. **encryptionKey sync.Once** ✅ 已修复 — crypto.go:17 使用 sync.Once
2. **WhereClause parameterization** ✅ 已修复 — types.go:96 使用 PrimaryKey，data_editor.go 参数化 WHERE
3. **Password clearing in GetConnections** ✅ 已修复 — connection.go:26 清空 Password
4. **Query timeout** ✅ 已修复 — query.go:10-11 委托至 ExecuteQueryWithTimeout
5. **Audit log append-only** ✅ 已修复 — audit.go:189 使用 appendToFile
6. **truncateQuery rune-based** ✅ 已修复 — audit.go:280-285 使用 rune 截断
7. **Language validation** ✅ 已修复 — app.go:70-72 验证 zh/en
8. **Exports directory permission** ✅ 已修复 — data_export.go:89 改为 0700

**仍需修复**:
1. **XSS prevention** — 对所有数据库返回数据使用 textContent 或 HTML encoding

### 8.2 Short-term (v2.0)

1. **Redis command whitelist** — 仅允许安全命令
2. **Query audit logging** — 所有 ExecuteQuery/ExecuteMultiQuery 添加审计
3. **Config file permissions** — config.json 改为 0600
4. **MySQL DESCRIBE unsanitized** — db/mysql.go:88 DESCRIBE + tableName 未使用 sanitizeIdentifier
5. **SQLite PRAGMA unsanitized** — db/sqlite.go:92 PRAGMA table_info + tableName 未使用 sanitizeIdentifier
6. **Import path traversal** — data_export.go:282-288 `baseName` 检查 + `..` 拒绝 + `filepath.Base` 防路径遍历，**已部分验证**

### 8.3 Long-term (v3.0)

1. **Connection ID mode** — 前端仅传递 ID，后端查找配置
2. **Windows ACL** — 使用 Windows 特有权限控制
3. **HTML sanitizer** — 引入 DOMPurify 或类似库
4. **Sensitive data masking** — 查询结果中的敏感字段自动脱敏
5. **Dangerous operation confirmation** — DROP/TRUNCATE 等操作二次确认