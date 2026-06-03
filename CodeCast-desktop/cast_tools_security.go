package main

import (
	"context"
	"encoding/json"
	"sync"

	ap "agentprimordia/pkg"
)

var (
	securityMu       sync.RWMutex
	securityEvents   = []castSecurityEvent{}
	securityStats    = castSecurityStats{ThreatsBlocked: 0, ThreatsAllowed: 0}
)

type castSecurityEvent struct {
	Timestamp int64  `json:"timestamp"`
	Command   string `json:"command"`
	Reason    string `json:"reason"`
}

type castSecurityStats struct {
	ThreatsBlocked int            `json:"threatsBlocked"`
	ThreatsAllowed int            `json:"threatsAllowed"`
	TopPatterns    map[string]int `json:"topPatterns"`
}

func registerSecurityTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_security_audit", "security",
			"安全审计统计（近 1h/24h/7d）",
			json.RawMessage(`{
				"type": "object",
				"properties": {"range": {"type": "string", "enum": ["1h","24h","7d"]}}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolSecurityAudit(ctx, args)
			},
		),
		newCastTool(a, "cast_security_blocked_history", "security",
			"查看最近被拦截的危险命令",
			json.RawMessage(`{
				"type": "object",
				"properties": {"limit": {"type": "integer"}}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolSecurityBlockedHistory(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolSecurityAudit(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	securityMu.RLock()
	defer securityMu.RUnlock()
	out := castSecurityAuditResult{
		ThreatsBlocked: securityStats.ThreatsBlocked,
		ThreatsAllowed: securityStats.ThreatsAllowed,
	}
	for pat, cnt := range securityStats.TopPatterns {
		out.TopPatterns = append(out.TopPatterns, struct {
			Pattern string `json:"pattern"`
			Count   int    `json:"count"`
		}{pat, cnt})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_security_audit", "security", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolSecurityBlockedHistory(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castSecurityBlockedHistoryArgs
	_ = json.Unmarshal(args, &in)
	limit := in.Limit
	if limit <= 0 {
		limit = 50
	}
	securityMu.RLock()
	defer securityMu.RUnlock()
	out := castSecurityBlockedHistoryResult{}
	for i := len(securityEvents) - 1; i >= 0 && len(out.Events) < limit; i-- {
		ev := securityEvents[i]
		out.Events = append(out.Events, struct {
			Timestamp int64  `json:"timestamp"`
			Command   string `json:"command"`
			Reason    string `json:"reason"`
		}{ev.Timestamp, ev.Command, ev.Reason})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_security_blocked_history", "security", "", args, string(outJSON), false, 0), nil
}
