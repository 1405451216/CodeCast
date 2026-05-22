package main

import (
	"context"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Sub-Agent Types ====================

type AgentStatus string

const (
	AgentStatusQueued    AgentStatus = "queued"
	AgentStatusRunning   AgentStatus = "running"
	AgentStatusCompleted AgentStatus = "completed"
	AgentStatusFailed    AgentStatus = "failed"
	AgentStatusCancelled AgentStatus = "cancelled"
)

type AgentMode string

const (
	AgentModeExplicit AgentMode = "explicit"
	AgentModeImplicit AgentMode = "implicit"
)

// SubAgent represents an independent agent executing a sub-task
type SubAgent struct {
	ID          string         `json:"id"`
	SessionID   string         `json:"session_id"`
	ParentMsgID string         `json:"parent_msg_id"`
	Title       string         `json:"title"`
	Prompt      string         `json:"prompt"`
	FilesScope  []string       `json:"files_scope"`
	Status      AgentStatus    `json:"status"`
	Messages    []AgentMessage `json:"messages"`
	Result      string         `json:"result"`
	Error       string         `json:"error,omitempty"`
	TurnCount   int            `json:"turn_count"`
	MaxTurns    int            `json:"max_turns"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	Mode        AgentMode      `json:"mode"`

	ctx    context.Context    `json:"-"`
	cancel context.CancelFunc `json:"-"`
}

// AgentMessage is a message in the sub-agent's conversation
type AgentMessage struct {
	Role       string      `json:"role"`
	Content    string      `json:"content"`
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
	ToolResult *ToolResult `json:"tool_result,omitempty"`
}

// ToolCall represents a function call request from the LLM
type ToolCall struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Args string `json:"args"`
}

// ToolResult represents the result of executing a tool
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}

// AgentEvent is sent to the frontend via Wails events
type AgentEvent struct {
	AgentID  string      `json:"agent_id"`
	Type     string      `json:"type"`
	Status   AgentStatus `json:"status,omitempty"`
	Turn     int         `json:"turn,omitempty"`
	MaxTurns int         `json:"max_turns,omitempty"`
	ToolName string      `json:"tool_name,omitempty"`
	Message  string      `json:"message,omitempty"`
}

// ==================== Agent Pool ====================

const DefaultMaxConcurrency = 10
const DefaultMaxTurns = 50

// AgentPool manages concurrent sub-agent execution
type AgentPool struct {
	mu        sync.Mutex
	agents    map[string]*SubAgent
	semaphore chan struct{}
	app       *App
	ctx       context.Context
	cancel    context.CancelFunc
}

func NewAgentPool(app *App, maxConcurrency int) *AgentPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &AgentPool{
		agents:    make(map[string]*SubAgent),
		semaphore: make(chan struct{}, maxConcurrency),
		app:       app,
		ctx:       ctx,
		cancel:    cancel,
	}
}

func (pool *AgentPool) Submit(agent *SubAgent) {
	pool.mu.Lock()
	pool.agents[agent.ID] = agent
	agent.Status = AgentStatusQueued
	pool.mu.Unlock()

	pool.emitEvent(agent, "status")

	go func() {
		select {
		case pool.semaphore <- struct{}{}:
			defer func() { <-pool.semaphore }()
			pool.runAgentLoop(agent)
		case <-pool.ctx.Done():
			pool.mu.Lock()
			agent.Status = AgentStatusCancelled
			pool.mu.Unlock()
			pool.emitEvent(agent, "status")
		}
	}()
}

func (pool *AgentPool) Cancel(agentID string) {
	pool.mu.Lock()
	agent, exists := pool.agents[agentID]
	pool.mu.Unlock()

	if exists && (agent.Status == AgentStatusRunning || agent.Status == AgentStatusQueued) {
		if agent.cancel != nil {
			agent.cancel()
		}
		pool.mu.Lock()
		agent.Status = AgentStatusCancelled
		pool.mu.Unlock()
		pool.emitEvent(agent, "status")
	}
}

func (pool *AgentPool) CancelBySession(sessionID string) {
	pool.mu.Lock()
	var toCancel []*SubAgent
	for _, agent := range pool.agents {
		if agent.SessionID == sessionID &&
			(agent.Status == AgentStatusRunning || agent.Status == AgentStatusQueued) {
			toCancel = append(toCancel, agent)
		}
	}
	pool.mu.Unlock()

	for _, agent := range toCancel {
		pool.Cancel(agent.ID)
	}
}

func (pool *AgentPool) GetAgent(agentID string) *SubAgent {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	return pool.agents[agentID]
}

func (pool *AgentPool) GetAgentsBySession(sessionID string) []*SubAgent {
	pool.mu.Lock()
	defer pool.mu.Unlock()

	var result []*SubAgent
	for _, agent := range pool.agents {
		if agent.SessionID == sessionID {
			result = append(result, agent)
		}
	}
	return result
}

func (pool *AgentPool) Shutdown() {
	pool.cancel()
	time.Sleep(2 * time.Second)
}

func (pool *AgentPool) emitEvent(agent *SubAgent, eventType string) {
	event := AgentEvent{
		AgentID:  agent.ID,
		Type:     eventType,
		Status:   agent.Status,
		Turn:     agent.TurnCount,
		MaxTurns: agent.MaxTurns,
	}
	wailsRuntime.EventsEmit(pool.app.ctx, "agent:event", event)
}
