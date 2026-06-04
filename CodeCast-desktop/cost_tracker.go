package main

import (
	"log/slog"

	ap "agentprimordia/pkg"
)

// initCostTracker sets up AP CostTracker for LLM usage and cost monitoring.
func (a *App) initCostTracker() {
	pricing := ap.DefaultPricingTable()
	budget := &ap.BudgetConfig{
		MaxTotalCostUSD:     0,
		MaxTokensPerCall:    0,
		MaxTokensPerSession: 0,
		OnBudgetExceed: func(summary *ap.CostSummary) {
			slog.Warn("LLM budget exceeded",
				"total_cost_usd", summary.TotalCostUSD,
				"total_tokens", summary.TotalTokens,
				"call_count", summary.CallCount,
			)
		},
	}
	a.costTracker = ap.NewCostTracker(pricing, budget)
	slog.Info("AP CostTracker 已启动", "pricing_models", len(pricing))
}

// GetCostSummary returns the current cost summary.
func (a *App) GetCostSummary() *ap.CostSummary {
	if a.costTracker == nil {
		return &ap.CostSummary{ByModel: make(map[string]*ap.ModelCost)}
	}
	return a.costTracker.Summary()
}

// ResetCostTracker resets all cost tracking data.
func (a *App) ResetCostTracker() {
	if a.costTracker != nil {
		a.costTracker.Reset()
		slog.Info("AP CostTracker 已重置")
	}
}

// CheckBudgetExceeded returns true if the configured budget has been exceeded.
func (a *App) CheckBudgetExceeded() bool {
	if a.costTracker == nil {
		return false
	}
	return a.costTracker.CheckBudget()
}

// GetBudgetConfig returns the current budget configuration.
func (a *App) GetBudgetConfig() ap.BudgetConfig {
	a.mu.RLock()
	budget := a.budgetConfig
	a.mu.RUnlock()
	if budget == nil {
		return ap.BudgetConfig{}
	}
	return *budget
}

// SetBudgetConfig updates the budget configuration.
func (a *App) SetBudgetConfig(budget *ap.BudgetConfig) {
	if budget == nil {
		return
	}
	a.mu.Lock()
	a.budgetConfig = budget
	a.mu.Unlock()

	pricing := ap.DefaultPricingTable()
	if budget.OnBudgetExceed == nil {
		budget.OnBudgetExceed = func(summary *ap.CostSummary) {
			slog.Warn("LLM budget exceeded",
				"total_cost_usd", summary.TotalCostUSD,
				"total_tokens", summary.TotalTokens,
			)
		}
	}
	a.costTracker = ap.NewCostTracker(pricing, budget)
	slog.Info("AP CostTracker budget updated", "max_cost_usd", budget.MaxTotalCostUSD)
}

// SetBudgetLimit is a convenience Wails binding to set just the cost limit.
func (a *App) SetBudgetLimit(maxCostUSD float64) {
	current := a.GetBudgetConfig()
	current.MaxTotalCostUSD = maxCostUSD
	a.SetBudgetConfig(&current)
}
