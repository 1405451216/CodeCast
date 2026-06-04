package main

import (
	"fmt"
	"log/slog"
	"runtime"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	toast "git.sr.ht/~jackmordaunt/go-toast/v2"
)

// ==================== Notification System ====================

func (a *App) SendNotification(title, body, notifType string) {
	a.mu.Lock()
	turn := a.settings.NotificationTurn
	a.mu.Unlock()

	switch turn {
	case "off":
		return
	case "only_errors":
		if notifType != "error" && notifType != "warning" {
			return
		}
	}

	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": title,
		"body":  body,
		"type":  notifType,
	})

	// Send system-level notification for errors so the user sees it even when the window is not focused
	if notifType == "error" {
		SendSystemNotification(title, body)
	}
}

// SendSystemNotification sends an OS-native notification.
// On Windows it uses go-toast; on other platforms it logs a message.
func SendSystemNotification(title, body string) {
	if runtime.GOOS == "windows" {
		n := toast.Notification{
			AppID: "CodeCast",
			Title: title,
			Body:  body,
		}
		if err := n.Push(); err != nil {
			slog.Warn("system notification push failed", "error", err, "title", title)
		}
	} else {
		// go-toast is Windows-only; on other platforms we skip silently.
		// macOS/Linux native notifications can be added later.
		slog.Info("[SystemNotification]", "title", title, "body", body)
	}
}

func (a *App) NotifyAIQuestion(question string) {
	a.mu.Lock()
	enabled := a.settings.NotificationQuestion
	a.mu.Unlock()
	if !enabled {
		return
	}
	a.SendNotification("AI 有问题需要确认", question, "question")
}

func (a *App) NotifyPermissionNeeded(operation string) {
	a.mu.Lock()
	enabled := a.settings.NotificationPermission
	a.mu.Unlock()
	if !enabled {
		return
	}
	a.SendNotification("需要您的授权", operation+" 需要您确认后才能继续", "permission")
}

// ==================== Enhanced Notification Scenarios ====================

// NotifyTaskCompleted sends a notification when a scheduled task finishes
func (a *App) NotifyTaskCompleted(taskName, status, duration string) {
	a.mu.Lock()
	turn := a.settings.NotificationTurn
	a.mu.Unlock()

	if turn == "off" {
		return
	}

	notifType := "success"
	title := "任务完成"
	body := fmt.Sprintf("「%s」执行完成，耗时 %s", taskName, duration)

	if status == "error" {
		notifType = "error"
		title = "任务失败"
		body = fmt.Sprintf("「%s」执行失败，耗时 %s", taskName, duration)
	}

	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": title,
		"body":  body,
		"type":  notifType,
	})

	SendSystemNotification(title, body)
}

// NotifyUpdateAvailable sends a rich notification for available updates
func (a *App) NotifyUpdateAvailable(version string) {
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title":      fmt.Sprintf("CodeCast v%s 可用", version),
		"body":       "点击查看更新内容并下载",
		"type":       "info",
		"persistent": true,
		"actions": []map[string]string{
			{"label": "查看详情", "action": "show_update"},
			{"label": "稍后提醒", "action": "dismiss"},
		},
	})
}

// NotifyLongRunning sends a notification when a request is taking too long
func (a *App) NotifyLongRunning(sessionID string, elapsed time.Duration) {
	a.mu.Lock()
	turn := a.settings.NotificationTurn
	a.mu.Unlock()

	if turn == "off" {
		return
	}

	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title":      "AI 正在思考中...",
		"body":       fmt.Sprintf("当前请求已持续 %s，请耐心等待", elapsed.Round(time.Second)),
		"type":       "info",
		"session_id": sessionID,
	})
}

// NotifyEnvironmentIssue reports an environment problem to the user
func (a *App) NotifyEnvironmentIssue(name, message, fixURL string) {
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": fmt.Sprintf("环境问题: %s", name),
		"body":  message,
		"type":  "warning",
		"actions": []map[string]string{
			{"label": "修复指南", "action": "open_url:" + fixURL},
		},
	})
}

// NotifyMemoryFull warns when memory storage is getting large
func (a *App) NotifyMemoryFull(currentSize string, episodeCount int) {
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": "记忆存储空间较大",
		"body":  fmt.Sprintf("当前已存储 %d 条记忆 (%s)，建议清理旧数据", episodeCount, currentSize),
		"type":  "warning",
		"actions": []map[string]string{
			{"label": "前往清理", "action": "open_memory_settings"},
		},
	})
}

// NotifySecurityAlert sends a high-priority security notification
func (a *App) NotifySecurityAlert(title, detail string) {
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title":      "⚠️ 安全警告: " + title,
		"body":       detail,
		"type":       "error",
		"persistent": true,
	})
	SendSystemNotification("安全警告: "+title, detail)
}

// NotifySessionComplete notifies when a long-running session gets a response
func (a *App) NotifySessionComplete(sessionName string) {
	a.mu.Lock()
	notifyComplete := a.settings.NotifyComplete
	a.mu.Unlock()

	if notifyComplete == "never" {
		return
	}

	// "unfocused" means only notify when window is not focused
	// We always emit the event; the frontend decides based on focus state
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title":           "对话回复已完成",
		"body":            fmt.Sprintf("「%s」的回复已生成", sessionName),
		"type":            "success",
		"notify_mode":     notifyComplete,
		"system_notify":   true,
	})

	if notifyComplete == "always" {
		SendSystemNotification("回复已完成", fmt.Sprintf("「%s」的回复已生成", sessionName))
	}
}
