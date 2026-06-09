package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Git Auto Commit ====================

func findGitRoot(filePath string) string {
	dir := filepath.Dir(filePath)
	for {
		if fi, err := os.Stat(filepath.Join(dir, ".git")); err == nil && fi.IsDir() {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func runGitCommand(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return string(output), err
}


func (a *App) executeGitCommit(gitRoot, filePath string) {
	relPath, _ := filepath.Rel(gitRoot, filePath)

	if output, err := runGitCommand(gitRoot, "add", filePath); err != nil {
		fmt.Printf("[Git] git add 失败: %s\n", output)
		wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
			"title": "Git 自动提交失败",
			"body":  fmt.Sprintf("git add %s 失败: %s", relPath, output),
			"type":  "error",
		})
		return
	}

	msg := fmt.Sprintf("CodeCast: 自动保存 %s", relPath)
	if output, err := runGitCommand(gitRoot, "commit", "-m", msg); err != nil {
		if strings.Contains(output, "nothing to commit") {
			return
		}
		fmt.Printf("[Git] git commit 失败: %s\n", output)
		wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
			"title": "Git 自动提交失败",
			"body":  fmt.Sprintf("git commit 失败: %s", output),
			"type":  "error",
		})
		return
	}

	fmt.Printf("[Git] 已自动提交: %s\n", relPath)
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": "Git 已自动提交",
		"body":  fmt.Sprintf("已提交: %s", relPath),
		"type":  "success",
	})
}

func (a *App) ConfirmGitCommit(filePath string) error {
	gitRoot := findGitRoot(filePath)
	if gitRoot == "" {
		return fmt.Errorf("未找到 git 仓库")
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("[Git] ConfirmGitCommit goroutine panic", "panic", r)
			}
		}()
		a.executeGitCommit(gitRoot, filePath)
	}()
	return nil
}

func (a *App) GetGitStatus() map[string]interface{} {
	result := map[string]interface{}{
		"enabled": false,
		"branch":  "",
		"dirty":   false,
		"ahead":   0,
		"behind":  0,
	}

	var projectDir string
	a.mu.RLock()
	if len(a.projects) > 0 {
		projectDir = a.projects[0].Path
	}
	a.mu.RUnlock()

	if projectDir == "" {
		return result
	}

	gitRoot := findGitRoot(projectDir)
	if gitRoot == "" {
		return result
	}

	result["enabled"] = true

	if branch, err := runGitCommand(gitRoot, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		result["branch"] = strings.TrimSpace(branch)
	}

	if status, err := runGitCommand(gitRoot, "status", "--porcelain"); err == nil {
		result["dirty"] = strings.TrimSpace(status) != ""
	}

	if ahead, err := runGitCommand(gitRoot, "rev-list", "--count", "@{upstream}..HEAD"); err == nil {
		var aheadCount int
		fmt.Sscanf(strings.TrimSpace(ahead), "%d", &aheadCount)
		result["ahead"] = aheadCount
	}

	if behind, err := runGitCommand(gitRoot, "rev-list", "--count", "HEAD..@{upstream}"); err == nil {
		var behindCount int
		fmt.Sscanf(strings.TrimSpace(behind), "%d", &behindCount)
		result["behind"] = behindCount
	}

	return result
}
