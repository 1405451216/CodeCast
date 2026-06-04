package main

import (
	"fmt"
	"log/slog"
	"time"

	ap "agentprimordia/pkg"
)

// TelemetryStatus holds the current telemetry configuration and state.
type TelemetryStatus struct {
	Enabled  bool   `json:"enabled"`
	Endpoint string `json:"endpoint"`
	Active   bool   `json:"active"`
	Error    string `json:"error,omitempty"`
}

// initTelemetry sets up AP OTLP telemetry if enabled in settings.
// Called from startup() and after settings change. Safe to call multiple times:
// existing provider is shut down before reinitialization.
func (a *App) initTelemetry() {
	a.mu.RLock()
	enabled := a.settings.TelemetryEnabled
	endpoint := a.settings.TelemetryEndpoint
	a.mu.RUnlock()

	if !enabled {
		if a.telemetryProvider != nil {
			_ = a.telemetryProvider.Shutdown()
			a.telemetryProvider = nil
			slog.Info("AP Telemetry disabled and shut down")
		}
		return
	}

	// Tear down any existing provider before creating a new one
	if a.telemetryProvider != nil {
		_ = a.telemetryProvider.Shutdown()
		a.telemetryProvider = nil
	}

	// Telemetry requires the metrics collector for OTLP metrics export.
	// Without it we can still create a provider for traces, but log a warning
	// so users know metrics are not being shipped.
	if a.metricsCollector == nil {
		slog.Warn("AP Telemetry requested but metrics collector is nil; metrics will not be exported")
	}

	provider, err := ap.NewTelemetryProvider(ap.TelemetryConfig{
		ServiceName:    "CodeCast",
		ServiceVersion: "0.1.0",
		OTLPEndpoint:   endpoint,
		EnableTraces:   true,
		EnableMetrics:  a.metricsCollector != nil,
		ExportInterval: 30 * time.Second,
	}, a.metricsCollector)
	if err != nil {
		slog.Error("AP TelemetryProvider creation failed", "endpoint", endpoint, "error", err)
		return
	}

	a.telemetryProvider = provider
	slog.Info("AP Telemetry initialized", "endpoint", endpoint)
}

// GetTelemetryStatus returns the current telemetry status for the frontend.
func (a *App) GetTelemetryStatus() TelemetryStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return TelemetryStatus{
		Enabled:  a.settings.TelemetryEnabled,
		Endpoint: a.settings.TelemetryEndpoint,
		Active:   a.telemetryProvider != nil,
	}
}

// ToggleTelemetry enables or disables OTLP telemetry at runtime and persists the change.
func (a *App) ToggleTelemetry(enabled bool) error {
	a.mu.Lock()
	a.settings.TelemetryEnabled = enabled
	a.mu.Unlock()

	a.initTelemetry()

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// SetTelemetryEndpoint updates the OTLP endpoint and reinitializes telemetry.
func (a *App) SetTelemetryEndpoint(endpoint string) error {
	if endpoint == "" {
		return fmt.Errorf("telemetry endpoint cannot be empty")
	}
	a.mu.Lock()
	a.settings.TelemetryEndpoint = endpoint
	a.mu.Unlock()

	a.initTelemetry()

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}
