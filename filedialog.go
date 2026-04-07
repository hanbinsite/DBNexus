package main

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// OpenFileDialog opens a file dialog
func (a *App) OpenFileDialog(title string, filters string) string {
	result, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return ""
	}
	return result
}

// SaveFileDialog opens a save dialog
func (a *App) SaveFileDialog(title string, defaultName string) string {
	result, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultName,
	})
	if err != nil {
		return ""
	}
	return result
}
