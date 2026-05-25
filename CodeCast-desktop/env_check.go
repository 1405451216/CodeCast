package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Environment Detection ====================

// EnvCheckResult represents the result of a single environment check
type EnvCheckResult struct {
	Name        string `json:"name"`
	Status      string `json:"status"` // "ok", "warning", "error", "missing"
	Version     string `json:"version,omitempty"`
	Message     string `json:"message"`
	FixCommand  string `json:"fix_command,omitempty"`
	FixURL      string `json:"fix_url,omitempty"`
	Required    bool   `json:"required"`
}

// EnvCheckReport is the full environment report
type EnvCheckReport struct {
	Timestamp   int64            `json:"timestamp"`
	OS          string           `json:"os"`
	Arch        string           `json:"arch"`
	Checks      []EnvCheckResult `json:"checks"`
	OverallOK   bool             `json:"overall_ok"`
}

// CheckEnvironment runs all environment checks and returns a report
func (a *App) CheckEnvironment() *EnvCheckReport {
	report := &EnvCheckReport{
		Timestamp: time.Now().Unix(),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		Checks:    []EnvCheckResult{},
		OverallOK: true,
	}

	// Run checks in parallel for speed
	var wg sync.WaitGroup
	var mu sync.Mutex
	checks := []func() EnvCheckResult{
		checkGit,
		checkNode,
		checkNPM,
		checkPython,
		checkGo,
	}

	wg.Add(len(checks))
	for _, checkFn := range checks {
		go func(fn func() EnvCheckResult) {
			defer wg.Done()
			result := fn()
			mu.Lock()
			report.Checks = append(report.Checks, result)
			if result.Required && result.Status == "missing" {
				report.OverallOK = false
			}
			mu.Unlock()
		}(checkFn)
	}
	wg.Wait()

	// Emit event to frontend
	if a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "env-check-report", report)
	}

	return report
}

// FixEnvironmentIssue attempts to fix a detected environment issue
func (a *App) FixEnvironmentIssue(name string) string {
	report := a.CheckEnvironment()
	for _, check := range report.Checks {
		if check.Name == name && check.FixCommand != "" {
			return fmt.Sprintf("请手动执行以下命令修复:\n\n%s\n\n或访问: %s", check.FixCommand, check.FixURL)
		}
	}
	return "未找到可自动修复的方案"
}

// ─── Individual Checks ───────────────────────────────

func checkGit() EnvCheckResult {
	result := EnvCheckResult{
		Name:     "Git",
		Required: true,
	}

	version, err := getCommandVersion("git", "--version")
	if err != nil {
		result.Status = "missing"
		result.Message = "Git 未安装，代码版本控制功能将不可用"
		if runtime.GOOS == "windows" {
			result.FixCommand = "winget install Git.Git"
			result.FixURL = "https://git-scm.com/download/win"
		} else if runtime.GOOS == "darwin" {
			result.FixCommand = "xcode-select --install"
			result.FixURL = "https://git-scm.com/download/mac"
		} else {
			result.FixCommand = "sudo apt install git"
			result.FixURL = "https://git-scm.com/download/linux"
		}
		return result
	}

	result.Status = "ok"
	result.Version = version
	result.Message = "Git 可用"
	return result
}

func checkNode() EnvCheckResult {
	result := EnvCheckResult{
		Name:     "Node.js",
		Required: false,
	}

	version, err := getCommandVersion("node", "--version")
	if err != nil {
		result.Status = "missing"
		result.Message = "Node.js 未安装，MCP 服务和部分插件可能无法使用"
		if runtime.GOOS == "windows" {
			result.FixCommand = "winget install OpenJS.NodeJS.LTS"
			result.FixURL = "https://nodejs.org/"
		} else {
			result.FixCommand = "curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts"
			result.FixURL = "https://nodejs.org/"
		}
		return result
	}

	result.Status = "ok"
	result.Version = version
	result.Message = "Node.js 可用"
	return result
}

func checkNPM() EnvCheckResult {
	result := EnvCheckResult{
		Name:     "npm",
		Required: false,
	}

	version, err := getCommandVersion("npm", "--version")
	if err != nil {
		result.Status = "missing"
		result.Message = "npm 未安装，包管理功能不可用"
		result.FixCommand = "安装 Node.js 后自动包含 npm"
		return result
	}

	result.Status = "ok"
	result.Version = version
	result.Message = "npm 可用"
	return result
}

func checkPython() EnvCheckResult {
	result := EnvCheckResult{
		Name:     "Python",
		Required: false,
	}

	// Try python3 first, then python
	version, err := getCommandVersion("python3", "--version")
	if err != nil {
		version, err = getCommandVersion("python", "--version")
	}

	if err != nil {
		result.Status = "missing"
		result.Message = "Python 未安装，部分脚本工具不可用"
		if runtime.GOOS == "windows" {
			result.FixCommand = "winget install Python.Python.3.12"
			result.FixURL = "https://www.python.org/downloads/"
		} else if runtime.GOOS == "darwin" {
			result.FixCommand = "brew install python"
			result.FixURL = "https://www.python.org/downloads/"
		} else {
			result.FixCommand = "sudo apt install python3"
			result.FixURL = "https://www.python.org/downloads/"
		}
		return result
	}

	result.Status = "ok"
	result.Version = version
	result.Message = "Python 可用"
	return result
}

func checkGo() EnvCheckResult {
	result := EnvCheckResult{
		Name:     "Go",
		Required: false,
	}

	version, err := getCommandVersion("go", "version")
	if err != nil {
		result.Status = "missing"
		result.Message = "Go 未安装（仅开发者需要）"
		result.FixURL = "https://go.dev/dl/"
		return result
	}

	result.Status = "ok"
	result.Version = version
	result.Message = "Go 可用"
	return result
}

// ─── Helpers ─────────────────────────────────────────

func getCommandVersion(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	// Extract just the version number if possible
	parts := strings.Fields(version)
	if len(parts) > 0 {
		for _, p := range parts {
			if len(p) > 0 && (p[0] == 'v' || (p[0] >= '0' && p[0] <= '9')) {
				return p, nil
			}
		}
	}
	return version, nil
}
