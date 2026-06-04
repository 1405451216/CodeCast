package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

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
		Title      string   `json:"title"`
		Prompt     string   `json:"prompt"`
		FilesScope []string `json:"files_scope,omitempty"`
	}
	if err := json.Unmarshal([]byte(tasksJSON), &tasks); err != nil {
		return nil, fmt.Errorf("parse tasks: %w", err)
	}

	var taskConfigs []ap.TaskConfig
	for _, t := range tasks {
		taskConfigs = append(taskConfigs, ap.TaskConfig{
			Title:      t.Title,
			Prompt:     t.Prompt,
			FilesScope: t.FilesScope,
			MaxTurns:   10,
		})
	}

	// Validate task scopes for overlap conflicts before dispatching
	if a.fileLockMgr != nil {
		var scopes [][]string
		for _, t := range taskConfigs {
			if t.FilesScope != nil {
				scopes = append(scopes, t.FilesScope)
			}
		}
		if err := ap.ValidateScopes(scopes); err != nil {
			return nil, fmt.Errorf("scope conflict: %w", err)
		}
	}

	// Use a.ctx as parent so agent dispatches are cancelled on app shutdown.
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	results, err := a.pool.Dispatch(ctx, taskConfigs)
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

// createPoolAgentFactory returns a function that creates CapabilityAgents for the pool.
func (a *App) createPoolAgentFactory() ap.AgentFactory {
	return func(config ap.AgentFactoryConfig) ap.Agent {
		a.mu.Lock()
		provider, err := a.createProvider("")
		a.mu.Unlock()
		if err != nil {
			slog.Warn("createPoolAgentFactory: provider failed", "error", err)
			return ap.NewReActAgent(ap.ReActConfig{
				Name:         "Pool-" + config.Name,
				SystemPrompt: config.SystemPrompt,
				MaxTurns:     config.MaxTurns,
			})
		}

		return ap.NewReActAgent(ap.ReActConfig{
			Name:         "Pool-" + config.Name,
			SystemPrompt: config.SystemPrompt,
			Model:        provider,
			Toolkit:      a.toolkit,
			MaxTurns:     config.MaxTurns,
		}).WithMemory(ap.NewMemoryAdapter(a.memory)).
			WithRAG(ap.RAGConfig{
				Provider: ap.NewRAGProviderAdapter(a.ragStore),
				Mode:     ap.RAGModeAuto,
				TopK:     3,
			}).
			WithHooks(a.hooks).
			WithCostTracker(a.costTracker)
	}
}
