package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Tasks ====================

func (a *App) GetTasks() []*Task {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]*Task, len(a.tasks))
	for i, t := range a.tasks {
		copy := *t
		result[i] = &copy
	}
	return result
}

func (a *App) CreateTask(name, description, command, schedule string) (*Task, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	task := &Task{
		ID:          fmt.Sprintf("task_%d", time.Now().UnixNano()),
		Name:        name,
		Description: description,
		Command:     command,
		Schedule:    schedule,
		Enabled:     true,
		Status:      "pending",
	}

	a.tasks = append(a.tasks, task)
	return task, nil
}

func (a *App) DeleteTask(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, t := range a.tasks {
		if t.ID == id {
			a.tasks = append(a.tasks[:i], a.tasks[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("task not found")
}

func (a *App) ToggleTask(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, t := range a.tasks {
		if t.ID == id {
			t.Enabled = enabled
			return nil
		}
	}
	return fmt.Errorf("task not found")
}

func (a *App) RunTaskNow(id string) error {
	var command string
	var found bool

	a.mu.Lock()
	for _, t := range a.tasks {
		if t.ID == id {
			t.Status = "running"
			t.LastRun = time.Now().Unix()
			command = t.Command
			found = true
			break
		}
	}
	if !found {
		a.mu.Unlock()
		return fmt.Errorf("task not found: %s", id)
	}
	taskID := id
	taskName := ""
	for _, t := range a.tasks {
		if t.ID == id {
			taskName = t.Name
			break
		}
	}
	a.mu.Unlock()

	if command == "" {
		a.mu.Lock()
		for _, t := range a.tasks {
			if t.ID == taskID {
				t.Status = "error"
				break
			}
		}
		a.mu.Unlock()
		return fmt.Errorf("任务 %s 没有配置命令", taskName)
	}

	go func() {
		startTime := time.Now()
		fmt.Printf("[Task] 开始执行任务: %s (ID: %s)\n", taskName, taskID)

		var workDir string
		var shell, flag string
		a.mu.Lock()
		if len(a.projects) > 0 {
			workDir = a.projects[0].Path
		}
		a.mu.Unlock()

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

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx, shell, flag, command)
		if workDir != "" {
			cmd.Dir = workDir
		}
		cmd.Env = append(os.Environ(), a.getCustomEnvVars()...)

		output, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Round(time.Second)

		a.mu.Lock()
		for _, t := range a.tasks {
			if t.ID == taskID {
				if err != nil {
					t.Status = "error"
					t.LastError = strings.TrimSpace(string(output))
					if t.LastError == "" {
						t.LastError = err.Error()
					}
					fmt.Printf("[Task] 任务 %s 执行失败 (%v): %s\n", taskName, err, t.LastError)
				} else {
					t.Status = "completed"
					t.LastError = ""
					fmt.Printf("[Task] 任务 %s 执行完成 (耗时: %s, 输出: %d bytes)\n", taskName, duration, len(output))
				}
				break
			}
		}
		a.mu.Unlock()

		trimmedOutput := strings.TrimSpace(string(output))
		if len(trimmedOutput) > 2000 {
			trimmedOutput = trimmedOutput[:2000]
		}

		wailsRuntime.EventsEmit(a.ctx, "task-completed", map[string]interface{}{
			"id":       taskID,
			"name":     taskName,
			"status":   func() string { a.mu.Lock(); defer a.mu.Unlock(); for _, t := range a.tasks { if t.ID == taskID { return t.Status } }; return "unknown" }(),
			"duration": duration.String(),
			"output":   trimmedOutput,
		})
	}()

	return nil
}

// StartTaskScheduler 启动定时任务调度器
func (a *App) StartTaskScheduler(stopCh <-chan struct{}) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		defer close(done)

		for {
			select {
			case <-ticker.C:
				a.checkAndRunScheduledTasks()
			case <-stopCh:
				return
			}
		}
	}()
	return done
}

func (a *App) checkAndRunScheduledTasks() {
	now := time.Now()
	var tasksToRun []struct {
		id      string
		name    string
		command string
	}

	a.mu.Lock()
	for _, t := range a.tasks {
		if !t.Enabled || t.Status == "running" || t.Schedule == "" || t.Command == "" {
			continue
		}
		nextRun := a.parseNextRun(t.Schedule, t.LastRun)
		if nextRun.IsZero() || now.After(nextRun) || now.Equal(nextRun) {
			tasksToRun = append(tasksToRun, struct {
				id      string
				name    string
				command string
			}{t.ID, t.Name, t.Command})
		}
	}
	a.mu.Unlock()

	for _, task := range tasksToRun {
		fmt.Printf("[Scheduler] 定时任务触发: %s\n", task.name)
		a.RunTaskNow(task.id)
	}
}

func (a *App) parseNextRun(schedule string, lastRun int64) time.Time {
	if lastRun == 0 {
		return time.Time{}
	}

	last := time.Unix(lastRun, 0)
	schedule = strings.TrimSpace(strings.ToLower(schedule))

	switch {
	case schedule == "hourly":
		return last.Add(1 * time.Hour)

	case schedule == "daily":
		return last.Add(24 * time.Hour)

	case strings.HasPrefix(schedule, "every "):
		intervalStr := strings.TrimPrefix(schedule, "every ")
		if d, err := time.ParseDuration(intervalStr); err == nil && d >= time.Minute {
			return last.Add(d)
		}

	case strings.HasPrefix(schedule, "daily "):
		timeStr := strings.TrimPrefix(schedule, "daily ")
		if t, err := time.Parse("15:04", timeStr); err == nil {
			next := time.Date(last.Year(), last.Month(), last.Day(), t.Hour(), t.Minute(), 0, 0, last.Location())
			if next.Before(last) || next.Equal(last) {
				next = next.Add(24 * time.Hour)
			}
			return next
		}
	case strings.Contains(schedule, " ") && len(schedule) == 5:
		if _, err := time.Parse("15:04", schedule[:5]); err == nil {
			if t, err := time.Parse("15:04", schedule); err == nil {
				next := time.Date(last.Year(), last.Month(), last.Day(), t.Hour(), t.Minute(), 0, 0, last.Location())
				if next.Before(last) || next.Equal(last) {
					next = next.Add(24 * time.Hour)
				}
				return next
			}
		}
	}

	return time.Time{}
}

// ==================== Task Templates ====================

// TaskTemplate is a pre-defined automation template
type TaskTemplate struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Command     string `json:"command"`
	Schedule    string `json:"schedule"`
	Category    string `json:"category"`
}

// GetTaskTemplates returns pre-defined automation templates
func (a *App) GetTaskTemplates() []TaskTemplate {
	return []TaskTemplate{
		{
			Name:        "Git 自动拉取",
			Description: "定时从远程仓库拉取最新代码",
			Command:     "git pull --rebase",
			Schedule:    "every 30m",
			Category:    "git",
		},
		{
			Name:        "依赖检查",
			Description: "检查项目依赖是否有安全漏洞",
			Command:     "npm audit --production",
			Schedule:    "daily 09:00",
			Category:    "security",
		},
		{
			Name:        "构建项目",
			Description: "定时编译构建项目确保代码健康",
			Command:     "npm run build",
			Schedule:    "daily 08:00",
			Category:    "build",
		},
		{
			Name:        "运行测试",
			Description: "定时执行测试套件",
			Command:     "npm test -- --watchAll=false",
			Schedule:    "every 2h",
			Category:    "testing",
		},
		{
			Name:        "清理临时文件",
			Description: "定期清理构建产物和临时缓存",
			Command:     "rm -rf dist/ .cache/ tmp/",
			Schedule:    "daily 23:00",
			Category:    "maintenance",
		},
		{
			Name:        "数据库备份",
			Description: "定时备份数据库文件",
			Command:     "cp database.db database_backup_$(date +%Y%m%d).db",
			Schedule:    "daily 02:00",
			Category:    "backup",
		},
	}
}

// ==================== Task CRUD Enhancement ====================

// UpdateTask updates an existing task's properties
func (a *App) UpdateTask(id, name, description, command, schedule string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, t := range a.tasks {
		if t.ID == id {
			if name != "" {
				t.Name = name
			}
			if description != "" {
				t.Description = description
			}
			if command != "" {
				t.Command = command
			}
			if schedule != "" {
				t.Schedule = schedule
			}
			return nil
		}
	}
	return fmt.Errorf("task not found: %s", id)
}

// PauseAllTasks disables all tasks
func (a *App) PauseAllTasks() int {
	a.mu.Lock()
	defer a.mu.Unlock()

	count := 0
	for _, t := range a.tasks {
		if t.Enabled {
			t.Enabled = false
			count++
		}
	}
	return count
}

// ResumeAllTasks enables all tasks
func (a *App) ResumeAllTasks() int {
	a.mu.Lock()
	defer a.mu.Unlock()

	count := 0
	for _, t := range a.tasks {
		if !t.Enabled {
			t.Enabled = true
			count++
		}
	}
	return count
}

// GetTaskStats returns statistics about task execution
func (a *App) GetTaskStats() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()

	total := len(a.tasks)
	enabled := 0
	running := 0
	errored := 0
	completed := 0

	for _, t := range a.tasks {
		if t.Enabled {
			enabled++
		}
		switch t.Status {
		case "running":
			running++
		case "error":
			errored++
		case "completed":
			completed++
		}
	}

	return map[string]interface{}{
		"total":     total,
		"enabled":   enabled,
		"running":   running,
		"errored":   errored,
		"completed": completed,
	}
}

// ==================== Enhanced Cron Parsing ====================

// parseCronSchedule provides enhanced schedule parsing beyond the existing parseNextRun.
// Supports: "cron HH:MM weekdays", "weekdays HH:MM", "every Xm/Xh"
func (a *App) parseCronSchedule(schedule string, lastRun int64) time.Time {
	// First try the existing parser
	if result := a.parseNextRun(schedule, lastRun); !result.IsZero() {
		return result
	}

	schedule = strings.TrimSpace(strings.ToLower(schedule))
	last := time.Unix(lastRun, 0)
	now := time.Now()

	// "weekdays HH:MM" - Run on Mon-Fri at specified time
	if strings.HasPrefix(schedule, "weekdays ") {
		timeStr := strings.TrimPrefix(schedule, "weekdays ")
		t, err := time.Parse("15:04", timeStr)
		if err != nil {
			return time.Time{}
		}

		// Find next weekday at that time
		next := time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, now.Location())
		if next.Before(now) || next.Equal(now) {
			next = next.Add(24 * time.Hour)
		}
		// Skip weekends
		for next.Weekday() == time.Saturday || next.Weekday() == time.Sunday {
			next = next.Add(24 * time.Hour)
		}
		return next
	}

	// "weekend HH:MM" - Run on Sat-Sun at specified time
	if strings.HasPrefix(schedule, "weekend ") {
		timeStr := strings.TrimPrefix(schedule, "weekend ")
		t, err := time.Parse("15:04", timeStr)
		if err != nil {
			return time.Time{}
		}

		next := time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, now.Location())
		if next.Before(now) || next.Equal(now) {
			next = next.Add(24 * time.Hour)
		}
		for next.Weekday() != time.Saturday && next.Weekday() != time.Sunday {
			next = next.Add(24 * time.Hour)
		}
		return next
	}

	// "weekly DAY HH:MM" - Run on specific weekday
	if strings.HasPrefix(schedule, "weekly ") {
		parts := strings.Fields(strings.TrimPrefix(schedule, "weekly "))
		if len(parts) >= 2 {
			dayMap := map[string]time.Weekday{
				"mon": time.Monday, "tue": time.Tuesday, "wed": time.Wednesday,
				"thu": time.Thursday, "fri": time.Friday, "sat": time.Saturday, "sun": time.Sunday,
			}
			day, ok := dayMap[parts[0]]
			if !ok {
				return time.Time{}
			}
			t, err := time.Parse("15:04", parts[1])
			if err != nil {
				return time.Time{}
			}

			next := time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, now.Location())
			for next.Weekday() != day || next.Before(now) || next.Equal(now) {
				next = next.Add(24 * time.Hour)
			}
			return next
		}
	}

	// "interval Xm/Xh after last" - More explicit interval syntax
	if strings.HasPrefix(schedule, "interval ") {
		intervalStr := strings.TrimPrefix(schedule, "interval ")
		if d, err := time.ParseDuration(intervalStr); err == nil && d >= time.Minute {
			next := last.Add(d)
			if next.Before(now) {
				// If we missed the window, schedule from now
				return now.Add(d)
			}
			return next
		}
	}

	return time.Time{}
}
