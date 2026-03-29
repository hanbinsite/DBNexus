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
