package main

// Connection represents a saved database connection
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
}

// QueryResult represents the result of a query execution
type QueryResult struct {
	Columns  []string        `json:"columns,omitempty"`
	Rows     [][]interface{} `json:"rows,omitempty"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
}

// SingleQueryResult represents a single query result in multi-query execution
type SingleQueryResult struct {
	Query    string          `json:"query"`
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	RowCount int             `json:"row_count"`
	Duration string          `json:"duration"`
	Error    string          `json:"error,omitempty"`
	Status   string          `json:"status"` // "success", "error"
}

// MultiQueryResult represents the result of multi-query execution
type MultiQueryResult struct {
	Results       []SingleQueryResult `json:"results"`
	TotalCount    int                 `json:"total_count"`
	SuccessCount  int                 `json:"success_count"`
	ErrorCount    int                 `json:"error_count"`
	TotalDuration string              `json:"total_duration"`
	StartTime     string              `json:"start_time"`
	EndTime       string              `json:"end_time"`
}

// TableInfo represents table information
type TableInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Schema  string `json:"schema"`
	Comment string `json:"comment,omitempty"`
}

// DatabaseInfo represents database information
type DatabaseInfo struct {
	Name    string `json:"name"`
	Owner   string `json:"owner,omitempty"`
	Comment string `json:"comment,omitempty"`
}

// IndexInfo represents index information
type IndexInfo struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // PRIMARY, UNIQUE, INDEX, FULLTEXT
	Columns     []string `json:"columns"`
	Unique      bool     `json:"unique"`
	PrimaryKey  bool     `json:"primary_key"`
	Nullable    bool     `json:"nullable"`
	Cardinality int64    `json:"cardinality"`
	Comment     string   `json:"comment,omitempty"`
}

// ForeignKeyInfo represents foreign key information
type ForeignKeyInfo struct {
	Name        string `json:"name"`
	ColumnName  string `json:"column_name"`
	RefTable    string `json:"ref_table"`
	RefColumn   string `json:"ref_column"`
	OnUpdate    string `json:"on_update"`
	OnDelete    string `json:"on_delete"`
	MatchOption string `json:"match_option,omitempty"`
}

// TableStats represents table statistics
type TableStats struct {
	RowCount    int64  `json:"row_count"`
	DataLength  int64  `json:"data_length"`
	IndexLength int64  `json:"index_length"`
	Engine      string `json:"engine"`
	Charset     string `json:"charset"`
	Collation   string `json:"collation"`
	Comment     string `json:"comment,omitempty"`
}

// TestResult represents a test result
type TestResult struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message"`
	Time    string `json:"time"`
}
