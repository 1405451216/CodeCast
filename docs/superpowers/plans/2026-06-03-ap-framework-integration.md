# AP Framework Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely replace CodeCast's Agent core engine with the AgentPrimordia (AP) framework, gaining 9+ LLM Providers, RAG, Guardrails, DAG orchestration, and EventBus.

**Architecture:** Big Bang replacement — delete CodeCast's custom agent/memory/llm/mcp code, introduce AP as a Go module dependency, rewrite App struct to hold AP instances directly. Frontend switches to AP TypeScript SDK types. session.go monolith is decomposed into focused modules (chat.go, provider_factory.go, prompt_builder.go, checkpoint_hook.go, agent_bridge.go, event_bridge.go).

**Tech Stack:** Go 1.25, AgentPrimordia v0.1.0 (Go module), @agentprimordia/sdk v0.1.0 (TypeScript), Wails v2, React 18, Zustand

**Design Spec:** `docs/superpowers/specs/2026-06-03-ap-framework-integration-design.md`

**AP API Reference:** All API signatures below are verified against `D:\codecast\agentprimordia\agentprimordia\pkg\*.go`

---

## File Structure

### Backend (Go) — Files to CREATE

| File | Responsibility |
|------|---------------|
| `CodeCast-desktop/chat.go` | Main chat entry point `SendMessage`, delegates to AP Agent |
| `CodeCast-desktop/provider_factory.go` | LLM Provider factory (9+1 providers via AP) |
| `CodeCast-desktop/prompt_builder.go` | System prompt construction via AP PromptTemplate |
| `CodeCast-desktop/checkpoint_hook.go` | Checkpoint mechanism via AP HookBeforeTool |
| `CodeCast-desktop/agent_bridge.go` | Wails binding bridge methods for agent operations |
| `CodeCast-desktop/event_bridge.go` | AP EventBus → Wails Events forwarding |

### Backend (Go) — Files to DELETE

| File | Reason |
|------|--------|
| `CodeCast-desktop/agent.go` | Replaced by AP Pool + Agent |
| `CodeCast-desktop/agent_engine.go` | Replaced by AP ReActAgent |
| `CodeCast-desktop/agent_tools.go` | Replaced by AP Toolkit |
| `CodeCast-desktop/agent_persist.go` | Replaced by AP CheckpointStore |
| `CodeCast-desktop/memory.go` | Replaced by AP SQLiteStore + RAGStore |
| `CodeCast-desktop/llm/manager.go` | Replaced by AP Provider factory |
| `CodeCast-desktop/llm/provider.go` | Replaced by AP Provider interface |
| `CodeCast-desktop/llm/providers.go` | Replaced by AP Provider implementations |
| `CodeCast-desktop/mcp.go` | Replaced by AP MCPRegistry |
| `CodeCast-desktop/sandbox.go` | Replaced by AP Sandbox + ACL + Guardrails |
| `CodeCast-desktop/prompts.go` | Replaced by AP PromptTemplate |
| `CodeCast-desktop/context.go` | Replaced by AP ContextWindowStrategy + RAG |

### Backend (Go) — Files to MODIFY

| File | Changes |
|------|---------|
| `CodeCast-desktop/main.go` | App struct: replace agentPool/memory/llmConfig with AP instances |
| `CodeCast-desktop/session.go` | Decompose: keep only session CRUD, move chat/dispatch/cancel to new files |
| `CodeCast-desktop/config.go` | Adapt resolveCredentialsLocked to feed AP Provider factory |
| `CodeCast-desktop/shell.go` | Adapt ExecuteCommand to use AP Shell tool |
| `CodeCast-desktop/notes.go` | Move ToContextPrompt to prompt_builder.go, recordNotesAsync to Hook |
| `CodeCast-desktop/completor.go` | Switch LLM calls to use AP Provider |
| `CodeCast-desktop/notification.go` | Adapt event emission to use AP EventBus |
| `CodeCast-desktop/go.mod` | Add agentprimordia dependency, upgrade modernc.org/sqlite |

### Frontend (TypeScript) — Files to MODIFY

| File | Changes |
|------|---------|
| `frontend/src/api.ts` | Update Wails binding method signatures for AP types |
| `frontend/src/api/types.ts` | Replace Go* types with AP SDK types |
| `frontend/src/store/types.ts` | Replace Message/SubAgent/AgentEvent with SDK types |
| `frontend/src/store/useAgentStore.ts` | Rewrite using SDK AgentStatus/Response/Event |
| `frontend/src/store/useMessagesStore.ts` | Rewrite using SDK Message/ToolCall |
| `frontend/src/store/useModelStore.ts` | Rewrite using SDK ProviderConfig/ModelInfo |
| `frontend/src/store/useMemoryStore.ts` | Rewrite using SDK MemoryEpisode, connect to backend |
| `frontend/src/store/useSessionStore.ts` | Simplify to session bookkeeping only |
| `frontend/src/store/useCastAgentStore.ts` | Adapt to SDK PoolTask |
| `frontend/src/types/agent.ts` | Replace with SDK re-exports + CodeCast extensions |
| `frontend/src/types/models.ts` | Replace with SDK re-exports + UI extensions |
| `frontend/src/hooks/useChatSender.ts` | Adapt streaming event handling for AP EventBus |
| `frontend/src/hooks/useAppInit.ts` | Adapt agent event handling for AP EventBus |
| `frontend/src/components/AgentCard.tsx` | Adapt to SDK AgentStatus |
| `frontend/src/components/MessagesView.tsx` | Adapt to SDK Message |
| `frontend/src/components/MemoryVisualizer.tsx` | Adapt to SDK MemoryEpisode |
| `frontend/src/components/CheckpointPanel.tsx` | Adapt to AP Checkpoint Hook events |
| `frontend/package.json` | Add @agentprimordia/sdk dependency |

---

## Task Decomposition

Tasks are ordered by dependency. Each task produces a self-contained, testable change.

---

### Task 1: Add AP Module Dependency

**Files:**
- Modify: `CodeCast-desktop/go.mod`

- [ ] **Step 1: Add agentprimordia dependency to go.mod**

Run: `cd CodeCast-desktop && go get agentprimordia@v0.1.0`

Expected: go.mod and go.sum updated with agentprimordia dependency

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS (AP is imported but not yet used, so this should succeed)

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/go.mod CodeCast-desktop/go.sum
git commit -m "chore: add agentprimordia framework dependency"
```

---

### Task 2: Create Provider Factory

**Files:**
- Create: `CodeCast-desktop/provider_factory.go`

- [ ] **Step 1: Write provider_factory.go with createProvider method**

Create `CodeCast-desktop/provider_factory.go`:

```go
package main

import (
	"fmt"

	ap "agentprimordia/pkg"
)

// createProvider creates an AP LLM Provider based on current settings.
// It uses resolveCredentialsLocked() as the credential source.
// All AP Provider constructors return (*Provider, error).
func (a *App) createProvider() (ap.Provider, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	creds, err := a.resolveCredentialsLocked("")
	if err != nil {
		return nil, fmt.Errorf("resolve credentials: %w", err)
	}

	var primary ap.Provider
	switch creds.ProviderID {
	case "openai":
		p, err := ap.NewOpenAIProvider(ap.Config{APIKey: creds.APIKey, BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create OpenAI provider: %w", err)
		}
		primary = p
	case "anthropic":
		p, err := ap.NewAnthropicProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Anthropic provider: %w", err)
		}
		primary = p
	case "gemini":
		p, err := ap.NewGeminiProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Gemini provider: %w", err)
		}
		primary = p
	case "ollama":
		p, err := ap.NewOllamaProvider(ap.Config{BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Ollama provider: %w", err)
		}
		primary = p
	case "azure":
		p, err := ap.NewAzureOpenAIProvider(ap.AzureConfig{
			ResourceName:    creds.ResourceName,
			DeploymentName:  creds.Model,
			APIKey:          creds.APIKey,
			Temperature:     0.7,
		})
		if err != nil {
			return nil, fmt.Errorf("create Azure provider: %w", err)
		}
		primary = p
	case "qwen":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create Qwen provider: %w", err)
		}
		primary = p
	case "glm":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://open.bigmodel.cn/api/paas/v4",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create GLM provider: %w", err)
		}
		primary = p
	case "mistral":
		p, err := ap.NewMistralProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Mistral provider: %w", err)
		}
		primary = p
	case "cohere":
		p, err := ap.NewCohereProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Cohere provider: %w", err)
		}
		primary = p
	case "deepseek":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://api.deepseek.com",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create DeepSeek provider: %w", err)
		}
		primary = p
	default:
		p, err := ap.NewOpenAIProvider(ap.Config{APIKey: creds.APIKey, BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create default provider: %w", err)
		}
		primary = p
	}

	// Wrap with ResilientProvider for retry + fallback + circuit breaker
	resilient, err := ap.NewResilientProvider(primary, ap.DefaultResilientConfig())
	if err != nil {
		return nil, fmt.Errorf("create resilient provider: %w", err)
	}
	return resilient, nil
}
```

Note: This task assumes `resolveCredentialsLocked()` returns an `APICredentials` struct with `ProviderID`, `APIKey`, `APIURL`, `Model` fields. For Azure, it additionally needs `ResourceName`. Verify the actual field names in `config.go` and adapt accordingly.

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/provider_factory.go
git commit -m "feat: add AP provider factory with 9+1 provider support"
```

---

### Task 3: Create Prompt Builder

**Files:**
- Create: `CodeCast-desktop/prompt_builder.go`

- [ ] **Step 1: Write prompt_builder.go**

Create `CodeCast-desktop/prompt_builder.go` with the following logic:

1. Translate existing `PromptBase`, `PromptCoding`, `PromptDaily` constants into AP `PromptTemplate` format using `{{.Variable}}` syntax
2. Implement `buildSystemPrompt(session *Session) string` that:
   - Uses `ap.NewPromptTemplate(templateString)` for the base prompt (constructor takes a template string)
   - Injects session mode (coding/daily) specific prompt sections
   - Injects project context (path, language, framework)
   - Injects personality setting
   - Injects custom instructions
   - Injects skill prompt (if session has a skill)
   - Injects notes context (from `notes.ToContextPrompt()`)
3. Preserve all existing prompt content — no behavioral changes, only format migration

The key change: prompts are now constructed via `ap.NewPromptTemplate()` which supports `{{.Name}}`, `{{.ProjectPath}}`, `{{.Mode}}`, `{{.Personality}}`, `{{.CustomInstructions}}`, `{{.SkillPrompt}}`, `{{.NotesContext}}` variables.

```go
package main

import (
	"fmt"
	"strings"

	ap "agentprimordia/pkg"
)

// buildSystemPrompt constructs the system prompt using AP PromptTemplate.
func (a *App) buildSystemPrompt(session *Session) string {
	mode := "coding"
	if session.Mode == "daily" {
		mode = "daily"
	}

	personality := "专业"
	if a.settings != nil {
		personality = a.settings.Personality
	}

	notesContext := ""
	if a.notesStore != nil {
		notesContext = a.notesStore.ToContextPrompt()
	}

	skillPrompt := ""
	if session.SkillID != "" {
		skill := a.getSkill(session.SkillID)
		if skill != nil {
			skillPrompt = skill.Prompt
		}
	}

	customInstructions := ""
	if a.settings != nil {
		customInstructions = a.settings.CustomInstructions
	}

	projectPath := ""
	if a.settings != nil {
		projectPath = a.settings.ProjectPath
	}

	// Build template with all variables
	tmpl := ap.NewPromptTemplate(fmt.Sprintf(`%s

%s

## 项目信息
- 项目路径: {{.ProjectPath}}
- 对话模式: {{.Mode}}
- 个性设定: {{.Personality}}

{{if .CustomInstructions}}## 自定义指令
{{.CustomInstructions}}{{end}}

{{if .SkillPrompt}}## 技能提示
{{.SkillPrompt}}{{end}}

{{if .NotesContext}}## 笔记上下文
{{.NotesContext}}{{end}}
`, PromptBase, modePrompt(mode)))

	// Execute template with variables
	result := tmpl.Execute(map[string]string{
		"ProjectPath":       projectPath,
		"Mode":              mode,
		"Personality":       personality,
		"CustomInstructions": customInstructions,
		"SkillPrompt":       skillPrompt,
		"NotesContext":      notesContext,
	})

	return result
}

// modePrompt returns the mode-specific prompt section.
func modePrompt(mode string) string {
	switch mode {
	case "coding":
		return PromptCoding
	case "daily":
		return PromptDaily
	default:
		return PromptCoding
	}
}
```

Note: `PromptBase`, `PromptCoding`, `PromptDaily` are the existing prompt constants from `prompts.go`. They will be preserved verbatim in this file until `prompts.go` is deleted in Task 10, at which point the constants move here.

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/prompt_builder.go
git commit -m "feat: add AP prompt builder with template variable support"
```

---

### Task 4: Create Checkpoint Hook

**Files:**
- Create: `CodeCast-desktop/checkpoint_hook.go`

- [ ] **Step 1: Write checkpoint_hook.go**

Implement the Checkpoint mechanism using AP's `HookBeforeTool`.

AP's `HookFunc` signature is: `func(ctx context.Context, hctx *HookContext) error`

```go
package main

import (
	"context"
	"fmt"
	"time"

	ap "agentprimordia/pkg"
)

// checkpointHook is an AP HookFunc that intercepts high-risk tool calls
// and waits for user confirmation before proceeding.
// Signature matches: ap.HookFunc = func(ctx context.Context, hctx *HookContext) error
func (a *App) checkpointHook(ctx context.Context, hctx *ap.HookContext) error {
	toolName := hctx.ToolCall.Name

	// High-risk tools require user confirmation
	highRiskTools := map[string]bool{
		"write_file": true, "edit_file": true, "run_command": true,
	}
	if !highRiskTools[toolName] {
		return nil // Low-risk tools pass through
	}

	// Build a unique checkpoint ID
	checkpointID := hctx.AgentID + "_" + toolName + "_" + fmt.Sprintf("%d", time.Now().UnixNano())

	// Assess risk level
	riskLevel := a.assessRiskLevel(toolName, string(hctx.ToolCall.Arguments))

	// Notify frontend via EventBus
	a.eventBus.PublishAsync(ap.Event{
		Type: ap.EventToolCall,
		Source: "checkpoint",
		Payload: map[string]any{
			"checkpoint_id": checkpointID,
			"tool_name":     toolName,
			"tool_args":     string(hctx.ToolCall.Arguments),
			"risk_level":    riskLevel,
			"agent_id":      hctx.AgentID,
			"session_id":    hctx.SessionID,
		},
	})

	// Block and wait for user confirmation
	confirmed := a.waitForCheckpointConfirmation(checkpointID)
	if !confirmed {
		return fmt.Errorf("用户拒绝了工具调用: %s", toolName)
	}
	return nil
}

// waitForCheckpointConfirmation blocks the current goroutine until the
// frontend user confirms or rejects the checkpoint, or until timeout.
func (a *App) waitForCheckpointConfirmation(checkpointID string) bool {
	ch := make(chan bool, 1)
	a.mu.Lock()
	a.checkpointConfirmations[checkpointID] = ch
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		delete(a.checkpointConfirmations, checkpointID)
		a.mu.Unlock()
	}()

	select {
	case confirmed := <-ch:
		return confirmed
	case <-time.After(5 * time.Minute):
		return false // Timeout auto-reject
	}
}

// ResolveCheckpoint is a Wails binding method called by the frontend
// when the user approves or rejects a checkpoint.
func (a *App) ResolveCheckpoint(checkpointID string, approved bool) {
	a.mu.Lock()
	ch, ok := a.checkpointConfirmations[checkpointID]
	a.mu.Unlock()
	if ok {
		ch <- approved
	}
}

// assessRiskLevel returns "low", "medium", or "high" based on tool + args analysis.
func (a *App) assessRiskLevel(toolName string, args string) string {
	switch toolName {
	case "run_command":
		return "high"
	case "write_file", "edit_file":
		return "medium"
	default:
		return "low"
	}
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/checkpoint_hook.go
git commit -m "feat: implement checkpoint mechanism via AP HookBeforeTool"
```

---

### Task 5: Create Event Bridge

**Files:**
- Create: `CodeCast-desktop/event_bridge.go`

- [ ] **Step 1: Write event_bridge.go**

Implement AP EventBus → Wails Events forwarding.

AP's `Bus.Subscribe(eventType)` returns `(<-chan Event, subscriberID string)` — it uses channels, not callbacks.

```go
package main

import (
	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// startEventBridge subscribes to AP EventBus events and forwards them to Wails frontend.
// AP Bus uses channel-based subscriptions: Subscribe(eventType) returns (<-chan Event, subscriberID)
func (a *App) startEventBridge() {
	// Map AP event types to Wails event names
	eventMap := map[ap.EventType]string{
		ap.EventAgentStart:   "agent:start",
		ap.EventAgentStop:    "agent:stop",
		ap.EventAgentError:   "agent:error",
		ap.EventTurnStart:    "agent:turn",
		ap.EventTurnEnd:      "agent:turn_end",
		ap.EventToolCall:     "agent:tool",
		ap.EventToolResult:   "agent:tool_result",
		ap.EventPoolDispatch: "pool:dispatch",
		ap.EventPoolComplete: "pool:complete",
	}

	for apEventType, wailsEventName := range eventMap {
		ch, _ := a.eventBus.Subscribe(apEventType)
		go func(ch <-chan ap.Event, wailsName string) {
			for evt := range ch {
				wailsRuntime.EventsEmit(a.ctx, wailsName, evt.Payload)
			}
		}(ch, wailsEventName)
	}
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/event_bridge.go
git commit -m "feat: add AP EventBus to Wails Events bridge"
```

---

### Task 6: Create Chat Entry Point

**Files:**
- Create: `CodeCast-desktop/chat.go`

- [ ] **Step 1: Write chat.go**

Implement the main chat entry point using AP Agent.

Key AP API details:
- `Agent.Run(ctx, Message) (*Response, error)` — no variadic opts
- `Agent.StreamRun(ctx, Message) (<-chan StreamEvent, error)` — for streaming
- `ap.UserMessage(content string) Message` — helper to create user messages
- `StreamEvent` has `Type` (StreamEventToken/StreamEventThought/etc.) and `Content` fields

```go
package main

import (
	"context"
	"fmt"

	ap "agentprimordia/pkg"
)

// SendMessage sends a chat message using the default model.
func (a *App) SendMessage(sessionID, input string) ([]Message, error) {
	return a.SendMessageEx(sessionID, input, "", "")
}

// SendMessageEx is the core chat method using AP Agent.
func (a *App) SendMessageEx(sessionID, input, model, thinking string) ([]Message, error) {
	session := a.getSession(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// Get or create session-scoped Agent
	agent, cancel, err := a.getOrCreateAgent(sessionID, model)
	if err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	// Create a context for this request (cancellable)
	ctx, reqCancel := context.WithCancel(a.ctx)
	defer reqCancel()

	// Store cancel func so CancelRequest() can abort this request
	a.mu.Lock()
	a.sessionCancels[sessionID] = func() {
		reqCancel()
		if cancel != nil {
			cancel()
		}
	}
	a.mu.Unlock()

	// Use StreamRun for real-time token streaming
	streamCh, err := agent.StreamRun(ctx, ap.UserMessage(input))
	if err != nil {
		return nil, fmt.Errorf("agent stream run: %w", err)
	}

	// Collect streaming events and forward to frontend
	var fullContent string
	for evt := range streamCh {
		switch evt.Type {
		case ap.StreamEventToken:
			fullContent += evt.Content
			// Forward streaming token to frontend via Wails Events
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type":    "content",
				"content": evt.Content,
			})
		case ap.StreamEventThought:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type":    "reasoning",
				"content": evt.Content,
			})
		case ap.StreamEventToolCall:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type":    "tool_call",
				"content": evt.Content,
			})
		case ap.StreamEventToolResult:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type":    "tool_result",
				"content": evt.Content,
			})
		case ap.StreamEventError:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type":    "error",
				"content": evt.Content,
			})
		case ap.StreamEventComplete:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "done",
			})
		}
	}

	// Save memory episodes via AP Memory
	a.memory.Add(a.ctx, &ap.Episode{
		SessionID: sessionID,
		Role:      string(ap.RoleUser),
		Content:   input,
	})
	a.memory.Add(a.ctx, &ap.Episode{
		SessionID: sessionID,
		Role:      string(ap.RoleAssistant),
		Content:   fullContent,
	})

	// Return messages in the format expected by frontend (Wails compatibility)
	return []Message{
		{Role: "user", Content: input},
		{Role: "assistant", Content: fullContent},
	}, nil
}

// getOrCreateAgent returns a session-scoped AP Agent, creating one if needed.
func (a *App) getOrCreateAgent(sessionID string, model string) (ap.Agent, context.CancelFunc, error) {
	a.mu.RLock()
	if agent, ok := a.sessionAgents[sessionID]; ok {
		a.mu.RUnlock()
		return agent, nil, nil
	}
	a.mu.RUnlock()

	// Create new provider for this session
	provider, err := a.createProvider()
	if err != nil {
		return nil, nil, err
	}

	session := a.getSession(sessionID)

	// Create session-scoped Agent using AP ReActConfig
	agent := ap.NewReActAgent(ap.ReActConfig{
		Name:          "CodeCast-" + sessionID[:8],
		SystemPrompt:  a.buildSystemPrompt(session),
		Model:         provider,               // AP uses "Model" field for llm.Provider
		Toolkit:       a.toolkit,              // AP uses "Toolkit" field for *tools.Registry
		Memory:        ap.NewMemoryAdapter(a.memory), // Bridge ap.Memory to agent.MemoryStore
		EventPublisher: ap.NewEventBusAdapter(a.eventBus),
		Metrics:       ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow: ap.NewDefaultStrategy(80),     // Keep last 80 messages
		Hooks:         a.hooks,
		MaxTurns:      20,
		RAG: &ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     5,
		},
	})

	a.mu.Lock()
	a.sessionAgents[sessionID] = agent
	a.mu.Unlock()

	return agent, nil, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS (may have duplicate method errors with session.go — will resolve in Task 9)

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/chat.go
git commit -m "feat: add AP-powered chat entry point with StreamRun"
```

---

### Task 7: Create Agent Bridge

**Files:**
- Create: `CodeCast-desktop/agent_bridge.go`

- [ ] **Step 1: Write agent_bridge.go**

Implement Wails binding bridge methods for agent operations using AP Pool.

Key AP Pool API:
- `NewPool(cfg PoolConfig) *Pool` — constructor
- `Pool.Submit(task TaskConfig) error` — submit a task
- Pool uses `AgentFactory` func type: `func(config AgentFactoryConfig) agent.Agent`

```go
package main

import (
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

// AgentInfo is the Wails-compatible struct for frontend agent display.
type AgentInfo struct {
	ID          string `json:"id"`
	SessionID   string `json:"sessionId"`
	Title       string `json:"title"`
	Status      string `json:"status"`
	Turn        int    `json:"turn"`
	MaxTurns    int    `json:"maxTurns"`
	Result      string `json:"result,omitempty"`
	Error       string `json:"error,omitempty"`
	LastToolName string `json:"lastToolName,omitempty"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// DispatchAgents parses task descriptions and dispatches them via AP Pool.
func (a *App) DispatchAgents(tasksJSON string) ([]string, error) {
	var tasks []struct {
		Title   string `json:"title"`
		Prompt  string `json:"prompt"`
	}
	if err := json.Unmarshal([]byte(tasksJSON), &tasks); err != nil {
		return nil, fmt.Errorf("parse tasks: %w", err)
	}

	var taskIDs []string
	for _, t := range tasks {
		taskCfg := ap.TaskConfig{
			Title:    t.Title,
			Prompt:   t.Prompt,
			MaxTurns: 10,
		}
		if err := a.pool.Submit(taskCfg); err != nil {
			return taskIDs, fmt.Errorf("submit task %q: %w", t.Title, err)
		}
		taskIDs = append(taskIDs, taskCfg.ID)
	}
	return taskIDs, nil
}

// GetAgents returns agent info for a session.
func (a *App) GetAgents(sessionID string) []AgentInfo {
	// AP Pool exposes Stats() for task info
	stats := a.pool.Stats()
	var agents []AgentInfo
	for _, task := range stats.ActiveTasks {
		agents = append(agents, AgentInfo{
			ID:        task.ID,
			SessionID: task.SessionID,
			Title:     task.Title,
			Status:    string(task.Status),
			MaxTurns:  task.MaxTurns,
		})
	}
	return agents
}

// GetAgentDetail returns a single agent's detail.
func (a *App) GetAgentDetail(agentID string) *AgentInfo {
	stats := a.pool.Stats()
	for _, task := range stats.ActiveTasks {
		if task.ID == agentID {
			return &AgentInfo{
				ID:        task.ID,
				SessionID: task.SessionID,
				Title:     task.Title,
				Status:    string(task.Status),
				MaxTurns:  task.MaxTurns,
			}
		}
	}
	return nil
}

// CancelAgent cancels a running agent via AP Pool.
func (a *App) CancelAgent(agentID string) error {
	return a.pool.Cancel(agentID)
}

// CancelSessionAgents cancels all agents for a session.
func (a *App) CancelSessionAgents(sessionID string) error {
	stats := a.pool.Stats()
	for _, task := range stats.ActiveTasks {
		if task.SessionID == sessionID {
			_ = a.pool.Cancel(task.ID)
		}
	}
	return nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS (may have duplicate method errors — will resolve in Task 9)

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/agent_bridge.go
git commit -m "feat: add agent bridge methods for AP Pool integration"
```

---

### Task 8: Rewrite App Struct and Startup — THE CRITICAL TASK

**Files:**
- Modify: `CodeCast-desktop/main.go`

This is the central task that connects everything. It modifies the App struct to hold AP instances and rewrites the startup/shutdown lifecycle.

- [ ] **Step 1: Update App struct in main.go**

Replace:
```go
agentPool        *AgentPool
llmConfig        LLMProviderConfig
memory           *MemoryStore
```

With:
```go
// AP 框架核心
agent             ap.Agent                  // 主对话 ReActAgent（default）
pool              *ap.Pool                  // 多 Agent 并发调度
memory            *ap.SQLiteStore           // 记忆存储（ap.Memory interface impl）
ragStore          *ap.RAGStore              // RAG 混合检索
toolkit           *ap.ToolRegistry          // 工具注册中心（ap.ToolRegistry = tools.Registry）
mcpReg            *ap.MCPRegistry           // MCP Server 注册中心
eventBus          *ap.Bus                   // 事件总线
metricsCollector  *ap.AgentMetricsCollector // 指标收集（ap.AgentMetricsCollector = metrics.AgentMetrics）
guardrail         *ap.GuardrailEngine       // 安全护栏
hooks             *ap.HookManager           // 生命周期钩子（ap.Hooks = *HookManager）
checkpointStore   ap.CheckpointStore        // 检查点持久化接口
lifecycle         *ap.Lifecycle             // Agent 状态机
sessionAgents     map[string]ap.Agent       // 会话级 Agent 缓存
sessionCancels    map[string]context.CancelFunc // 会话级取消函数

// CodeCast 应用层
llmConfig                 LLMProviderConfig  // 保留，作为 provider_factory 的凭证源
completor                 *CodeCompletor
checkpointConfirmations   map[string]chan bool // Checkpoint 确认通道
```

Remove: `agentPool *AgentPool`, `memory *MemoryStore` (replaced by AP)

- [ ] **Step 2: Rewrite startup() method**

Replace the startup initialization to use verified AP API signatures:

```go
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 1. 初始化 AP 记忆存储
	memoryPath := filepath.Join(a.dataDir, "memory.db")
	a.memory, _ = ap.NewSQLiteStore(memoryPath)

	// 2. 初始化 AP 事件总线（bufferSize=64）
	a.eventBus = ap.NewBus(64)

	// 3. 初始化 AP 指标收集
	a.metricsCollector = ap.NewMetrics()

	// 4. 初始化 AP 安全系统
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrail.AddRule(ap.NewPIIRule(ap.DefaultPIIRuleConfig()))
	acl := ap.NewACL()
	sandbox := ap.NewSandbox(acl)

	// 5. 初始化 AP 工具系统
	// DefaultToolkit(rootDir string) (*Registry, []Tool, error)
	projectPath := ""
	if a.settings != nil {
		projectPath = a.settings.ProjectPath
	}
	a.toolkit, _, _ = ap.DefaultToolkit(projectPath)

	// 6. 注册 Checkpoint Hook
	a.hooks = ap.NewHookManager()
	// HookFunc signature: func(ctx context.Context, hctx *HookContext) error
	a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)

	// 7. 初始化 AP MCP 注册中心
	a.mcpReg = ap.NewMCPRegistry()

	// 8. 初始化 AP 检查点存储
	checkpointPath := filepath.Join(a.dataDir, "checkpoints.db")
	a.checkpointStore, _ = ap.NewSQLiteCheckpointStore(checkpointPath)

	// 9. 初始化 AP 生命周期
	a.lifecycle = ap.NewLifecycle()

	// 10. 初始化 RAG（需要 provider 做 embedding）
	provider, _ := a.createProvider()
	embeddingAdapter := ap.NewEmbeddingAdapter(provider, 1536)
	a.ragStore = ap.NewRAGStore(a.memory, embeddingAdapter)

	// 11. 创建默认 Agent
	a.agent = ap.NewReActAgent(ap.ReActConfig{
		Name:            "CodeCast",
		SystemPrompt:    a.buildSystemPrompt(nil),
		Model:           provider,                         // ReActConfig.Model = llm.Provider
		Toolkit:         a.toolkit,                        // ReActConfig.Toolkit = *tools.Registry
		Memory:          ap.NewMemoryAdapter(a.memory),    // Bridge Memory → MemoryStore
		EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
		Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow:   ap.NewDefaultStrategy(80),
		Hooks:           a.hooks,                          // ReActConfig.Hooks = Hooks = *HookManager
		Lifecycle:       a.lifecycle,
		CheckpointStore: a.checkpointStore,
		MaxTurns:        20,
		RAG: &ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     5,
		},
	})

	// 12. 初始化 AP Agent Pool
	a.pool = ap.NewPool(ap.PoolConfig{
		MaxConcurrency: 5,
		Timeout:        5 * time.Minute,
		DefaultAgent: ap.ReActAgentConfig{
			SystemPrompt: "你是一个代码助手子代理",
			MaxTurns:     10,
		},
	})
	a.pool.SetModel(provider)

	// 13. 启动事件桥接
	a.startEventBridge()

	// 14. 初始化会话级缓存
	a.sessionAgents = make(map[string]ap.Agent)
	a.sessionCancels = make(map[string]context.CancelFunc)
	a.checkpointConfirmations = make(map[string]chan bool)
}
```

- [ ] **Step 3: Rewrite shutdown() method**

```go
func (a *App) shutdown(ctx context.Context) {
	// Cancel all session contexts
	a.mu.Lock()
	for _, cancel := range a.sessionCancels {
		cancel()
	}
	a.mu.Unlock()

	// Close AP components
	if a.pool != nil {
		a.pool.Close()
	}
	if a.eventBus != nil {
		a.eventBus.Close()
	}
	if a.memory != nil {
		a.memory.Close()
	}
	if a.notesStore != nil {
		a.notesStore.Close()
	}
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CodeCast-desktop/main.go
git commit -m "feat: rewrite App struct with AP framework instances"
```

---

### Task 9: Decompose session.go

**Files:**
- Modify: `CodeCast-desktop/session.go`

This is the most complex task. The 1474-line session.go monolith must be decomposed.

- [ ] **Step 1: Remove migrated methods from session.go**

Remove from session.go (now in other files):
- `SendMessage` / `SendMessageEx` → moved to `chat.go`
- `DispatchAgents` / `GetAgents` / `GetAgentDetail` / `CancelAgent` / `CancelSessionAgents` → moved to `agent_bridge.go`
- `buildSystemPrompt` → moved to `prompt_builder.go`
- `callAPI` / `callAPIEx` → replaced by AP Agent
- `buildContextAssembly` / `buildMessageSequence` → replaced by AP ContextWindowStrategy
- `injectToolDetails` → replaced by AP dynamic tool loading
- `mainChatToolDefinitions` → replaced by AP ToolRegistry
- `resolveCredentialsLocked` → stays in config.go (already there)
- `waitForCheckpointConfirmation` / `ResolveCheckpoint` → moved to `checkpoint_hook.go`
- `checkpointHook` / `assessRiskLevel` → moved to `checkpoint_hook.go`

- [ ] **Step 2: Keep only session CRUD in session.go**

Session.go should only contain:
- `Session` type definition
- `NewSession()`
- `GetSessions()` / `CreateSession()` / `GetSession()` / `DeleteSession()` / etc.
- `SearchSessions()` / `ExportSession()` / `RenameSession()` / `GetSessionsByMode()`
- `BatchDeleteSessions()`
- Session archive methods

- [ ] **Step 3: Adapt memory-related Wails bindings**

Update these methods to use AP Memory (ap.Memory interface):
- `ResetMemory()` → calls `a.memory.ClearAll(ctx, "")` 
- `GetMemoryStats()` → calls `a.memory.Stats(ctx)` which returns `*ap.MemoryStats`
- `ClearMemory()` → calls `a.memory.ClearAll(ctx, "")`
- `recordToolIfEnabled()` → uses AP Memory `RecordToolUse(ctx, sessionID, agentName, toolName, args, result)`

- [ ] **Step 4: Adapt cancel methods**

Update these methods to use AP context cancellation:
- `CancelRequest()` → calls the session's cancel func from `a.sessionCancels`
- `CancelSessionRequest(sessionID)` → calls `a.sessionCancels[sessionID]()`

- [ ] **Step 5: Adapt skill methods**

Skill methods remain in session.go — they are application-level logic, no AP dependency.

- [ ] **Step 6: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add CodeCast-desktop/session.go
git commit -m "refactor: decompose session.go monolith, keep only session CRUD"
```

---

### Task 10: Delete Replaced Backend Files

**Files:**
- Delete: `CodeCast-desktop/agent.go`
- Delete: `CodeCast-desktop/agent_engine.go`
- Delete: `CodeCast-desktop/agent_tools.go`
- Delete: `CodeCast-desktop/agent_persist.go`
- Delete: `CodeCast-desktop/memory.go`
- Delete: `CodeCast-desktop/llm/manager.go`
- Delete: `CodeCast-desktop/llm/provider.go`
- Delete: `CodeCast-desktop/llm/providers.go`
- Delete: `CodeCast-desktop/mcp.go`
- Delete: `CodeCast-desktop/sandbox.go`
- Delete: `CodeCast-desktop/prompts.go`
- Delete: `CodeCast-desktop/context.go`

- [ ] **Step 1: Delete each file**

```bash
cd CodeCast-desktop
del agent.go agent_engine.go agent_tools.go agent_persist.go
del memory.go mcp.go sandbox.go prompts.go context.go
rmdir /s /q llm
```

- [ ] **Step 2: Fix any remaining references**

Search for imports/references to deleted types:
- `AgentPool` → replaced by `ap.Pool`
- `SubAgent` → replaced by `AgentInfo` (agent_bridge.go)
- `MemoryStore` → replaced by `ap.SQLiteStore`
- `LLMResponse` → replaced by `ap.Response`
- `httpClient` → no longer needed (AP has its own HTTP client)
- `PromptBase` / `PromptCoding` / `PromptDaily` → now in `prompt_builder.go`

Fix all compilation errors.

- [ ] **Step 3: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A CodeCast-desktop/
git commit -m "refactor: delete replaced backend files (agent, memory, llm, mcp, sandbox, prompts, context)"
```

---

### Task 11: Adapt Remaining Backend Files

**Files:**
- Modify: `CodeCast-desktop/config.go`
- Modify: `CodeCast-desktop/shell.go`
- Modify: `CodeCast-desktop/notes.go`
- Modify: `CodeCast-desktop/completor.go`
- Modify: `CodeCast-desktop/notification.go`

- [ ] **Step 1: Adapt config.go**

- Update `resolveCredentialsLocked()` to work with `provider_factory.go`
- Update `GetProviders()` / `GetProviderModels()` to include all 9+1 AP providers
- Update `GetModelConfigs()` / `AddModelConfig()` etc. to work with AP Provider types
- Remove references to deleted `llm/` package

- [ ] **Step 2: Adapt shell.go**

- `ExecuteCommand()` can remain largely unchanged — it's called directly by the frontend and is independent of the Agent engine
- If AP's Shell tool is used for agent commands, this method is still needed for direct frontend execution

- [ ] **Step 3: Adapt notes.go**

- Move `ToContextPrompt()` call from session.go to `prompt_builder.go` (already done in Task 3)
- `recordNotesAsync()` should be triggered via AP Hook (`HookAfterRun`) instead of hardcoded in SendMessage:

```go
// Register HookAfterRun to trigger note recording
a.hooks.Register(ap.HookAfterRun, func(ctx context.Context, hctx *ap.HookContext) error {
	go a.recordNotesAsync(hctx.SessionID)
	return nil
})
```

- [ ] **Step 4: Adapt completor.go**

- Replace `getOpenAICompletions()` / `streamOpenAICompletions()` to use `a.createProvider()` for LLM calls
- The L3 local cache and L1 symbol index remain unchanged
- L2 AI completion uses AP Provider via `provider.Complete(ctx, req)`

- [ ] **Step 5: Adapt notification.go**

- Replace `wailsRuntime.EventsEmit` calls with `a.eventBus.PublishAsync()` where appropriate
- The event_bridge.go will forward to Wails Events
- For direct frontend notifications that don't need AP EventBus, keep `wailsRuntime.EventsEmit`

- [ ] **Step 6: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add CodeCast-desktop/config.go CodeCast-desktop/shell.go CodeCast-desktop/notes.go CodeCast-desktop/completor.go CodeCast-desktop/notification.go
git commit -m "refactor: adapt remaining backend files for AP framework"
```

---

### Task 12: Add AP TypeScript SDK to Frontend

**Files:**
- Modify: `CodeCast-desktop/frontend/package.json`

- [ ] **Step 1: Install AP TypeScript SDK**

```bash
cd CodeCast-desktop/frontend
npm install @agentprimordia/sdk@^0.1.0
```

- [ ] **Step 2: Verify SDK types are available**

Run: `npx tsc --noEmit`

Expected: PASS (SDK installed but not yet used)

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/frontend/package.json CodeCast-desktop/frontend/package-lock.json
git commit -m "chore: add @agentprimordia/sdk TypeScript dependency"
```

---

### Task 13: Rewrite Frontend Types and Store

**Files:**
- Modify: `CodeCast-desktop/frontend/src/store/types.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/types/agent.ts`
- Modify: `CodeCast-desktop/frontend/src/types/models.ts`

- [ ] **Step 1: Update store/types.ts**

Replace CodeCast types with AP SDK re-exports + CodeCast extensions:

```typescript
// Re-export AP SDK types
export type { Message, ToolCall, ToolResult, AgentStatus, Response, AgentMetrics, Usage, MemoryEpisode, MemoryStats } from '@agentprimordia/sdk';
export { ErrorCodes } from '@agentprimordia/sdk';

// CodeCast-specific extensions
export interface Session {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Mode: 'coding' | 'daily' | '';
  // Messages removed — now managed by AP Memory
}

export interface AgentInfo {
  id: string;
  sessionId: string;
  title: string;
  status: AgentStatus;
  turn: number;
  maxTurns: number;
  result?: string;
  error?: string;
  lastToolName?: string;
  createdAt: string;
  updatedAt: string;
}

// Keep CodeCast-specific types
export interface Project { /* unchanged */ }
export interface SlashCommand { /* unchanged */ }
export interface TodoItem { /* unchanged */ }
// ... other CodeCast-specific types unchanged
```

- [ ] **Step 2: Update api/types.ts**

Update Go type conversions to align with AP SDK types:

```typescript
import type { Message } from '@agentprimordia/sdk';

export interface GoMessage {
  ID: string;
  Role: string;
  Content: string;
  Reasoning?: string;
  ToolCalls?: GoToolCall[];
  Timestamp: number;
}

export function toMessage(gm: GoMessage): Message {
  return {
    role: gm.Role as Message['role'],
    content: gm.Content,
    toolCalls: gm.ToolCalls?.map(tc => ({
      id: tc.ID,
      name: tc.Name,
      arguments: tc.Args,
    })),
  };
}
```

- [ ] **Step 3: Update types/agent.ts**

Replace with SDK re-exports + extensions:

```typescript
export type { AgentStatus, Response, AgentMetrics } from '@agentprimordia/sdk';
export { ErrorCodes } from '@agentprimordia/sdk';

// CodeCast agent extensions
export interface AgentTask {
  id: string;
  title: string;
  status: AgentStatus;
  subTasks: AgentSubTask[];
}

export interface AgentSubTask {
  id: string;
  title: string;
  status: AgentStatus;
  dependencies: string[];
}
```

- [ ] **Step 4: Update types/models.ts**

Replace with SDK re-exports + UI extensions:

```typescript
export type { ProviderConfig, ModelInfo, Usage } from '@agentprimordia/sdk';

// CodeCast UI-specific extensions
export interface ModelProvider {
  id: string;
  name: string;
  icon: string;
  authType: 'apikey' | 'none';
  baseURL?: string;
  models: ModelConfig[];
  enabled: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  capabilities: ModelCapabilities;
  recommendedUse: ModelUseCase[];
  pricing?: { input: number; output: number };
}
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: May have errors in components that import old types — will fix in Task 14

- [ ] **Step 6: Commit**

```bash
git add CodeCast-desktop/frontend/src/store/types.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/types/agent.ts CodeCast-desktop/frontend/src/types/models.ts
git commit -m "feat: rewrite frontend types using AP SDK re-exports"
```

---

### Task 14: Rewrite Frontend Stores

**Files:**
- Modify: `CodeCast-desktop/frontend/src/store/useAgentStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useMessagesStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useModelStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useMemoryStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useSessionStore.ts`

- [ ] **Step 1: Rewrite useAgentStore.ts**

Replace `SubAgent` with `AgentInfo`, replace `AgentEvent` handling with AP EventBus event format:

```typescript
import type { AgentStatus } from '@agentprimordia/sdk';
import type { AgentInfo } from './types';

interface AgentSlice {
  agents: AgentInfo[];
  addAgent: (agent: AgentInfo) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  removeAgent: (id: string) => void;
  getAgentsBySession: (sessionId: string) => AgentInfo[];
  handleAgentEvent: (event: { type: string; payload: any }) => void;
}
```

- [ ] **Step 2: Rewrite useMessagesStore.ts**

Use SDK `Message` type:

```typescript
import type { Message } from '@agentprimordia/sdk';

interface MessagesSlice {
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (updater: (msg: Message) => Message) => void;
  clearMessages: () => void;
}
```

- [ ] **Step 3: Rewrite useModelStore.ts**

Use SDK `ProviderConfig` and `ModelInfo` types. Keep the existing AES-GCM encryption for API key storage.

- [ ] **Step 4: Rewrite useMemoryStore.ts**

Use SDK `MemoryEpisode` and `MemoryStats` types. Connect to backend via Wails bindings:

```typescript
import type { MemoryEpisode, MemoryStats } from '@agentprimordia/sdk';

interface MemoryState {
  memories: MemoryEpisode[];
  statistics: MemoryStats | null;
  isLoading: boolean;
  error: string | null;
  fetchMemories: () => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearExpired: (days: number) => Promise<void>;
}
```

- [ ] **Step 5: Simplify useSessionStore.ts**

Remove `Messages` from Session type. Session is now just bookkeeping:

```typescript
interface SessionSlice {
  sessions: Session[];
  currentSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
}
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: May have component errors — will fix in Task 15

- [ ] **Step 7: Commit**

```bash
git add CodeCast-desktop/frontend/src/store/
git commit -m "feat: rewrite frontend stores using AP SDK types"
```

---

### Task 15: Adapt Frontend API and Hooks

**Files:**
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/hooks/useChatSender.ts`
- Modify: `CodeCast-desktop/frontend/src/hooks/useAppInit.ts`

- [ ] **Step 1: Update api.ts**

Update Wails binding method signatures to match new backend:
- `sendMessageEx()` return type changes from `GoMessage[]` to the new format
- Add `resolveCheckpoint(checkpointId: string, approved: boolean)` method
- Update agent-related methods to use `AgentInfo` type

- [ ] **Step 2: Update useChatSender.ts**

Adapt streaming event handling:
- Event name stays `"stream:${sessionId}"` (event_bridge.go forwards from AP EventBus)
- Event payload format: `{type: "content"|"reasoning"|"tool_call"|"tool_result"|"error"|"done", content?: string}`
- The `type` field now includes `"reasoning"`, `"tool_call"`, `"tool_result"` from AP StreamEvent types

- [ ] **Step 3: Update useAppInit.ts**

Adapt agent event handling:
- Event names come from event_bridge.go: `"agent:start"`, `"agent:stop"`, `"agent:error"`, `"agent:turn"`, `"agent:turn_end"`, `"agent:tool"`, `"agent:tool_result"`, `"pool:dispatch"`, `"pool:complete"`
- Event payload is `ap.Event.Payload` (any type from Go backend)
- Update `handleAgentEvent()` to work with new event structure

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: May have component errors — will fix in Task 16

- [ ] **Step 5: Commit**

```bash
git add CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/hooks/useChatSender.ts CodeCast-desktop/frontend/src/hooks/useAppInit.ts
git commit -m "feat: adapt frontend API and hooks for AP framework"
```

---

### Task 16: Adapt Frontend Components

**Files:**
- Modify: `CodeCast-desktop/frontend/src/components/AgentCard.tsx`
- Modify: `CodeCast-desktop/frontend/src/components/MessagesView.tsx`
- Modify: `CodeCast-desktop/frontend/src/components/MemoryVisualizer.tsx`
- Modify: `CodeCast-desktop/frontend/src/components/CheckpointPanel.tsx`
- Modify: `CodeCast-desktop/frontend/src/components/AgentLoopEngine.tsx`
- Modify: All other components that import from `store/types.ts`

- [ ] **Step 1: Fix AgentCard.tsx**

- Replace `SubAgent` type with `AgentInfo`
- Replace `AgentEvent` handling with AP SDK `Event`
- Update `CancelAgent()` call signature if changed

- [ ] **Step 2: Fix MessagesView.tsx**

- Replace `Message` type usage — now from SDK, fields: `role`, `content`, `toolCalls?`, `toolCallId?`, `name?`
- Ensure `role`, `content`, `toolCalls` fields are accessed correctly
- Handle `reasoning` field if present in SDK Message (check if CodeCast extends this)

- [ ] **Step 3: Fix MemoryVisualizer.tsx**

- Replace `MemoryItem` with SDK `MemoryEpisode`
- Update field names: `id`, `sessionId`, `role`, `content`, `summary?`, `topics?`, `importance?`, `metadata?`, `createdAt`
- Connect to real backend data (currently mock)

- [ ] **Step 4: Fix CheckpointPanel.tsx**

- Update to work with AP Checkpoint Hook events
- Event payload: `{checkpoint_id, tool_name, tool_args, risk_level, agent_id, session_id}`
- Add `ResolveCheckpoint()` API call for approve/reject

- [ ] **Step 5: Fix all other components**

Search for all components importing old types and update:

```bash
cd CodeCast-desktop/frontend
grep -r "from.*store/types" src/components/ --include="*.tsx" -l
```

Fix each file to use the new type imports.

- [ ] **Step 6: Verify full frontend compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: PASS — 0 TypeScript errors

- [ ] **Step 7: Verify frontend build**

Run: `cd CodeCast-desktop/frontend && npm run build`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add CodeCast-desktop/frontend/src/components/
git commit -m "feat: adapt all frontend components for AP SDK types"
```

---

### Task 17: Full Integration Test

**Files:**
- Modify: `CodeCast-desktop/agent_test.go` (update for AP types)
- Modify: `CodeCast-desktop/security_test.go` (update for AP security types)

- [ ] **Step 1: Update Go tests**

- Update `agent_test.go` to test AP Agent, Pool, and Checkpoint behavior
- Update `security_test.go` to test AP Sandbox, ACL, and Guardrail behavior
- Add new tests for `provider_factory.go`, `prompt_builder.go`, `checkpoint_hook.go`

- [ ] **Step 2: Run Go tests**

Run: `cd CodeCast-desktop && go test -v -race ./...`

Expected: All tests PASS

- [ ] **Step 3: Run frontend tests**

Run: `cd CodeCast-desktop/frontend && npm run test`

Expected: All tests PASS

- [ ] **Step 4: Run full build**

Run: `cd CodeCast-desktop && wails build`

Expected: PASS — produces executable

- [ ] **Step 5: Manual smoke test**

1. Launch CodeCast
2. Configure an LLM Provider (e.g., DeepSeek)
3. Send a chat message → verify streaming response works
4. Ask agent to read a file → verify tool calling works
5. Ask agent to write a file → verify checkpoint mechanism works
6. Dispatch multiple agents → verify pool scheduling works
7. Check memory panel → verify episodes are stored
8. Add an MCP server → verify MCP integration works

- [ ] **Step 6: Commit**

```bash
git add -A CodeCast-desktop/
git commit -m "test: update tests for AP framework integration"
```

---

### Task 18: Clean Up and Final Commit

**Files:**
- All files

- [ ] **Step 1: Remove any remaining dead code**

Search for references to deleted types/functions:
```bash
cd CodeCast-desktop
grep -r "SubAgent\|AgentPool\|MemoryStore\|LLMResponse\|httpClient" *.go
```

Remove any remaining references.

- [ ] **Step 2: Run final build**

Run: `cd CodeCast-desktop && wails build`

Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `cd CodeCast-desktop && go test -v -race ./... && cd frontend && npm test`

Expected: All PASS

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: clean up remaining dead code after AP framework integration"
```
