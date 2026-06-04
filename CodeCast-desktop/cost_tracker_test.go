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
	if config.MaxTotalCostUSD != 0 {
		t.Errorf("expected 0 MaxTotalCostUSD, got %f", config.MaxTotalCostUSD)
	}
}

func TestSetBudgetConfig(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}
	newBudget := &ap.BudgetConfig{
		MaxTotalCostUSD: 10.0,
	}
	app.SetBudgetConfig(newBudget)
	config := app.GetBudgetConfig()
	if config.MaxTotalCostUSD != 10.0 {
		t.Errorf("expected 10.0 MaxTotalCostUSD, got %f", config.MaxTotalCostUSD)
	}
}
