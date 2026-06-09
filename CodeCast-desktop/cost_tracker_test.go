package main

import (
	"context"
	"testing"

	ap "agentprimordia/pkg"
)

func TestInitCostTracker(t *testing.T) {
	app := &App{
		settings: &Settings{},
		ctx:      context.Background(),
	}
	app.initCostTracker()
	if app.costTracker == nil {
		t.Fatal("expected costTracker to be initialized")
	}
}

func TestGetCostSummaryEmpty(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}
	summary := app.GetCostSummary()
	if summary.TotalCostUSD != 0 {
		t.Errorf("expected 0 cost, got %f", summary.TotalCostUSD)
	}
	if summary.CallCount != 0 {
		t.Errorf("expected 0 calls, got %d", summary.CallCount)
	}
}

func TestResetCostTracker(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}
	app.ResetCostTracker()
	summary := app.GetCostSummary()
	if summary.CallCount != 0 {
		t.Errorf("expected 0 calls after reset, got %d", summary.CallCount)
	}
}

func TestGetBudgetConfig(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}
	config := app.GetBudgetConfig()
	if config.MaxCostUSD != 0 {
		t.Errorf("expected 0 MaxCostUSD, got %f", config.MaxCostUSD)
	}
}

func TestSetBudgetConfig(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}
	app.SetBudgetConfig(BudgetConfigDTO{MaxCostUSD: 10.0})
	config := app.GetBudgetConfig()
	if config.MaxCostUSD != 10.0 {
		t.Errorf("expected 10.0 MaxCostUSD, got %f", config.MaxCostUSD)
	}
}
