package main

import (
	"os"
	"path/filepath"
	"testing"

	ap "agentprimordia/pkg"
)

// newTestAppWithMCP creates a minimal App suitable for MCP bridge tests.
func newTestAppWithMCP(t *testing.T) *App {
	t.Helper()
	tmpDir := t.TempDir()
	app := &App{
		settings:     &DefaultSettings,
		settingsPath: filepath.Join(tmpDir, "settings.json"),
		encryptionKey: make([]byte, 32), // 32-byte key for saveSettingsToFile
		mcpReg:       ap.NewMCPRegistry(),
	}
	// Write initial settings so saveSettingsToFile can work
	if err := os.WriteFile(app.settingsPath, []byte("{}"), 0600); err != nil {
		t.Fatalf("failed to create settings file: %v", err)
	}
	return app
}

// ==================== syncMCPServersToRegistry tests ====================

func TestSyncMCPServersToRegistry(t *testing.T) {
	app := newTestAppWithMCP(t)

	// DefaultSettings includes a builtin Chrome DevTools MCP server
	app.syncMCPServersToRegistry()

	entries := app.mcpReg.List()
	if len(entries) == 0 {
		t.Error("expected at least one MCP server registered after sync")
	}

	// Verify the builtin server is registered
	found := false
	for _, e := range entries {
		if e.Config.Name == "builtin_chrome_devtools_mcp" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected builtin Chrome DevTools MCP server to be registered")
	}
}

func TestSyncMCPServersToRegistryEmpty(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{}

	app.syncMCPServersToRegistry()

	entries := app.mcpReg.List()
	if len(entries) != 0 {
		t.Errorf("expected 0 MCP servers, got %d", len(entries))
	}
}

func TestSyncMCPServersToRegistryMultiple(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{
		{ID: "mcp_test1", Name: "Test1", Type: "stdio", Command: "npx", Args: []string{"pkg1"}, Enabled: true},
		{ID: "mcp_test2", Name: "Test2", Type: "websocket", URL: "ws://localhost:8080", Enabled: false},
	}

	app.syncMCPServersToRegistry()

	entries := app.mcpReg.List()
	if len(entries) != 2 {
		t.Errorf("expected 2 MCP servers, got %d", len(entries))
	}
}

// ==================== AddMCPServer tests ====================

func TestAddMCPServer(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.AddMCPServer("Test WS", "ws://localhost:9090")
	if err != nil {
		t.Fatalf("AddMCPServer failed: %v", err)
	}

	app.mu.RLock()
	servers := app.settings.MCPServers
	app.mu.RUnlock()

	// Should have at least the one we just added (plus any defaults)
	found := false
	for _, s := range servers {
		if s.Name == "Test WS" && s.Type == "websocket" && s.URL == "ws://localhost:9090" {
			found = true
			break
		}
	}
	if !found {
		t.Error("added MCP server not found in settings")
	}

	// Should also be registered in the MCPRegistry
	entries := app.mcpReg.List()
	regFound := false
	for _, e := range entries {
		if e.Config.BaseURL == "ws://localhost:9090" {
			regFound = true
			break
		}
	}
	if !regFound {
		t.Error("added MCP server not registered in MCPRegistry")
	}
}

func TestAddMCPServerEmptyName(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.AddMCPServer("", "ws://localhost:9090")
	if err == nil {
		t.Error("expected error for empty name")
	}
}

// ==================== AddMCPServerStdio tests ====================

func TestAddMCPServerStdio(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.AddMCPServerStdio("Test Stdio", "npx", []string{"-y", "some-mcp-server"})
	if err != nil {
		t.Fatalf("AddMCPServerStdio failed: %v", err)
	}

	app.mu.RLock()
	servers := app.settings.MCPServers
	app.mu.RUnlock()

	found := false
	for _, s := range servers {
		if s.Name == "Test Stdio" && s.Type == "stdio" && s.Command == "npx" {
			found = true
			break
		}
	}
	if !found {
		t.Error("added stdio MCP server not found in settings")
	}
}

func TestAddMCPServerStdioEmptyName(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.AddMCPServerStdio("", "npx", []string{})
	if err == nil {
		t.Error("expected error for empty name")
	}
}

func TestAddMCPServerStdioEmptyCommand(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.AddMCPServerStdio("Test", "", []string{})
	if err == nil {
		t.Error("expected error for empty command")
	}
}

// ==================== RemoveMCPServer tests ====================

func TestRemoveMCPServer(t *testing.T) {
	app := newTestAppWithMCP(t)

	// Add a server first
	err := app.AddMCPServer("To Remove", "ws://localhost:9999")
	if err != nil {
		t.Fatalf("AddMCPServer failed: %v", err)
	}

	// Find the ID
	app.mu.RLock()
	var id string
	for _, s := range app.settings.MCPServers {
		if s.Name == "To Remove" {
			id = s.ID
			break
		}
	}
	app.mu.RUnlock()

	if id == "" {
		t.Fatal("could not find added server ID")
	}

	// Remove it
	err = app.RemoveMCPServer(id)
	if err != nil {
		t.Fatalf("RemoveMCPServer failed: %v", err)
	}

	// Verify it's gone from settings
	app.mu.RLock()
	for _, s := range app.settings.MCPServers {
		if s.ID == id {
			t.Error("server still present in settings after removal")
		}
	}
	app.mu.RUnlock()
}

func TestRemoveMCPServerNotFound(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.RemoveMCPServer("nonexistent_id")
	if err == nil {
		t.Error("expected error for nonexistent server ID")
	}
}

// ==================== GetMCPStatus tests ====================

func TestGetMCPStatus(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{
		{ID: "mcp_s1", Name: "Server1", Type: "stdio", Enabled: true},
		{ID: "mcp_s2", Name: "Server2", Type: "websocket", Enabled: true},
	}
	app.syncMCPServersToRegistry()

	status := app.GetMCPStatus()
	if len(status) != 2 {
		t.Fatalf("expected 2 status entries, got %d", len(status))
	}

	// Check that IDs and names are correct
	names := map[string]string{}
	for _, s := range status {
		names[s.ID] = s.Name
	}
	if names["mcp_s1"] != "Server1" {
		t.Errorf("expected Server1, got %s", names["mcp_s1"])
	}
	if names["mcp_s2"] != "Server2" {
		t.Errorf("expected Server2, got %s", names["mcp_s2"])
	}
}

func TestGetMCPStatusEmpty(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{}

	status := app.GetMCPStatus()
	if len(status) != 0 {
		t.Errorf("expected 0 status entries, got %d", len(status))
	}
}

// ==================== GetMCPServerTools tests ====================

func TestGetMCPServerToolsNotRegistered(t *testing.T) {
	app := newTestAppWithMCP(t)

	tools := app.GetMCPServerTools("nonexistent")
	if len(tools) != 0 {
		t.Errorf("expected empty tools list, got %v", tools)
	}
}

func TestGetMCPServerToolsRegisteredButNotConnected(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{
		{ID: "mcp_test", Name: "Test", Type: "stdio", Command: "echo", Enabled: true},
	}
	app.syncMCPServersToRegistry()

	// Server is registered but not connected (no client)
	tools := app.GetMCPServerTools("mcp_test")
	if len(tools) != 0 {
		t.Errorf("expected empty tools for unconnected server, got %v", tools)
	}
}

// ==================== ToggleMCPServer tests ====================

func TestToggleMCPServer(t *testing.T) {
	app := newTestAppWithMCP(t)

	// Add a server
	err := app.AddMCPServer("Toggle Test", "ws://localhost:7777")
	if err != nil {
		t.Fatalf("AddMCPServer failed: %v", err)
	}

	// Find the ID
	app.mu.RLock()
	var id string
	for _, s := range app.settings.MCPServers {
		if s.Name == "Toggle Test" {
			id = s.ID
			break
		}
	}
	app.mu.RUnlock()

	// Toggle off
	err = app.ToggleMCPServer(id, false)
	if err != nil {
		t.Fatalf("ToggleMCPServer(off) failed: %v", err)
	}

	// Verify
	app.mu.RLock()
	var enabled bool
	for _, s := range app.settings.MCPServers {
		if s.ID == id {
			enabled = s.Enabled
			break
		}
	}
	app.mu.RUnlock()

	if enabled {
		t.Error("server should be disabled after toggle(false)")
	}

	// Toggle on
	err = app.ToggleMCPServer(id, true)
	if err != nil {
		t.Fatalf("ToggleMCPServer(on) failed: %v", err)
	}

	app.mu.RLock()
	for _, s := range app.settings.MCPServers {
		if s.ID == id {
			enabled = s.Enabled
			break
		}
	}
	app.mu.RUnlock()

	if !enabled {
		t.Error("server should be enabled after toggle(true)")
	}
}

func TestToggleMCPServerNotFound(t *testing.T) {
	app := newTestAppWithMCP(t)

	err := app.ToggleMCPServer("nonexistent", true)
	if err == nil {
		t.Error("expected error for nonexistent server ID")
	}
}

// ==================== TestMCPServerConnection tests ====================

func TestTestMCPServerConnectionNotFound(t *testing.T) {
	app := newTestAppWithMCP(t)

	result := app.TestMCPServerConnection("nonexistent")
	if result.Success {
		t.Error("expected failure for nonexistent server")
	}
}

func TestTestMCPServerConnectionUnregisteredInSettings(t *testing.T) {
	app := newTestAppWithMCP(t)
	app.settings.MCPServers = []MCPServer{
		{ID: "mcp_ghost", Name: "Ghost", Type: "websocket", URL: "ws://localhost:1234", Enabled: true},
	}
	// Note: NOT calling syncMCPServersToRegistry, so it's in settings but not in registry
	// TestMCPServerConnection should still find it in settings and try to register/start

	result := app.TestMCPServerConnection("mcp_ghost")
	// It will try to start but fail (no actual server), but at least it should find it in settings
	if result.Success {
		t.Error("expected failure since no actual MCP server is running")
	}
	if result.Message == "" {
		t.Error("expected an error message")
	}
}

// ==================== generateMCPID tests ====================

func TestGenerateMCPID(t *testing.T) {
	id1 := generateMCPID()
	id2 := generateMCPID()

	if id1 == id2 {
		t.Error("generated IDs should be unique")
	}
	if len(id1) < 5 {
		t.Errorf("ID too short: %s", id1)
	}
	if id1[:4] != "mcp_" {
		t.Errorf("ID should start with 'mcp_', got: %s", id1)
	}
}
