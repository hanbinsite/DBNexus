package main

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// WindowMinimize minimizes the window
func (a *App) WindowMinimize() {
	runtime.WindowMinimise(a.ctx)
}

// WindowMaximize maximizes/restores the window
func (a *App) WindowMaximize() {
	if runtime.WindowIsMaximised(a.ctx) {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
}

// WindowClose closes the window
func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

// WindowIsMaximized returns whether the window is maximized
func (a *App) WindowIsMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}
