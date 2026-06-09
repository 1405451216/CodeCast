package main

import (
	"log/slog"

	ap "agentprimordia/pkg"
)

// BudgetConfigDTO is the JSON-safe budget configuration exposed to the frontend.
// ap.BudgetConfig contains a func field (OnBudgetExceed) which cannot be serialized,
// so we project only the data fields the UI needs.
type BudgetConfigDTO struct {
	MaxCostUSD          float64 `json:"maxCostUSD"`
	AlertThreshold      float64 `json:"alertThreshold"`
	EnforcementEnabled  bool    `json:"enforcementEnabled"`
	MaxTokensPerCall    int     `json:"maxTokensPerCall"`
	MaxTokensPerSession int     `json:"maxTokensPerSession"`
}

// budgetToDTO converts an ap.BudgetConfig to a JSON-safe DTO.
// AlertThreshold and EnforcementEnabled are stored at the application layer
// since AP's BudgetConfig does not have these fields.
func budgetToDTO(b *ap.BudgetConfig, alertThreshold float64, enforcementEnabled bool) BudgetConfigDTO {
	if b == nil {
		return BudgetConfigDTO{
			AlertThreshold:     alertThreshold,
			EnforcementEnabled: enforcementEnabled,
		}
	}
	return BudgetConfigDTO{
		MaxCostUSD:          b.MaxTotalCostUSD,
		AlertThreshold:      alertThreshold,
		EnforcementEnabled:  enforcementEnabled,
		MaxTokensPerCall:    b.MaxTokensPerCall,
		MaxTokensPerSession: b.MaxTokensPerSession,
	}
}

// dtoToBudgetConfig converts a DTO back to ap.BudgetConfig, preserving the
// OnBudgetExceed callback from the current app config.
func dtoToBudgetConfig(dto BudgetConfigDTO, current *ap.BudgetConfig) *ap.BudgetConfig {
	cb := defaultBudgetCallback
	if current != nil && current.OnBudgetExceed != nil {
		cb = current.OnBudgetExceed
	}
	return &ap.BudgetConfig{
		MaxTotalCostUSD:     dto.MaxCostUSD,
		MaxTokensPerCall:    dto.MaxTokensPerCall,
		MaxTokensPerSession: dto.MaxTokensPerSession,
		OnBudgetExceed:      cb,
	}
}

func defaultBudgetCallback(summary *ap.CostSummary) {
	slog.Warn("LLM budget exceeded",
		"total_cost_usd", summary.TotalCostUSD,
		"total_tokens", summary.TotalTokens,
		"call_count", summary.CallCount,
	)
}

// initCostTracker sets up AP CostTracker for LLM usage and cost monitoring.
func (a *App) initCostTracker() {
	pricing := ap.DefaultPricingTable()
	budget := &ap.BudgetConfig{
		MaxTotalCostUSD:     0,
		MaxTokensPerCall:    0,
		MaxTokensPerSession: 0,
		OnBudgetExceed:      defaultBudgetCallback,
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

// GetBudgetConfig returns the current budget configuration (JSON-safe DTO).
func (a *App) GetBudgetConfig() BudgetConfigDTO {
	a.mu.RLock()
	budget := a.budgetConfig
	alertThreshold := a.budgetAlertThreshold
	enforcementEnabled := a.budgetEnforcementEnabled
	a.mu.RUnlock()
	return budgetToDTO(budget, alertThreshold, enforcementEnabled)
}

// SetBudgetConfig updates the budget configuration.
// H13 fix: preserve the existing CostTracker instance when updating budget config
// to avoid discarding all accumulated cost-tracking data. The budget limits are
// updated via a shared pointer—CheckBudget reads the latest limits on each call.
func (a *App) SetBudgetConfig(dto BudgetConfigDTO) {
	slog.Debug("[COST] SetBudgetConfig start", "max_cost_usd", dto.MaxCostUSD)

	a.mu.Lock()
	defer a.mu.Unlock()

	// Preserve existing CostTracker so accumulated cost data is not lost.
	// BudgetConfig fields are updated in-place so CostTracker (which holds
	// a pointer) sees the new limits on its next CheckBudget call.
	if a.budgetConfig != nil {
		a.budgetConfig.MaxTotalCostUSD = dto.MaxCostUSD
		a.budgetConfig.MaxTokensPerCall = dto.MaxTokensPerCall
		a.budgetConfig.MaxTokensPerSession = dto.MaxTokensPerSession
	} else {
		a.budgetConfig = dtoToBudgetConfig(dto, nil)
		// Only create a new CostTracker if one doesn't exist yet
		if a.costTracker == nil {
			pricing := ap.DefaultPricingTable()
			a.costTracker = ap.NewCostTracker(pricing, a.budgetConfig)
		}
	}
	a.budgetAlertThreshold = dto.AlertThreshold
	a.budgetEnforcementEnabled = dto.EnforcementEnabled

	slog.Debug("[COST] SetBudgetConfig done", "max_cost_usd", a.budgetConfig.MaxTotalCostUSD, "alert_threshold", dto.AlertThreshold, "enforcement", dto.EnforcementEnabled)
}

// SetBudgetLimit is a convenience Wails binding to set just the cost limit.
func (a *App) SetBudgetLimit(maxCostUSD float64) {
	current := a.GetBudgetConfig()
	current.MaxCostUSD = maxCostUSD
	a.SetBudgetConfig(current)
}
