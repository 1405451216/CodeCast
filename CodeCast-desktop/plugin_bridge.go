package main

import (
	"context"
	"fmt"
	"log/slog"

	ap "agentprimordia/pkg"
)

// PluginInfoData is the JSON-serializable plugin info for the frontend.
type PluginInfoData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Path        string `json:"path,omitempty"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

// PluginStatusData summarizes the plugin system state for the frontend.
type PluginStatusData struct {
	LoadedCount int              `json:"loadedCount"`
	Plugins     []PluginInfoData `json:"plugins"`
}

// ListPlugins returns all loaded AP plugins.
func (a *App) ListPlugins() []PluginInfoData {
	if a.pluginLoader == nil {
		return nil
	}
	plugins := a.pluginLoader.List()
	result := make([]PluginInfoData, 0, len(plugins))
	for _, p := range plugins {
		result = append(result, PluginInfoData{
			ID:      p.Name,
			Name:    p.Name,
			Version: p.Version,
			Status:  "loaded",
		})
	}
	return result
}

// LoadPlugin loads a plugin from the given path.
// AP's PluginLoader operates on already-instantiated ToolPlugin implementations
// rather than file paths. This method is provided for frontend compatibility
// and reports an error indicating the path-based loader is not yet wired up
// (callers should use a higher-level plugin registration path).
func (a *App) LoadPlugin(path string) (*PluginInfoData, error) {
	if a.pluginLoader == nil {
		return nil, fmt.Errorf("plugin loader not initialized")
	}
	if path == "" {
		return nil, fmt.Errorf("plugin path is required")
	}
	// AP's PluginLoader.Load accepts a ToolPlugin instance, not a path.
	// Path-based plugin loading is intentionally not yet implemented; return
	// a clear error so the frontend can surface it.
	return nil, fmt.Errorf("path-based plugin loading not supported; register plugins via AP's ToolPlugin interface")
}

// UnloadPlugin unloads a plugin by ID (plugin name in AP terminology).
func (a *App) UnloadPlugin(pluginID string) error {
	if a.pluginLoader == nil {
		return fmt.Errorf("plugin loader not initialized")
	}
	return a.pluginLoader.Unload(pluginID)
}

// GetPluginStatus returns the current plugin system status.
func (a *App) GetPluginStatus() PluginStatusData {
	plugins := a.ListPlugins()
	return PluginStatusData{
		LoadedCount: len(plugins),
		Plugins:     plugins,
	}
}

// SendPluginMessage sends a message to a specific agent via the message bus.
func (a *App) SendPluginMessage(targetAgentID string, content string) error {
	if a.messageBus == nil {
		return fmt.Errorf("message bus not initialized")
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	_, err := a.messageBus.Send(ctx, &ap.BusMessage{
		From:    "user",
		To:      targetAgentID,
		Content: content,
	})
	return err
}

// BroadcastMessage broadcasts a message to all registered agents.
func (a *App) BroadcastMessage(content string) error {
	if a.messageBus == nil {
		return fmt.Errorf("message bus not initialized")
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	a.messageBus.Broadcast(ctx, &ap.BusMessage{
		From:    "user",
		Content: content,
	})
	return nil
}

// RegisterPluginHandler registers a BusMessageHandler for the given agent ID.
// Exposed so the frontend/backend can wire agent message handlers.
func (a *App) RegisterPluginHandler(agentID string, handler ap.BusMessageHandler) {
	if a.messageBus == nil {
		return
	}
	a.messageBus.Register(agentID, handler)
}

// StartHTTPTransport starts the AP HTTP transport for remote plugin access.
// Optional and controlled by the user.
func (a *App) StartHTTPTransport(addr string) error {
	if a.httpTransport != nil {
		return fmt.Errorf("HTTP transport already running")
	}
	transport := ap.NewHTTPTransport()
	if err := transport.Start(addr); err != nil {
		return fmt.Errorf("start HTTP transport: %w", err)
	}
	a.httpTransport = transport
	slog.Info("AP HTTPTransport started", "addr", addr)
	return nil
}

// StopHTTPTransport stops the AP HTTP transport. Safe to call when not running.
func (a *App) StopHTTPTransport() error {
	if a.httpTransport == nil {
		return nil
	}
	if err := a.httpTransport.Close(); err != nil {
		return fmt.Errorf("stop HTTP transport: %w", err)
	}
	a.httpTransport = nil
	slog.Info("AP HTTPTransport stopped")
	return nil
}
