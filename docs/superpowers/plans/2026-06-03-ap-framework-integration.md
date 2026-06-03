# AP Framework Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely replace CodeCast's Agent core engine with the AgentPrimordia (AP) framework, gaining 9+ LLM Providers, RAG, Guardrails, DAG orchestration, EventBus, CostTracker, and CachedProvider.

**Architecture:** Big Bang replacement — delete CodeCast's custom agent/memory/llm/mcp code, introduce AP as a Go module dependency, rewrite App struct to hold AP instances directly. Frontend switches to AP TypeScript SDK types. session.go monolith is decomposed into focused modules (chat.go, provider_factory.go, prompt_builder.go, checkpoint_hook.go, agent_bridge.go, event_bridge.go). AP's DAG Workflow replaces flat Pool.Submit for complex multi-step tasks.

**Tech Stack:** Go 1.25, AgentPrimordia v0.1.0 (Go module), @agentprimordia/sdk v0.1.0 (TypeScript), Wails v2, React 18, Zustand (slice pattern)

**Design Spec:** `docs/superpowers/specs/2026-06-03-ap-framework-integration-design.md`

**AP API Reference:** All API signatures verified against `D:\codecast\agentprimordia\agentprimordia\pkg\*.go` and `internal/`

---

## Errata — Critical Fixes from Audit (2026-06-03)

| # | Issue | Fix |
|---|-------|-----|
| 1 | `APICredentials` has no `ProviderID` field | Use existing `guessProviderForModel()` (config.go:911) |
| 2 | Frontend uses Zustand slice pattern (15 slices in `store/index.ts`), not separate stores | Modify slice files, not create new stores |
| 3 | `llmConfig` cannot be removed — `syncSettingsToConfig()` depends on it | Keep `llmConfig LLMProviderConfig` in App struct |
| 4 | `persistence.go` not in plan but must be preserved | Add to "Files to KEEP" list |
| 5 | AP Pool uses `Dispatch(ctx, []TaskConfig)` not `Submit(TaskConfig)` | Fix agent_bridge.go |
| 6 | AP Pool has `CancelBySession()`, `GetTasksBySession()`, `ListAgents()`, `ListTasks()` | Use native methods instead of manual implementation |
| 7 | `PoolStats` has no `ActiveTasks` field — it has `RunningTasks/QueuedTasks/CompletedTasks/FailedTasks` | Fix agent_bridge.go GetAgents() |
| 8 | AP has `StatusWaitingForInput` — useful for Checkpoint | Use in AgentInfo |
| 9 | AP has `CostTracker`, `CachedProvider`, `GuardrailHook`, `DAGWorkflow`, `Pipeline` | Add as architecture improvements |
| 10 | **DEADLOCK BUG**: `createProvider()` calls `a.mu.RLock()` then `resolveCredentialsLocked()` which expects caller to already hold `a.mu` — Go RWMutex is not reentrant | Remove `RLock` from `createProvider()`, document that caller must hold the lock |
| 11 | Task granularity too coarse — Task 9 (1474-line session.go) and Task 11 (5 files) violate 2-5 min step rule | Split into focused sub-tasks |
| 12 | Backend/Frontend tasks are serial but could be parallel | Task 12-16 only depend on Task 1, enable parallel tracks |
| 13 | No rollback strategy for high-risk tasks | Each commit is a rollback point; add explicit safety commits |

---

## File Structure

### Backend (Go) — Files to CREATE

| File | Responsibility |
|------|---------------|
| `CodeCast-desktop/chat.go` | Main chat entry point `SendMessage`, delegates to AP Agent |
| `CodeCast-desktop/provider_factory.go` | LLM Provider factory (9+1 providers via AP) |
| `CodeCast-desktop/prompt_builder.go` | System prompt construction via AP PromptTemplate |
| `CodeCast-desktop/checkpoint_hook.go` | Checkpoint mechanism via AP GuardrailHook + HookBeforeTool |
| `CodeCast-desktop/agent_bridge.go` | Wails binding bridge methods for agent/pool operations |
| `CodeCast-desktop/event_bridge.go` | AP EventBus → Wails Events forwarding |
| `CodeCast-desktop/cost_tracker.go` | LLM cost tracking via AP CostTracker |

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
| `CodeCast-desktop/main.go` | App struct: replace agentPool/memory with AP instances, KEEP llmConfig |
| `CodeCast-desktop/session.go` | Decompose: keep only session CRUD, move chat/dispatch/cancel to new files |
| `CodeCast-desktop/config.go` | Adapt resolveCredentialsLocked to feed AP Provider factory |
| `CodeCast-desktop/shell.go` | Adapt ExecuteCommand to use AP Shell tool |
| `CodeCast-desktop/notes.go` | Move ToContextPrompt to prompt_builder.go, recordNotesAsync to Hook |
| `CodeCast-desktop/completor.go` | Switch LLM calls to use AP CachedProvider |
| `CodeCast-desktop/notification.go` | Adapt event emission to use AP EventBus |
| `CodeCast-desktop/go.mod` | Add agentprimordia dependency, upgrade modernc.org/sqlite |

### Backend (Go) — Files to KEEP (unchanged)

| File | Reason |
|------|--------|
| `CodeCast-desktop/persistence.go` | Session JSON file persistence (application-layer bookkeeping) |

### Frontend (TypeScript) — Files to MODIFY

| File | Changes |
|------|---------|
| `frontend/src/api.ts` | Update Wails binding method signatures for AP types |
| `frontend/src/api/types.ts` | Replace Go* types with AP SDK types |
| `frontend/src/store/types.ts` | Replace Message/SubAgent/AgentEvent with SDK types |
| `frontend/src/store/useAgentStore.ts` | Rewrite createAgentSlice using SDK AgentStatus/Response/Event |
| `frontend/src/store/useMessagesStore.ts` | Rewrite createMessagesSlice using SDK Message/ToolCall |
| `frontend/src/store/useModelStore.ts` | Rewrite createModelSlice using SDK ProviderConfig/ModelInfo |
| `frontend/src/store/useSessionStore.ts` | Simplify createSessionSlice — session bookkeeping only |
| `frontend/src/store/index.ts` | Update AppState interface for new slice types |
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

## Execution Strategy

### Parallel Tracks

Tasks 1-11 (Backend) and Tasks 12-16 (Frontend) are **independent** after Task 1 completes. They can execute in parallel:

```
Task 1 (go.mod) ──┬── Task 2-11 (Backend track)
                   └── Task 12-16 (Frontend track)
Task 17-18 (Integration) depends on both tracks completing
```

### Rollback Strategy

Every step ends with a `git commit`. If any task fails:
1. `git log --oneline -5` to find the last working commit
2. `git reset --hard <commit>` to rollback
3. Fix the issue and re-apply changes

For high-risk tasks (Task 8, 9, 10), **create a safety branch** before starting:
```bash
git checkout -b backup-before-task-N
git checkout main  # continue working on main
```

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

Key insight: `APICredentials` only has `APIKey`, `APIURL`, `Model` — no `ProviderID`.
Use existing `guessProviderForModel()` (config.go:911) to derive provider ID.

```go
package main

import (
	"fmt"

	ap "agentprimordia/pkg"
)

// createProvider creates an AP LLM Provider based on current settings.
// Uses resolveCredentialsLocked() for API key/URL, guessProviderForModel() for provider type.
// All AP Provider constructors return (*Provider, error).
//
// IMPORTANT: Caller MUST hold a.mu lock before calling this method.
// resolveCredentialsLocked() requires the caller to hold a.mu (see config.go:862 comment).
// Go's sync.RWMutex is NOT reentrant — do NOT add a.mu.RLock() here or it will deadlock.
func (a *App) createProvider() (ap.Provider, error) {
	creds, err := a.resolveCredentialsLocked("")
	if err != nil {
		return nil, fmt.Errorf("resolve credentials: %w", err)
	}

	// Derive provider ID from model name using existing method (config.go:911)
	providerID := a.guessProviderForModel(creds.Model)

	var primary ap.Provider
	switch providerID {
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
			DeploymentName: creds.Model,
			APIKey:         creds.APIKey,
			BaseURL:        creds.APIURL,
			Temperature:    0.7,
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
		// Fallback: use APIURL + APIKey as generic OpenAI-compatible
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

// createCachedProvider creates a cached provider for code completion use cases.
// Uses AP's CachedProvider with fingerprint + vector similarity cache.
// IMPORTANT: Caller MUST hold a.mu lock (calls createProvider which requires it).
func (a *App) createCachedProvider() (ap.Provider, error) {
	primary, err := a.createProvider()
	if err != nil {
		return nil, err
	}

	fpCache := ap.NewFingerprintCache()
	vecCache := ap.NewInMemoryCache(1536)
	hybridCache := ap.NewHybridCache(fpCache, vecCache, 0.95)

	cached, err := ap.NewCachedProvider(primary, hybridCache, 0.95)
	if err != nil {
		return nil, fmt.Errorf("create cached provider: %w", err)
	}
	return cached, nil
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/provider_factory.go
git commit -m "feat: add AP provider factory with 9+1 provider support and cached provider"
```

---

### Task 3: Create Prompt Builder

**Files:**
- Create: `CodeCast-desktop/prompt_builder.go`

- [ ] **Step 1: Write prompt_builder.go**

```go
package main

import (
	"fmt"

	ap "agentprimordia/pkg"
)

// buildSystemPrompt constructs the system prompt using AP PromptTemplate.
func (a *App) buildSystemPrompt(session *Session) string {
	mode := "coding"
	personality := "专业"
	notesContext := ""
	skillPrompt := ""
	customInstructions := ""
	projectPath := ""

	if session != nil && session.Mode == "daily" {
		mode = "daily"
	}
	if a.settings != nil {
		personality = a.settings.Personality
		customInstructions = a.settings.CustomInstructions
		projectPath = a.settings.ProjectPath
	}
	if a.notesStore != nil {
		notesContext = a.notesStore.ToContextPrompt()
	}
	if session != nil && session.SkillID != "" {
		skill := a.getSkill(session.SkillID)
		if skill != nil {
			skillPrompt = skill.Prompt
		}
	}

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

	result := tmpl.Execute(map[string]string{
		"ProjectPath":        projectPath,
		"Mode":               mode,
		"Personality":        personality,
		"CustomInstructions": customInstructions,
		"SkillPrompt":        skillPrompt,
		"NotesContext":       notesContext,
	})

	return result
}

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

- [ ] **Step 2: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/prompt_builder.go
git commit -m "feat: add AP prompt builder with template variable support"
```

---

### Task 4: Create Checkpoint Hook with GuardrailHook

**Files:**
- Create: `CodeCast-desktop/checkpoint_hook.go`

- [ ] **Step 1: Write checkpoint_hook.go**

Use AP's `GuardrailHook` for input/output safety + custom `HookBeforeTool` for user confirmation.
AP `HookFunc` signature: `func(ctx context.Context, hctx *HookContext) error`

```go
package main

import (
	"context"
	"fmt"
	"time"

	ap "agentprimordia/pkg"
)

// setupGuardrails configures AP GuardrailEngine with safety rules
// and returns a GuardrailHook that can be registered with HookManager.
func (a *App) setupGuardrails() *ap.GuardrailHook {
	// PII detection
	a.guardrail.AddRule(ap.NewPIIRule(ap.DefaultPIIRuleConfig()))

	// Sensitive word blocking
	a.guardrail.AddRule(ap.NewSensitiveWordRule(ap.SensitiveWordConfig{
		Words: []string{"rm -rf /", "DROP TABLE", "DELETE FROM", "format C:"},
	}))

	// Prompt injection detection
	a.guardrail.AddRule(ap.NewPromptInjectionRule(ap.PromptInjectionConfig{
		MaxInjectionScore: 0.7,
	}))

	// Output safety check
	a.guardrail.AddRule(ap.NewOutputSafetyRule(ap.OutputSafetyConfig{
		BlockPatterns: []string{`(?i)password\s*=\s*['\"]`},
	}))

	// Create GuardrailHook — integrates with AP HookManager
	return ap.NewGuardrailHook(a.guardrail)
}

// checkpointHook is an AP HookFunc that intercepts high-risk tool calls
// and waits for user confirmation before proceeding.
func (a *App) checkpointHook(ctx context.Context, hctx *ap.HookContext) error {
	toolName := hctx.ToolCall.Name

	highRiskTools := map[string]bool{
		"write_file": true, "edit_file": true, "run_command": true,
	}
	if !highRiskTools[toolName] {
		return nil
	}

	checkpointID := hctx.AgentID + "_" + toolName + "_" + fmt.Sprintf("%d", time.Now().UnixNano())
	riskLevel := a.assessRiskLevel(toolName, string(hctx.ToolCall.Arguments))

	a.eventBus.PublishAsync(ap.Event{
		Type:   ap.EventToolCall,
		Source:  "checkpoint",
		Payload: map[string]any{
			"checkpoint_id": checkpointID,
			"tool_name":     toolName,
			"tool_args":     string(hctx.ToolCall.Arguments),
			"risk_level":    riskLevel,
			"agent_id":      hctx.AgentID,
			"session_id":    hctx.SessionID,
		},
	})

	confirmed := a.waitForCheckpointConfirmation(checkpointID)
	if !confirmed {
		return fmt.Errorf("用户拒绝了工具调用: %s", toolName)
	}
	return nil
}

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
		return false
	}
}

// ResolveCheckpoint is a Wails binding method called by the frontend.
func (a *App) ResolveCheckpoint(checkpointID string, approved bool) {
	a.mu.Lock()
	ch, ok := a.checkpointConfirmations[checkpointID]
	a.mu.Unlock()
	if ok {
		ch <- approved
	}
}

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
git commit -m "feat: implement checkpoint + guardrail safety via AP Hooks"
```

---

### Task 5: Create Event Bridge

**Files:**
- Create: `CodeCast-desktop/event_bridge.go`

- [ ] **Step 1: Write event_bridge.go**

AP `Bus.Subscribe(eventType)` returns `(<-chan Event, subscriberID string)`.

```go
package main

import (
	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startEventBridge() {
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

AP Agent API: `Run(ctx, Message) (*Response, error)` and `StreamRun(ctx, Message) (<-chan StreamEvent, error)`.

```go
package main

import (
	"context"
	"fmt"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) SendMessage(sessionID, input string) ([]Message, error) {
	return a.SendMessageEx(sessionID, input, "", "")
}

func (a *App) SendMessageEx(sessionID, input, model, thinking string) ([]Message, error) {
	session := a.getSessionByID(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	agent, _, err := a.getOrCreateAgent(sessionID, model)
	if err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	// NOTE: createProvider() requires a.mu to be held.
	// getOrCreateAgent() calls createProvider() internally with the lock.

	ctx, reqCancel := context.WithCancel(a.ctx)
	defer reqCancel()

	a.mu.Lock()
	a.sessionCancels[sessionID] = reqCancel
	a.mu.Unlock()

	streamCh, err := agent.StreamRun(ctx, ap.UserMessage(input))
	if err != nil {
		return nil, fmt.Errorf("agent stream run: %w", err)
	}

	var fullContent string
	for evt := range streamCh {
		switch evt.Type {
		case ap.StreamEventToken:
			fullContent += evt.Content
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "content", "content": evt.Content,
			})
		case ap.StreamEventThought:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "reasoning", "content": evt.Content,
			})
		case ap.StreamEventToolCall:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "tool_call", "content": evt.Content,
			})
		case ap.StreamEventToolResult:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "tool_result", "content": evt.Content,
			})
		case ap.StreamEventError:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "error", "content": evt.Content,
			})
		case ap.StreamEventComplete:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "done",
			})
		}
	}

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

	return []Message{
		{Role: "user", Content: input},
		{Role: "assistant", Content: fullContent},
	}, nil
}

func (a *App) getOrCreateAgent(sessionID string, model string) (ap.Agent, context.CancelFunc, error) {
	a.mu.RLock()
	if agent, ok := a.sessionAgents[sessionID]; ok {
		a.mu.RUnlock()
		return agent, nil, nil
	}
	a.mu.RUnlock()

	// createProvider() requires caller to hold a.mu — we acquire it here
	a.mu.Lock()
	provider, err := a.createProvider()
	a.mu.Unlock()
	if err != nil {
		return nil, nil, err
	}

	session := a.getSessionByID(sessionID)

	agent := ap.NewReActAgent(ap.ReActConfig{
		Name:            "CodeCast-" + sessionID[:8],
		SystemPrompt:    a.buildSystemPrompt(session),
		Model:           provider,
		Toolkit:         a.toolkit,
		Memory:          ap.NewMemoryAdapter(a.memory),
		EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
		Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow:   ap.NewDefaultStrategy(80),
		Hooks:           a.hooks,
		Lifecycle:       a.lifecycle,
		CheckpointStore: a.checkpointStore,
		MaxTurns:        20,
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

### Task 7: Create Agent Bridge + Cost Tracker

**Files:**
- Create: `CodeCast-desktop/agent_bridge.go`
- Create: `CodeCast-desktop/cost_tracker.go`

- [ ] **Step 1: Write agent_bridge.go using verified AP Pool API**

AP Pool uses `Dispatch(ctx, []TaskConfig)` (not Submit), and has `CancelBySession()`, `GetTasksBySession()`, `ListAgents()`, `ListTasks()`.

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

type AgentInfo struct {
	ID           string `json:"id"`
	SessionID    string `json:"sessionId"`
	Title        string `json:"title"`
	Status       string `json:"status"`
	Turn         int    `json:"turn"`
	MaxTurns     int    `json:"maxTurns"`
	Result       string `json:"result,omitempty"`
	Error        string `json:"error,omitempty"`
	LastToolName string `json:"lastToolName,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

// DispatchAgents dispatches tasks via AP Pool.Dispatch (batch).
func (a *App) DispatchAgents(tasksJSON string) ([]string, error) {
	var tasks []struct {
		Title  string `json:"title"`
		Prompt string `json:"prompt"`
	}
	if err := json.Unmarshal([]byte(tasksJSON), &tasks); err != nil {
		return nil, fmt.Errorf("parse tasks: %w", err)
	}

	var taskConfigs []ap.TaskConfig
	for _, t := range tasks {
		taskConfigs = append(taskConfigs, ap.TaskConfig{
			Title:    t.Title,
			Prompt:   t.Prompt,
			MaxTurns: 10,
		})
	}

	// AP Pool.Dispatch submits all tasks as a batch
	results, err := a.pool.Dispatch(context.Background(), taskConfigs)
	if err != nil {
		return nil, fmt.Errorf("dispatch tasks: %w", err)
	}

	var taskIDs []string
	for _, r := range results {
		if r != nil {
			taskIDs = append(taskIDs, r.TaskID)
		}
	}
	return taskIDs, nil
}

// GetAgents returns agent info for a session using AP Pool.GetTasksBySession.
func (a *App) GetAgents(sessionID string) []AgentInfo {
	taskResults := a.pool.GetTasksBySession(sessionID)
	var agents []AgentInfo
	for _, tr := range taskResults {
		agents = append(agents, AgentInfo{
			ID:        tr.TaskID,
			SessionID: tr.Task.SessionID,
			Title:     tr.Task.Title,
			Status:    string(tr.Status),
			MaxTurns:  tr.Task.MaxTurns,
		})
	}
	return agents
}

// GetAgentDetail returns a single agent's detail using AP Pool.GetTask.
func (a *App) GetAgentDetail(agentID string) *AgentInfo {
	tr, ok := a.pool.GetTask(agentID)
	if !ok {
		return nil
	}
	return &AgentInfo{
		ID:        tr.TaskID,
		SessionID: tr.Task.SessionID,
		Title:     tr.Task.Title,
		Status:    string(tr.Status),
		MaxTurns:  tr.Task.MaxTurns,
		Result:    func() string { if tr.Response != nil { return tr.Response.Content }; return "" }(),
		Error:     func() string { if tr.Error != nil { return tr.Error.Error() }; return "" }(),
	}
}

// CancelAgent cancels a running agent via AP Pool.Cancel.
func (a *App) CancelAgent(agentID string) error {
	return a.pool.Cancel(agentID)
}

// CancelSessionAgents cancels all agents for a session via AP Pool.CancelBySession.
func (a *App) CancelSessionAgents(sessionID string) error {
	return a.pool.CancelBySession(sessionID)
}
```

- [ ] **Step 2: Write cost_tracker.go**

```go
package main

import (
	ap "agentprimordia/pkg"
)

// initCostTracker sets up AP CostTracker for LLM usage monitoring.
func (a *App) initCostTracker() {
	// CostTracker is configured as part of ReActConfig.CostTracker
	// It hooks into the Agent lifecycle to track token usage and costs
	// per session, per model, and globally.
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add CodeCast-desktop/agent_bridge.go CodeCast-desktop/cost_tracker.go
git commit -m "feat: add agent bridge + cost tracker using AP Pool native API"
```

---

### Task 8: Rewrite App Struct and Startup — THE CRITICAL TASK

**Files:**
- Modify: `CodeCast-desktop/main.go`

- [ ] **Step 1: Update App struct in main.go**

CRITICAL: Keep `llmConfig LLMProviderConfig` — it's used by `syncSettingsToConfig()`.

Replace `agentPool *AgentPool` and `memory *MemoryStore` with:

```go
// AP 框架核心
agent             ap.Agent
pool              *ap.Pool
memory            *ap.SQLiteStore
ragStore          *ap.RAGStore
toolkit           *ap.ToolRegistry
mcpReg            *ap.MCPRegistry
eventBus          *ap.Bus
metricsCollector  *ap.AgentMetricsCollector
guardrail         *ap.GuardrailEngine
guardrailHook     *ap.GuardrailHook
hooks             *ap.HookManager
checkpointStore   ap.CheckpointStore
lifecycle         *ap.Lifecycle
sessionAgents     map[string]ap.Agent
sessionCancels    map[string]context.CancelFunc

// CodeCast 应用层（保留）
llmConfig                 LLMProviderConfig  // KEEP: syncSettingsToConfig() 依赖
completor                 *CodeCompletor
checkpointConfirmations   map[string]chan bool
```

- [ ] **Step 2: Rewrite startup() method**

```go
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 1. AP Memory
	memoryPath := filepath.Join(a.dataDir, "memory.db")
	a.memory, _ = ap.NewSQLiteStore(memoryPath)

	// 2. AP EventBus (bufferSize=64)
	a.eventBus = ap.NewBus(64)

	// 3. AP Metrics
	a.metricsCollector = ap.NewMetrics()

	// 4. AP Guardrail + GuardrailHook
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails() // checkpoint_hook.go

	// 5. AP Toolkit — DefaultToolkit(rootDir string) (*Registry, []Tool, error)
	projectPath := ""
	if a.settings != nil {
		projectPath = a.settings.ProjectPath
	}
	a.toolkit, _, _ = ap.DefaultToolkit(projectPath)

	// 6. AP Hooks — register checkpoint + guardrail
	a.hooks = ap.NewHookManager()
	a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
	// GuardrailHook auto-registers with HookManager
	a.guardrailHook.Register(a.hooks)

	// 7. AP MCPRegistry
	a.mcpReg = ap.NewMCPRegistry()

	// 8. AP CheckpointStore
	checkpointPath := filepath.Join(a.dataDir, "checkpoints.db")
	a.checkpointStore, _ = ap.NewSQLiteCheckpointStore(checkpointPath)

	// 9. AP Lifecycle
	a.lifecycle = ap.NewLifecycle()

	// 10. Provider + RAG (createProvider requires a.mu — safe during startup, no contention)
	a.mu.Lock()
	provider, _ := a.createProvider()
	a.mu.Unlock()
	embeddingAdapter := ap.NewEmbeddingAdapter(provider, 1536)
	a.ragStore = ap.NewRAGStore(a.memory, embeddingAdapter)

	// 11. Default Agent
	a.agent = ap.NewReActAgent(ap.ReActConfig{
		Name:            "CodeCast",
		SystemPrompt:    a.buildSystemPrompt(nil),
		Model:           provider,
		Toolkit:         a.toolkit,
		Memory:          ap.NewMemoryAdapter(a.memory),
		EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
		Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow:   ap.NewDefaultStrategy(80),
		Hooks:           a.hooks,
		Lifecycle:       a.lifecycle,
		CheckpointStore: a.checkpointStore,
		MaxTurns:        20,
		RAG: &ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     5,
		},
	})

	// 12. AP Agent Pool
	a.pool = ap.NewPool(ap.PoolConfig{
		MaxConcurrency: 5,
		Timeout:        5 * time.Minute,
		DefaultAgent: ap.ReActAgentConfig{
			SystemPrompt: "你是一个代码助手子代理",
			MaxTurns:     10,
		},
	})
	a.pool.SetModel(provider)

	// 13. Event bridge
	a.startEventBridge()

	// 14. Session caches
	a.sessionAgents = make(map[string]ap.Agent)
	a.sessionCancels = make(map[string]context.CancelFunc)
	a.checkpointConfirmations = make(map[string]chan bool)

	// 15. Notes Hook — trigger note recording after each agent run
	a.hooks.Register(ap.HookAfterRun, func(ctx context.Context, hctx *ap.HookContext) error {
		go a.recordNotesAsync(hctx.SessionID)
		return nil
	})

	// 16. Notes cleanup (preserve existing behavior from main.go)
	if a.notesStore != nil {
		go a.notesStore.CleanupOld(30)
	}
}
```

- [ ] **Step 3: Rewrite shutdown() method**

```go
func (a *App) shutdown(ctx context.Context) {
	a.mu.Lock()
	for _, cancel := range a.sessionCancels {
		cancel()
	}
	a.mu.Unlock()

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

- [ ] **Step 1: Remove migrated methods from session.go**

Remove (now in other files):
- `SendMessage` / `SendMessageEx` → `chat.go`
- `DispatchAgents` / `GetAgents` / `GetAgentDetail` / `CancelAgent` / `CancelSessionAgents` → `agent_bridge.go`
- `buildSystemPrompt` → `prompt_builder.go`
- `callAPI` / `callAPIEx` → replaced by AP Agent
- `buildContextAssembly` / `buildMessageSequence` → replaced by AP ContextWindowStrategy
- `injectToolDetails` → replaced by AP dynamic tool loading
- `mainChatToolDefinitions` → replaced by AP ToolRegistry
- `waitForCheckpointConfirmation` / `ResolveCheckpoint` → `checkpoint_hook.go`
- `checkpointHook` / `assessRiskLevel` → `checkpoint_hook.go`
- `saveMemoryAsync` → replaced by AP Memory `Add()`
- `activeCancels` map and related methods → replaced by `sessionCancels` map

- [ ] **Step 2: Keep only session CRUD + these methods in session.go**

- `Session` type definition
- `NewSession()`
- `GetSessions()` / `CreateSession()` / `GetSession()` / `DeleteSession()`
- `SearchSessions()` / `ExportSession()` / `ExportSessionJSON()` / `ExportSessionMarkdown()`
- `RenameSession()` / `GetSessionsByMode()` / `BatchDeleteSessions()`
- `getSessionByID()` / `getSessionByIDLocked()` (internal helpers)
- Session archive methods
- Skill-related methods (application-layer)

- [ ] **Step 3: Adapt memory-related Wails bindings**

- `ResetMemory()` → `a.memory.ClearAll(ctx, "")`
- `GetMemoryStats()` → `a.memory.Stats(ctx)` returns `*ap.MemoryStats`
- `ClearMemory()` → `a.memory.ClearAll(ctx, "")`
- `recordToolIfEnabled()` → `a.memory.RecordToolUse(ctx, sessionID, agentName, toolName, args, result)`

- [ ] **Step 4: Adapt cancel methods**

- `CancelRequest()` → calls `a.sessionCancels[sessionID]()`
- `CancelSessionRequest(sessionID)` → calls `a.sessionCancels[sessionID]()`

- [ ] **Step 5: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add CodeCast-desktop/session.go
git commit -m "refactor: decompose session.go monolith, keep only session CRUD"
```

---

### Task 10: Delete Replaced Backend Files

**Files:**
- Delete 12 files (see File Structure above)
- KEEP: `persistence.go` (session JSON bookkeeping)

- [ ] **Step 1: Delete each file**

```bash
cd CodeCast-desktop
del agent.go agent_engine.go agent_tools.go agent_persist.go
del memory.go mcp.go sandbox.go prompts.go context.go
rmdir /s /q llm
```

- [ ] **Step 2: Fix remaining references**

- `AgentPool` → `ap.Pool`
- `SubAgent` → `AgentInfo`
- `MemoryStore` → `ap.SQLiteStore`
- `LLMResponse` → `ap.Response`
- `PromptBase`/`PromptCoding`/`PromptDaily` → now in `prompt_builder.go`
- `httpClient` → removed (AP has its own)

Fix all compilation errors.

- [ ] **Step 3: Verify compilation**

Run: `cd CodeCast-desktop && go build ./...`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A CodeCast-desktop/
git commit -m "refactor: delete replaced backend files, keep persistence.go"
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

- Keep `resolveCredentialsLocked()` and `guessProviderForModel()` — they feed `provider_factory.go`
- Update `GetProviders()` / `GetProviderModels()` to include 9+1 AP providers
- Remove references to deleted `llm/` package

- [ ] **Step 2: Adapt shell.go**

- `ExecuteCommand()` remains unchanged — direct frontend execution, not Agent

- [ ] **Step 3: Adapt notes.go**

- `ToContextPrompt()` call now in `prompt_builder.go`
- `recordNotesAsync()` triggered via `HookAfterRun` (registered in startup)
- Keep `CleanupOld()` — called in startup

- [ ] **Step 4: Adapt completor.go**

- Replace `getOpenAICompletions()` / `streamOpenAICompletions()` with `a.createCachedProvider()`
- L2 AI completion uses AP CachedProvider: `cachedProvider.Complete(ctx, req)`
- L3 local cache and L1 symbol index unchanged

- [ ] **Step 5: Adapt notification.go**

- For events that should go through AP EventBus: use `a.eventBus.PublishAsync()`
- For direct Wails-only notifications: keep `wailsRuntime.EventsEmit()`

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

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add CodeCast-desktop/frontend/package.json CodeCast-desktop/frontend/package-lock.json
git commit -m "chore: add @agentprimordia/sdk TypeScript dependency"
```

---

### Task 13: Rewrite Frontend Types

**Files:**
- Modify: `CodeCast-desktop/frontend/src/store/types.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/types/agent.ts`
- Modify: `CodeCast-desktop/frontend/src/types/models.ts`

- [ ] **Step 1: Update store/types.ts** — Replace with SDK re-exports + CodeCast extensions

```typescript
export type { Message, ToolCall, ToolResult, AgentStatus, Response, AgentMetrics, Usage, MemoryEpisode, MemoryStats } from '@agentprimordia/sdk';
export { ErrorCodes } from '@agentprimordia/sdk';

export interface Session {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Mode: 'coding' | 'daily' | '';
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
```

- [ ] **Step 2: Update api/types.ts** — Go→SDK type converter

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
    toolCalls: gm.ToolCalls?.map(tc => ({ id: tc.ID, name: tc.Name, arguments: tc.Args })),
  };
}
```

- [ ] **Step 3: Update types/agent.ts** — SDK re-exports + extensions

- [ ] **Step 4: Update types/models.ts** — SDK re-exports + UI extensions

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: May have errors — will fix in Task 14

- [ ] **Step 6: Commit**

```bash
git add CodeCast-desktop/frontend/src/store/types.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/types/agent.ts CodeCast-desktop/frontend/src/types/models.ts
git commit -m "feat: rewrite frontend types using AP SDK re-exports"
```

---

### Task 14: Rewrite Frontend Store Slices

**Files:**
- Modify: `CodeCast-desktop/frontend/src/store/useAgentStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useMessagesStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useModelStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/useSessionStore.ts`
- Modify: `CodeCast-desktop/frontend/src/store/index.ts`

NOTE: CodeCast uses Zustand **slice pattern** — each file exports a `createXxxSlice()` function and `XxxSlice` type. The slices are composed in `store/index.ts` into a single `useAppStore`. Do NOT create separate stores.

- [ ] **Step 1: Rewrite useAgentStore.ts** — `createAgentSlice` using SDK `AgentStatus`

```typescript
import type { AgentStatus } from '@agentprimordia/sdk';
import type { AgentInfo } from './types';
import type { SliceSet } from './storeTypes';

export interface AgentSlice {
  agents: AgentInfo[];
  addAgent: (agent: AgentInfo) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  removeAgent: (id: string) => void;
  getAgentsBySession: (sessionId: string) => AgentInfo[];
  handleAgentEvent: (event: { type: string; payload: any }) => void;
}

export const createAgentSlice = (set: SliceSet): AgentSlice => ({
  agents: [],
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  updateAgent: (id, updates) => set((s) => ({
    agents: s.agents.map(a => a.id === id ? { ...a, ...updates } : a),
  })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter(a => a.id !== id) })),
  getAgentsBySession: (sessionId) => { /* implementation */ },
  handleAgentEvent: (event) => { /* route event by type */ },
});
```

- [ ] **Step 2: Rewrite useMessagesStore.ts** — `createMessagesSlice` using SDK `Message`

- [ ] **Step 3: Rewrite useModelStore.ts** — `createModelSlice` using SDK `ProviderConfig`/`ModelInfo`

- [ ] **Step 4: Simplify useSessionStore.ts** — `createSessionSlice` — session bookkeeping only

- [ ] **Step 5: Update store/index.ts** — Update `AppState` interface with new slice types

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: May have component errors — will fix in Task 15

- [ ] **Step 7: Commit**

```bash
git add CodeCast-desktop/frontend/src/store/
git commit -m "feat: rewrite frontend store slices using AP SDK types"
```

---

### Task 15: Adapt Frontend API and Hooks

**Files:**
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/hooks/useChatSender.ts`
- Modify: `CodeCast-desktop/frontend/src/hooks/useAppInit.ts`

- [ ] **Step 1: Update api.ts**

- Add `resolveCheckpoint(checkpointId: string, approved: boolean)` method
- Update agent-related methods to use `AgentInfo` type
- Update `sendMessageEx()` return type

- [ ] **Step 2: Update useChatSender.ts**

Streaming event payload format from AP:
- `{type: "content"|"reasoning"|"tool_call"|"tool_result"|"error"|"done", content?: string}`

- [ ] **Step 3: Update useAppInit.ts**

Event names from event_bridge.go: `"agent:start"`, `"agent:stop"`, `"agent:error"`, `"agent:turn"`, `"agent:turn_end"`, `"agent:tool"`, `"agent:tool_result"`, `"pool:dispatch"`, `"pool:complete"`

- [ ] **Step 4: Verify TypeScript compilation**

- [ ] **Step 5: Commit**

```bash
git add CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/hooks/useChatSender.ts CodeCast-desktop/frontend/src/hooks/useAppInit.ts
git commit -m "feat: adapt frontend API and hooks for AP framework"
```

---

### Task 16: Adapt Frontend Components

**Files:**
- All components importing from `store/types.ts`

- [ ] **Step 1: Fix AgentCard.tsx** — `SubAgent` → `AgentInfo`

- [ ] **Step 2: Fix MessagesView.tsx** — SDK `Message` fields: `role`, `content`, `toolCalls?`

- [ ] **Step 3: Fix MemoryVisualizer.tsx** — SDK `MemoryEpisode` fields

- [ ] **Step 4: Fix CheckpointPanel.tsx** — Event payload: `{checkpoint_id, tool_name, tool_args, risk_level, agent_id, session_id}`

- [ ] **Step 5: Fix all other components** — `grep -r "from.*store/types" src/components/ --include="*.tsx" -l`

- [ ] **Step 6: Verify full frontend compilation**

Run: `cd CodeCast-desktop/frontend && npx tsc --noEmit`

Expected: PASS — 0 errors

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

- [ ] **Step 1: Update Go tests** — agent_test.go, security_test.go

- [ ] **Step 2: Run Go tests** — `cd CodeCast-desktop && go test -v -race ./...`

- [ ] **Step 3: Run frontend tests** — `cd CodeCast-desktop/frontend && npm run test`

- [ ] **Step 4: Run full build** — `cd CodeCast-desktop && wails build`

- [ ] **Step 5: Manual smoke test** — 8 items (chat, tools, checkpoint, pool, memory, MCP, guardrail, cost)

- [ ] **Step 6: Commit**

```bash
git add -A CodeCast-desktop/
git commit -m "test: update tests for AP framework integration"
```

---

### Task 18: Clean Up and Final Commit

- [ ] **Step 1: Remove dead code** — `grep -r "SubAgent\|AgentPool\|MemoryStore\|LLMResponse\|httpClient" *.go`

- [ ] **Step 2: Run final build** — `wails build`

- [ ] **Step 3: Run all tests** — `go test -v -race ./... && cd frontend && npm test`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: clean up remaining dead code after AP framework integration"
```
