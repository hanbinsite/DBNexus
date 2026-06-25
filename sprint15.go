package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// S15-1: 版本控制集成 (Git)
type GitRepoInfo struct {
	Path       string `json:"path"`
	Branch     string `json:"branch"`
	Remote     string `json:"remote,omitempty"`
	Status     string `json:"status"` // "clean", "modified", "untracked"
	AheadCount int    `json:"ahead_count,omitempty"`
	BehindCount int   `json:"behind_count,omitempty"`
}

type GitCommitInfo struct {
	Hash      string `json:"hash"`
	Author    string `json:"author"`
	Date      string `json:"date"`
	Message   string `json:"message"`
}

type GitFileChange struct {
	Status   string `json:"status"` // "added", "modified", "deleted", "renamed"
	File     string `json:"file"`
	OldFile  string `json:"old_file,omitempty"`
}

var (
	gitReposMu  sync.RWMutex
	gitRepos    []string
	gitReposLoaded bool
)

func getGitReposFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "git_repos.json")
}

func (a *App) GetGitRepos() []string {
	gitReposMu.RLock()
	defer gitReposMu.RUnlock()

	if !gitReposLoaded {
		gitReposMu.RUnlock()
		gitReposMu.Lock()
		if !gitReposLoaded {
			gitReposLoaded = true
			data, _ := os.ReadFile(getGitReposFilePath())
			json.Unmarshal(data, &gitRepos)
		}
		gitReposMu.Unlock()
		gitReposMu.RLock()
	}

	result := make([]string, len(gitRepos))
	copy(result, gitRepos)
	return result
}

func (a *App) AddGitRepo(path string) error {
	if path == "" {
		return fmt.Errorf("path is required")
	}

	// Verify it's a git repo
	if _, err := os.Stat(filepath.Join(path, ".git")); err != nil {
		return fmt.Errorf("not a git repository: %s", path)
	}

	gitReposMu.Lock()
	defer gitReposMu.Unlock()

	if !gitReposLoaded {
		gitReposLoaded = true
		data, _ := os.ReadFile(getGitReposFilePath())
		json.Unmarshal(data, &gitRepos)
	}

	// Check for duplicates
	for _, existing := range gitRepos {
		if existing == path {
			return nil // Already added
		}
	}

	gitRepos = append(gitRepos, path)
	data, _ := json.Marshal(gitRepos)
	dir := filepath.Dir(getGitReposFilePath())
	os.MkdirAll(dir, DirPermSecure)
	os.WriteFile(getGitReposFilePath(), data, FilePermSecure)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("添加Git仓库: %s", path),
		map[string]interface{}{"path": path},
	)

	return nil
}

func (a *App) RemoveGitRepo(path string) error {
	gitReposMu.Lock()
	defer gitReposMu.Unlock()

	for i, repo := range gitRepos {
		if repo == path {
			gitRepos = append(gitRepos[:i], gitRepos[i+1:]...)
			data, _ := json.Marshal(gitRepos)
			return os.WriteFile(getGitReposFilePath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("repo not found: %s", path)
}

func (a *App) GetGitRepoInfo(repoPath string) (*GitRepoInfo, error) {
	info := &GitRepoInfo{Path: repoPath}

	// Get current branch
	if output, err := runGitCommand(repoPath, "branch", "--show-current"); err == nil {
		info.Branch = strings.TrimSpace(output)
	}

	// Get remote URL
	if output, err := runGitCommand(repoPath, "remote", "get-url", "origin"); err == nil {
		info.Remote = strings.TrimSpace(output)
	}

	// Get status
	if output, err := runGitCommand(repoPath, "status", "--porcelain"); err == nil {
		if strings.TrimSpace(output) == "" {
			info.Status = "clean"
		} else {
			info.Status = "modified"
		}
	}

	// Get ahead/behind count
	if output, err := runGitCommand(repoPath, "rev-list", "--left-right", "--count", "HEAD...@{upstream}"); err == nil {
		parts := strings.Fields(strings.TrimSpace(output))
		if len(parts) >= 2 {
			fmt.Sscanf(parts[0], "%d", &info.AheadCount)
			fmt.Sscanf(parts[1], "%d", &info.BehindCount)
		}
	}

	return info, nil
}

func (a *App) GetGitLog(repoPath string, limit int) ([]GitCommitInfo, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	format := "--pretty=format:%H|%an|%ad|%s"
	output, err := runGitCommand(repoPath, "log", format, "--date=short", fmt.Sprintf("-%d", limit))
	if err != nil {
		return []GitCommitInfo{}, nil
	}

	var commits []GitCommitInfo
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for _, line := range lines {
		parts := strings.SplitN(line, "|", 4)
		if len(parts) >= 4 {
			commits = append(commits, GitCommitInfo{
				Hash:    parts[0],
				Author:  parts[1],
				Date:    parts[2],
				Message: parts[3],
			})
		}
	}

	if commits == nil {
		commits = []GitCommitInfo{}
	}
	return commits, nil
}

func (a *App) GetGitChanges(repoPath string) ([]GitFileChange, error) {
	output, err := runGitCommand(repoPath, "status", "--porcelain")
	if err != nil {
		return []GitFileChange{}, nil
	}

	var changes []GitFileChange
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for _, line := range lines {
		if len(line) < 3 {
			continue
		}
		statusCode := strings.TrimSpace(line[:2])
		file := strings.TrimSpace(line[3:])

		change := GitFileChange{File: file}

		switch statusCode {
		case "A", "??":
			change.Status = "added"
		case "M":
			change.Status = "modified"
		case "D":
			change.Status = "deleted"
		case "R":
			change.Status = "renamed"
			if idx := strings.Index(file, " -> "); idx >= 0 {
				change.OldFile = file[:idx]
				change.File = file[idx+4:]
			}
		default:
			change.Status = "modified"
		}

		changes = append(changes, change)
	}

	if changes == nil {
		changes = []GitFileChange{}
	}
	return changes, nil
}

func (a *App) GitCommit(repoPath string, message string) (string, error) {
	if message == "" {
		return "", fmt.Errorf("commit message is required")
	}

	// Add all changes
	runGitCommand(repoPath, "add", "-A")

	// Commit
	output, err := runGitCommand(repoPath, "commit", "-m", message)
	if err != nil {
		return "", fmt.Errorf("git commit failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("Git提交: %s (%s)", repoPath, message),
		map[string]interface{}{"repo": repoPath, "message": message},
	)

	return strings.TrimSpace(output), nil
}

func (a *App) GitPull(repoPath string) (string, error) {
	output, err := runGitCommand(repoPath, "pull")
	if err != nil {
		return "", fmt.Errorf("git pull failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("Git拉取: %s", repoPath), nil,
	)

	return strings.TrimSpace(output), nil
}

func (a *App) GitPush(repoPath string) (string, error) {
	output, err := runGitCommand(repoPath, "push")
	if err != nil {
		return "", fmt.Errorf("git push failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("Git推送: %s", repoPath), nil,
	)

	return strings.TrimSpace(output), nil
}

func (a *App) GitCheckout(repoPath string, branch string) (string, error) {
	if branch == "" {
		return "", fmt.Errorf("branch name is required")
	}

	output, err := runGitCommand(repoPath, "checkout", branch)
	if err != nil {
		return "", fmt.Errorf("git checkout failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("Git切换分支: %s -> %s", repoPath, branch),
		map[string]interface{}{"repo": repoPath, "branch": branch},
	)

	return strings.TrimSpace(output), nil
}

func (a *App) GitCreateBranch(repoPath string, branchName string) (string, error) {
	if branchName == "" {
		return "", fmt.Errorf("branch name is required")
	}

	output, err := runGitCommand(repoPath, "checkout", "-b", branchName)
	if err != nil {
		return "", fmt.Errorf("git create branch failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("Git创建分支: %s (%s)", repoPath, branchName),
		map[string]interface{}{"repo": repoPath, "branch": branchName},
	)

	return strings.TrimSpace(output), nil
}

func (a *App) GitDiff(repoPath string, file string) (string, error) {
	args := []string{"diff"}
	if file != "" {
		args = append(args, "--", file)
	}

	output, err := runGitCommand(repoPath, args...)
	if err != nil {
		return "", fmt.Errorf("git diff failed: %w", err)
	}

	return output, nil
}

func (a *App) GitInitRepo(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("path is required")
	}

	output, err := runGitCommand(path, "init")
	if err != nil {
		return "", fmt.Errorf("git init failed: %w", err)
	}

	GetAuditLogger().Log(AuditLevelWarning, AuditEventConfigChange,
		fmt.Sprintf("Git初始化: %s", path),
		map[string]interface{}{"path": path},
	)

	return strings.TrimSpace(output), nil
}

func runGitCommand(repoPath string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s", strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// S15-2: ARCH-003 — 插件化架构基础
type PluginInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"` // "query_hook", "data_processor", "ui_extension"
	Enabled     bool   `json:"enabled"`
	Path        string `json:"path,omitempty"`
	LoadedAt    string `json:"loaded_at,omitempty"`
}

type PluginHook struct {
	Type     string      `json:"type"`
	Priority int         `json:"priority"`
	Callback func(interface{}) interface{}
}

var (
	pluginsMu    sync.RWMutex
	plugins      []PluginInfo
	hooks        = make(map[string][]PluginHook)
	pluginsLoaded bool
)

func getPluginsFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ConfigDirName, "plugins.json")
}

func (a *App) GetPlugins() []PluginInfo {
	pluginsMu.RLock()
	defer pluginsMu.RUnlock()

	if !pluginsLoaded {
		pluginsMu.RUnlock()
		pluginsMu.Lock()
		if !pluginsLoaded {
			pluginsLoaded = true
			data, _ := os.ReadFile(getPluginsFilePath())
			json.Unmarshal(data, &plugins)
		}
		pluginsMu.Unlock()
		pluginsMu.RLock()
	}

	result := make([]PluginInfo, len(plugins))
	copy(result, plugins)
	return result
}

func (a *App) RegisterPlugin(name string, version string, description string, pluginType string) (PluginInfo, error) {
	if name == "" {
		return PluginInfo{}, fmt.Errorf("plugin name is required")
	}

	pluginsMu.Lock()
	defer pluginsMu.Unlock()

	if !pluginsLoaded {
		pluginsLoaded = true
		data, _ := os.ReadFile(getPluginsFilePath())
		json.Unmarshal(data, &plugins)
	}

	plugin := PluginInfo{
		ID:          fmt.Sprintf("plugin_%d", time.Now().UnixNano()),
		Name:        name,
		Version:     version,
		Description: description,
		Type:        pluginType,
		Enabled:     true,
		LoadedAt:    time.Now().Format("2006-01-02 15:04:05"),
	}
	plugins = append(plugins, plugin)

	data, _ := json.Marshal(plugins)
	dir := filepath.Dir(getPluginsFilePath())
	os.MkdirAll(dir, DirPermSecure)
	os.WriteFile(getPluginsFilePath(), data, FilePermSecure)

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("注册插件: %s v%s (%s)", name, version, pluginType),
		map[string]interface{}{"plugin": name, "version": version, "type": pluginType},
	)

	return plugin, nil
}

func (a *App) TogglePlugin(pluginID string, enabled bool) error {
	pluginsMu.Lock()
	defer pluginsMu.Unlock()

	for i, p := range plugins {
		if p.ID == pluginID {
			plugins[i].Enabled = enabled
			data, _ := json.Marshal(plugins)
			return os.WriteFile(getPluginsFilePath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("plugin not found: %s", pluginID)
}

func (a *App) RemovePlugin(pluginID string) error {
	pluginsMu.Lock()
	defer pluginsMu.Unlock()

	for i, p := range plugins {
		if p.ID == pluginID {
			plugins = append(plugins[:i], plugins[i+1:]...)
			data, _ := json.Marshal(plugins)
			return os.WriteFile(getPluginsFilePath(), data, FilePermSecure)
		}
	}
	return fmt.Errorf("plugin not found: %s", pluginID)
}

// 插件钩子注册
func RegisterHook(hookType string, priority int, callback func(interface{}) interface{}) {
	pluginsMu.Lock()
	defer pluginsMu.Unlock()

	hook := PluginHook{
		Type:     hookType,
		Priority: priority,
		Callback: callback,
	}
	hooks[hookType] = append(hooks[hookType], hook)

	// Sort by priority (lower = higher priority)
	hookList := hooks[hookType]
	for i := 0; i < len(hookList)-1; i++ {
		for j := i + 1; j < len(hookList); j++ {
			if hookList[j].Priority < hookList[i].Priority {
				hookList[i], hookList[j] = hookList[j], hookList[i]
			}
		}
	}
}

// 执行钩子链
func ExecuteHooks(hookType string, data interface{}) interface{} {
	pluginsMu.RLock()
	hookList := hooks[hookType]
	pluginsMu.RUnlock()

	result := data
	for _, hook := range hookList {
		result = hook.Callback(result)
	}
	return result
}

// 钩子类型常量
const (
	HookBeforeQuery    = "before_query"
	HookAfterQuery     = "after_query"
	HookBeforeExport   = "before_export"
	HookAfterImport    = "after_import"
	HookBeforeEdit     = "before_edit"
	HookAfterEdit      = "after_edit"
	HookDataTransform  = "data_transform"
	HookUIRender       = "ui_render"
)

func (a *App) GetPluginHooks() []string {
	return []string{
		HookBeforeQuery, HookAfterQuery,
		HookBeforeExport, HookAfterImport,
		HookBeforeEdit, HookAfterEdit,
		HookDataTransform, HookUIRender,
	}
}
