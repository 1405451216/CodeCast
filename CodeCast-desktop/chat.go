package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"

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

	ctx, reqCancel := context.WithCancel(a.ctx)
	streamDone := make(chan struct{})
	defer func() {
		<-streamDone // wait until stream read loop is finished
		reqCancel()
	}()

	a.mu.Lock()
	requestIDBytes := make([]byte, 4)
	rand.Read(requestIDBytes)
	requestKey := sessionID + "_" + hex.EncodeToString(requestIDBytes)
	a.sessionCancels[requestKey] = reqCancel
	a.mu.Unlock()

	streamCh, err := agent.StreamRun(ctx, ap.UserMessage(input))
	if err != nil {
		close(streamDone)
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
	close(streamDone)

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

	// Auto-summarization: trigger SummaryEngine if threshold is met
	if a.summaryEngine != nil {
		go func() {
			result, err := a.summaryEngine.RunAndStore(a.ctx, sessionID)
			if err != nil {
				slog.Debug("auto-summarization skipped or failed", "session", sessionID, "error", err)
				return
			}
			if result != nil {
				slog.Info("auto-summarization completed", "session", sessionID, "topics", result.Topics)
				wailsRuntime.EventsEmit(a.ctx, "summary:ready", map[string]string{
					"sessionID": sessionID,
					"summary":   result.Summary,
					"topics":    result.Topics,
				})
			}
		}()
	}

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
		EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
		Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
		ContextWindow:   ap.NewDefaultStrategy(80),
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

	a.mu.Lock()
	a.sessionAgents[sessionID] = agent
	a.mu.Unlock()

	return agent, nil, nil
}
