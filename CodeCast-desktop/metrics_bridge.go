package main

import (
	"fmt"
	"time"

	ap "agentprimordia/pkg"
)

// apMetricsBridge delegates all metrics operations to AP's AgentMetricsCollector.
// This replaces the custom PerformanceMonitor from metrics.go.
type apMetricsBridge struct {
	collector *ap.AgentMetricsCollector
}

var globalMetricsBridge *apMetricsBridge

// initAPMetricsBridge initializes the global metrics bridge with an AP collector.
func initAPMetricsBridge(collector *ap.AgentMetricsCollector) {
	globalMetricsBridge = &apMetricsBridge{collector: collector}
}

// RecordCommandExecution records a command execution metric.
func RecordCommandExecution(command string, durationMs int64, success bool) {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return
	}
	var err error
	if !success {
		err = fmt.Errorf("command %s failed", command)
	}
	globalMetricsBridge.collector.RecordToolCall(time.Duration(durationMs)*time.Millisecond, err)
}

// RecordCommandBlocked records a blocked command.
func RecordCommandBlocked(command string) {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return
	}
	// Tracked as a failed tool call so it appears in ToolTotalErrors.
	globalMetricsBridge.collector.RecordToolCall(0, fmt.Errorf("command %s blocked", command))
}

// RecordLLMRequest records an LLM API call.
func RecordLLMRequest(model string, promptTokens, completionTokens int64, durationMs int64, err error) {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return
	}
	globalMetricsBridge.collector.RecordLLMCall(time.Duration(durationMs)*time.Millisecond, err)
	if promptTokens > 0 || completionTokens > 0 {
		globalMetricsBridge.collector.RecordTokenUsage(model, int(promptTokens), int(completionTokens))
	}
}

// UpdateActiveSessions updates the active sessions gauge.
func UpdateActiveSessions(count int) {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return
	}
	globalMetricsBridge.collector.SetPoolQueue(int64(count))
}

// UpdateMemoryUsage updates the memory usage gauge.
func UpdateMemoryUsage(bytes int64) {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return
	}
	globalMetricsBridge.collector.SetMemorySize(bytes)
}

// GetPerformanceStats returns performance statistics for the frontend,
// delegating to AP's MetricsSnapshot.
func GetPerformanceStats() PerformanceStats {
	if globalMetricsBridge == nil || globalMetricsBridge.collector == nil {
		return PerformanceStats{}
	}
	snap := globalMetricsBridge.collector.Snapshot()

	successRate := float64(0)
	totalCalls := snap.ToolTotalCalls + snap.LLMTotalCalls
	totalErrors := snap.ToolTotalErrors + snap.LLMTotalErrors
	if totalCalls > 0 {
		successRate = float64(totalCalls-totalErrors) / float64(totalCalls) * 100
	}

	avgLatency := float64(0)
	if snap.ToolLatencyMs.Count > 0 {
		avgLatency = float64(snap.ToolLatencyMs.Sum) / float64(snap.ToolLatencyMs.Count)
	}

	return PerformanceStats{
		Uptime:            time.Since(startTime),
		TotalRequests:     uint64(snap.LLMTotalCalls),
		TotalCommands:     uint64(snap.ToolTotalCalls),
		BlockedCommands:   uint64(snap.ToolTotalErrors),
		TotalErrors:       uint64(totalErrors),
		SuccessRate:       successRate,
		AverageLatency:    avgLatency,
		LLMLatencyP50:     histogramPercentile(snap.LLMLatencyMs, 0.50),
		LLMLatencyP95:     histogramPercentile(snap.LLMLatencyMs, 0.95),
		LLMLatencyP99:     histogramPercentile(snap.LLMLatencyMs, 0.99),
		CommandLatencyP50: histogramPercentile(snap.ToolLatencyMs, 0.50),
		CommandLatencyP95: histogramPercentile(snap.ToolLatencyMs, 0.95),
		CommandLatencyP99: histogramPercentile(snap.ToolLatencyMs, 0.99),
		ActiveAlerts:      0,
		GeneratedAt:       time.Now(),
	}
}
