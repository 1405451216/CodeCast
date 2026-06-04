package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	ap "agentprimordia/pkg"
)

// CheckpointInfo is a lightweight view of an AP AgentState, sent to the frontend.
type CheckpointInfo struct {
	ID        string `json:"ID"`
	SessionID string `json:"SessionID"`
	Turn      int    `json:"Turn"`
	Status    string `json:"Status"`
	ToolName  string `json:"ToolName"`
	CreatedAt string `json:"CreatedAt"`
}

// GetCheckpoints lists checkpoints for a given session.
// It calls CheckpointStore.List and returns up to limit entries.
func (a *App) GetCheckpoints(sessionID string, limit int) []CheckpointInfo {
	if a.checkpointStore == nil {
		return []CheckpointInfo{}
	}

	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()

	states, err := a.checkpointStore.List(ctx, sessionID)
	if err != nil {
		slog.Warn("GetCheckpoints failed", "error", err)
		return []CheckpointInfo{}
	}

	if len(states) > limit {
		states = states[:limit]
	}

	result := make([]CheckpointInfo, 0, len(states))
	for _, s := range states {
		toolName := ""
		if s.Metrics.TotalTools > 0 {
			toolName = fmt.Sprintf("tools:%d", s.Metrics.TotalTools)
		}

		result = append(result, CheckpointInfo{
			ID:        s.AgentID,
			SessionID: s.SessionID,
			Turn:      s.TurnCount,
			Status:    s.Status,
			ToolName:  toolName,
			CreatedAt: s.SavedAt.Format(time.RFC3339),
		})
	}
	return result
}

// LoadCheckpoint loads and returns a checkpoint by ID.
// The frontend uses this to verify a checkpoint exists before resuming.
func (a *App) LoadCheckpoint(checkpointID string) error {
	if a.checkpointStore == nil {
		return fmt.Errorf("checkpoint store not configured")
	}

	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()

	_, err := a.checkpointStore.Load(ctx, checkpointID)
	if err != nil {
		return fmt.Errorf("load checkpoint: %w", err)
	}
	return nil
}

// DeleteCheckpoint removes a checkpoint by ID.
func (a *App) DeleteCheckpoint(checkpointID string) error {
	if a.checkpointStore == nil {
		return fmt.Errorf("checkpoint store not configured")
	}

	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()

	if err := a.checkpointStore.Delete(ctx, checkpointID); err != nil {
		return fmt.Errorf("delete checkpoint: %w", err)
	}
	slog.Info("Checkpoint deleted", "id", checkpointID)
	return nil
}

// ResumeFromCheckpoint resumes an agent from a saved checkpoint.
// It looks up the session's agent and calls ResumeFromCheckpoint on it.
func (a *App) ResumeFromCheckpoint(sessionID string, checkpointID string) error {
	if a.checkpointStore == nil {
		return fmt.Errorf("checkpoint store not configured")
	}

	a.mu.RLock()
	agent, ok := a.sessionAgents[sessionID]
	a.mu.RUnlock()
	if !ok {
		return fmt.Errorf("no agent found for session %q", sessionID)
	}

	// ResumeFromCheckpoint is on *ReActAgent directly — use interface assertion.
	type resumeCapable interface {
		ResumeFromCheckpoint(ctx context.Context) (*ap.Response, error)
	}

	rc, ok := agent.(resumeCapable)
	if !ok {
		return fmt.Errorf("agent does not support ResumeFromCheckpoint")
	}

	ctx, cancel := context.WithTimeout(a.ctx, 10*time.Minute)
	defer cancel()

	resp, err := rc.ResumeFromCheckpoint(ctx)
	if err != nil {
		return fmt.Errorf("resume from checkpoint: %w", err)
	}

	if resp != nil && resp.Error != nil {
		return fmt.Errorf("resume completed with error: %w", resp.Error)
	}

	slog.Info("Agent resumed from checkpoint", "session", sessionID, "checkpoint", checkpointID)
	return nil
}
