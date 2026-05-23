package main

import (
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
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
