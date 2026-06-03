package main

import (
	"context"
	"encoding/json"

	ap "agentprimordia/pkg"
)

func registerMemoryTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_memory_search", "memory",
			"全文搜索 AP 记忆（SQLite FTS5）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"query": {"type": "string"},
					"limit": {"type": "integer"}
				},
				"required": ["query"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolMemorySearch(ctx, args)
			},
		),
		newCastTool("cast_memory_stats", "memory",
			"获取记忆系统统计",
			json.RawMessage(`{"type":"object","properties":{}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolMemoryStats(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolMemorySearch(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castMemorySearchArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}
	if a.memory == nil {
		return a.recordCastInvocation("cast_memory_search", "memory", "", args,
			"memory not initialized", true, 0), nil
	}
	episodes, err := a.memory.Search(ctx, in.Query, &ap.SearchOptions{
		Query: in.Query,
		Limit: limit,
	})
	if err != nil {
		return a.recordCastInvocation("cast_memory_search", "memory", "", args, err.Error(), true, 0), nil
	}
	out := castMemorySearchResult{}
	for _, ep := range episodes {
		out.Episodes = append(out.Episodes, struct {
			ID        string  `json:"id"`
			SessionID string  `json:"sessionId"`
			Role      string  `json:"role"`
			Content   string  `json:"content"`
			Timestamp int64   `json:"timestamp"`
			Score     float64 `json:"score"`
		}{ep.ID, ep.SessionID, ep.Role, truncate(ep.Content, 500), 0, ep.Importance})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_memory_search", "memory", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolMemoryStats(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	if a.memory == nil {
		return a.recordCastInvocation("cast_memory_stats", "memory", "", args,
			"memory not initialized", true, 0), nil
	}
	stats, err := a.memory.Stats(ctx)
	if err != nil {
		return a.recordCastInvocation("cast_memory_stats", "memory", "", args, err.Error(), true, 0), nil
	}
	out := castMemoryStatsResult{
		TotalEpisodes:  int(stats.TotalEpisodes),
		TotalSessions:  int(stats.TotalSessions),
		StorageBytes:   stats.SizeBytes,
		OldestTimestamp: 0,
		NewestTimestamp: 0,
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_memory_stats", "memory", "", args, string(outJSON), false, 0), nil
}
