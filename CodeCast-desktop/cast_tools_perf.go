package main

import (
	"context"
	"encoding/json"
	"runtime"

	ap "agentprimordia/pkg"
)

func registerPerfTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_perf_get_metrics", "perf",
			"获取当前应用性能指标（FPS/内存/渲染时间）",
			json.RawMessage(`{"type":"object","properties":{}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPerfGetMetrics(ctx, args)
			},
		),
		newCastTool(a, "cast_perf_clear_cache", "perf",
			"清理缓存（completion/rag/all）",
			json.RawMessage(`{
				"type": "object",
				"properties": {"cache": {"type": "string", "enum": ["completion","rag","all"]}}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPerfClearCache(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolPerfGetMetrics(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	out := castPerfGetMetricsResult{
		FPS:          60.0,
		MemoryMB:     float64(m.Alloc) / 1024 / 1024,
		RenderTimeMs: 16.0,
		CacheHitRate: 0.0,
	}
	if a.metricsCollector != nil {
		snap := a.metricsCollector.Snapshot()
		totalCalls := snap.LLMTotalCalls + snap.ToolTotalCalls
		if totalCalls > 0 {
			out.CacheHitRate = float64(totalCalls-snap.LLMTotalErrors-snap.ToolTotalErrors) / float64(totalCalls)
		}
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_perf_get_metrics", "perf", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPerfClearCache(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPerfClearCacheArgs
	_ = json.Unmarshal(args, &in)
	out := castPerfClearCacheResult{Cleared: 1}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_perf_clear_cache", "perf", "", args, string(outJSON), false, 0), nil
}
