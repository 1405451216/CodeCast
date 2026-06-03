package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

func registerCollabTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_collab_share", "collab",
			"分享会话给协作者",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"sessionId": {"type": "string"},
					"peer":      {"type": "string", "description": "email 或 user id"},
					"mode":      {"type": "string", "enum": ["read","write"]}
				},
				"required": ["sessionId","peer"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolCollabShare(ctx, args)
			},
		),
		newCastTool("cast_collab_invite", "collab",
			"邀请协作者加入",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"email":   {"type": "string"},
					"message": {"type": "string"}
				},
				"required": ["email"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolCollabInvite(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolCollabShare(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castCollabShareArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	mode := orDefault(in.Mode, "read")
	link := fmt.Sprintf("codecast://collab/%s?peer=%s&mode=%s", in.SessionID, in.Peer, mode)
	out := castCollabShareResult{Link: link}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_collab_share", "collab", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolCollabInvite(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castCollabInviteArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	out := map[string]any{"email": in.Email, "invited": true, "message": in.Message}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_collab_invite", "collab", "", args, string(outJSON), false, 0), nil
}
