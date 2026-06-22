# D03 - Data Models / 数据模型文档

> 文档版本: v1.0 | 最后更新: 2026-05-08 | 基于源码 types.go, db/types.go, db/db.go 及各模块文件撰写

---

## 1. Connection Types / 连接类型

### 1.1 Connection (types.go:3-17)

保存的数据库连接配置，存储在 `connections.json`。

```go
type Connection struct {
    ID            string `json:"id"`                    // 连接唯一标识，自动生成 (time.Now().UnixNano())
    Name          string `json:"name"`                  // 连接显示名称
    Type          string `json:"type"`                  // 数据库类型: "postgresql"/"mysql"/"sqlite"/"redis"/"polardb"/"gaussdb"
    Host          string `json:"host"`                  // 主机地址 (SQLite 无需)
    Port          int    `json:"port"`                  // 端口号 (SQLite 无需)
    Username      string `json:"username"`              // 用户名 (Redis/SQLite 无需)
    Password      string `json:"password"`              // 密码 (保存时 AES-256-GCM 加密，未保存时为空)
    Database      string `json:"database"`              // 默认数据库 (可选)
    SSLMode       string `json:"ssl_mode,omitempty"`    // SSL 模式 (PG: disable/require/verify-ca/verify-full)
    Color         string `json:"color"`                 // 连接标签颜色 (UI 用)
    SavePassword  bool   `json:"save_password"`         // 是否保存密码 (true→加密存储)
    AutoConnect   bool   `json:"auto_connect"`          // 启动时自动连接
    LastConnected string `json:"last_connected,omitempty"` // 上次连接时间
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ID` | string | 自动 | `SaveConnection()` 时自动生成 (connection.go:31) |
| `Name` | string | 是 | 显示名称 |
| `Type` | string | 是 | 必须为 GetSupportedDatabases() 返回的 id 值 |
| `Host` | string | 条件 | SQLite 无需，其余必填 |
| `Port` | int | 条件 | SQLite 无需，其余使用默认端口 |
| `Username` | string | 条件 | Redis/SQLite 无需，其余必填 |
| `Password` | string | 条件 | `save_password=true` 时加密存储；`false` 时清空 |
| `Database` | string | 否 | 留空时使用 `getDefaultDatabase()` 映射 |
| `SSLMode` | string | 否 | 仅 PostgreSQL/PolarDB/GaussDB 使用 |
| `SavePassword` | bool | 否 | 控制密码是否加密持久化 |
| `AutoConnect` | bool | 否 | UI 功能，当前未实际实现自动连接逻辑 |

---

### 1.2 db.ConnectionConfig (db/db.go:22-30)

驱动层连接配置，由 `connectionToDBConfig()` 从 Connection 转换生成。

```go
type ConnectionConfig struct {
    Type     DBType `json:"type"`                 // 驱动层数据库类型枚举
    Host     string `json:"host"`                 // 主机地址
    Port     int    `json:"port"`                  // 端口
    Username string `json:"username"`              // 用户名
    Password string `json:"password"`              // 明文密码（已解密）
    Database string `json:"database"`              // 目标数据库
    SSLMode  string `json:"ssl_mode,omitempty"`    // SSL 模式
}
```

**与 Connection 的区别**: `ConnectionConfig.Password` 是明文（已解密），`Connection.Password` 可能是加密后的 Base64 字符串。

---

### 1.3 db.DBType (db/db.go:10-19)

数据库类型枚举。

```go
type DBType string

const (
    PostgreSQL DBType = "postgresql"
    PolarDB    DBType = "polardb"
    GaussDB    DBType = "gaussdb"
    MySQL      DBType = "mysql"
    Redis      DBType = "redis"
    SQLite     DBType = "sqlite"
)
```

---

## 2. Query Result Types / 查询结果类型

### 2.1 QueryResult (types.go:19-25)

单查询执行结果。

```go
type QueryResult struct {
    Columns  []string        `json:"columns,omitempty"`    // 列名数组
    Rows     [][]interface{} `json:"rows,omitempty"`        // 行数据 (每行是 interface{} 数组)
    RowCount int             `json:"row_count"`             // 返回行数
    Duration string          `json:"duration"`              // 执行耗时 (time.Since().String())
    Error    string          `json:"error,omitempty"`       // 错误消息 (空表示成功)
}
```

**特殊值处理** (query_timeout.go:102-108):
- `nil` → `"NULL"` 字符串
- `[]byte` → `string(b)` (二进制数据转字符串)
- 其他值原样保留

---

### 2.2 SingleQueryResult (types.go:27-35)

多查询中单个查询的结果。

```go
type SingleQueryResult struct {
    Query    string          `json:"query"`                 // 原始 SQL 语句
    Columns  []string        `json:"columns"`               // 列名
    Rows     [][]interface{} `json:"rows"`                  // 行数据
    RowCount int             `json:"row_count"`             // 行数
    Duration string          `json:"duration"`              // 耗时
    Error    string          `json:"error,omitempty"`       // 错误消息
    Status   string          `json:"status"`                // "success" 或 "error"
}
```

---

### 2.3 MultiQueryResult (types.go:37-45)

多查询批量执行的总结果。

```go
type MultiQueryResult struct {
    Results       []SingleQueryResult `json:"results"`          // 各子查询结果
    TotalCount    int                 `json:"total_count"`      // 查询总数
    SuccessCount  int                 `json:"success_count"`    // 成功数
    ErrorCount    int                 `json:"error_count"`      // 失败数
    TotalDuration string              `json:"total_duration"`   // 总耗时
    StartTime     string              `json:"start_time"`       // 开始时间 (HH:MM:SS)
    EndTime       string              `json:"end_time"`         // 结束时间 (HH:MM:SS)
}
```

---

## 3. Schema Types / Schema 类型

### 3.1 TableInfo (types.go:47-52)

表/视图/函数信息。

```go
type TableInfo struct {
    Name    string `json:"name"`                   // 名称
    Type    string `json:"type"`                   // 类型: "table"/"view"/"function"
    Schema  string `json:"schema"`                 // 所属 schema (PG)
    Comment string `json:"comment,omitempty"`      // 注释
}
```

---

### 3.2 db.TableInfo (db/types.go:4-9)

db 包内的 TableInfo（与 root TableInfo 结构相同）。

```go
type TableInfo struct {
    Name    string `json:"name"`
    Type    string `json:"type"`
    Schema  string `json:"schema"`
    Comment string `json:"comment,omitempty"`
}
```

**已知问题**: root `TableInfo` 与 `db.TableInfo` 重复定义

---

### 3.3 DatabaseInfo (types.go:54-58)

```go
type DatabaseInfo struct {
    Name    string `json:"name"`                   // 数据库名
    Owner   string `json:"owner,omitempty"`        // 所有者 (PG)
    Comment string `json:"comment,omitempty"`      // 注释
}
```

**实际使用**: `GetDatabases()` 只填充 `Name`，`Owner` 和 `Comment` 未实现 (schema.go:12-30)

---

### 3.4 IndexInfo (types.go:60-69)

```go
type IndexInfo struct {
    Name        string   `json:"name"`               // 索引名
    Type        string   `json:"type"`               // PRIMARY/UNIQUE/INDEX/FULLTEXT
    Columns     []string `json:"columns"`            // 索引列
    Unique      bool     `json:"unique"`              // 是否唯一索引
    PrimaryKey  bool     `json:"primary_key"`         // 是否主键
    Nullable    bool     `json:"nullable"`            // 是否允许 NULL
    Cardinality int64    `json:"cardinality"`         // 索引基数 (MySQL)
    Comment     string   `json:"comment,omitempty"`   // 注释
}
```

---

### 3.5 ForeignKeyInfo (types.go:71-79)

```go
type ForeignKeyInfo struct {
    Name        string `json:"name"`                  // 外键约束名
    ColumnName  string `json:"column_name"`           // 本表列名
    RefTable    string `json:"ref_table"`             // 引用表名
    RefColumn   string `json:"ref_column"`            // 引用列名
    OnUpdate    string `json:"on_update"`              // 更新规则: NO ACTION/RESTRICT/CASCADE/SET NULL/SET DEFAULT
    OnDelete    string `json:"on_delete"`              // 删除规则
    MatchOption string `json:"match_option,omitempty"` // 匹配选项
}
```

**PG 动作码映射** (schema.go: ~460行区域): `a`→NO ACTION, `r`→RESTRICT, `c`→CASCADE, `n`→SET NULL, `d`→SET DEFAULT

---

### 3.6 TableStats (types.go:81-89)

```go
type TableStats struct {
    RowCount    int64  `json:"row_count"`             // 行数
    DataLength  int64  `json:"data_length"`           // 数据大小 (bytes)
    IndexLength int64  `json:"index_length"`          // 索引大小 (bytes)
    Engine      string `json:"engine"`                // 存储引擎 (MySQL: InnoDB/MyISAM)
    Charset     string `json:"charset"`               // 字符集
    Collation   string `json:"collation"`             // 排序规则
    Comment     string `json:"comment,omitempty"`     // 表注释
}
```

---

### 3.7 TestResult (types.go:105-110)

```go
type TestResult struct {
    Name    string `json:"name"`                    // 连接名
    Success bool   `json:"success"`                 // 是否成功
    Message string `json:"message"`                 // 结果消息 (i18n)
    Time    string `json:"time"`                    // 测试耗时
}
```

---

### 3.8 db.ColumnInfo (db/db.go:33-39)

```go
type ColumnInfo struct {
    Name         string `json:"name"`                // 列名
    Type         string `json:"type"`                 // 数据类型 (varchar, int, etc.)
    Nullable     bool   `json:"nullable"`             // 是否允许 NULL
    DefaultValue string `json:"default_value"`        // 默认值
    PrimaryKey   bool   `json:"primary_key"`          // 是否主键
}
```

---

### 3.9 db ViewInfo / FunctionInfo (db/types.go:12-24)

```go
type ViewInfo struct {
    Name       string `json:"name"`
    Schema     string `json:"schema,omitempty"`
    Definition string `json:"definition,omitempty"`
}

type FunctionInfo struct {
    Name       string `json:"name"`
    Schema     string `json:"schema,omitempty"`
    ReturnType string `json:"return_type,omitempty"`
    Arguments  string `json:"arguments,omitempty"`
}
```

**当前未使用**: 这些类型在 db 包中定义但未被任何 API 方法返回（API 返回 `TableInfo` 统一格式）

---

### 3.10 db.RedisKeyInfo (db/redis.go:149-156)

```go
type RedisKeyInfo struct {
    Key      string      `json:"key"`       // 键名
    Type     string      `json:"type"`      // 类型: string/list/set/zset/hash/stream
    TTL      int64       `json:"ttl"`       // 过期时间秒数 (-1=永不过期, -2=已过期)
    Size     int64       `json:"size"`      // 元素数量
    Value    interface{} `json:"value"`     // 键值 (类型决定格式)
    Encoding string      `json:"encoding"`  // Redis 内部编码
}
```

---

## 4. Data Editing Types / 数据编辑类型

### 4.1 EditOperation (data_editor.go:13-19)

```go
type EditOperation string

const (
    EditOpInsert EditOperation = "INSERT"
    EditOpUpdate EditOperation = "UPDATE"
    EditOpDelete EditOperation = "DELETE"
)
```

---

### 4.2 EditRequest (types.go:91-97)

```go
type EditRequest struct {
    Operation   EditOperation          `json:"operation"`           // 操作类型
    Table       string                 `json:"table"`               // 表名
    Database    string                 `json:"database"`            // 数据库名
    Data        map[string]interface{} `json:"data,omitempty"`      // 列名→值映射
    PrimaryKey  map[string]interface{} `json:"primaryKey,omitempty"` // 主键列→值映射 (参数化)
}
```

**✅ 已修复**: `WhereClause` 已删除，强制使用 `PrimaryKey` 进行参数化 WHERE 条件 (data_editor.go:159/180/217/228)。

---

### 4.3 EditResult (types.go:99-103)

```go
type EditResult struct {
    Success      bool   `json:"success"`          // 操作是否成功
    Error        string `json:"error,omitempty"`  // 错误消息
    RowsAffected int64  `json:"rows_affected,omitempty"` // 影响行数
}
```

---

## 5. Export/Import Types / 导入导出类型

### 5.1 ExportFormat (data_export.go:16-23)

```go
type ExportFormat string

const (
    ExportCSV   ExportFormat = "csv"
    ExportJSON  ExportFormat = "json"
    ExportExcel ExportFormat = "xlsx"
    ExportSQL   ExportFormat = "sql"
)
```

---

### 5.2 ExportRequest (data_export.go:26-34)

```go
type ExportRequest struct {
    Format   ExportFormat `json:"format"`          // 导出格式
    FileName string       `json:"fileName"`        // 输出文件名 (不含扩展名)
    Query    string       `json:"query,omitempty"`  // 自定义查询 (可选)
    Table    string       `json:"table,omitempty"`  // 表名 (可选, 与 Query 二选一)
    Database string       `json:"database"`         // 数据库名
    Limit    int          `json:"limit,omitempty"`  // 行数限制
    Offset   int          `json:"offset,omitempty"` // 偏移量
}
```

---

### 5.3 ExportResult (data_export.go:37-44)

```go
type ExportResult struct {
    Success   bool   `json:"success"`          // 是否成功
    FileName  string `json:"fileName"`         // 输出文件名 (含扩展名)
    RowsCount int    `json:"rowsCount"`        // 导出行数
    Message   string `json:"message"`          // 结果消息
    Error     string `json:"error,omitempty"`  // 错误消息
    FilePath  string `json:"filePath,omitempty"` // 完整文件路径
}
```

---

### 5.4 ImportRequest (data_export.go:245-250)

```go
type ImportRequest struct {
    Format   ExportFormat `json:"format"`   // 导入格式 (仅 csv/json)
    FileName string       `json:"fileName"` // 源文件名
    Table    string       `json:"table"`    // 目标表名
    Database string       `json:"database"` // 目标数据库
}
```

---

### 5.5 ImportResult (data_export.go:252-257)

```go
type ImportResult struct {
    Success      bool   `json:"success"`         // 是否成功
    RowsImported int    `json:"rowsImported"`    // 导入行数
    Message      string `json:"message"`         // 结果消息
    Error        string `json:"error,omitempty"` // 错误消息
}
```

---

## 6. Data Compare Types / 数据对比类型

### 6.1 CompareType (data_compare.go:10-16)

```go
type CompareType string

const (
    CompareTypeTable    CompareType = "table"     // 表对比
    CompareTypeQuery    CompareType = "query"     // 查询对比
    CompareTypeDatabase CompareType = "database"  // 数据库对比 (未实现)
)
```

---

### 6.2 CompareMode (data_compare.go:19-25)

```go
type CompareMode string

const (
    CompareModeStructure CompareMode = "structure" // 结构对比 (未实现)
    CompareModeData      CompareMode = "data"      // 数据对比
    CompareModeAll       CompareMode = "all"       // 全部对比 (未实现)
)
```

---

### 6.3 CompareRequest (data_compare.go:28-39)

```go
type CompareRequest struct {
    Type           CompareType `json:"type"`               // 对比类型
    Mode           CompareMode `json:"mode"`               // 对比模式
    SourceDB       string      `json:"sourceDB"`            // 源数据库
    TargetDB       string      `json:"targetDB"`            // 目标数据库
    SourceTable    string      `json:"sourceTable,omitempty"`   // 源表名
    TargetTable    string      `json:"targetTable,omitempty"`   // 目标表名
    SourceQuery    string      `json:"sourceQuery,omitempty"`   // 源查询
    TargetQuery    string      `json:"targetQuery,omitempty"`   // 目标查询
    KeyColumns     []string    `json:"keyColumns,omitempty"`    // 对比键列
    CompareColumns []string    `json:"compareColumns,omitempty"` // 对比列
}
```

---

### 6.4 CompareResult (data_compare.go:42-52)

```go
type CompareResult struct {
    Success         bool                     `json:"success"`       // 是否成功
    Message         string                   `json:"message"`       // 结果消息
    Summary         *CompareSummary          `json:"summary,omitempty"` // 对比摘要
    Differences     []DifferenceItem         `json:"differences,omitempty"` // 差异列表
    MissingInSource []map[string]interface{} `json:"missingInSource,omitempty"` // 源中缺失行
    MissingInTarget []map[string]interface{} `json:"missingInTarget,omitempty"` // 目标中缺失行
    IdenticalRows   int64                    `json:"identicalRows"`  // 完全匹配行数
    DifferentRows   int64                    `json:"differentRows"`  // 有差异行数
    Error           string                   `json:"error,omitempty"` // 错误消息
}
```

---

### 6.5 CompareSummary (data_compare.go:55-62)

```go
type CompareSummary struct {
    SourceRowCount       int64   `json:"sourceRowCount"`        // 源行数
    TargetRowCount       int64   `json:"targetRowCount"`        // 目标行数
    MatchPercentage      float64 `json:"matchPercentage"`       // 匹配百分比
    DifferenceCount      int     `json:"differenceCount"`       // 差异列数
    MissingInSourceCount int     `json:"missingInSourceCount"`  // 源缺失行数
    MissingInTargetCount int     `json:"missingInTargetCount"`  // 目标缺失行数
}
```

---

### 6.6 DifferenceItem (data_compare.go:65-70)

```go
type DifferenceItem struct {
    RowKey      map[string]interface{} `json:"rowKey"`       // 行键值
    ColumnName  string                 `json:"columnName"`   // 差异列名
    SourceValue interface{}            `json:"sourceValue"`  // 源值
    TargetValue interface{}            `json:"targetValue"`  // 目标值
}
```

---

## 7. Transaction Types / 事务类型

### 7.1 TransactionOptions (transaction.go:13-16)

```go
type TransactionOptions struct {
    Isolation string `json:"isolation"`    // 隔离级别: READ UNCOMMITTED/READ COMMITTED/REPEATABLE READ/SERIALIZABLE
    ReadOnly  bool   `json:"readOnly"`     // 是否只读事务
}
```

---

### 7.2 TransactionResult (transaction.go:18-25)

```go
type TransactionResult struct {
    Success      bool               `json:"success"`       // 是否成功
    RowsAffected int64              `json:"rowsAffected"`  // 总影响行数
    Message      string             `json:"message"`       // 结果消息 (中文)
    Error        string             `json:"error,omitempty"` // 错误消息
    Duration     string             `json:"duration"`      // 总耗时
    Queries      []TransactionQuery `json:"queries"`       // 各子查询结果
}
```

---

### 7.3 TransactionQuery (transaction.go:27-31)

```go
type TransactionQuery struct {
    Query        string `json:"query"`                 // SQL 语句
    RowsAffected int64  `json:"rowsAffected"`          // 影响行数
    Error        string `json:"error,omitempty"`       // 错误消息
}
```

---

### 7.4 TransactionRequest (transaction.go:33-38)

```go
type TransactionRequest struct {
    Config   Connection         `json:"config"`    // 连接配置
    Database string             `json:"database"`  // 数据库名
    Queries  []string           `json:"queries"`   // SQL 语句列表
    Options  TransactionOptions `json:"options"`   // 事务选项
}
```

---

### 7.5 activeTransaction (transaction.go:44-49)

```go
type activeTransaction struct {
    tx      *sql.Tx             // SQL 事务对象
    driver  db.DatabaseDriver   // 驱动引用
    ctx     context.Context     // context.Background() (无超时)
    created time.Time           // 创建时间 (用于超时清理)
}
```

**存储**: `globalTransactions map[string]*activeTransaction` (全局 map)

---

## 8. Autocomplete Types / 自动补全类型

### 8.1 AutoCompleteType (autocomplete.go:11-19)

```go
type AutoCompleteType string

const (
    AutoCompleteTable    AutoCompleteType = "table"     // 表名
    AutoCompleteColumn   AutoCompleteType = "column"    // 列名
    AutoCompleteKeyword  AutoCompleteType = "keyword"   // SQL 关键字
    AutoCompleteFunction AutoCompleteType = "function"  // SQL 函数
    AutoCompleteDatabase AutoCompleteType = "database"  // 数据库名
)
```

---

### 8.2 AutoCompleteItem (autocomplete.go:22-29)

```go
type AutoCompleteItem struct {
    Label         string           `json:"label"`            // 显示文本
    Kind          AutoCompleteType `json:"kind"`             // 类型
    Detail        string           `json:"detail,omitempty"`  // 简要描述
    Documentation string           `json:"documentation,omitempty"` // 详细说明
    InsertText    string           `json:"insertText"`       // 插入文本 (函数带 "()")
    SortText      string           `json:"sortText"`         // 排序键 ("0"+name/"1"+kw/"2"+fn)
}
```

---

### 8.3 AutoCompleteResult (autocomplete.go:32-36)

```go
type AutoCompleteResult struct {
    Suggestions []AutoCompleteItem `json:"suggestions"` // 补全建议列表 (max 50)
    From        int                `json:"from"`        // 替换起始位置
    To          int                `json:"to"`          // 替换结束位置
}
```

---

### 8.4 SQLKeyword (autocomplete.go:39-42)

```go
type SQLKeyword struct {
    Keyword string // 关键字名
    Detail  string // 中文描述
}
```

**数据源**: `sqlKeywords` (65条, L46-117), `sqlFunctions` (55条, L120-195), `mysqlFunctions` (7条, L198-207), `postgresFunctions` (11条, L210-222)

---

## 9. Format & Query Options / 格式化与查询选项

### 9.1 FormatOptions (sql_formatter.go:9-16)

```go
type FormatOptions struct {
    IndentWidth     int    `json:"indentWidth"`      // 缩进宽度 (默认4)
    KeywordCase     string `json:"keywordCase"`      // 关键字大小写: upper/lower/preserve
    LineBreakStyle  string `json:"lineBreakStyle"`   // 换行风格: standard/compact
    AlignClauses    bool   `json:"alignClauses"`     // 对齐子句
    FormatFunctions bool   `json:"formatFunctions"`  // 格式化函数
    MaxLineLength   int    `json:"maxLineLength"`    // 最大行长度 (默认80)
}
```

**默认值** (L19-26): indentWidth=4, keywordCase="upper", lineBreakStyle="standard", alignClauses=true, formatFunctions=true, maxLineLength=80

---

### 9.2 QueryOptions (query_timeout.go:22-24)

```go
type QueryOptions struct {
    Timeout int // 超时时间秒数 (0→使用默认30s, max=300s, min=1s)
}
```

---

## 10. Explain & Analysis Types / 执行计划与分析类型

### 10.1 ExplainNode (query_analyzer.go:34-48)

```go
type ExplainNode struct {
    ID       int               `json:"id"`             // 节点 ID
    ParentID int               `json:"parentId,omitempty"` // 父节点 ID
    Type     string            `json:"type"`            // 操作类型 (Seq Scan/Index Scan/Sort/etc.)
    Relation string            `json:"relation,omitempty"` // 表名
    Alias    string            `json:"alias,omitempty"`    // 别名
    Rows     int64             `json:"rows,omitempty"`     // 估计行数
    Cost     float64           `json:"cost,omitempty"`     // 估计成本
    Time     float64           `json:"time,omitempty"`     // 实际时间(ms)
    Index    string            `json:"index,omitempty"`    // 使用的索引名
    Filter   string            `json:"filter,omitempty"`   // 过滤条件
    Children []*ExplainNode    `json:"children,omitempty"` // 子节点
    Details  map[string]string `json:"details,omitempty"`  // 附加详情
    Warnings []string          `json:"warnings,omitempty"` // 警告信息
}
```

---

### 10.2 ExplainResult (query_analyzer.go:51-61)

```go
type ExplainResult struct {
    Success     bool         `json:"success"`              // 是否成功
    RootNode    *ExplainNode `json:"rootNode,omitempty"`   // 执行计划根节点
    TotalCost   float64      `json:"totalCost,omitempty"`  // 总成本
    TotalRows   int64        `json:"totalRows,omitempty"`  // 总行数
    TotalTime   float64      `json:"totalTime,omitempty"`  // 总时间
    Query       string       `json:"query"`                // 原始查询
    Warnings    []string     `json:"warnings,omitempty"`   // 警告列表
    Suggestions []string     `json:"suggestions,omitempty"` // 优化建议
    Error       string       `json:"error,omitempty"`      // 错误消息
}
```

---

### 10.3 QueryAnalysis (query_analyzer.go:64-81)

```go
type QueryAnalysis struct {
    QueryType       string              `json:"queryType"`       // 查询类型: SELECT/INSERT/UPDATE/DELETE
    Tables          []string            `json:"tables"`          // 涉及的表
    Indexes         map[string][]string `json:"indexes"`         // 表→索引映射
    JoinCount       int                 `json:"joinCount"`       // JOIN 数量
    SubqueryCount   int                 `json:"subqueryCount"`   // 子查询数量
    HasAggregate    bool                `json:"hasAggregate"`    // 是否有聚合
    HasOrderBy      bool                `json:"hasOrderBy"`      // 是否有 ORDER BY
    HasGroupBy      bool                `json:"hasGroupBy"`      // 是否有 GROUP BY
    HasDistinct     bool                `json:"hasDistinct"`     // 是否有 DISTINCT
    HasLimit        bool                `json:"hasLimit"`        // 是否有 LIMIT
    HasUnion        bool                `json:"hasUnion"`        // 是否有 UNION
    HasSubquery     bool                `json:"hasSubquery"`     // 是否有子查询
    EstimatedCost   float64             `json:"estimatedCost"`   // 估计成本
    EstimatedRows   int64               `json:"estimatedRows"`   // 估计行数
    Complexity      string              `json:"complexity"`      // 复杂度: LOW/MEDIUM/HIGH
    Recommendations []string            `json:"recommendations"` // 优化建议
}
```

**复杂度计算** (query_analyzer.go: ~350行区域): score = joinCount×2 + subquery(5) + aggregate(3) + orderBy(2) + groupBy(3) + union(4); LOW≤3, MEDIUM≤8, HIGH>8

---

## 11. Audit Types / 审计类型

### 11.1 AuditLogLevel (audit.go:13-20)

```go
type AuditLogLevel string

const (
    AuditLevelInfo     AuditLogLevel = "INFO"
    AuditLevelWarning  AuditLogLevel = "WARNING"
    AuditLevelError    AuditLogLevel = "ERROR"
    AuditLevelCritical AuditLogLevel = "CRITICAL"
)
```

---

### 11.2 AuditEventType (audit.go:23-37)

```go
type AuditEventType string

const (
    AuditEventConnect          AuditEventType = "CONNECT"
    AuditEventDisconnect       AuditEventType = "DISCONNECT"
    AuditEventQuery            AuditEventType = "QUERY"
    AuditEventQueryTimeout     AuditEventType = "QUERY_TIMEOUT"
    AuditEventQueryError       AuditEventType = "QUERY_ERROR"
    AuditEventConnectionSave   AuditEventType = "CONNECTION_SAVE"
    AuditEventConnectionDelete AuditEventType = "CONNECTION_DELETE"
    AuditEventLogin            AuditEventType = "LOGIN"
    AuditEventLogout           AuditEventType = "LOGOUT"
    AuditEventConfigChange     AuditEventType = "CONFIG_CHANGE"
    AuditEventSensitiveData    AuditEventType = "SENSITIVE_DATA_ACCESS"
)
```

---

### 11.3 AuditLog (audit.go:40-55)

```go
type AuditLog struct {
    ID         string                 `json:"id"`                  // 日志 ID (UnixNano)
    Timestamp  string                 `json:"timestamp"`           // 时间 "2006-01-02 15:04:05.000"
    Level      AuditLogLevel          `json:"level"`               // 级别
    EventType  AuditEventType         `json:"event_type"`          // 事件类型
    User       string                 `json:"user,omitempty"`      // 用户
    Connection string                 `json:"connection,omitempty"` // 连接名
    Database   string                 `json:"database,omitempty"`   // 数据库
    Query      string                 `json:"query,omitempty"`      // 查询 (截断100字符)
    Duration   string                 `json:"duration,omitempty"`   // 耗时
    Success    bool                   `json:"success"`              // 是否成功 (ERROR/CRITICAL→false)
    Message    string                 `json:"message"`              // 消息
    Details    map[string]interface{} `json:"details,omitempty"`    // 详细信息
    ClientIP   string                 `json:"client_ip,omitempty"`  // 客户端 IP (未填充)
    UserAgent  string                 `json:"user_agent,omitempty"` // User-Agent (未填充)
}
```

---

### 11.4 AuditLogger (audit.go:58-64)

```go
type AuditLogger struct {
    mu      sync.RWMutex       // 读写锁
    logFile string             // 日志文件路径
    logs    []AuditLog         // 内存缓存 (maxLogs=10000)
    maxLogs int                // 最大缓存数量
    enabled bool               // 是否启用
}
```

**单例**: `GetAuditLogger()` + `sync.Once` (audit.go:69-87)

---

## 12. Pool Types / 连接池类型

### 12.1 connectionPool (pool.go:17-20)

```go
type connectionPool struct {
    mu          sync.RWMutex                 // pool 内部读写锁
    connections map[string]*pooledDriver     // 键→驱动映射
}
```

---

### 12.2 pooledDriver (pool.go:20-24)

```go
type pooledDriver struct {
    driver    db.DatabaseDriver    // 数据库驱动实例
    createdAt time.Time            // 创建时间 (用于 FIFO 淘汰)
    lastPing  time.Time            // 最后 Ping 时间 (用于健康检查)
}
```

---

## 13. Type Mapping Summary / 类型映射总结

### 13.1 Go → JSON → JS Type Mapping

| Go 类型 | JSON 标签 | JS 类型 | Wails 映射 |
|---------|-----------|---------|------------|
| `string` | `json:"name"` | `string` | 直传 |
| `int` | `json:"port"` | `number` | 直传 |
| `int64` | `json:"rowsAffected"` | `number` | 直传 |
| `bool` | `json:"success"` | `boolean` | 直传 |
| `float64` | `json:"matchPercentage"` | `number` | 直传 |
| `[]string` | `json:"columns"` | `Array<string>` | 直传 |
| `[][]interface{}` | `json:"rows"` | `Array<Array<any>>` | 直传 |
| `map[string]interface{}` | `json:"data"` | `Record<string, any>` | 直传 |
| `[]AuditLog` | `json:"logs"` | `Array<main.AuditLog>` | 直传 |
| `*ExplainNode` | `json:"rootNode"` | `main.ExplainNode | null` | 直传 |
| `EditOperation (string)` | `json:"operation"` | `string` | 作为 string enum |
| `DBType (string)` | `json:"type"` | `string` | 作为 string enum |

### 13.2 Duplicate Type Warning

| Type A | Type B | Issue |
|--------|--------|-------|
| `main.TableInfo` (types.go:47-52) | `db.TableInfo` (db/types.go:4-9) | 相同结构，重复定义 |
| `main.Connection` (types.go:3-17) | `db.ConnectionConfig` (db/db.go:22-30) | 类似结构，需 `connectionToDBConfig()` 转换 |