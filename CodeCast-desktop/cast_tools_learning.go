package main

import (
	"context"
	"encoding/json"
	"sync"

	ap "agentprimordia/pkg"
)

// castLearningStore 简单学习模式存储（生产应持久化到 SQLite）
var (
	learningMu      sync.RWMutex
	learningPatterns = map[string]*castLearningPattern{}
)

type castLearningPattern struct {
	Pattern  string `json:"pattern"`
	Count    int    `json:"count"`
	LastUsed int64  `json:"lastUsed"`
}

func registerLearningTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_learning_get_patterns", "learning",
			"获取用户常用操作模式",
			json.RawMessage(`{
				"type": "object",
				"properties": {"limit": {"type": "integer"}}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolLearningGetPatterns(ctx, args)
			},
		),
		newCastTool(a, "cast_learning_clear", "learning",
			"清空学习数据",
			json.RawMessage(`{"type":"object","properties":{}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolLearningClear(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolLearningGetPatterns(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castLearningGetPatternsArgs
	_ = json.Unmarshal(args, &in)
	limit := in.Limit
	if limit <= 0 {
		limit = 20
	}
	learningMu.RLock()
	defer learningMu.RUnlock()
	out := castLearningGetPatternsResult{}
	for _, p := range learningPatterns {
		out.Patterns = append(out.Patterns, struct {
			Pattern  string `json:"pattern"`
			Count    int    `json:"count"`
			LastUsed int64  `json:"lastUsed"`
		}{p.Pattern, p.Count, p.LastUsed})
		if len(out.Patterns) >= limit {
			break
		}
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_learning_get_patterns", "learning", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolLearningClear(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	learningMu.Lock()
	learningPatterns = map[string]*castLearningPattern{}
	learningMu.Unlock()
	out := map[string]any{"cleared": true}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_learning_clear", "learning", "", args, string(outJSON), false, 0), nil
}
