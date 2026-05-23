package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Window Control ====================

func (a *App) WindowMinimise() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) WindowMaximise() {
	wailsRuntime.WindowToggleMaximise(a.ctx)
}

func (a *App) WindowClose() {
	wailsRuntime.Quit(a.ctx)
}

// ==================== Editor Detection & Open ====================

type EditorInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Command string `json:"command"`
}

func (a *App) GetPlatform() string {
	return runtime.GOOS
}

func (a *App) GetAvailableEditors() []EditorInfo {
	editors := []EditorInfo{}

	type editorCheck struct {
		ID      string
		Name    string
		WinCmd  []string
		MacCmd  []string
	}

	checks := []editorCheck{
		{"vscode", "VS Code", []string{"code"}, []string{"code"}},
		{"cursor", "Cursor", []string{"cursor"}, []string{"cursor"}},
		{"webstorm", "WebStorm", []string{"webstorm64.exe", "webstorm"}, []string{"webstorm"}},
		{"idea", "IntelliJ IDEA", []string{"idea64.exe", "idea"}, []string{"idea"}},
		{"catpaw", "CatPaw IDE", []string{"catpaw"}, []string{"catpaw"}},
		{"sublime", "Sublime Text", []string{"subl"}, []string{"subl"}},
	}

	for _, c := range checks {
		cmds := c.MacCmd
		if runtime.GOOS == "windows" {
			cmds = c.WinCmd
		}
		for _, cmd := range cmds {
			if path, err := exec.LookPath(cmd); err == nil {
				editors = append(editors, EditorInfo{
					ID:      c.ID,
					Name:    c.Name,
					Command: path,
				})
				break
			}
		}
	}

	return editors
}

func (a *App) GetPreferredEditor() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.settings.OpenTarget
}

func (a *App) SetPreferredEditor(editorID string) error {
	a.mu.Lock()
	a.settings.OpenTarget = editorID
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

func (a *App) OpenInEditor(dirPath string) error {
	if dirPath == "" {
		a.mu.Lock()
		projects := a.projects
		a.mu.Unlock()
		if len(projects) > 0 {
			dirPath = projects[0].Path
		}
		if dirPath == "" {
			return fmt.Errorf("no project directory specified")
		}
	}

	a.mu.Lock()
	err := a.isPathAllowed(dirPath)
	a.mu.Unlock()
	if err != nil {
		return fmt.Errorf("path not allowed: %v", err)
	}

	a.mu.Lock()
	editorID := a.settings.OpenTarget
	a.mu.Unlock()

	editors := a.GetAvailableEditors()
	var targetCmd string

	for _, e := range editors {
		if e.ID == editorID {
			targetCmd = e.Command
			break
		}
	}

	if targetCmd == "" && len(editors) > 0 {
		targetCmd = editors[0].Command
	}

	if targetCmd == "" {
		if runtime.GOOS == "windows" {
			return exec.Command("explorer", dirPath).Start()
		}
		return exec.Command("open", dirPath).Start()
	}

	return exec.Command(targetCmd, dirPath).Start()
}

// ==================== Popout Window ====================

func (a *App) PopoutWindow() error {
	a.mu.Lock()
	a.settings.BrowserPlugin = "popout"
	a.mu.Unlock()

	var currentSessionID string
	var currentSessionName string
	a.mu.Lock()
	if len(a.sessions) > 0 {
		currentSessionID = a.sessions[len(a.sessions)-1].ID
		currentSessionName = a.sessions[len(a.sessions)-1].Name
	}
	a.mu.Unlock()

	wailsRuntime.EventsEmit(a.ctx, "popout-requested", map[string]interface{}{
		"sessionId":   currentSessionID,
		"sessionName": currentSessionName,
		"timestamp":   time.Now().Unix(),
	})

	fmt.Printf("[Popout] 弹窗请求已发送 (会话: %s)\n", currentSessionName)
	return nil
}

func (a *App) GetPopoutState() map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	return map[string]interface{}{
		"active": a.settings.BrowserPlugin == "popout",
	}
}

func (a *App) WindowSetAlwaysOnTop(onTop bool) {
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, onTop)
}
