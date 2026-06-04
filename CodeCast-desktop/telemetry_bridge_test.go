package main

import (
	"context"
	"testing"
)

func TestInitTelemetryDisabled(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled:  false,
			TelemetryEndpoint: "http://localhost:4318",
		},
		ctx: context.Background(),
	}

	app.initTelemetry()

	if app.telemetryProvider != nil {
		t.Error("expected nil telemetryProvider when telemetry is disabled")
	}
}

func TestGetTelemetryStatusDisabled(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled: false,
		},
	}

	status := app.GetTelemetryStatus()
	if status.Enabled {
		t.Error("expected Enabled=false when telemetry is disabled")
	}
}

func TestGetTelemetryStatusEnabledNoProvider(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled:  true,
			TelemetryEndpoint: "http://localhost:4318",
		},
	}

	status := app.GetTelemetryStatus()
	if !status.Enabled {
		t.Error("expected Enabled=true when settings.TelemetryEnabled is true")
	}
	if status.Endpoint != "http://localhost:4318" {
		t.Errorf("expected endpoint http://localhost:4318, got %s", status.Endpoint)
	}
	if status.Active {
		t.Error("expected Active=false when telemetryProvider is nil")
	}
}

func TestToggleTelemetry(t *testing.T) {
	app := &App{
		settings:    &Settings{TelemetryEnabled: false, TelemetryEndpoint: "http://localhost:4318"},
		ctx:         context.Background(),
		settingsPath: "",
	}

	// Toggle on — without a metrics collector, the provider won't activate
	// but the settings flag should still flip and init should be attempted.
	app.mu.Lock()
	app.settings.TelemetryEnabled = true
	app.mu.Unlock()
	app.initTelemetry()

	status := app.GetTelemetryStatus()
	if !status.Enabled {
		t.Error("expected Enabled=true after manual toggle")
	}
}
