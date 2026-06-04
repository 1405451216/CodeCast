package main

import (
	"time"
)

// PerformanceStats holds performance statistics for the frontend (Wails binding).
// Populated by GetPerformanceStats() in metrics_bridge.go via AP's MetricsSnapshot.
type PerformanceStats struct {
	Uptime            time.Duration `json:"uptime"`
	TotalRequests     uint64        `json:"total_requests"`
	TotalCommands     uint64        `json:"total_commands"`
	BlockedCommands   uint64        `json:"blocked_commands"`
	TotalErrors       uint64        `json:"total_errors"`
	SuccessRate       float64       `json:"success_rate"`
	AverageLatency    float64       `json:"average_latency_ms"`
	LLMLatencyP50     float64       `json:"llm_latency_p50_ms"`
	LLMLatencyP95     float64       `json:"llm_latency_p95_ms"`
	LLMLatencyP99     float64       `json:"llm_latency_p99_ms"`
	CommandLatencyP50 float64       `json:"command_latency_p50_ms"`
	CommandLatencyP95 float64       `json:"command_latency_p95_ms"`
	CommandLatencyP99 float64       `json:"command_latency_p99_ms"`
	ActiveAlerts      int           `json:"active_alerts"`
	GeneratedAt       time.Time     `json:"generated_at"`
}

// startTime records when the application started, used for Uptime calculations.
var startTime = time.Now()
