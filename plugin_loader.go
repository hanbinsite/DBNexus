package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"plugin"
	"sync"
)

// PluginLoader handles dynamic plugin loading via Go plugin package
type PluginLoader struct {
	mu      sync.RWMutex
	loaded  map[string]*plugin.Plugin
	path    string
}

var pluginLoader = &PluginLoader{
	loaded: make(map[string]*plugin.Plugin),
}

func (pl *PluginLoader) GetPluginDir() string {
	homeDir, _ := os.UserHomeDir()
	dir := filepath.Join(homeDir, ConfigDirName, "plugins", "native")
	os.MkdirAll(dir, DirPermSecure)
	return dir
}

// LoadPlugin loads a Go plugin (.so file) dynamically
// Note: Go plugins only work on Linux/macOS with CGO_ENABLED=1
func (pl *PluginLoader) LoadPlugin(path string) error {
	pl.mu.Lock()
	defer pl.mu.Unlock()

	if _, exists := pl.loaded[path]; exists {
		return nil // Already loaded
	}

	// Check file exists
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("plugin file not found: %s", path)
	}

	// Try to load as Go plugin
	p, err := plugin.Open(path)
	if err != nil {
		return fmt.Errorf("failed to load plugin: %w", err)
	}

	pl.loaded[path] = p

	// Try to call Init function if available
	if initFn, err := p.Lookup("Init"); err == nil {
		if fn, ok := initFn.(func() error); ok {
			if err := fn(); err != nil {
				return fmt.Errorf("plugin init failed: %w", err)
			}
		}
	}

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConfigChange,
		fmt.Sprintf("插件已加载: %s", filepath.Base(path)),
		map[string]interface{}{"path": path},
	)

	return nil
}

// CallPluginFunction calls a function from a loaded plugin
func (pl *PluginLoader) CallPluginFunction(pluginPath string, funcName string, args ...interface{}) (interface{}, error) {
	pl.mu.RLock()
	p, exists := pl.loaded[pluginPath]
	pl.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("plugin not loaded: %s", pluginPath)
	}

	fn, err := p.Lookup(funcName)
	if err != nil {
		return nil, fmt.Errorf("function not found: %s", funcName)
	}

	// Try common function signatures
	switch f := fn.(type) {
	case func() interface{}:
		return f(), nil
	case func(...interface{}) interface{}:
		return f(args...), nil
	case func(string) string:
		if len(args) > 0 {
			if s, ok := args[0].(string); ok {
				return f(s), nil
			}
		}
		return nil, fmt.Errorf("invalid argument type")
	default:
		return nil, fmt.Errorf("unsupported function signature")
	}
}

// UnloadPlugin removes a plugin from memory
func (pl *PluginLoader) UnloadPlugin(path string) error {
	pl.mu.Lock()
	defer pl.mu.Unlock()

	if _, exists := pl.loaded[path]; !exists {
		return fmt.Errorf("plugin not loaded: %s", path)
	}

	// Call Cleanup function if available
	if cleanupFn, err := pl.loaded[path].Lookup("Cleanup"); err == nil {
		if fn, ok := cleanupFn.(func()); ok {
			fn()
		}
	}

	delete(pl.loaded, path)
	return nil
}

// ListLoadedPlugins returns all loaded plugin paths
func (pl *PluginLoader) ListLoadedPlugins() []string {
	pl.mu.RLock()
	defer pl.mu.RUnlock()

	paths := make([]string, 0, len(pl.loaded))
	for path := range pl.loaded {
		paths = append(paths, path)
	}
	return paths
}

// ScanPluginDir scans the plugin directory for .so files
func (pl *PluginLoader) ScanPluginDir() ([]string, error) {
	dir := pl.GetPluginDir()
	var plugins []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && filepath.Ext(path) == ".so" {
			plugins = append(plugins, path)
		}
		return nil
	})

	if plugins == nil {
		plugins = []string{}
	}
	return plugins, err
}

// Wails API for plugin loading
func (a *App) LoadNativePlugin(path string) error {
	return pluginLoader.LoadPlugin(path)
}

func (a *App) UnloadNativePlugin(path string) error {
	return pluginLoader.UnloadPlugin(path)
}

func (a *App) GetLoadedNativePlugins() []string {
	return pluginLoader.ListLoadedPlugins()
}

func (a *App) ScanNativePlugins() []string {
	plugins, _ := pluginLoader.ScanPluginDir()
	return plugins
}

// PluginManifest describes a plugin's metadata
type PluginManifest struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Author      string   `json:"author"`
	Hooks       []string `json:"hooks"`
	Dependencies []string `json:"dependencies,omitempty"`
}

// LoadPluginManifest loads a manifest.json from a plugin directory
func LoadPluginManifest(pluginDir string) (*PluginManifest, error) {
	manifestPath := filepath.Join(pluginDir, "manifest.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("manifest not found: %w", err)
	}

	var manifest PluginManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("invalid manifest: %w", err)
	}

	return &manifest, nil
}

// GetPluginManifests scans for all plugin manifests
func (a *App) GetPluginManifests() []PluginManifest {
	dir := pluginLoader.GetPluginDir()
	parentDir := filepath.Dir(dir)

	var manifests []PluginManifest

	entries, err := os.ReadDir(parentDir)
	if err != nil {
		return []PluginManifest{}
	}

	for _, entry := range entries {
		if entry.IsDir() {
			manifest, err := LoadPluginManifest(filepath.Join(parentDir, entry.Name()))
			if err == nil {
				manifests = append(manifests, *manifest)
			}
		}
	}

	if manifests == nil {
		manifests = []PluginManifest{}
	}
	return manifests
}
