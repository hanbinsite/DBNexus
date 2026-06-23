package main

type MessageKey string

const (
	MsgHostRequired       MessageKey = "host_required"
	MsgUsernameRequired   MessageKey = "username_required"
	MsgSQLiteFileRequired MessageKey = "sqlite_file_required"
	MsgConnectionFailed   MessageKey = "connection_failed"
	MsgConnectionTimeout  MessageKey = "connection_timeout"
	MsgConnectionSuccess  MessageKey = "connection_success"
	MsgPingFailed         MessageKey = "ping_failed"
	MsgConnected          MessageKey = "connected"
	MsgHintConnection     MessageKey = "hint_connection"
	MsgHintAuth           MessageKey = "hint_auth"
	MsgHintHost           MessageKey = "hint_host"
	MsgHintTimeout        MessageKey = "hint_timeout"
	MsgHintDatabase       MessageKey = "hint_database"
	MsgHintMySQLAccess    MessageKey = "hint_mysql_access"
	MsgHintPGPassword     MessageKey = "hint_pg_password"
	MsgQueryExecuting     MessageKey = "query_executing"
	MsgNoDbSelected       MessageKey = "no_db_selected"
	MsgEnterQuery         MessageKey = "enter_query"
	MsgTableNameRequired  MessageKey = "table_name_required"
	MsgDBNameRequired     MessageKey = "db_name_required"
	MsgOpTypeRequired     MessageKey = "op_type_required"
	MsgInvalidTableName   MessageKey = "invalid_table_name"
	MsgConnectionError    MessageKey = "connection_error"
	MsgExecutionFailed    MessageKey = "execution_failed"
	MsgTransactionStartFailed  MessageKey = "tx_start_failed"
	MsgTransactionCommitFailed MessageKey = "tx_commit_failed"
	MsgTransactionRollbackFailed MessageKey = "tx_rollback_failed"
	MsgTransactionNotFound      MessageKey = "tx_not_found"
	MsgRedisDangerousCmd   MessageKey = "redis_dangerous_cmd"
	MsgRedisNotConnected   MessageKey = "redis_not_connected"
	MsgRedisNotRedisConn   MessageKey = "redis_not_redis_conn"
	MsgDBConnectionFailed  MessageKey = "db_connection_failed"
	MsgDBSwitchFailed      MessageKey = "db_switch_failed"
	MsgViewQueryFailed     MessageKey = "view_query_failed"
	MsgQueryTimeout        MessageKey = "query_timeout"
	MsgEncryptPasswordFailed MessageKey = "encrypt_password_failed"
)

var messages = map[string]map[MessageKey]string{
	"zh": {
		MsgHostRequired:       "请输入主机地址",
		MsgUsernameRequired:   "请输入用户名",
		MsgSQLiteFileRequired: "请选择 SQLite 数据库文件",
		MsgConnectionFailed:   "连接失败",
		MsgConnectionTimeout:  "连接超时或认证失败",
		MsgConnectionSuccess:  "连接成功！数据库: %s",
		MsgPingFailed:         "Ping 失败: %v",
		MsgConnected:          "连接成功",
		MsgHintConnection:     "\n\n提示: 请检查主机地址和端口是否正确，以及数据库服务是否正在运行",
		MsgHintAuth:           "\n\n提示: 用户名或密码错误，请检查凭据",
		MsgHintHost:           "\n\n提示: 无法解析主机地址，请检查网络连接和主机名",
		MsgHintTimeout:        "\n\n提示: 连接超时，请检查防火墙设置和网络连接",
		MsgHintDatabase:       "\n\n提示: 数据库不存在，请检查数据库名称或留空以自动获取",
		MsgHintMySQLAccess:    "\n\n提示: MySQL 访问被拒绝，请检查用户名和密码，以及用户是否有远程连接权限",
		MsgHintPGPassword:     "\n\n提示: PostgreSQL 需要密码认证，请提供密码",
		MsgQueryExecuting:     "执行查询中...",
		MsgNoDbSelected:       "请先在左侧选择一个数据库",
		MsgEnterQuery:         "请输入查询语句",
		MsgTableNameRequired:  "表名不能为空",
		MsgDBNameRequired:     "数据库名不能为空",
		MsgOpTypeRequired:     "操作类型不能为空",
		MsgInvalidTableName:   "无效的表名: %s",
		MsgConnectionError:    "连接失败: %v",
		MsgExecutionFailed:    "执行失败: %v",
		MsgTransactionStartFailed:  "开始事务失败: %v",
		MsgTransactionCommitFailed: "提交事务失败: %v",
		MsgTransactionRollbackFailed: "回滚事务失败: %v",
		MsgTransactionNotFound:      "事务不存在: %s",
		MsgRedisDangerousCmd:   "危险命令拒绝: %s 不在允许列表内",
		MsgRedisNotConnected:   "连接Redis失败: %v",
		MsgRedisNotRedisConn:   "不是Redis连接",
		MsgDBConnectionFailed:  "连接数据库失败: %v",
		MsgDBSwitchFailed:      "切换数据库 %s 失败: %v",
		MsgViewQueryFailed:     "查询视图失败: %v",
		MsgQueryTimeout:        "查询超时",
		MsgEncryptPasswordFailed: "密码加密失败: %v",
	},
	"en": {
		MsgHostRequired:       "Host address is required",
		MsgUsernameRequired:   "Username is required",
		MsgSQLiteFileRequired: "SQLite database file is required",
		MsgConnectionFailed:   "Connection failed",
		MsgConnectionTimeout:  "Connection timeout or authentication failed",
		MsgConnectionSuccess:  "Connected successfully! Database: %s",
		MsgPingFailed:         "Ping failed: %v",
		MsgConnected:          "Connected",
		MsgHintConnection:     "\n\nTip: Please check if the host address and port are correct, and if the database service is running.",
		MsgHintAuth:           "\n\nTip: Username or password is incorrect. Please check your credentials.",
		MsgHintHost:           "\n\nTip: Cannot resolve host address. Please check your network connection and hostname.",
		MsgHintTimeout:        "\n\nTip: Connection timed out. Please check your firewall settings and network connection.",
		MsgHintDatabase:       "\n\nTip: Database does not exist. Please check the database name or leave it blank to auto-detect.",
		MsgHintMySQLAccess:    "\n\nTip: MySQL access denied. Please check the username and password, and whether the user has remote connection permission.",
		MsgHintPGPassword:     "\n\nTip: PostgreSQL requires password authentication. Please provide a password.",
		MsgQueryExecuting:     "Executing query...",
		MsgNoDbSelected:       "Please select a database from the left panel",
		MsgEnterQuery:         "Please enter a query",
		MsgTableNameRequired:  "Table name is required",
		MsgDBNameRequired:     "Database name is required",
		MsgOpTypeRequired:     "Operation type is required",
		MsgInvalidTableName:   "Invalid table name: %s",
		MsgConnectionError:    "Connection failed: %v",
		MsgExecutionFailed:    "Execution failed: %v",
		MsgTransactionStartFailed:  "Transaction start failed: %v",
		MsgTransactionCommitFailed: "Transaction commit failed: %v",
		MsgTransactionRollbackFailed: "Transaction rollback failed: %v",
		MsgTransactionNotFound:      "Transaction not found: %s",
		MsgRedisDangerousCmd:   "Dangerous command rejected: %s not in allowlist",
		MsgRedisNotConnected:   "Redis connection failed: %v",
		MsgRedisNotRedisConn:   "Not a Redis connection",
		MsgDBConnectionFailed:  "Database connection failed: %v",
		MsgDBSwitchFailed:      "Failed to switch database %s: %v",
		MsgViewQueryFailed:     "Failed to query views: %v",
		MsgQueryTimeout:        "Query timeout",
		MsgEncryptPasswordFailed: "Failed to encrypt password: %v",
	},
}

func (a *App) t(key MessageKey, lang string) string {
	if msgs, ok := messages[lang]; ok {
		if msg, ok := msgs[key]; ok {
			return msg
		}
	}
	if msgs, ok := messages["zh"]; ok {
		if msg, ok := msgs[key]; ok {
			return msg
		}
	}
	return string(key)
}
