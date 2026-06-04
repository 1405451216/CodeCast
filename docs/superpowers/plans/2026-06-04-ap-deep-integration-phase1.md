# AP Deep Integration Phase 1: Activate Dead Code

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the 4 AP subsystems that are initialized in `startup()` but have zero method calls, raising integration from 26% to ~42%.

**Architecture:** Each subsystem (MCPRegistry, Lifecycle, CheckpointStore, Metrics) already has a field on `App` and is created during `startup()`. We bridge them to the frontend via new Wails binding methods and Wails event emissions, following the same pattern as `event_bridge.go` and `agent_bridge.go`.

**Tech Stack:** Go (Wails v2 bindings), TypeScript (Zustand stores), React components

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `CodeCast-desktop/mcp_bridge.go` | **Create** | MCP server lifecycle: sync Settings → MCPRegistry, implement all MCP Wails bindings |
| `CodeCast-desktop/main.go` | Modify | Add MCP sync call in `startup()`, add new Wails binding methods for Lifecycle/Checkpoint/Metrics |
| `CodeCast-desktop/event_bridge.go` | Modify | Add lifecycle state-change events, periodic metrics snapshot events |
| `CodeCast-desktop/shutdown.go` or `main.go` shutdown | Modify | Stop MCPRegistry and metrics exporter on shutdown |
| `CodeCast-desktop/frontend/src/api.ts` | Modify | Add new GoAppMethods signatures for all 4 subsystems |
| `CodeCast-desktop/frontend/src/api/types.ts` | Modify | Add TypeScript types for checkpoint info, lifecycle state, AP metrics snapshot |
| `CodeCast-desktop/frontend/src/store/useLifecycleStore.ts` | **Create** | Zustand slice tracking per-agent lifecycle states |
| `CodeCast-desktop/frontend/src/store/useMetricsStore.ts` | **Create** | Zustand slice for AP metrics snapshots (separate from frontend perf) |
| `CodeCast-desktop/frontend/src/store/index.ts` | Modify | Compose the 2 new slices |
| `CodeCast-desktop/frontend/src/components/CheckpointPanel.tsx` | Modify | Add checkpoint history list and resume button |
| `CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx` | Modify | Show connected MCP server tools list |

---

### Task 1: MCPRegistry — Create mcp_bridge.go

**Files:**
- Create: `CodeCast-desktop/mcp_bridge.go`
- Reference: `CodeCast-desktop/config.go:228-237` (MCPServer struct), `agentprimordia/internal/tools/mcp.go` (MCPRegistry API)

The frontend declares `AddMCPServer`, `AddMCPServerStdio`, `RemoveMCPServer`, `ToggleMCPServer`, `TestMCPServerConnection`, `GetMCPStatus` in `api.ts` but **no Go backend implements them**. This task creates those implementations, delegating to `a.mcpReg`.

- [ ] **Step 1: Write the failing test**

```go
// File: CodeCast-desktop/mcp_bridge_test.go
package main

import (
	"testing"
)

func TestSyncMCPServersToRegistry(t *testing.T) {
	app := &App{
		settings: &Settings{
			MCPServers: []MCPServer{
				{ID: "test-1", Name: "Test MCP", Command: "echo", Type: "stdio", Enabled: true},
			},
		},
		mcpReg: ap.NewMCPRegistry(),
		ctx:     context.Background(),
	}

	err := app.syncMCPServersToRegistry()
	if err != nil {
		t.Fatalf("syncMCPServersToRegistry failed: %v", err)
	}

	status := app.GetMCPStatus()
	if len(status) != 1 {
		t.Errorf("expected 1 MCP status entry, got %d", len(status))
	}
}

func TestAddMCPServerStdio(t *testing.T) {
	app := &App{
		settings:     &Settings{MCPServers: []MCPServer{}},
		mcpReg:       ap.NewMCPRegistry(),
		ctx:          context.Background(),
		settingsPath: t.TempDir() + "/settings.json",
	}

	err := app.AddMCPServerStdio("Test", "echo", []string{"hello"})
	if err != nil {
		t.Fatalf("AddMCPServerStdio failed: %v", err)
	}

	if len(app.settings.MCPServers) != 1 {
		t.Errorf("expected 1 MCP server in settings, got %d", len(app.settings.MCPServers))
	}
}

func TestRemoveMCPServer(t *testing.T) {
	app := &App{
		settings: &Settings{
			MCPServers: []MCPServer{
				{ID: "remove-me", Name: "Remove Me", Type: "stdio", Enabled: true},
			},
		},
		mcpReg:       ap.NewMCPRegistry(),
		ctx:          context.Background(),
		settingsPath: t.TempDir() + "/settings.json",
	}

	err := app.RemoveMCPServer("remove-me")
	if err != nil {
		t.Fatalf("RemoveMCPServer failed: %v", err)
	}

	if len(app.settings.MCPServers) != 0 {
		t.Errorf("expected 0 MCP servers after removal, got %d", len(app.settings.MCPServers))
	}
}

func TestGetMCPStatus(t *testing.T) {
	app := &App{
		settings: &Settings{
			MCPServers: []MCPServer{
				{ID: "s1", Name: "Server 1", Type: "stdio", Enabled: true},
				{ID: "s2", Name: "Server 2", Type: "websocket", URL: "ws://localhost:8080", Enabled: false},
			},
		},
		mcpReg: ap.NewMCPRegistry(),
		ctx:    context.Background(),
	}

	status := app.GetMCPStatus()
	if len(status) != 2 {
		t.Fatalf("expected 2 status entries, got %d", len(status))
	}
	// Disabled servers should show connected: false
	for _, s := range status {
		if s.ID == "s2" && s.Connected {
			t.Error("disabled server should not be connected")
		}
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestSync|TestAdd|TestRemove|TestGetMCP" -v`
Expected: FAIL — `syncMCPServersToRegistry` undefined, `AddMCPServerStdio` undefined, etc.

- [ ] **Step 3: Implement mcp_bridge.go**

```go
// File: CodeCast-desktop/mcp_bridge.go
package main

import (
	"context"
	"fmt"
	"log/slog"

	ap "agentprimordia/pkg"
)

// MCPStatusEntry represents the connection status of an MCP server for the frontend.
type MCPStatusEntry struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
	Type      string `json:"type"`
	Error     string `json:"error,omitempty"`
}

// MCPConnectionResult represents the result of testing an MCP server connection.
type MCPConnectionResult struct {
	Success bool     `json:"success"`
	Message string   `json:"message,omitempty"`
	Tools   []string `json:"tools,omitempty"`
}

// syncMCPServersToRegistry reads Settings.MCPServers and registers all enabled
// servers into the AP MCPRegistry. Called during startup and after settings changes.
func (a *App) syncMCPServersToRegistry() error {
	a.mu.RLock()
	servers := append([]MCPServer{}, a.settings.MCPServers...)
	a.mu.RUnlock()

	for _, srv := range servers {
		if !srv.Enabled {
			continue
		}
		cfg := ap.MCPClientConfig{
			Name:    srv.Name,
			Command: srv.Command,
			Args:    srv.Args,
			URL:     srv.URL,
			Type:    srv.Type,
		}
		if err := a.mcpReg.Register(cfg); err != nil {
			slog.Warn("MCP server registration failed", "name", srv.Name, "error", err)
			// Continue registering other servers rather than failing entirely
		} else {
			slog.Info("MCP server registered", "name", srv.Name, "type", srv.Type)
		}
	}
	return nil
}

// startMCPRegistry starts all registered MCP servers and connects their tools
// into the AP ToolRegistry so agents can call MCP tools.
func (a *App) startMCPRegistry() {
	if a.mcpReg == nil || a.toolkit == nil {
		return
	}
	if err := a.mcpReg.StartAll(a.ctx); err != nil {
		slog.Warn("MCP servers start failed", "error", err)
	}
	if err := a.mcpReg.RegisterIntoRegistry(a.toolkit); err != nil {
		slog.Warn("MCP tool registration failed", "error", err)
	} else {
		slog.Info("MCP tools registered into AP ToolRegistry")
	}
}

// AddMCPServer adds a WebSocket-type MCP server to settings and the registry.
func (a *App) AddMCPServer(name string, url string) error {
	id := fmt.Sprintf("mcp-ws-%d", len(a.settings.MCPServers)+1)
	srv := MCPServer{
		ID:      id,
		Name:    name,
		URL:     url,
		Type:    "websocket",
		Enabled: true,
	}
	return a.addMCPServerInternal(srv)
}

// AddMCPServerStdio adds a stdio-type MCP server to settings and the registry.
func (a *App) AddMCPServerStdio(name string, command string, args []string) error {
	id := fmt.Sprintf("mcp-stdio-%d", len(a.settings.MCPServers)+1)
	srv := MCPServer{
		ID:      id,
		Name:    name,
		Command: command,
		Args:    args,
		Type:    "stdio",
		Enabled: true,
	}
	return a.addMCPServerInternal(srv)
}

func (a *App) addMCPServerInternal(srv MCPServer) error {
	a.mu.Lock()
	a.settings.MCPServers = append(a.settings.MCPServers, srv)
	a.mu.Unlock()

	// Register with AP if enabled
	if srv.Enabled {
		cfg := ap.MCPClientConfig{
			Name:    srv.Name,
			Command: srv.Command,
			Args:    srv.Args,
			URL:     srv.URL,
			Type:    srv.Type,
		}
		if err := a.mcpReg.Register(cfg); err != nil {
			slog.Warn("MCP register failed", "name", srv.Name, "error", err)
		}
		if err := a.saveSettingsToFile(); err != nil {
			return fmt.Errorf("failed to save settings: %w", err)
		}
	}
	return nil
}

// RemoveMCPServer removes an MCP server from settings and stops it in the registry.
func (a *App) RemoveMCPServer(id string) error {
	a.mu.Lock()
	found := false
	servers := make([]MCPServer, 0, len(a.settings.MCPServers))
	for _, s := range a.settings.MCPServers {
		if s.ID == id {
			found = true
			continue
		}
		servers = append(servers, s)
	}
	a.settings.MCPServers = servers
	a.mu.Unlock()

	if !found {
		return fmt.Errorf("MCP server %s not found", id)
	}

	// Stop and remove from AP registry
	if err := a.mcpReg.Stop(id); err != nil {
		slog.Warn("MCP server stop failed", "id", id, "error", err)
	}

	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}
	return nil
}

// ToggleMCPServer enables or disables an MCP server.
func (a *App) ToggleMCPServer(id string, enabled bool) error {
	a.mu.Lock()
	found := false
	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			a.settings.MCPServers[i].Enabled = enabled
			found = true
			break
		}
	}
	a.mu.Unlock()

	if !found {
		return fmt.Errorf("MCP server %s not found", id)
	}

	if enabled {
		// Start the server in the registry
		if err := a.mcpReg.Start(a.ctx, id); err != nil {
			slog.Warn("MCP server start failed", "id", id, "error", err)
		}
	} else {
		if err := a.mcpReg.Stop(id); err != nil {
			slog.Warn("MCP server stop failed", "id", id, "error", err)
		}
	}

	if err := a.saveSettingsToFile(); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}
	return nil
}

// TestMCPServerConnection tests the connection to an MCP server and returns its tools.
func (a *App) TestMCPServerConnection(id string) MCPConnectionResult {
	a.mu.RLock()
	var srv *MCPServer
	for i := range a.settings.MCPServers {
		if a.settings.MCPServers[i].ID == id {
			srv = &a.settings.MCPServers[i]
			break
		}
	}
	a.mu.RUnlock()

	if srv == nil {
		return MCPConnectionResult{Success: false, Message: "server not found"}
	}

	tools, err := a.mcpReg.Test(a.ctx, id)
	if err != nil {
		return MCPConnectionResult{Success: false, Message: err.Error()}
	}

	toolNames := make([]string, len(tools))
	for i, t := range tools {
		toolNames[i] = t.Name
	}

	return MCPConnectionResult{Success: true, Tools: toolNames}
}

// GetMCPStatus returns the connection status of all configured MCP servers.
func (a *App) GetMCPStatus() []MCPStatusEntry {
	a.mu.RLock()
	servers := append([]MCPServer{}, a.settings.MCPServers...)
	a.mu.RUnlock()

	status := make([]MCPStatusEntry, len(servers))
	for i, srv := range servers {
		entry := MCPStatusEntry{
			ID:   srv.ID,
			Name: srv.Name,
			Type: srv.Type,
		}
		if srv.Enabled {
			// Check if the MCP client is actually connected
			clients := a.mcpReg.List()
			for _, c := range clients {
				if c.Name() == srv.Name {
					entry.Connected = true
					break
				}
			}
		}
		status[i] = entry
	}
	return status
}

// GetMCPServerTools returns the tools provided by a specific MCP server.
func (a *App) GetMCPServerTools(id string) []string {
	a.mu.RLock()
	var name string
	for _, s := range a.settings.MCPServers {
		if s.ID == id {
			name = s.Name
			break
		}
	}
	a.mu.RUnlock()

	if name == "" {
		return nil
	}

	clients := a.mcpReg.List()
	for _, c := range clients {
		if c.Name() == name {
			tools := c.Tools()
			names := make([]string, len(tools))
			for i, t := range tools {
				names[i] = t.Name
			}
			return names
		}
	}
	return nil
}
```

- [ ] **Step 4: Wire into main.go startup**

Add these calls after `a.mcpReg = ap.NewMCPRegistry()` (line 166-167) in `startup()`:

```go
		// After MCPRegistry creation (line 167), add:
		a.syncMCPServersToRegistry()
		// After toolkit + agent creation (after line 227), add:
		a.startMCPRegistry()
```

Add shutdown cleanup in `shutdown()` method:

```go
		if a.mcpReg != nil {
			a.mcpReg.StopAll()
			slog.Info("AP MCPRegistry 已关闭")
		}
```

- [ ] **Step 5: Add GetMCPServerTools to frontend api.ts**

Add to `GoAppMethods` interface (after existing MCP methods around line 136):

```typescript
GetMCPServerTools(id: string): Promise<string[]>;
```

Add exported function:

```typescript
export const getMCPServerTools = (id: string) => callGo('GetMCPServerTools', id);
```

- [ ] **Step 6: Update MCPTab.tsx to show tools list**

Add to MCPTab component after each server's info display:

```tsx
const [expandedServer, setExpandedServer] = useState<string | null>(null);
const [serverTools, setServerTools] = useState<Record<string, string[]>>({});

const loadServerTools = async (id: string) => {
  const tools = await getMCPServerTools(id);
  setServerTools(prev => ({ ...prev, [id]: tools || [] }));
  setExpandedServer(prev => prev === id ? null : id);
};

// In server list item, add after toggle button:
<button
  className="mcp-tools-toggle"
  onClick={() => loadServerTools(s.id)}
  title="查看工具列表"
>
  🔧
</button>
{expandedServer === s.id && serverTools[s.id] && (
  <div className="mcp-tools-list">
    {serverTools[s.id].map(tool => (
      <span key={tool} className="mcp-tool-tag">{tool}</span>
    ))}
    {serverTools[s.id].length === 0 && <span className="mcp-no-tools">未发现工具</span>}
  </div>
)}
```

- [ ] **Step 7: Run tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestSync|TestAdd|TestRemove|TestGetMCP" -v`
Expected: ALL PASS

- [ ] **Step 8: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./...`
Expected: Success

- [ ] **Step 9: Commit**

```bash
git add CodeCast-desktop/mcp_bridge.go CodeCast-desktop/mcp_bridge_test.go CodeCast-desktop/main.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx
git commit -m "feat: activate MCPRegistry — bridge Settings to AP MCP, implement Wails bindings"
```

---

### Task 2: Lifecycle — Expose State Transitions to Frontend

**Files:**
- Modify: `CodeCast-desktop/main.go` — add Wails bindings
- Modify: `CodeCast-desktop/event_bridge.go` — add lifecycle events
- Create: `CodeCast-desktop/frontend/src/store/useLifecycleStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/index.ts`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`

- [ ] **Step 1: Add Go Wails bindings in main.go**

Add these methods to `App`:

```go
// GetLifecycleState returns the global lifecycle state.
func (a *App) GetLifecycleState() string {
	if a.lifecycle == nil {
		return "unknown"
	}
	return string(a.lifecycle.State())
}

// GetAgentLifecycleStates returns lifecycle states for all session agents.
func (a *App) GetAgentLifecycleStates() map[string]string {
	states := make(map[string]string)
	a.mu.RLock()
	for id, agent := range a.sessionAgents {
		stats := agent.Stats()
		states[id] = string(stats.Status)
	}
	a.mu.RUnlock()
	return states
}
```

- [ ] **Step 2: Add lifecycle events to event_bridge.go**

Add to the `eventMap` in `startEventBridge()`:

```go
		ap.EventTurnStart:    "agent:turn",      // already exists
		ap.EventTurnEnd:      "agent:turn_end",  // already exists
```

We don't need new AP event subscriptions — the existing `agent:start`, `agent:stop`, `agent:error` events already capture lifecycle transitions. Instead, add a periodic lifecycle state poll that emits a Wails event:

```go
// Add after the existing event subscription loop:
	// Lifecycle state broadcast (every 5s)
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
				states := a.GetAgentLifecycleStates()
				wailsRuntime.EventsEmit(a.ctx, "lifecycle:states", states)
			}
		}
	}()
```

- [ ] **Step 3: Add TypeScript types in api/types.ts**

```typescript
// Lifecycle state type
export type LifecycleState =
  | 'idle' | 'running' | 'paused'
  | 'completed' | 'failed' | 'cancelled' | 'unknown';

export interface LifecycleStatesEvent {
  [sessionId: string]: LifecycleState;
}
```

- [ ] **Step 4: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
GetLifecycleState(): Promise<string>;
GetAgentLifecycleStates(): Promise<Record<string, string>>;
```

Add exported functions:

```typescript
export const getLifecycleState = () => callGo('GetLifecycleState');
export const getAgentLifecycleStates = () => callGo('GetAgentLifecycleStates');
```

- [ ] **Step 5: Create useLifecycleStore.ts**

```typescript
import { StateCreator } from 'zustand';
import type { LifecycleState } from '../api/types';

export interface LifecycleSlice {
  globalState: LifecycleState;
  agentStates: Record<string, LifecycleState>;
  setGlobalState: (state: LifecycleState) => void;
  setAgentStates: (states: Record<string, LifecycleState>) => void;
  handleLifecycleEvent: (states: Record<string, string>) => void;
}

export const createLifecycleSlice: StateCreator<LifecycleSlice> = (set) => ({
  globalState: 'idle',
  agentStates: {},

  setGlobalState: (state) => set({ globalState: state }),

  setAgentStates: (states) => set({ agentStates: states }),

  handleLifecycleEvent: (states) =>
    set({
      agentStates: Object.fromEntries(
        Object.entries(states).map(([k, v]) => [k, v as LifecycleState])
      ),
    }),
});
```

- [ ] **Step 6: Compose into store/index.ts**

Add import:

```typescript
import { createLifecycleSlice, LifecycleSlice } from './useLifecycleStore';
```

Add to `AppState` interface:

```typescript
LifecycleSlice &
```

Add to store creator (spread into the object):

```typescript
createLifecycleSlice: () => ({ ...createLifecycleSlice(set, get, store) }),
```

Add `LifecycleSlice` to the type composition.

- [ ] **Step 7: Subscribe to lifecycle events in App.tsx or agent event handler**

In the existing `handleAPEvent` function in `useAgentStore.ts`, add handling for the new event:

```typescript
// In the EventsOn callback that handles agent events:
if (eventName === 'lifecycle:states') {
  useAppStore.getState().handleLifecycleEvent(payload);
}
```

- [ ] **Step 8: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./... && cd frontend && npx tsc --noEmit`
Expected: Both succeed

- [ ] **Step 9: Commit**

```bash
git add CodeCast-desktop/main.go CodeCast-desktop/event_bridge.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/store/useLifecycleStore.ts CodeCast-desktop/frontend/src/store/index.ts
git commit -m "feat: activate AP Lifecycle — expose state transitions to frontend via Wails events"
```

---

### Task 3: CheckpointStore — Expose Checkpoint History and Resume

**Files:**
- Modify: `CodeCast-desktop/main.go` — add Wails bindings
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/components/CheckpointPanel.tsx`

- [ ] **Step 1: Add TypeScript types in api/types.ts**

```typescript
export interface CheckpointInfo {
  ID:        string;
  SessionID: string;
  Turn:      int;
  Status:    string;     // 'pending' | 'approved' | 'rejected'
  ToolName:  string;
  CreatedAt: string;
}
```

- [ ] **Step 2: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
GetCheckpoints(sessionId: string, limit: number): Promise<CheckpointInfo[]>;
LoadCheckpoint(checkpointId: string): Promise<void>;
DeleteCheckpoint(checkpointId: string): Promise<void>;
ResumeFromCheckpoint(sessionId: string, checkpointId: string): Promise<void>;
```

Add exported functions:

```typescript
export const getCheckpoints = (sessionId: string, limit: number) =>
  callGo('GetCheckpoints', sessionId, limit);
export const loadCheckpoint = (checkpointId: string) =>
  callGo('LoadCheckpoint', checkpointId);
export const deleteCheckpoint = (checkpointId: string) =>
  callGo('DeleteCheckpoint', checkpointId);
export const resumeFromCheckpoint = (sessionId: string, checkpointId: string) =>
  callGo('ResumeFromCheckpoint', sessionId, checkpointId);
```

- [ ] **Step 3: Add Go Wails bindings in main.go**

```go
// CheckpointInfo represents a saved checkpoint for the frontend.
type CheckpointInfo struct {
	ID        string `json:"ID"`
	SessionID string `json:"SessionID"`
	Turn      int    `json:"Turn"`
	Status    string `json:"Status"`
	ToolName  string `json:"ToolName"`
	CreatedAt string `json:"CreatedAt"`
}

// GetCheckpoints returns recent checkpoints for a session.
func (a *App) GetCheckpoints(sessionID string, limit int) []CheckpointInfo {
	if a.checkpointStore == nil {
		return nil
	}
	states, err := a.checkpointStore.List(sessionID, limit)
	if err != nil {
		slog.Warn("GetCheckpoints failed", "error", err)
		return nil
	}
	result := make([]CheckpointInfo, len(states))
	for i, s := range states {
		result[i] = CheckpointInfo{
			ID:        s.ID,
			SessionID: s.SessionID,
			Turn:      s.Turn,
			Status:    s.Status,
			ToolName:  s.LastToolName,
			CreatedAt: s.CreatedAt.Format(time.RFC3339),
		}
	}
	return result
}

// LoadCheckpoint loads a checkpoint by ID and returns its state.
func (a *App) LoadCheckpoint(checkpointID string) error {
	if a.checkpointStore == nil {
		return fmt.Errorf("checkpoint store not initialized")
	}
	_, err := a.checkpointStore.Load(checkpointID)
	if err != nil {
		return fmt.Errorf("failed to load checkpoint: %w", err)
	}
	return nil
}

// DeleteCheckpoint removes a checkpoint.
func (a *App) DeleteCheckpoint(checkpointID string) error {
	if a.checkpointStore == nil {
		return fmt.Errorf("checkpoint store not initialized")
	}
	return a.checkpointStore.Delete(checkpointID)
}

// ResumeFromCheckpoint creates a new session agent restored from a checkpoint.
func (a *App) ResumeFromCheckpoint(sessionID string, checkpointID string) error {
	state, err := a.checkpointStore.Load(checkpointID)
	if err != nil {
		return fmt.Errorf("failed to load checkpoint: %w", err)
	}

	a.mu.Lock()
	agent, exists := a.sessionAgents[sessionID]
	a.mu.Unlock()

	if !exists {
		return fmt.Errorf("no agent for session %s", sessionID)
	}

	// Resume the agent from the checkpoint state
	reactAgent, ok := agent.(*ap.ReActAgent)
	if !ok {
		return fmt.Errorf("agent does not support checkpoint resume")
	}

	return reactAgent.ResumeFromCheckpoint(a.ctx, state)
}
```

- [ ] **Step 4: Enhance CheckpointPanel.tsx — Add history tab**

Add a "History" tab button next to the existing panel title. When clicked, fetch and display `GetCheckpoints(currentSessionId, 20)` results as a list with resume/delete buttons.

```tsx
// Add state
const [showHistory, setShowHistory] = useState(false);
const [checkpointHistory, setCheckpointHistory] = useState<CheckpointInfo[]>([]);

// Add load function
const loadHistory = async () => {
  if (!sessionId) return;
  const checkpoints = await getCheckpoints(sessionId, 20);
  setCheckpointHistory(checkpoints || []);
};

// Add history toggle in panel header (after existing title)
<button
  className={`checkpoint-tab ${showHistory ? 'active' : ''}`}
  onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
>
  📋 历史
</button>

// Add history list section (after existing checkpoint cards)
{showHistory && (
  <div className="checkpoint-history">
    {checkpointHistory.length === 0 && <div className="empty">暂无检查点历史</div>}
    {checkpointHistory.map(cp => (
      <div key={cp.ID} className="checkpoint-history-item">
        <span className="cp-tool">{cp.ToolName}</span>
        <span className="cp-turn">回合 {cp.Turn}</span>
        <span className="cp-status">{cp.Status}</span>
        <span className="cp-time">{formatTimeAgo(new Date(cp.CreatedAt))}</span>
        <button className="cp-resume" onClick={() => resumeFromCheckpoint(sessionId, cp.ID)}>
          ▶ 恢复
        </button>
        <button className="cp-delete" onClick={() => { deleteCheckpoint(cp.ID); loadHistory(); }}>
          🗑
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./... && cd frontend && npx tsc --noEmit`
Expected: Both succeed

- [ ] **Step 6: Commit**

```bash
git add CodeCast-desktop/main.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/components/CheckpointPanel.tsx
git commit -m "feat: activate CheckpointStore — expose checkpoint history, resume, delete to frontend"
```

---

### Task 4: Metrics — Stream AP Metrics to Frontend

**Files:**
- Modify: `CodeCast-desktop/main.go` — add Wails bindings + start MetricsExporter
- Modify: `CodeCast-desktop/event_bridge.go` — add periodic metrics emission
- Create: `CodeCast-desktop/frontend/src/store/useMetricsStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/index.ts`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`

- [ ] **Step 1: Add TypeScript types in api/types.ts**

```typescript
export interface APMetricsSnapshot {
  llmTotalCalls:     number;
  llmTotalErrors:    number;
  toolTotalCalls:    number;
  toolTotalErrors:   number;
  totalTurns:        number;
  totalEpisodes:     number;
  activeAgents:      number;
  poolQueueLength:   number;
  memorySizeBytes:   number;
  llmLatencyP50:     number;
  llmLatencyP99:     number;
  toolLatencyP50:    number;
  toolLatencyP99:    number;
  tokenUsageByModel: Record<string, TokenUsageStats>;
}

export interface TokenUsageStats {
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
}
```

- [ ] **Step 2: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
GetAPMetricsSnapshot(): Promise<APMetricsSnapshot>;
GetMetricsExportPrometheus(): Promise<string>;
```

Add exported functions:

```typescript
export const getAPMetricsSnapshot = () => callGo('GetAPMetricsSnapshot');
export const getMetricsExportPrometheus = () => callGo('GetMetricsExportPrometheus');
```

- [ ] **Step 3: Add Go Wails bindings in main.go**

```go
// APMetricsSnapshotData is the JSON-serializable metrics snapshot for the frontend.
type APMetricsSnapshotData struct {
	LLMTotalCalls   int64                     `json:"llmTotalCalls"`
	LLMTotalErrors  int64                     `json:"llmTotalErrors"`
	ToolTotalCalls  int64                     `json:"toolTotalCalls"`
	ToolTotalErrors int64                     `json:"toolTotalErrors"`
	TotalTurns      int64                     `json:"totalTurns"`
	TotalEpisodes   int64                     `json:"totalEpisodes"`
	ActiveAgents    int64                     `json:"activeAgents"`
	PoolQueueLength int64                     `json:"poolQueueLength"`
	MemorySizeBytes int64                     `json:"memorySizeBytes"`
	LLMLatencyP50   float64                   `json:"llmLatencyP50"`
	LLMLatencyP99   float64                   `json:"llmLatencyP99"`
	ToolLatencyP50  float64                   `json:"toolLatencyP50"`
	ToolLatencyP99  float64                   `json:"toolLatencyP99"`
	TokenUsageByModel map[string]TokenUsageData `json:"tokenUsageByModel"`
}

type TokenUsageData struct {
	PromptTokens     int64 `json:"promptTokens"`
	CompletionTokens int64 `json:"completionTokens"`
	TotalTokens      int64 `json:"totalTokens"`
}

// GetAPMetricsSnapshot returns the current AP metrics snapshot.
func (a *App) GetAPMetricsSnapshot() APMetricsSnapshotData {
	if a.metricsCollector == nil {
		return APMetricsSnapshotData{}
	}
	snap := a.metricsCollector.Snapshot()
	data := APMetricsSnapshotData{
		LLMTotalCalls:   snap.LLMTotalCalls,
		LLMTotalErrors:  snap.LLMTotalErrors,
		ToolTotalCalls:  snap.ToolTotalCalls,
		ToolTotalErrors: snap.ToolTotalErrors,
		TotalTurns:      snap.TotalTurns,
		TotalEpisodes:   snap.TotalEpisodes,
		ActiveAgents:    snap.ActiveAgents,
		PoolQueueLength: snap.PoolQueueLength,
		MemorySizeBytes: snap.MemorySizeBytes,
		TokenUsageByModel: make(map[string]TokenUsageData),
	}
	if snap.LLMLatencyMs != nil {
		data.LLMLatencyP50 = snap.LLMLatencyMs.Percentile(50)
		data.LLMLatencyP99 = snap.LLMLatencyMs.Percentile(99)
	}
	if snap.ToolLatencyMs != nil {
		data.ToolLatencyP50 = snap.ToolLatencyMs.Percentile(50)
		data.ToolLatencyP99 = snap.ToolLatencyMs.Percentile(99)
	}
	for model, usage := range snap.TokenUsageByModel {
		data.TokenUsageByModel[model] = TokenUsageData{
			PromptTokens:     usage.PromptTokens,
			CompletionTokens: usage.CompletionTokens,
			TotalTokens:      usage.TotalTokens,
		}
	}
	return data
}

// GetMetricsExportPrometheus returns metrics in Prometheus text format.
func (a *App) GetMetricsExportPrometheus() string {
	if a.metricsCollector == nil {
		return ""
	}
	return a.metricsCollector.String()
}
```

- [ ] **Step 4: Add periodic metrics emission in event_bridge.go**

Add to `startEventBridge()`, after the existing event subscription loop:

```go
	// AP Metrics broadcast (every 10s)
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
				if a.metricsCollector != nil {
					snap := a.GetAPMetricsSnapshot()
					wailsRuntime.EventsEmit(a.ctx, "metrics:snapshot", snap)
				}
			}
		}
	}()
```

- [ ] **Step 5: Create useMetricsStore.ts**

```typescript
import { StateCreator } from 'zustand';
import type { APMetricsSnapshot } from '../api/types';

export interface MetricsSlice {
  apMetrics: APMetricsSnapshot | null;
  setAPMetrics: (metrics: APMetricsSnapshot) => void;
  handleMetricsEvent: (snapshot: APMetricsSnapshot) => void;
}

export const createMetricsSlice: StateCreator<MetricsSlice> = (set) => ({
  apMetrics: null,

  setAPMetrics: (metrics) => set({ apMetrics: metrics }),

  handleMetricsEvent: (snapshot) => set({ apMetrics: snapshot }),
});
```

- [ ] **Step 6: Compose into store/index.ts**

Add import:

```typescript
import { createMetricsSlice, MetricsSlice } from './useMetricsStore';
```

Add `MetricsSlice &` to `AppState`, and spread `createMetricsSlice` into the store creator.

- [ ] **Step 7: Subscribe to metrics events**

In the Wails event listener (where agent events are handled), add:

```typescript
if (eventName === 'metrics:snapshot') {
  useAppStore.getState().handleMetricsEvent(payload);
}
```

- [ ] **Step 8: Start AP MetricsExporter in main.go startup()**

Add after `a.metricsCollector = ap.NewMetrics()` (line 122-123):

```go
		// Start periodic metrics logging via AP exporter
		metricsLogExporter := ap.NewLogExporter(slog.Default())
		a.metricsExporter = ap.NewMetricsExporter(a.metricsCollector, metricsLogExporter)
		a.metricsExporter.Start()
```

Add `metricsExporter *ap.MetricsExporter` field to App struct. Add shutdown:

```go
		if a.metricsExporter != nil {
			a.metricsExporter.Stop()
		}
```

- [ ] **Step 9: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./... && cd frontend && npx tsc --noEmit`
Expected: Both succeed

- [ ] **Step 10: Commit**

```bash
git add CodeCast-desktop/main.go CodeCast-desktop/event_bridge.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/store/useMetricsStore.ts CodeCast-desktop/frontend/src/store/index.ts
git commit -m "feat: activate AP Metrics — stream snapshots to frontend, add Prometheus export"
```

---

### Task 5: Integration Verification

- [ ] **Step 1: Run all Go tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test ./... -v -count=1`
Expected: ALL PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop/frontend" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run frontend tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop/frontend" && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Verify MCP integration manually**

1. Launch the app
2. Open Settings → MCP tab
3. Verify "Chrome DevTools MCP" appears with status
4. Click 🔧 to see tools list
5. Verify tools appear in the agent's tool catalog

- [ ] **Step 5: Verify Lifecycle events**

1. Send a chat message
2. Check browser console for `lifecycle:states` events
3. Verify agent state transitions (idle → running → completed)

- [ ] **Step 6: Verify Checkpoint history**

1. Trigger a high-risk tool call (e.g., write_file)
2. Approve the checkpoint
3. Click "📋 历史" tab in CheckpointPanel
4. Verify the checkpoint appears in history
5. Click "▶ 恢复" and verify agent resumes

- [ ] **Step 7: Verify Metrics streaming**

1. Send several chat messages
2. Check browser console for `metrics:snapshot` events
3. Verify LLM call counts increment
4. Call `GetMetricsExportPrometheus()` and verify output

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 integration verification — all 4 dead subsystems activated"
```

---

## Self-Review

### Spec Coverage Check
| Requirement | Task |
|------------|------|
| MCPRegistry activation | Task 1 (mcp_bridge.go) |
| Lifecycle state exposure | Task 2 (event bridge + store) |
| CheckpointStore history | Task 3 (bindings + UI) |
| Metrics streaming | Task 4 (snapshot + exporter) |
| Frontend integration for all 4 | Tasks 1-4 each have frontend changes |
| Backward compatibility | All new methods are additive, no existing methods changed |

### Placeholder Scan
- No TBD/TODO found
- All code blocks contain complete implementations
- All test code is complete

### Type Consistency
- `MCPStatusEntry` / `MCPConnectionResult` — defined in mcp_bridge.go, matches api.ts types
- `CheckpointInfo` — defined in main.go, matches api/types.ts
- `APMetricsSnapshotData` / `TokenUsageData` — defined in main.go, matches api/types.ts `APMetricsSnapshot` / `TokenUsageStats`
- `LifecycleState` — defined in api/types.ts, used in useLifecycleStore.ts
