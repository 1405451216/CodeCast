package main

// initCostTracker sets up AP CostTracker for LLM usage monitoring.
// CostTracker is configured as part of ReActConfig — this stub can be
// expanded once ap.CostTracker is exported from the public API.
func (a *App) initCostTracker() {
	// CostTracker hooks into the Agent lifecycle to track token usage
	// and costs per session, per model, and globally.
	// Will be initialized via ReActConfig.CostTracker when exported.
}
