package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"

	ap "agentprimordia/pkg"
)

// MCPConnectionResult matches the TypeScript interface in api.ts:
//
//	interface MCPConnectionResult { success: boolean; message?: string; tools?: string[]; }
type MCPConnectionResult struct {
	Success bool     `json:"success"`
	Message string   `json:"message,omitempty"`
	Tools   []string `json:"tools,omitempty"`
}

// MCPStatusEntry matches the TypeScript interface in api.ts:
//
//	interface MCPStatusEntry { id: string; name: string; connected: boolean; error?: string; }
type MCPStatusEntry struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
	Error     string `json:"error,omitempty"`
}

// ==================== MCP Server CRUD (Wails bindings) ====================

// AddMCPServer adds a new WebSocket/SSE MCP server and persists it in settings.
func (a *App) AddMCPServer(name, url string) error {
	if name == "" {
		return fmt.Errorf("server name cannot be empty")
	}

	id := generateMCPID()
	server := MCPServer{
		ID:      id,
		Name:    name,
		URL:     url,
		Type:    "websocket",
		Enabled: true,
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("save settings: %w", err)
	}

	// Register with AP MCPRegistry so it can be started later
	a.mcpReg.Register(ap.MCPClientConfig{
		Name:    id,
		BaseURL: url,
	})

	// Auto-start if enabled
	if server.Enabled {
		if err := a.mcpReg.Start(context.Background(), id); err != nil {
			slog.Warn("MCP server auto-start failed", "id", id, "error", err)
		}
	}

	return nil
}

// AddMCPServerStdio adds a new stdio MCP server and persists it in settings.
func (a *App) AddMCPServerStdio(name, command string, args []string) error {
	if name == "" {
		return fmt.Errorf("server name cannot be empty")
	}
	if command == "" {
		return fmt.Errorf("command cannot be empty")
	}

	id := generateMCPID()
	server := MCPServer{
		ID:      id,
		Name:    name,
		Command: command,
		Args:    args,
		Type:    "stdio",
		Enabled: true,
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("save settings: %w", err)
	}

	// Register with AP MCPRegistry
	a.mcpReg.Register(ap.MCPClientConfig{
		Name:    id,
		Command: command,
		Args:    args,
	})

	// Auto-start if enabled
	if server.Enabled {
		if err := a.mcpReg.Start(context.Background(), id); err != nil {
			slog.Warn("MCP server auto-start failed", "id", id, "error", err)
		}
	}

	return nil
}

// RemoveMCPServer removes an MCP server from settings and stops/unregisters it.
func (a *App) RemoveMCPServer(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	found := false
	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			a.settings.MCPServers = append(a.settings.MCPServers[:i], a.settings.MCPServers[i+1:]...)
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("MCP server not found: %s", id)
	}

	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("save settings: %w", err)
	}

	// Stop and unregister from AP MCPRegistry
	_ = a.mcpReg.Stop(id)
	_ = a.mcpReg.Unregister(id)

	return nil
}

// ToggleMCPServer enables or disables an MCP server.
// When enabling, it also starts the server; when disabling, it stops it.
func (a *App) ToggleMCPServer(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	found := false
	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			a.settings.MCPServers[i].Enabled = enabled
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("MCP server not found: %s", id)
	}

	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("save settings: %w", err)
	}

	// Start or stop the server accordingly
	if enabled {
		if err := a.mcpReg.Start(context.Background(), id); err != nil {
			slog.Warn("MCP server start failed on toggle", "id", id, "error", err)
		}
	} else {
		_ = a.mcpReg.Stop(id)
	}

	return nil
}

// TestMCPServerConnection tests connectivity to an MCP server and returns available tools.
func (a *App) TestMCPServerConnection(id string) MCPConnectionResult {
	// Ensure server is started before testing
	entry, ok := a.mcpReg.Get(id)
	if !ok {
		// Not registered in MCPRegistry yet — try to sync and start
		a.mu.RLock()
		var server *MCPServer
		for i := range a.settings.MCPServers {
			if a.settings.MCPServers[i].ID == id {
				server = &a.settings.MCPServers[i]
				break
			}
		}
		a.mu.RUnlock()

		if server == nil {
			return MCPConnectionResult{
				Success: false,
				Message: fmt.Sprintf("MCP server not found: %s", id),
			}
		}

		// Register and start
		a.mcpReg.Register(ap.MCPClientConfig{
			Name:    id,
			Command: server.Command,
			Args:    server.Args,
			BaseURL: server.URL,
		})

		if err := a.mcpReg.Start(context.Background(), id); err != nil {
			return MCPConnectionResult{
				Success: false,
				Message: fmt.Sprintf("connection failed: %v", err),
			}
		}

		entry, _ = a.mcpReg.Get(id)
	}

	if entry == nil || entry.Client == nil {
		return MCPConnectionResult{
			Success: false,
			Message: "server not connected",
		}
	}

	// Test the connection
	if err := a.mcpReg.Test(context.Background(), id); err != nil {
		return MCPConnectionResult{
			Success: false,
			Message: fmt.Sprintf("connection test failed: %v", err),
		}
	}

	// Collect tool names
	tools := entry.Client.Tools()
	toolNames := make([]string, len(tools))
	for i, t := range tools {
		toolNames[i] = t.Name
	}

	return MCPConnectionResult{
		Success: true,
		Message: fmt.Sprintf("connected, %d tools available", len(tools)),
		Tools:   toolNames,
	}
}

// GetMCPStatus returns the connection status of all configured MCP servers.
func (a *App) GetMCPStatus() []MCPStatusEntry {
	a.mu.RLock()
	servers := make([]MCPServer, len(a.settings.MCPServers))
	copy(servers, a.settings.MCPServers)
	a.mu.RUnlock()

	result := make([]MCPStatusEntry, 0, len(servers))
	for _, s := range servers {
		entry := MCPStatusEntry{
			ID:   s.ID,
			Name: s.Name,
		}

		regEntry, ok := a.mcpReg.Get(s.ID)
		if ok && regEntry != nil && regEntry.Client != nil {
			entry.Connected = true
		} else if s.Enabled {
			// Server is enabled but not connected; set error indicator
			entry.Error = "未连接"
		}

		result = append(result, entry)
	}

	return result
}

// GetMCPServerTools returns the list of tool names provided by a connected MCP server.
func (a *App) GetMCPServerTools(id string) []string {
	entry, ok := a.mcpReg.Get(id)
	if !ok || entry.Client == nil {
		return []string{}
	}

	tools := entry.Client.Tools()
	result := make([]string, len(tools))
	for i, t := range tools {
		result[i] = t.Name
	}
	return result
}

// ==================== Internal helpers ====================

// syncMCPServersToRegistry registers all persisted MCP servers from settings
// into the AP MCPRegistry. This should be called once during startup after
// the MCPRegistry is created.
func (a *App) syncMCPServersToRegistry() {
	a.mu.RLock()
	servers := make([]MCPServer, len(a.settings.MCPServers))
	copy(servers, a.settings.MCPServers)
	a.mu.RUnlock()

	for _, s := range servers {
		cfg := ap.MCPClientConfig{
			Name:    s.ID,
			Command: s.Command,
			Args:    s.Args,
			BaseURL: s.URL,
		}
		a.mcpReg.Register(cfg)
		slog.Info("MCP server registered", "id", s.ID, "name", s.Name, "type", s.Type)
	}
}

// startMCPRegistry starts all enabled MCP servers that were previously
// registered via syncMCPServersToRegistry. Should be called after sync.
func (a *App) startMCPRegistry() {
	a.mu.RLock()
	servers := make([]MCPServer, len(a.settings.MCPServers))
	copy(servers, a.settings.MCPServers)
	a.mu.RUnlock()

	for _, s := range servers {
		if !s.Enabled {
			continue
		}
		if err := a.mcpReg.Start(context.Background(), s.ID); err != nil {
			slog.Warn("MCP server start failed", "id", s.ID, "name", s.Name, "error", err)
		} else {
			slog.Info("MCP server started", "id", s.ID, "name", s.Name)
		}
	}
}

// generateMCPID creates a unique identifier for an MCP server entry.
func generateMCPID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// Fallback: should never happen, but provide a safe default
		return fmt.Sprintf("mcp_fallback_%d", len(b))
	}
	return fmt.Sprintf("mcp_%s", hex.EncodeToString(b))
}
