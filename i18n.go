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
		MsgHintConnection:     "\n\n💡 提示: 请检查主机地址和端口是否正确，以及数据库服务是否正在运行",
		MsgHintAuth:           "\n\n💡 提示: 用户名或密码错误，请检查凭据",
		MsgHintHost:           "\n\n💡 提示: 无法解析主机地址，请检查网络连接和主机名",
		MsgHintTimeout:        "\n\n💡 提示: 连接超时，请检查防火墙设置和网络连接",
		MsgHintDatabase:       "\n\n💡 提示: 数据库不存在，请检查数据库名称或留空以自动获取",
		MsgHintMySQLAccess:    "\n\n💡 提示: MySQL 访问被拒绝，请检查用户名和密码，以及用户是否有远程连接权限",
		MsgHintPGPassword:     "\n\n💡 提示: PostgreSQL 需要密码认证，请提供密码",
		MsgQueryExecuting:     "执行查询中...",
		MsgNoDbSelected:       "请先在左侧选择一个数据库",
		MsgEnterQuery:         "请输入查询语句",
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
		MsgHintConnection:     "\n\n💡 Tip: Please check if the host address and port are correct, and if the database service is running.",
		MsgHintAuth:           "\n\n💡 Tip: Username or password is incorrect. Please check your credentials.",
		MsgHintHost:           "\n\n💡 Tip: Cannot resolve host address. Please check your network connection and hostname.",
		MsgHintTimeout:        "\n\n💡 Tip: Connection timed out. Please check your firewall settings and network connection.",
		MsgHintDatabase:       "\n\n💡 Tip: Database does not exist. Please check the database name or leave it blank to auto-detect.",
		MsgHintMySQLAccess:    "\n\n💡 Tip: MySQL access denied. Please check the username and password, and whether the user has remote connection permission.",
		MsgHintPGPassword:     "\n\n💡 Tip: PostgreSQL requires password authentication. Please provide a password.",
		MsgQueryExecuting:     "Executing query...",
		MsgNoDbSelected:       "Please select a database from the left panel",
		MsgEnterQuery:         "Please enter a query",
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

func (a *App) getCurrentLang() string {
	lang := a.GetLanguage()
	if lang == "" {
		lang = "zh"
	}
	return lang
}
