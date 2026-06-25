package main

import (
	"strings"
)

type MaskConfig struct {
	Enabled       bool     `json:"enabled"`
	MaskColumns   []string `json:"mask_columns"`
	MaskChar      string   `json:"mask_char"`
	MaskKeepStart int      `json:"mask_keep_start"`
	MaskKeepEnd   int      `json:"mask_keep_end"`
}

var defaultMaskConfig = MaskConfig{
	Enabled:       false,
	MaskColumns:   []string{"password", "passwd", "secret", "token", "api_key", "credit_card", "ssn", "phone", "email"},
	MaskChar:      "*",
	MaskKeepStart: 2,
	MaskKeepEnd:   2,
}

func maskValue(value string, config MaskConfig) string {
	if value == "" {
		return value
	}

	if len(value) <= config.MaskKeepStart+config.MaskKeepEnd {
		return strings.Repeat(config.MaskChar, len(value))
	}

	start := value[:config.MaskKeepStart]
	end := value[len(value)-config.MaskKeepEnd:]
	maskLen := len(value) - config.MaskKeepStart - config.MaskKeepEnd
	return start + strings.Repeat(config.MaskChar, maskLen) + end
}

func shouldMaskColumn(colName string, config MaskConfig) bool {
	if !config.Enabled {
		return false
	}

	colLower := strings.ToLower(colName)
	for _, maskCol := range config.MaskColumns {
		if strings.Contains(colLower, strings.ToLower(maskCol)) {
			return true
		}
	}
	return false
}

func maskQueryResult(result *QueryResult, config MaskConfig) {
	if !config.Enabled || result == nil || result.Columns == nil {
		return
	}

	maskColIndices := []int{}
	for i, col := range result.Columns {
		if shouldMaskColumn(col, config) {
			maskColIndices = append(maskColIndices, i)
		}
	}

	if len(maskColIndices) == 0 {
		return
	}

	for _, row := range result.Rows {
		for _, idx := range maskColIndices {
			if idx < len(row) {
				if str, ok := row[idx].(string); ok {
					row[idx] = maskValue(str, config)
				}
			}
		}
	}
}

func (a *App) SetMaskConfig(enabled bool, columns string, maskChar string, keepStart int, keepEnd int) error {
	config := MaskConfig{
		Enabled:       enabled,
		MaskChar:      maskChar,
		MaskKeepStart: keepStart,
		MaskKeepEnd:   keepEnd,
	}
	if columns != "" {
		config.MaskColumns = strings.Split(columns, ",")
		for i, c := range config.MaskColumns {
			config.MaskColumns[i] = strings.TrimSpace(c)
		}
	} else {
		config.MaskColumns = defaultMaskConfig.MaskColumns
	}

	defaultMaskConfig = config
	return nil
}

func (a *App) GetMaskConfig() MaskConfig {
	return defaultMaskConfig
}
