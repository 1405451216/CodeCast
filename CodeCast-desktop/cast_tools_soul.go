package main

import (
	"context"
	"encoding/json"

	ap "agentprimordia/pkg"
)

var soulListStore *castPersistentStore[[]*castSoulPersona]

type castSoulPersona struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    bool   `json:"isActive"`
}

func registerSoulTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_soul_set", "soul",
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
		newCastTool(a, "cast_soul_list", "soul",
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
	var found bool
	soulListStore.Mutate(func(list []*castSoulPersona) {
		for _, p := range list {
			if p.ID == in.Persona {
				p.IsActive = true
				found = true
			} else {
				p.IsActive = false
			}
		}
	})
	if !found {
		return a.recordCastInvocation("cast_soul_set", "soul", "", args,
			"unknown persona: "+in.Persona, true, 0), nil
	}
	// 同步到 settings
	if a.settings != nil {
		a.mu.Lock()
		a.settings.Personality = in.Persona
		a.mu.Unlock()
	}
	out := castSoulSetResult{Active: in.Persona}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_soul_set", "soul", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolSoulList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	out := castSoulListResult{}
	soulListStore.Get(func(list []*castSoulPersona) {
		for _, p := range list {
			out.Personas = append(out.Personas, struct {
				ID          string `json:"id"`
				Name        string `json:"name"`
				Description string `json:"description"`
				IsActive    bool   `json:"isActive"`
			}{p.ID, p.Name, p.Description, p.IsActive})
		}
	})
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_soul_list", "soul", "", args, string(outJSON), false, 0), nil
}
