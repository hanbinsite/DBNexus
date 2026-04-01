package db

// TableInfo represents table information
type TableInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Schema  string `json:"schema"`
	Comment string `json:"comment,omitempty"`
}

// ViewInfo represents database view information
type ViewInfo struct {
	Name       string `json:"name"`
	Schema     string `json:"schema,omitempty"`
	Definition string `json:"definition,omitempty"`
}

// FunctionInfo represents stored function or procedure information
type FunctionInfo struct {
	Name       string `json:"name"`
	Schema     string `json:"schema,omitempty"`
	ReturnType string `json:"return_type,omitempty"`
	Arguments  string `json:"arguments,omitempty"`
}
