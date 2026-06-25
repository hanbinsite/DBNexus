package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func (a *App) BackupDatabase(config Connection, database string, outputPath string) (string, error) {
	if outputPath == "" {
		homeDir, _ := os.UserHomeDir()
		outputPath = filepath.Join(homeDir, ".db-client", "backups",
			fmt.Sprintf("%s_%s_%s", database, time.Now().Format("20060102_150405"), "backup"))
	}

	dir := filepath.Dir(outputPath)
	os.MkdirAll(dir, 0700)

	switch config.Type {
	case "mysql":
		return a.backupMySQL(config, database, outputPath)
	case "postgresql", "polardb", "gaussdb":
		return a.backupPostgres(config, database, outputPath)
	case "sqlite":
		return a.backupSQLite(config, outputPath)
	default:
		return "", fmt.Errorf("backup not supported for type: %s", config.Type)
	}
}

func (a *App) backupMySQL(config Connection, database string, outputPath string) (string, error) {
	args := []string{
		"-h", config.Host,
		"-P", fmt.Sprintf("%d", config.Port),
		"-u", config.Username,
	}
	if config.Password != "" {
		args = append(args, fmt.Sprintf("-p%s", config.Password))
	}
	args = append(args, "--single-transaction", "--routines", "--triggers", database)

	cmd := exec.Command("mysqldump", args...)
	cmd.Stdout = nil

	f, err := os.Create(outputPath)
	if err != nil {
		return "", fmt.Errorf("failed to create backup file: %w", err)
	}
	defer f.Close()

	cmd.Stdout = f
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		os.Remove(outputPath)
		return "", fmt.Errorf("mysqldump failed: %w (is mysqldump installed?)", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("MySQL备份: %s -> %s", database, outputPath),
		map[string]interface{}{"database": database, "path": outputPath},
	)

	return outputPath, nil
}

func (a *App) backupPostgres(config Connection, database string, outputPath string) (string, error) {
	env := os.Environ()
	env = append(env, fmt.Sprintf("PGPASSWORD=%s", config.Password))

	args := []string{
		"-h", config.Host,
		"-p", fmt.Sprintf("%d", config.Port),
		"-U", config.Username,
		"-d", database,
		"-F", "c",
		"-f", outputPath,
	}

	cmd := exec.Command("pg_dump", args...)
	cmd.Env = env
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		os.Remove(outputPath)
		return "", fmt.Errorf("pg_dump failed: %w (is pg_dump installed?)", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("PostgreSQL备份: %s -> %s", database, outputPath),
		map[string]interface{}{"database": database, "path": outputPath},
	)

	return outputPath, nil
}

func (a *App) backupSQLite(config Connection, outputPath string) (string, error) {
	srcFile := config.Database
	if srcFile == "" {
		return "", fmt.Errorf("SQLite database file path is empty")
	}

	src, err := os.Open(srcFile)
	if err != nil {
		return "", fmt.Errorf("failed to open SQLite file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(outputPath)
	if err != nil {
		return "", fmt.Errorf("failed to create backup file: %w", err)
	}
	defer dst.Close()

	if _, err := copyFile(dst, src); err != nil {
		os.Remove(outputPath)
		return "", fmt.Errorf("failed to copy SQLite file: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventQuery,
		fmt.Sprintf("SQLite备份: %s -> %s", srcFile, outputPath),
		map[string]interface{}{"path": outputPath},
	)

	return outputPath, nil
}

func (a *App) RestoreDatabase(config Connection, database string, inputPath string) error {
	if _, err := os.Stat(inputPath); err != nil {
		return fmt.Errorf("backup file not found: %s", inputPath)
	}

	switch config.Type {
	case "mysql":
		return a.restoreMySQL(config, database, inputPath)
	case "postgresql", "polardb", "gaussdb":
		return a.restorePostgres(config, database, inputPath)
	case "sqlite":
		return a.restoreSQLite(config, inputPath)
	default:
		return fmt.Errorf("restore not supported for type: %s", config.Type)
	}
}

func (a *App) restoreMySQL(config Connection, database string, inputPath string) error {
	f, err := os.Open(inputPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer f.Close()

	args := []string{
		"-h", config.Host,
		"-P", fmt.Sprintf("%d", config.Port),
		"-u", config.Username,
		fmt.Sprintf("-p%s", config.Password),
		database,
	}

	cmd := exec.Command("mysql", args...)
	cmd.Stdin = f
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("mysql restore failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("MySQL恢复: %s <- %s", database, inputPath),
		map[string]interface{}{"database": database, "path": inputPath},
	)

	return nil
}

func (a *App) restorePostgres(config Connection, database string, inputPath string) error {
	env := os.Environ()
	env = append(env, fmt.Sprintf("PGPASSWORD=%s", config.Password))

	args := []string{
		"-h", config.Host,
		"-p", fmt.Sprintf("%d", config.Port),
		"-U", config.Username,
		"-d", database,
		"-F", "c",
		"-f", inputPath,
	}

	cmd := exec.Command("pg_restore", args...)
	cmd.Env = env
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_restore failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("PostgreSQL恢复: %s <- %s", database, inputPath),
		map[string]interface{}{"database": database, "path": inputPath},
	)

	return nil
}

func (a *App) restoreSQLite(config Connection, inputPath string) error {
	dstFile := config.Database
	if dstFile == "" {
		return fmt.Errorf("SQLite database file path is empty")
	}

	src, err := os.Open(inputPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(dstFile)
	if err != nil {
		return fmt.Errorf("failed to open target database file: %w", err)
	}
	defer dst.Close()

	if _, err := copyFile(dst, src); err != nil {
		return fmt.Errorf("failed to restore SQLite file: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventQuery,
		fmt.Sprintf("SQLite恢复: %s <- %s", dstFile, inputPath),
		map[string]interface{}{"path": inputPath},
	)

	return nil
}

func copyFile(dst io.Writer, src io.Reader) (int64, error) {
	return io.Copy(dst, src)
}
