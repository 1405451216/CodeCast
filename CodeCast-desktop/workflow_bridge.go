package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// WorkflowDefinition is the JSON-serializable description of a workflow
// submitted by the frontend. It is intentionally limited to fields that
// round-trip through JSON; runtime-only fields (agent.Agent refs, funcs)
// are populated server-side.
type WorkflowDefinition struct {
	Type        string                    `json:"type"`        // linear | conditional | loop | parallel_fork_join | state_machine
	Name        string                    `json:"name"`
	Description string                    `json:"description,omitempty"`
	StartNodeID string                    `json:"startNodeId"`
	ErrorHandling WorkflowErrorHandlingDef `json:"errorHandling"`
	MaxIterations int                     `json:"maxIterations"`
	TimeoutSec   int                      `json:"timeoutSec"`
	Nodes        []WorkflowNodeDef        `json:"nodes"`
	Transitions  []WorkflowTransitionDef  `json:"transitions"`
}

// WorkflowNodeDef describes a single node in the workflow graph.
// Task nodes get a freshly created capability agent; other node types
// (condition, parallel, loop_start, loop_end, fallback) do not require an agent.
type WorkflowNodeDef struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Type          string            `json:"type"` // task | condition | parallel | loop_start | loop_end | fallback
	SystemPrompt  string            `json:"systemPrompt,omitempty"`
	PromptTemplate string           `json:"promptTemplate,omitempty"`
	Condition     *WorkflowCondDef  `json:"condition,omitempty"`
}

// WorkflowCondDef describes a node/transition condition.
// Field+Operator+Value are evaluated against the upstream node's output map.
type WorkflowCondDef struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

// WorkflowTransitionDef describes an edge in the workflow graph.
type WorkflowTransitionDef struct {
	From      string           `json:"from"`
	To        string           `json:"to"`
	Condition *WorkflowCondDef `json:"condition,omitempty"`
	Weight    float64          `json:"weight"`
	Type      string           `json:"type"` // "always" | "condition" | "probability"
	Probability float64         `json:"probability"`
}

// WorkflowErrorHandlingDef mirrors ap.ErrorHandling.
type WorkflowErrorHandlingDef struct {
	OnError         string `json:"onError"` // retry | skip | fail | fallback
	MaxRetries      int    `json:"maxRetries"`
	FallbackStep    string `json:"fallbackStep,omitempty"`
	ContinueOnError bool   `json:"continueOnError"`
}

// workflowRun is the in-memory state for a live workflow execution.
type workflowRun struct {
	ID         string
	Definition WorkflowDefinition
	Execution  *ap.WorkflowExecution
	Status     string // pending | running | paused | completed | failed | cancelled
	StartedAt  time.Time
	EndedAt    time.Time
	Result     *ap.WorkflowResult
	Error      string
}

// WorkflowRunData is the JSON-serializable run status for the frontend.
type WorkflowRunData struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Type       string            `json:"type"`
	Status     string            `json:"status"`
	StartedAt  string            `json:"startedAt"`
	EndedAt    string            `json:"endedAt,omitempty"`
	Output     map[string]any    `json:"output,omitempty"`
	Metrics    *ap.WorkflowMetrics `json:"metrics,omitempty"`
	Error      string            `json:"error,omitempty"`
}

// initWorkflowRuns initializes the workflowRuns map. Idempotent.
func (a *App) initWorkflowRuns() {
	a.workflowMu.Lock()
	defer a.workflowMu.Unlock()
	if a.workflowRuns == nil {
		a.workflowRuns = make(map[string]*workflowRun)
	}
}

// RunWorkflow accepts a JSON workflow definition, builds an AP WorkflowExecution,
// wires agents into the task nodes, and starts the execution in a goroutine.
// Returns the run ID; the caller subscribes to events via "workflow_event" for progress.
func (a *App) RunWorkflow(workflowJSON string, _ context.Context) (string, error) {
	if workflowJSON == "" {
		return "", fmt.Errorf("workflow JSON is required")
	}
	var def WorkflowDefinition
	if err := json.Unmarshal([]byte(workflowJSON), &def); err != nil {
		return "", fmt.Errorf("invalid workflow JSON: %w", err)
	}
	if def.Name == "" {
		return "", fmt.Errorf("workflow name is required")
	}
	if def.StartNodeID == "" {
		return "", fmt.Errorf("workflow startNodeId is required")
	}
	if len(def.Nodes) == 0 {
		return "", fmt.Errorf("workflow must have at least one node")
	}

	wfType, err := mapWorkflowType(def.Type)
	if err != nil {
		return "", err
	}

	// Build the AP WorkflowConfig
	eh := ap.ErrorHandling{
		OnError:         orDefault(def.ErrorHandling.OnError, "fail"),
		MaxRetries:      def.ErrorHandling.MaxRetries,
		FallbackStep:    def.ErrorHandling.FallbackStep,
		ContinueOnError: def.ErrorHandling.ContinueOnError,
	}
	timeout := time.Duration(def.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}
	maxIter := def.MaxIterations
	if maxIter <= 0 {
		maxIter = 100
	}
	cfg := ap.WorkflowConfig{
		Type:          wfType,
		Name:          def.Name,
		Description:   def.Description,
		MaxIterations: maxIter,
		Timeout:       timeout,
		ErrorHandling: eh,
	}

	wf := ap.NewWorkflowExecution(cfg)

	// Build nodes
	nodeByID := make(map[string]*ap.WorkflowNode, len(def.Nodes))
	for _, n := range def.Nodes {
		nodeType, terr := mapNodeType(n.Type)
		if terr != nil {
			return "", fmt.Errorf("node %s: %w", n.ID, terr)
		}
		apNode := &ap.WorkflowNode{
			ID:   n.ID,
			Name: orDefault(n.Name, n.ID),
			Type: nodeType,
		}
		if n.PromptTemplate != "" {
			apNode.Config = &ap.NodeConfig{
				PromptTemplate: n.PromptTemplate,
			}
		}
		if n.Condition != nil {
			apNode.Condition = &ap.NodeCondition{
				Field:    n.Condition.Field,
				Operator: n.Condition.Operator,
				Value:    n.Condition.Value,
			}
		}
		// Task nodes need an agent. Condition/parallel/loop_* don't.
		if nodeType == ap.TaskNode || nodeType == ap.FallbackNode {
			agentName := n.Name
			if agentName == "" {
				agentName = n.ID
			}
			systemPrompt := n.SystemPrompt
			if systemPrompt == "" {
				systemPrompt = "你是 CodeCast 工作流中的 " + agentName + " 节点。专注于完成指定任务，给出简洁准确的结果。"
			}
			ag, aerr := a.createWorkflowAgent(agentName, systemPrompt)
			if aerr != nil {
				return "", fmt.Errorf("create agent for node %s: %w", n.ID, aerr)
			}
			apNode.Agent = ag
		}
		if err := wf.AddNode(apNode); err != nil {
			return "", fmt.Errorf("add node %s: %w", n.ID, err)
		}
		nodeByID[n.ID] = apNode
	}

	// Build transitions
	for _, t := range def.Transitions {
		trans := &ap.Transition{
			From:   t.From,
			To:     t.To,
			Weight: t.Weight,
		}
		if t.Condition != nil {
			trans.Condition = &ap.TransitionCondition{
				Field:    t.Condition.Field,
				Operator: t.Condition.Operator,
				Value:    t.Condition.Value,
			}
		} else if t.Type != "" {
			trans.Condition = &ap.TransitionCondition{Type: t.Type}
			if t.Type == "probability" {
				trans.Condition.Probability = t.Probability
			}
		}
		if err := wf.AddTransition(trans); err != nil {
			return "", fmt.Errorf("add transition %s->%s: %w", t.From, t.To, err)
		}
	}

	if err := wf.SetStartNode(def.StartNodeID); err != nil {
		return "", fmt.Errorf("set start node: %w", err)
	}

	// Register the run
	a.initWorkflowRuns()
	runID := fmt.Sprintf("wf-%d", time.Now().UnixNano())
	run := &workflowRun{
		ID:         runID,
		Definition: def,
		Execution:  wf,
		Status:     string(ap.WfStatusPending),
		StartedAt:  time.Now(),
	}
	a.workflowMu.Lock()
	a.workflowRuns[runID] = run
	a.workflowMu.Unlock()

	// Subscribe to events and emit Wails events
	go a.workflowEventPump(runID, wf)

	// Run the workflow in a goroutine
	go func() {
		a.workflowMu.Lock()
		run.Status = string(ap.WfStatusRunning)
		a.workflowMu.Unlock()
		safeEmit(a.ctx, "workflow:started", map[string]any{
			"runId": runID, "name": def.Name, "type": def.Type,
		})
		result, execErr := wf.Execute(map[string]any{"_input": def.Description})
		now := time.Now()
		a.workflowMu.Lock()
		run.EndedAt = now
		run.Result = result
		if execErr != nil {
			run.Error = execErr.Error()
			run.Status = string(ap.WfStatusFailed)
		} else if wf.GetStatus() == ap.WfStatusCancelled {
			run.Status = string(ap.WfStatusCancelled)
		} else if wf.GetStatus() == ap.WfStatusPaused {
			run.Status = string(ap.WfStatusPaused)
		} else {
			run.Status = string(ap.WfStatusCompleted)
		}
		a.workflowMu.Unlock()

		safeEmit(a.ctx, "workflow:complete", map[string]any{
			"runId":     runID,
			"status":    run.Status,
			"output":    run.Result.Output,
			"error":     run.Error,
			"duration":  run.Result.Duration.String(),
		})
	}()

	slog.Info("Workflow started", "runId", runID, "name", def.Name, "type", def.Type)
	return runID, nil
}

// workflowEventPump drains the workflow event channel and emits Wails events
// for the frontend. Runs until the workflow channel is closed (channel closes
// when GC finalizes the workflow; we stop on completion signal).
func (a *App) workflowEventPump(runID string, wf *ap.WorkflowExecution) {
	for event := range wf.Events() {
		safeEmit(a.ctx, "workflow_event", map[string]any{
			"runId":    runID,
			"type":     event.Type,
			"nodeId":   event.NodeID,
			"data":     event.Data,
			"timestamp": event.Timestamp.Format(time.RFC3339Nano),
		})
	}
}

// PauseWorkflow pauses a running workflow. The agent Run is cancelled and
// status transitions to paused; subsequent Resume can continue.
func (a *App) PauseWorkflow(runID string) error {
	a.workflowMu.RLock()
	run, ok := a.workflowRuns[runID]
	a.workflowMu.RUnlock()
	if !ok {
		return fmt.Errorf("workflow run %s not found", runID)
	}
	if run.Execution == nil {
		return fmt.Errorf("workflow run %s has no execution handle", runID)
	}
	run.Execution.Pause()
	a.workflowMu.Lock()
	run.Status = string(ap.WfStatusPaused)
	a.workflowMu.Unlock()
	slog.Info("Workflow paused", "runId", runID)
	safeEmit(a.ctx, "workflow:paused", map[string]any{"runId": runID})
	return nil
}

// ResumeWorkflow resumes a paused workflow. AP's WorkflowExecution.Resume
// only updates the status flag — it does not re-execute the workflow. This is
// a known limitation of the current AP API; the workflow is marked as resumed
// for UI feedback but does not continue from the last node.
func (a *App) ResumeWorkflow(runID string) error {
	a.workflowMu.RLock()
	run, ok := a.workflowRuns[runID]
	a.workflowMu.RUnlock()
	if !ok {
		return fmt.Errorf("workflow run %s not found", runID)
	}
	if run.Execution == nil {
		return fmt.Errorf("workflow run %s has no execution handle", runID)
	}
	if err := run.Execution.Resume(); err != nil {
		return err
	}
	a.workflowMu.Lock()
	run.Status = string(ap.WfStatusRunning)
	a.workflowMu.Unlock()
	slog.Info("Workflow resumed", "runId", runID)
	safeEmit(a.ctx, "workflow:resumed", map[string]any{"runId": runID})
	return nil
}

// CancelWorkflow cancels a running or paused workflow.
func (a *App) CancelWorkflow(runID string) error {
	a.workflowMu.RLock()
	run, ok := a.workflowRuns[runID]
	a.workflowMu.RUnlock()
	if !ok {
		return fmt.Errorf("workflow run %s not found", runID)
	}
	if run.Execution == nil {
		return fmt.Errorf("workflow run %s has no execution handle", runID)
	}
	run.Execution.Cancel()
	a.workflowMu.Lock()
	run.Status = string(ap.WfStatusCancelled)
	a.workflowMu.Unlock()
	slog.Info("Workflow cancelled", "runId", runID)
	safeEmit(a.ctx, "workflow:cancelled", map[string]any{"runId": runID})
	return nil
}

// GetWorkflowRun returns the current state of a workflow run.
func (a *App) GetWorkflowRun(runID string) *WorkflowRunData {
	a.workflowMu.RLock()
	run, ok := a.workflowRuns[runID]
	a.workflowMu.RUnlock()
	if !ok {
		return nil
	}
	data := &WorkflowRunData{
		ID:        run.ID,
		Name:      run.Definition.Name,
		Type:      run.Definition.Type,
		Status:    run.Status,
		StartedAt: run.StartedAt.Format(time.RFC3339Nano),
		Error:     run.Error,
	}
	if !run.EndedAt.IsZero() {
		data.EndedAt = run.EndedAt.Format(time.RFC3339Nano)
	}
	if run.Result != nil {
		data.Output = run.Result.Output
		data.Metrics = run.Result.Metrics
	}
	return data
}

// ListWorkflowExecutions returns all workflow runs (most recent first).
func (a *App) ListWorkflowExecutions() []WorkflowRunData {
	a.workflowMu.RLock()
	defer a.workflowMu.RUnlock()
	out := make([]WorkflowRunData, 0, len(a.workflowRuns))
	for _, run := range a.workflowRuns {
		data := WorkflowRunData{
			ID:        run.ID,
			Name:      run.Definition.Name,
			Type:      run.Definition.Type,
			Status:    run.Status,
			StartedAt: run.StartedAt.Format(time.RFC3339Nano),
			Error:     run.Error,
		}
		if !run.EndedAt.IsZero() {
			data.EndedAt = run.EndedAt.Format(time.RFC3339Nano)
		}
		if run.Result != nil {
			data.Output = run.Result.Output
			data.Metrics = run.Result.Metrics
		}
		out = append(out, data)
	}
	return out
}

// ExportWorkflow returns the JSON snapshot of a workflow's full state.
func (a *App) ExportWorkflow(runID string) ([]byte, error) {
	a.workflowMu.RLock()
	run, ok := a.workflowRuns[runID]
	a.workflowMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("workflow run %s not found", runID)
	}
	if run.Execution == nil {
		return nil, fmt.Errorf("workflow run %s has no execution handle", runID)
	}
	return run.Execution.Export()
}

// createWorkflowAgent creates a lightweight agent for use inside a workflow node.
// Mirrors the existing createCapabilityAgent pattern but takes an explicit
// system prompt so each node can have specialized instructions.
func (a *App) createWorkflowAgent(name, systemPrompt string) (ap.Agent, error) {
	a.mu.Lock()
	provider, err := a.createProvider("")
	a.mu.Unlock()
	if err != nil {
		return nil, fmt.Errorf("create provider for %s: %w", name, err)
	}

	// Build the agent with fluent With* API. The With* methods are defined on
	// *ReActAgent and return *CapabilityAgent, so we build the chain in one
	// expression and assign the result to ap.Agent.
	baseAgent := ap.NewReActAgent(ap.ReActConfig{
		Name:         name,
		SystemPrompt: systemPrompt,
		Model:        provider,
		Toolkit:      a.toolkit,
		MaxTurns:     5,
	})

	var ag ap.Agent = baseAgent
	if a.memory != nil {
		ag = baseAgent.WithMemory(ap.NewMemoryAdapter(a.memory))
	}
	if a.ragStore != nil {
		ag = baseAgent.WithRAG(ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     3,
		})
	}
	if a.hooks != nil {
		ag = baseAgent.WithHooks(a.hooks)
	}
	if a.costTracker != nil {
		ag = baseAgent.WithCostTracker(a.costTracker)
	}
	return ag, nil
}

// mapWorkflowType converts a frontend type string to ap.WorkflowType.
func mapWorkflowType(s string) (ap.WorkflowType, error) {
	switch s {
	case "linear":
		return ap.LinearWorkflow, nil
	case "conditional":
		return ap.ConditionalWorkflow, nil
	case "loop":
		return ap.LoopWorkflow, nil
	case "parallel_fork_join":
		return ap.ParallelForkJoinWf, nil
	case "state_machine":
		return ap.StateMachineWf, nil
	}
	return "", fmt.Errorf("unsupported workflow type: %s (valid: linear, conditional, loop, parallel_fork_join, state_machine)", s)
}

// mapNodeType converts a frontend node type string to ap.NodeType.
func mapNodeType(s string) (ap.NodeType, error) {
	switch s {
	case "task":
		return ap.TaskNode, nil
	case "condition":
		return ap.ConditionNode, nil
	case "parallel":
		return ap.ParallelNode, nil
	case "loop_start":
		return ap.LoopStartNode, nil
	case "loop_end":
		return ap.LoopEndNode, nil
	case "fallback":
		return ap.FallbackNode, nil
	case "sub_workflow":
		return ap.SubWfNode, nil
	}
	return "", fmt.Errorf("unsupported node type: %s (valid: task, condition, parallel, loop_start, loop_end, fallback, sub_workflow)", s)
}

// ensure unused import suppression
var _ = wailsRuntime.EventsEmit
var _ = sync.RWMutex{}
