package main

type Connection struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	Database      string `json:"database"`
	SSLMode       string `json:"ssl_mode,omitempty"`
	Color         string `json:"color"`
	SavePassword  bool   `json:"save_password"`
	AutoConnect   bool   `json:"auto_connect"`
	LastConnected string `json:"last_connected,omitempty"`

	// SSH Tunnel
	SSHEnabled  bool   `json:"ssh_enabled,omitempty"`
	SSHHost     string `json:"ssh_host,omitempty"`
	SSHPort     int    `json:"ssh_port,omitempty"`
	SSHUser     string `json:"ssh_user,omitempty"`
	SSHPassword string `json:"ssh_password,omitempty"`
	SSHKeyPath  string `json:"ssh_key_path,omitempty"`
}

type QueryResult struct {
	Columns  []string        `json:"columns,omitempty"`
	Rows     [][]interface{} `json:"rows,omitempty"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
}

type SingleQueryResult struct {
	Query    string          `json:"query"`
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
	Status   string          `json:"status"`
}

type MultiQueryResult struct {
	Results       []SingleQueryResult `json:"results"`
	TotalCount    int                 `json:"total_count"`
	SuccessCount  int                 `json:"success_count"`
	ErrorCount    int                 `json:"error_count"`
	TotalDuration string              `json:"total_duration"`
	StartTime     string              `json:"start_time"`
	EndTime       string              `json:"end_time"`
}

type TableInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Schema  string `json:"schema"`
	Comment string `json:"comment,omitempty"`
}

type DatabaseInfo struct {
	Name    string `json:"name"`
	Owner   string `json:"owner,omitempty"`
	Comment string `json:"comment,omitempty"`
}

type IndexInfo struct {
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	Columns    []string `json:"columns"`
	Unique     bool     `json:"unique"`
	PrimaryKey bool     `json:"primary_key"`
	Nullable   bool     `json:"nullable"`
	Cardinality int64   `json:"cardinality"`
	Comment    string   `json:"comment,omitempty"`
}

type ForeignKeyInfo struct {
	Name        string `json:"name"`
	ColumnName  string `json:"column_name"`
	RefTable    string `json:"ref_table"`
	RefColumn   string `json:"ref_column"`
	OnUpdate    string `json:"on_update"`
	OnDelete    string `json:"on_delete"`
	MatchOption string `json:"match_option,omitempty"`
}

type TableStats struct {
	RowCount   int64  `json:"row_count"`
	DataLength int64  `json:"data_length"`
	IndexLength int64 `json:"index_length"`
	Engine     string `json:"engine"`
	Charset    string `json:"charset"`
	Collation  string `json:"collation"`
	Comment    string `json:"comment,omitempty"`
}

type EditRequest struct {
	Operation  string                 `json:"operation"`
	Table      string                 `json:"table"`
	Database   string                 `json:"database"`
	Data       map[string]interface{} `json:"data,omitempty"`
	PrimaryKey map[string]interface{} `json:"primaryKey,omitempty"`
}

type EditResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	RowsAffected int64 `json:"rows_affected,omitempty"`
}

type TestResult struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message"`
	Time    string `json:"time"`
}

type QueryOptions struct {
	Timeout int `json:"timeout,omitempty"`
}
