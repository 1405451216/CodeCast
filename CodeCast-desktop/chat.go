package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	ap "agentprimordia/pkg"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// emitEvent safely emits a Wails event. In test environments (no Wails runtime),
// it skips the call to avoid log.Fatal from Wails.
func (a *App) emitEvent(eventName string, data ...any) {
	if a.ctx == nil || a.ctx.Value("frontend") == nil {
		slog.Debug("[CHAT] emitEvent skipped: no Wails frontend", "event", eventName)
		return
	}
	wailsRuntime.EventsEmit(a.ctx, eventName, data...)
}

// SendMessage sends a user message to the agent and returns the response.
// It delegates to SendMessageEx with empty model and thinking parameters.
func (a *App) SendMessage(sessionID, input string) ([]Message, error) {
	return a.SendMessageEx(sessionID, input, "", "")
}

// SendMessageEx sends a user message to the agent with optional model override and thinking mode.
// It creates or reuses an agent for the session, streams the response, stores episodes in memory,
// and triggers auto-summarization if the threshold is met.
func (a *App) SendMessageEx(sessionID, input, model, thinking string) ([]Message, error) {
	slog.Info("[CHAT] SendMessageEx start", "session", sessionID, "input_len", len(input), "model", model)

	session := a.getSessionByID(sessionID)
	if session == nil {
		slog.Error("[CHAT] session not found", "session", sessionID)
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	slog.Debug("[CHAT] session resolved", "session", sessionID, "mode", session.Mode)

	agent, err := a.getOrCreateAgent(sessionID, model)
	if err != nil {
		slog.Error("[CHAT] getOrCreateAgent failed", "session", sessionID, "error", err)
		return nil, fmt.Errorf("create agent: %w", err)
	}
	slog.Info("[CHAT] agent ready", "session", sessionID)

	ctx, reqCancel := context.WithCancel(a.ctx)
	streamDone := make(chan struct{})
	defer func() {
		<-streamDone // wait until stream read loop is finished
		reqCancel()
		slog.Debug("[CHAT] stream cleanup done", "session", sessionID)
	}()

	a.mu.Lock()
	requestIDBytes := make([]byte, 4)
	if _, err := rand.Read(requestIDBytes); err != nil {
		a.mu.Unlock()
		slog.Error("[CHAT] generate request ID failed", "error", err)
		return nil, fmt.Errorf("generate request ID: %w", err)
	}
	requestKey := sessionID + "_" + hex.EncodeToString(requestIDBytes)
	a.sessionCancels[requestKey] = reqCancel
	a.mu.Unlock()
	slog.Debug("[CHAT] request cancel registered", "request_key", requestKey)

	streamCh, err := agent.StreamRun(ctx, ap.UserMessage(input))
	if err != nil {
		close(streamDone)
		slog.Error("[CHAT] agent.StreamRun failed", "session", sessionID, "error", err)
		return nil, fmt.Errorf("agent stream run: %w", err)
	}
	slog.Info("[CHAT] stream started", "session", sessionID)

	var fullContent string
	var tokenCount int
	for evt := range streamCh {
		switch evt.Type {
		case ap.StreamEventToken:
			fullContent += evt.Content
			tokenCount++
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "content", "content": evt.Content,
			})
		case ap.StreamEventThought:
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "reasoning", "content": evt.Content,
			})
		case ap.StreamEventToolCall:
			slog.Info("[CHAT] tool call", "session", sessionID, "tool", evt.Content)
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "tool_call", "content": evt.Content,
			})
		case ap.StreamEventToolResult:
			slog.Info("[CHAT] tool result", "session", sessionID, "result_len", len(evt.Content))
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "tool_result", "content": evt.Content,
			})
		case ap.StreamEventError:
			slog.Error("[CHAT] stream error", "session", sessionID, "error", evt.Content)
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "error", "content": evt.Content,
			})
		case ap.StreamEventComplete:
			slog.Info("[CHAT] stream complete", "session", sessionID, "tokens", tokenCount, "content_len", len(fullContent))
			a.emitEvent("stream:"+sessionID, map[string]any{
				"type": "done",
			})
		}
	}
	close(streamDone)

	if a.memory != nil {
		if err := a.memory.Add(a.ctx, &ap.Episode{
			SessionID: sessionID,
			Role:      string(ap.RoleUser),
			Content:   input,
		}); err != nil {
			slog.Warn("[CHAT] failed to add user episode", "session", sessionID, "error", err)
		} else {
			slog.Debug("[CHAT] user episode stored", "session", sessionID)
		}
		if err := a.memory.Add(a.ctx, &ap.Episode{
			SessionID: sessionID,
			Role:      string(ap.RoleAssistant),
			Content:   fullContent,
		}); err != nil {
			slog.Warn("[CHAT] failed to add assistant episode", "session", sessionID, "error", err)
		} else {
			slog.Debug("[CHAT] assistant episode stored", "session", sessionID, "content_len", len(fullContent))
		}
	}

	// H12 fix: store streaming messages back into the session so that
	// GetMessages / persistSession see the full conversation history.
	a.mu.Lock()
	for _, s := range a.sessions {
		if s.ID == sessionID {
			before := len(s.Messages)
			s.Messages = append(s.Messages,
				Message{Role: "user", Content: input},
				Message{Role: "assistant", Content: fullContent},
			)
			slog.Info("[CHAT] session messages appended", "session", sessionID, "before", before, "after", len(s.Messages))
			break
		}
	}
	a.mu.Unlock()

	// Auto-summarization: trigger SummaryEngine if threshold is met.
	// H15 fix: wrap in a goroutine with 30s timeout to prevent stuck goroutines
	// if the LLM call hangs.
	if a.summaryEngine != nil {
		go func() {
			ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
			defer cancel()
			result, err := a.summaryEngine.RunAndStore(ctx, sessionID)
			if err != nil {
				slog.Debug("[CHAT] auto-summarization skipped", "session", sessionID, "error", err)
				return
			}
			if result != nil {
				slog.Info("[CHAT] auto-summarization completed", "session", sessionID, "topics", result.Topics)
				a.emitEvent("summary:ready", map[string]string{
					"sessionID": sessionID,
					"summary":   result.Summary,
					"topics":    result.Topics,
				})
			}
		}()
	}

	slog.Info("[CHAT] SendMessageEx done", "session", sessionID, "content_len", len(fullContent))
	return []Message{
		{Role: "user", Content: input},
		{Role: "assistant", Content: fullContent},
	}, nil
}

// getOrCreateAgent returns an existing agent for the session or creates a new one.
// It uses double-checked locking to prevent TOCTOU races when multiple goroutines
// try to create agents for the same session concurrently.
func (a *App) getOrCreateAgent(sessionID string, model string) (ap.Agent, error) {
	slog.Debug("[AGENT] getOrCreateAgent start", "session", sessionID, "model", model)

	a.mu.RLock()
	if agent, ok := a.sessionAgents[sessionID]; ok {
		a.mu.RUnlock()
		slog.Debug("[AGENT] found existing agent", "session", sessionID)
		return agent, nil
	}
	a.mu.RUnlock()
	slog.Debug("[AGENT] no existing agent, acquiring write lock", "session", sessionID)

	// createProviderLocked() requires caller to hold a.mu — we acquire it here
	a.mu.Lock()
	defer a.mu.Unlock()
	// H1 fix: re-check after acquiring write lock to prevent TOCTOU race
	if agent, ok := a.sessionAgents[sessionID]; ok {
		slog.Debug("[AGENT] agent created by another goroutine while waiting", "session", sessionID)
		return agent, nil
	}
	slog.Info("[AGENT] creating new agent", "session", sessionID)

	provider, err := a.createProviderLocked(model)
	if err != nil {
		slog.Error("[AGENT] createProviderLocked failed", "session", sessionID, "error", err)
		return nil, err
	}
	slog.Debug("[AGENT] provider created", "session", sessionID)

	session := a.getSessionByID(sessionID)

	agent := ap.NewReActAgent(ap.ReActConfig{
		Name:            "CodeCast-" + sessionID[:8],
		SystemPrompt:    a.buildSystemPrompt(session),
		Model:           provider,
		Toolkit:         a.toolkit,
		EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
		Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow:   a.contextWindowStrategy,
		Lifecycle:       a.lifecycle,
		CheckpointStore: a.checkpointStore,
		MaxTurns:        20,
	}).WithMemory(ap.NewMemoryAdapter(a.memory)).
		WithRAG(ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     5,
		}).
		WithHooks(a.hooks).
		WithCostTracker(a.costTracker)

	a.sessionAgents[sessionID] = agent
	slog.Info("[AGENT] agent created and stored", "session", sessionID, "agent_count", len(a.sessionAgents))
	return agent, nil
}
