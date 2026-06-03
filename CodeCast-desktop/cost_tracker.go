package main

import (
	ap "agentprimordia/pkg"
)

// initCostTracker sets up AP CostTracker for LLM usage monitoring.
func (a *App) initCostTracker() {
	// CostTracker is configured as part of ReActConfig.CostTracker
	// It hooks into the Agent lifecycle to track token usage and costs
	// per session, per model, and globally.
}
