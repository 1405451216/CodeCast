package main

import (
	"context"
	"encoding/json"
	"sync"

	ap "agentprimordia/pkg"
)

var (
	soulMu   sync.RWMutex
	soulList = []*castSoulPersona{
		{ID: "friendly", Name: "友好", Description: "亲切自然的对话风格", IsActive: false},
		{ID: "professional", Name: "专业", Description: "严谨专业的技术回答", IsActive: true},
		{ID: "concise", Name: "简洁", Description: "精炼要点式回答", IsActive: false},
		{ID: "detailed", Name: "详细", Description: "深入全面的解释和示例", IsActive: false},
	}
)

type castSoulPersona struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    bool   `json:"isActive"`
}

func registerSoulTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_soul_set", "soul",
			"切换 AI 人格",
			json.RawMessage(`{
				"type": "object",
				"properties": {"persona": {"type": "string"}},
				"required": ["persona"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolSoulSet(ctx, args)
			},
		),
		newCastTool("cast_soul_list", "soul",
			"列出所有人格",
			json.RawMessage(`{"type":"object","properties":{}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolSoulList(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolSoulSet(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castSoulSetArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	soulMu.Lock()
	found := false
	for _, p := range soulList {
		if p.ID == in.Persona {
			p.IsActive = true
			found = true
		} else {
			p.IsActive = false
		}
	}
	soulMu.Unlock()
	if !found {
		return a.recordCastInvocation("cast_soul_set", "soul", "", args,
			"unknown persona: "+in.Persona, true, 0), nil
	}
	// 同步到 settings
	if a.settings != nil {
		a.settings.Personality = in.Persona
	}
	out := castSoulSetResult{Active: in.Persona}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_soul_set", "soul", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolSoulList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	soulMu.RLock()
	defer soulMu.RUnlock()
	out := castSoulListResult{}
	for _, p := range soulList {
		out.Personas = append(out.Personas, struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			IsActive    bool   `json:"isActive"`
		}{p.ID, p.Name, p.Description, p.IsActive})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_soul_list", "soul", "", args, string(outJSON), false, 0), nil
}
