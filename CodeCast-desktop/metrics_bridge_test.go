package main

import (
	"errors"
	"testing"

	ap "agentprimordia/pkg"
)

func TestRecordCommandExecution_DelegatesToToolCall(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	RecordCommandExecution("ls", 150, true)
	RecordCommandExecution("rm", 50, false)

	snap := collector.Snapshot()
	if snap.ToolTotalCalls != 2 {
		t.Errorf("expected ToolTotalCalls=2, got %d", snap.ToolTotalCalls)
	}
	if snap.ToolTotalErrors != 1 {
		t.Errorf("expected ToolTotalErrors=1, got %d", snap.ToolTotalErrors)
	}
	if snap.ToolLatencyMs.Count != 2 {
		t.Errorf("expected ToolLatencyMs.Count=2, got %d", snap.ToolLatencyMs.Count)
	}
}

func TestRecordCommandBlocked_DelegatesToToolCall(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	RecordCommandBlocked("dangerous_cmd")

	snap := collector.Snapshot()
	if snap.ToolTotalCalls != 1 {
		t.Errorf("expected ToolTotalCalls=1, got %d", snap.ToolTotalCalls)
	}
	if snap.ToolTotalErrors != 1 {
		t.Errorf("expected ToolTotalErrors=1 (blocked=error), got %d", snap.ToolTotalErrors)
	}
}

func TestRecordLLMRequest_DelegatesToLLMCallAndTokenUsage(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	RecordLLMRequest("gpt-4", 100, 50, 200, nil)
	RecordLLMRequest("claude-3", 200, 100, 300, errors.New("timeout"))

	snap := collector.Snapshot()
	if snap.LLMTotalCalls != 2 {
		t.Errorf("expected LLMTotalCalls=2, got %d", snap.LLMTotalCalls)
	}
	if snap.LLMTotalErrors != 1 {
		t.Errorf("expected LLMTotalErrors=1, got %d", snap.LLMTotalErrors)
	}
	if snap.LLMLatencyMs.Count != 2 {
		t.Errorf("expected LLMLatencyMs.Count=2, got %d", snap.LLMLatencyMs.Count)
	}

	// Check token usage was recorded by reading the exported map directly
	// (same pattern as main.go GetAPMetricsSnapshot)
	if collector.TokenUsageByModel == nil {
		t.Fatal("expected TokenUsageByModel to be populated")
	}
	gptStats, ok := collector.TokenUsageByModel["gpt-4"]
	if !ok {
		t.Fatal("expected gpt-4 token stats")
	}
	if gptStats.PromptTokens != 100 || gptStats.CompletionTokens != 50 {
		t.Errorf("expected prompt=100 completion=50, got prompt=%d completion=%d",
			gptStats.PromptTokens, gptStats.CompletionTokens)
	}
}

func TestUpdateActiveSessions_DelegatesToPoolQueue(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	UpdateActiveSessions(5)

	snap := collector.Snapshot()
	if snap.PoolQueueLength != 5 {
		t.Errorf("expected PoolQueueLength=5, got %d", snap.PoolQueueLength)
	}
}

func TestUpdateMemoryUsage_DelegatesToMemorySize(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	UpdateMemoryUsage(1024 * 1024 * 512) // 512 MB in bytes

	snap := collector.Snapshot()
	if snap.MemorySizeBytes != 1024*1024*512 {
		t.Errorf("expected MemorySizeBytes=%d, got %d", 1024*1024*512, snap.MemorySizeBytes)
	}
}

func TestGetPerformanceStats_ReturnsStats(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	RecordCommandExecution("test", 100, true)
	RecordLLMRequest("model", 50, 25, 200, nil)

	stats := GetPerformanceStats()
	if stats.TotalCommands != 1 {
		t.Errorf("expected TotalCommands=1, got %d", stats.TotalCommands)
	}
	if stats.TotalRequests != 1 {
		t.Errorf("expected TotalRequests=1, got %d", stats.TotalRequests)
	}
	if stats.TotalErrors != 0 {
		t.Errorf("expected TotalErrors=0, got %d", stats.TotalErrors)
	}
	if stats.SuccessRate != 100.0 {
		t.Errorf("expected SuccessRate=100, got %f", stats.SuccessRate)
	}
	if stats.Uptime <= 0 {
		t.Error("expected positive Uptime")
	}
}

func TestNilCollectorSafety(t *testing.T) {
	// Reset the global bridge to nil
	globalMetricsBridge = nil

	// None of these should panic
	RecordCommandExecution("ls", 100, true)
	RecordCommandBlocked("rm")
	RecordLLMRequest("gpt-4", 100, 50, 200, nil)
	UpdateActiveSessions(3)
	UpdateMemoryUsage(1024)
	stats := GetPerformanceStats()
	if stats.TotalCommands != 0 {
		t.Errorf("expected zero stats with nil bridge, got TotalCommands=%d", stats.TotalCommands)
	}
}

func TestNilCollectorInBridge(t *testing.T) {
	// Bridge exists but collector is nil
	globalMetricsBridge = &apMetricsBridge{collector: nil}

	// None of these should panic
	RecordCommandExecution("ls", 100, true)
	RecordCommandBlocked("rm")
	RecordLLMRequest("gpt-4", 100, 50, 200, nil)
	UpdateActiveSessions(3)
	UpdateMemoryUsage(1024)
	_ = GetPerformanceStats()
}

func TestRecordLLMRequest_ZeroTokens_NoTokenUsage(t *testing.T) {
	collector := ap.NewMetrics()
	initAPMetricsBridge(collector)

	// Both token counts are zero — RecordTokenUsage should NOT be called
	RecordLLMRequest("gpt-4", 0, 0, 200, nil)

	snap := collector.Snapshot()
	if snap.LLMTotalCalls != 1 {
		t.Errorf("expected LLMTotalCalls=1, got %d", snap.LLMTotalCalls)
	}

	// TokenUsageByModel should be nil since no tokens were recorded
	if collector.TokenUsageByModel != nil && len(collector.TokenUsageByModel) != 0 {
		t.Errorf("expected no token usage entries, got %d", len(collector.TokenUsageByModel))
	}
}
