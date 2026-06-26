package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"db-server/db"
)

// QueryService handles query execution operations
type QueryServiceImpl struct {
	app *App
}

func (s *QueryServiceImpl) ExecuteQuery(config Connection, database string, query string) QueryResult {
	return s.app.ExecuteQuery(config, database, query)
}

func (s *QueryServiceImpl) ExecuteMultiQuery(config Connection, database string, query string) MultiQueryResult {
	return s.app.ExecuteMultiQuery(config, database, query)
}

func (s *QueryServiceImpl) ValidateSQLSyntax(sql string) *SQLValidationResult {
	return s.app.ValidateSQLSyntax(sql)
}

// SchemaService handles schema operations
type SchemaServiceImpl struct {
	app *App
}

func (s *SchemaServiceImpl) GetTables(config Connection, database string) ([]TableInfo, error) {
	return s.app.GetTables(config, database)
}

func (s *SchemaServiceImpl) GetTableStructure(config Connection, database string, table string) ([]db.ColumnInfo, error) {
	return s.app.GetTableColumns(config, database, table)
}

func (s *SchemaServiceImpl) GetDatabases(config Connection) ([]DatabaseInfo, error) {
	return s.app.GetDatabases(config)
}

// ConnectionService handles connection operations
type ConnectionServiceImpl struct {
	app *App
}

func (s *ConnectionServiceImpl) TestConnection(config Connection) (bool, string) {
	return s.app.TestConnection(config)
}

func (s *ConnectionServiceImpl) SaveConnection(config Connection) error {
	return s.app.SaveConnection(config)
}

func (s *ConnectionServiceImpl) DeleteConnection(id string) error {
	return s.app.DeleteConnection(id)
}

func (s *ConnectionServiceImpl) GetConnections() []Connection {
	return s.app.GetConnections()
}

// AuditService handles audit operations
type AuditServiceImpl struct {
	app *App
}

func (s *AuditServiceImpl) Log(level string, event string, message string, details map[string]interface{}) {
	logger := GetAuditLogger()
	logger.Log(AuditLogLevel(level), AuditEventType(event), message, details)
}

// ServiceContainer holds all service instances
type ServiceContainer struct {
	Query      *QueryServiceImpl
	Schema     *SchemaServiceImpl
	Connection *ConnectionServiceImpl
	Audit      *AuditServiceImpl
	mu         sync.RWMutex
}

var serviceContainer *ServiceContainer
var serviceContainerOnce sync.Once

func GetServiceContainer(app *App) *ServiceContainer {
	serviceContainerOnce.Do(func() {
		serviceContainer = &ServiceContainer{
			Query:      &QueryServiceImpl{app: app},
			Schema:     &SchemaServiceImpl{app: app},
			Connection: &ConnectionServiceImpl{app: app},
			Audit:      &AuditServiceImpl{app: app},
		}
	})
	if app != nil {
		serviceContainer.mu.Lock()
		serviceContainer.Query.app = app
		serviceContainer.Schema.app = app
		serviceContainer.Connection.app = app
		serviceContainer.Audit.app = app
		serviceContainer.mu.Unlock()
	}
	return serviceContainer
}

// Helper method to get query duration
func (s *QueryServiceImpl) GetQueryDuration(query string) time.Duration {
	start := time.Now()
	_ = query
	return time.Since(start)
}

// Helper method to check if query is read-only
func (s *QueryServiceImpl) IsReadOnly(query string) bool {
	if len(query) == 0 {
		return false
	}
	upper := fmt.Sprintf("%s", query[:1])
	for _, c := range query {
		upper = fmt.Sprintf("%c", c)
		break
	}
	return upper == "S" || upper == "s"
}

// Helper method to get table count for a database
func (s *SchemaServiceImpl) GetTableCount(config Connection, database string) (int, error) {
	tables, err := s.GetTables(config, database)
	if err != nil {
		return 0, err
	}
	return len(tables), nil
}

// Helper method to check connection health
func (s *ConnectionServiceImpl) IsHealthy(config Connection) bool {
	connected, _ := s.TestConnection(config)
	return connected
}

// Helper method to get connection count
func (s *ConnectionServiceImpl) GetConnectionCount() int {
	return len(s.GetConnections())
}

// Context helper for services
func (s *QueryServiceImpl) ExecuteQueryWithContext(ctx context.Context, config Connection, database string, query string) QueryResult {
	_ = ctx
	return s.app.ExecuteQuery(config, database, query)
}

