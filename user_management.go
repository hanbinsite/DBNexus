package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type DBUser struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	Privileges string `json:"privileges"`
}

func (a *App) GetDatabaseUsers(config Connection) ([]DBUser, error) {
	dbConfig := a.connectionToDBConfig(config)
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()

	var query string
	switch config.Type {
	case "mysql":
		query = "SELECT user, host FROM mysql.user ORDER BY user"
	case "postgresql", "polardb", "gaussdb":
		query = "SELECT usename, '%' FROM pg_user ORDER BY usename"
	default:
		return []DBUser{}, nil
	}

	rows, err := driver.Query(ctx, query)
	if err != nil {
		return []DBUser{}, nil
	}
	defer rows.Close()

	var users []DBUser
	for rows.Next() {
		var name, host string
		if err := rows.Scan(&name, &host); err != nil {
			continue
		}
		users = append(users, DBUser{Name: name, Host: host})
	}

	if users == nil {
		users = []DBUser{}
	}
	return users, nil
}

func (a *App) CreateDatabaseUser(config Connection, username string, password string, host string) error {
	if username == "" || password == "" {
		return fmt.Errorf("username and password are required")
	}
	if host == "" {
		host = "%"
	}

	safeUser := sanitizeIdentifier(username)
	safeHost := sanitizeIdentifier(host)

	dbConfig := a.connectionToDBConfig(config)
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	var query string
	switch config.Type {
	case "mysql":
		query = fmt.Sprintf("CREATE USER '%s'@'%s' IDENTIFIED BY '%s'", safeUser, safeHost, escapeStringLiteral(password))
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf("CREATE USER %s WITH PASSWORD '%s'", safeUser, escapeStringLiteral(password))
	default:
		return fmt.Errorf("user management not supported for %s", config.Type)
	}

	_, err = driver.Exec(ctx, query)
	if err != nil {
		GetAuditLogger().Log(AuditLevelError, AuditEventQuery,
			fmt.Sprintf("创建用户失败: %s (%v)", username, err),
			map[string]interface{}{"user": username},
		)
		return fmt.Errorf("create user failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("创建数据库用户: %s@%s", username, host),
		map[string]interface{}{"user": username, "host": host},
	)

	return nil
}

func (a *App) DropDatabaseUser(config Connection, username string, host string) error {
	if username == "" {
		return fmt.Errorf("username is required")
	}
	if host == "" {
		host = "%"
	}

	safeUser := sanitizeIdentifier(username)
	safeHost := sanitizeIdentifier(host)

	dbConfig := a.connectionToDBConfig(config)
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	var query string
	switch config.Type {
	case "mysql":
		query = fmt.Sprintf("DROP USER '%s'@'%s'", safeUser, safeHost)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf("DROP USER %s", safeUser)
	default:
		return fmt.Errorf("user management not supported for %s", config.Type)
	}

	_, err = driver.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("drop user failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("删除数据库用户: %s@%s", username, host),
		map[string]interface{}{"user": username, "host": host},
	)

	return nil
}

func (a *App) GrantPrivileges(config Connection, username string, database string, privileges string, host string) error {
	if username == "" || privileges == "" {
		return fmt.Errorf("username and privileges are required")
	}
	if host == "" {
		host = "%"
	}

	safeUser := sanitizeIdentifier(username)
	safeDB := sanitizeIdentifier(database)
	safeHost := sanitizeIdentifier(host)

	dbConfig := a.connectionToDBConfig(config)
	driver, err := a.getDriverForConfig(dbConfig)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Second)
	defer cancel()

	privs := strings.ToUpper(strings.TrimSpace(privileges))
	if privs == "ALL" || privs == "ALL PRIVILEGES" {
		privs = "ALL PRIVILEGES"
	}

	var query string
	switch config.Type {
	case "mysql":
		query = fmt.Sprintf("GRANT %s ON `%s`.* TO '%s'@'%s'", privs, safeDB, safeUser, safeHost)
	case "postgresql", "polardb", "gaussdb":
		query = fmt.Sprintf("GRANT %s ON DATABASE %s TO %s", privs, safeDB, safeUser)
	default:
		return fmt.Errorf("grant not supported for %s", config.Type)
	}

	_, err = driver.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("grant failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("授权: %s -> %s@%s (%s)", privs, username, host, database),
		map[string]interface{}{"user": username, "database": database, "privileges": privs},
	)

	return nil
}
