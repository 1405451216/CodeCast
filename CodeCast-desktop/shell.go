package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

var dangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\brm\s+-rf\s+/`),
	regexp.MustCompile(`\bmkfs\b`),
	regexp.MustCompile(`\bshutdown\s`),
	regexp.MustCompile(`\breboot\b`),
	regexp.MustCompile(`\bdel\s+/`),
	regexp.MustCompile(`:\(\)\{.*:\|.*\}`),
	regexp.MustCompile(`>\s*/dev/`),
	regexp.MustCompile(`curl\s.*\|\s*sh`),
	regexp.MustCompile(`wget\s.*\|\s*sh`),
}

// ==================== Computer Control (Shell Execution) ====================

func (a *App) ExecuteCommand(command string, timeoutSeconds int) (string, error) {
	a.mu.Lock()
	enabled := a.settings.ComputerControl
	a.mu.Unlock()

	if !enabled {
		return "", fmt.Errorf("计算机控制功能未开启，请在设置中启用")
	}

	var workDir string
	a.mu.Lock()
	if len(a.projects) > 0 {
		workDir = a.projects[0].Path
	}
	noProjectMode := a.noProjectMode
	a.mu.Unlock()

	if workDir == "" && !noProjectMode {
		return "", fmt.Errorf("未选择项目目录")
	}

	cmdLower := strings.ToLower(command)
	for _, re := range dangerousPatterns {
		if re.MatchString(cmdLower) {
			return "", fmt.Errorf("命令被安全策略拦截: 包含危险模式")
		}
	}

	command = sanitizeWindowsCommand(command)

	var shell, flag string
	if runtime.GOOS == "windows" {
		shell = "cmd"
		flag = "/C"
	} else {
		shell = os.Getenv("SHELL")
		if shell == "" {
			if runtime.GOOS == "darwin" {
				shell = "/bin/zsh"
			} else {
				shell = "/bin/bash"
			}
		}
		flag = "-c"
	}

	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, flag, command)
	cmd.Dir = workDir
	cmd.Env = append(os.Environ(), a.getCustomEnvVars()...)

	output, err := cmd.CombinedOutput()
	result := string(output)

	if ctx.Err() == context.DeadlineExceeded {
		return result + "\n[命令执行超时]", fmt.Errorf("command timed out after %ds", timeoutSeconds)
	}
	if err != nil {
		return result, fmt.Errorf("command failed: %w", err)
	}

	fmt.Printf("[Shell] 执行命令: %s (输出: %d bytes)\n", command[:min(len(command), 50)], len(result))
	return result, nil
}

func (a *App) getCustomEnvVars() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	vars := make([]string, 0, len(a.settings.EnvVars))
	for _, ev := range a.settings.EnvVars {
		vars = append(vars, ev.Key+"="+ev.Value)
	}
	return vars
}

func sanitizeWindowsCommand(cmd string) string {
	if runtime.GOOS != "windows" {
		return cmd
	}
	replacer := strings.NewReplacer(
		"^", "^^",
		"&", "^&",
		"<", "^<",
		">", "^>",
		"|", "^|",
		"%", "%%",
	)
	return replacer.Replace(cmd)
}
