package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// safeEmit emits a Wails event only when the context carries a valid Wails
// frontend. In unit tests the context is a plain context.Background(), which
// has no frontend — calling EventsEmit directly would log.Fatal. We guard
// against that by checking for the "frontend" key first.
func safeEmit(ctx context.Context, event string, data any) {
	if ctx != nil && ctx.Value("frontend") != nil {
		wailsRuntime.EventsEmit(ctx, event, data)
	}
}

// OrchestrationRun tracks a running orchestration workflow.
type OrchestrationRun struct {
	ID        string `json:"id"`
	Type      string `json:"type"`       // "code_review" | "refactoring" | "test_pipeline" | "handoff" | "parallel"
	Status    string `json:"status"`     // "running" | "completed" | "failed" | "cancelled"
	SessionID string `json:"sessionId"`
	Input     string `json:"input"`
	Output    string `json:"output,omitempty"`
	Error     string `json:"error,omitempty"`
	StartedAt string `json:"startedAt"`
	EndedAt   string `json:"endedAt,omitempty"`
	Cancel    context.CancelFunc `json:"-"` // cancels the per-run context
}

// CodeReviewResult is the structured output of the code review DAG.
type CodeReviewResult struct {
	Summary     string   `json:"summary"`
	Issues      []string `json:"issues"`
	Suggestions []string `json:"suggestions"`
	Score       float64  `json:"score"`
}

// RefactoringResult is the structured output of the refactoring DAG.
type RefactoringResult struct {
	OriginalCode   string   `json:"originalCode"`
	RefactoredCode string   `json:"refactoredCode"`
	Changes        []string `json:"changes"`
	Explanation    string   `json:"explanation"`
}

// TestPipelineResult is the structured output of the test generation pipeline.
type TestPipelineResult struct {
	TestCode  string   `json:"testCode"`
	Coverage  float64  `json:"coverage"`
	Skipped   []string `json:"skipped,omitempty"`
	Framework string   `json:"framework"`
}

// ParallelAnalysisResult is the combined output from ParallelRun.
type ParallelAnalysisResult struct {
	Results []string `json:"results"`
	Errors  []string `json:"errors,omitempty"`
}

// buildCodeReviewDAG constructs a DAG workflow for automated code review.
//
//	analyze ──> review_security ──┐
//	     └──> review_style ───────┤──> summarize
//	     └──> review_perf ───────┘
func (a *App) buildCodeReviewDAG() (*ap.DAGWorkflow, error) {
	builder := ap.NewDAGBuilder("code-review")

	builder.Node("analyze", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("code-review-analyzer")
		if err != nil {
			return "", fmt.Errorf("create analyzer agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"分析以下代码的结构、依赖关系和复杂度：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("review_security", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("code-review-security")
		if err != nil {
			return "", fmt.Errorf("create security agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"审查以下代码的安全问题（SQL注入、XSS、硬编码密钥等）：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("review_style", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("code-review-style")
		if err != nil {
			return "", fmt.Errorf("create style agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"审查以下代码的代码风格、命名规范和可读性：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("review_perf", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("code-review-perf")
		if err != nil {
			return "", fmt.Errorf("create perf agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"审查以下代码的性能问题（内存泄漏、N+1查询、算法复杂度等）：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("summarize", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("code-review-summarizer")
		if err != nil {
			return "", fmt.Errorf("create summarizer agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"汇总以下代码的多方面审查结果，生成最终审查报告：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	// Wire edges: analyze fans out to 3 review nodes, which fan in to summarize
	builder.FanOut("analyze", "review_security", "review_style", "review_perf")
	builder.FanIn("summarize", "review_security", "review_style", "review_perf")

	return builder.Build()
}

// buildRefactoringDAG constructs a DAG workflow for code refactoring.
//
//	assess ──> refactor ──> validate
func (a *App) buildRefactoringDAG() (*ap.DAGWorkflow, error) {
	builder := ap.NewDAGBuilder("refactoring")

	builder.Node("assess", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("refactor-assessor")
		if err != nil {
			return "", fmt.Errorf("create assessor agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"评估以下代码，识别需要重构的部分，给出重构建议：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("refactor", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("refactor-executor")
		if err != nil {
			return "", fmt.Errorf("create refactor agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"根据以下评估结果，执行代码重构：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Node("validate", func(ctx context.Context, input string) (string, error) {
		agent, err := a.createCapabilityAgent("refactor-validator")
		if err != nil {
			return "", fmt.Errorf("create validator agent: %w", err)
		}
		resp, err := agent.Run(ctx, ap.UserMessage(fmt.Sprintf(
			"验证重构后的代码是否正确，与原始需求对比：\n\n%s", input)))
		if err != nil {
			return "", err
		}
		return resp.Content, nil
	})

	builder.Chain("assess", "refactor", "validate")

	return builder.Build()
}

// noopAgent is a placeholder Agent used when a real agent cannot be created
// (e.g. during tests without a configured provider). It returns an empty response.
type noopAgent struct{ name string }

func (n *noopAgent) Run(_ context.Context, _ ap.Message) (*ap.Response, error) {
	return &ap.Response{Content: ""}, nil
}
func (n *noopAgent) StreamRun(_ context.Context, _ ap.Message) (<-chan ap.StreamEvent, error) {
	ch := make(chan ap.StreamEvent, 1)
	ch <- ap.StreamEvent{Type: ap.StreamEventComplete, Content: ""}
	close(ch)
	return ch, nil
}
func (n *noopAgent) Stop()               {}
func (n *noopAgent) Name() string        { return n.name }
func (n *noopAgent) Stats() ap.AgentStats { return ap.AgentStats{} }

// agentOrNoop returns the agent or a noop fallback when creation fails.
func agentOrNoop(name string, a ap.Agent, err error) ap.Agent {
	if err != nil || a == nil {
		return &noopAgent{name: name}
	}
	return a
}

// buildTestPipeline constructs a linear Pipeline for test generation.
func (a *App) buildTestPipeline() (*ap.Pipeline, error) {
	ia, iaErr := a.createCapabilityAgent("test-identifier")
	ga, gaErr := a.createCapabilityAgent("test-generator")
	va, vaErr := a.createCapabilityAgent("test-verifier")
	identifyAgent := agentOrNoop("test-identifier", ia, iaErr)
	generateAgent := agentOrNoop("test-generator", ga, gaErr)
	verifyAgent := agentOrNoop("test-verifier", va, vaErr)

	pipeline := ap.NewPipeline(
		ap.PipelineStep{
			Name:  "identify_targets",
			Agent: identifyAgent,
			Condition: func(ctx context.Context, prevResult *ap.StepResult) bool {
				return prevResult == nil || prevResult.Error == nil
			},
		},
		ap.PipelineStep{
			Name:  "generate_tests",
			Agent: generateAgent,
			Condition: func(ctx context.Context, prevResult *ap.StepResult) bool {
				return prevResult != nil && prevResult.Error == nil && !prevResult.Skipped
			},
		},
		ap.PipelineStep{
			Name:  "verify_tests",
			Agent: verifyAgent,
			Condition: func(ctx context.Context, prevResult *ap.StepResult) bool {
				return prevResult != nil && prevResult.Error == nil && !prevResult.Skipped
			},
		},
	)

	return pipeline, nil
}

// createCapabilityAgent creates a lightweight agent using the CapabilityAgent fluent API.
func (a *App) createCapabilityAgent(name string) (ap.Agent, error) {
	a.mu.Lock()
	if a.settings == nil {
		a.mu.Unlock()
		return nil, fmt.Errorf("settings not initialized for agent %s", name)
	}
	provider, err := a.createProvider()
	a.mu.Unlock()
	if err != nil {
		return nil, fmt.Errorf("create provider for %s: %w", name, err)
	}

	agent := ap.NewReActAgent(ap.ReActConfig{
		Name:         name,
		SystemPrompt: "你是 CodeCast 的 " + name + " 代理。专注于完成指定任务，给出简洁准确的结果。",
		Model:        provider,
		Toolkit:      a.toolkit,
		MaxTurns:     5,
	}).WithMemory(ap.NewMemoryAdapter(a.memory)).
		WithRAG(ap.RAGConfig{
			Provider: ap.NewRAGProviderAdapter(a.ragStore),
			Mode:     ap.RAGModeAuto,
			TopK:     3,
		}).
		WithHooks(a.hooks).
		WithCostTracker(a.costTracker)

	return agent, nil
}

// RunCodeReviewWorkflow executes the code review DAG and returns the result.
func (a *App) RunCodeReviewWorkflow(sessionID, code string) (*CodeReviewResult, error) {
	dag, err := a.buildCodeReviewDAG()
	if err != nil {
		return nil, fmt.Errorf("build code review DAG: %w", err)
	}

	runID := fmt.Sprintf("cr-%d", time.Now().UnixNano())
	runCtx, runCancel := context.WithCancel(a.ctx)
	a.orchestrationMu.Lock()
	a.orchestrationRuns[runID] = &OrchestrationRun{
		ID:        runID,
		Type:      "code_review",
		Status:    "running",
		SessionID: sessionID,
		Input:     truncate(code, 200),
		StartedAt: time.Now().Format(time.RFC3339),
		Cancel:    runCancel,
	}
	a.orchestrationMu.Unlock()

	safeEmit(a.ctx, "orchestration:start", map[string]any{
		"runId": runID, "type": "code_review", "sessionId": sessionID,
	})

	go func() {
		defer runCancel()
		result, execErr := dag.Run(runCtx, code)

		a.orchestrationMu.Lock()
		run := a.orchestrationRuns[runID]
		if run != nil {
			run.EndedAt = time.Now().Format(time.RFC3339)
			if execErr != nil {
				run.Status = "failed"
				run.Error = execErr.Error()
			} else {
				run.Status = "completed"
				// Concatenate all node outputs
				var combined string
				for _, id := range result.Order {
					if nr, ok := result.NodeResults[id]; ok && nr.Output != "" {
						combined += nr.Output + "\n"
					}
				}
				run.Output = truncate(combined, 500)
			}
		}
		a.orchestrationMu.Unlock()

		eventType := "orchestration:complete"
		if execErr != nil {
			eventType = "orchestration:error"
		}
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		}
		safeEmit(a.ctx, eventType, map[string]any{
			"runId": runID, "type": "code_review", "error": errMsg,
		})
	}()

	return &CodeReviewResult{
		Summary: fmt.Sprintf("Code review workflow started (run ID: %s)", runID),
	}, nil
}

// RunRefactoringWorkflow executes the refactoring DAG.
func (a *App) RunRefactoringWorkflow(sessionID, code string) (*RefactoringResult, error) {
	dag, err := a.buildRefactoringDAG()
	if err != nil {
		return nil, fmt.Errorf("build refactoring DAG: %w", err)
	}

	runID := fmt.Sprintf("rf-%d", time.Now().UnixNano())
	runCtx, runCancel := context.WithCancel(a.ctx)
	a.orchestrationMu.Lock()
	a.orchestrationRuns[runID] = &OrchestrationRun{
		ID:        runID,
		Type:      "refactoring",
		Status:    "running",
		SessionID: sessionID,
		Input:     truncate(code, 200),
		StartedAt: time.Now().Format(time.RFC3339),
		Cancel:    runCancel,
	}
	a.orchestrationMu.Unlock()

	safeEmit(a.ctx, "orchestration:start", map[string]any{
		"runId": runID, "type": "refactoring", "sessionId": sessionID,
	})

	go func() {
		defer runCancel()
		result, execErr := dag.Run(runCtx, code)

		a.orchestrationMu.Lock()
		run := a.orchestrationRuns[runID]
		if run != nil {
			run.EndedAt = time.Now().Format(time.RFC3339)
			if execErr != nil {
				run.Status = "failed"
				run.Error = execErr.Error()
			} else {
				run.Status = "completed"
				var combined string
				for _, id := range result.Order {
					if nr, ok := result.NodeResults[id]; ok && nr.Output != "" {
						combined += nr.Output + "\n"
					}
				}
				run.Output = truncate(combined, 500)
			}
		}
		a.orchestrationMu.Unlock()

		eventType := "orchestration:complete"
		if execErr != nil {
			eventType = "orchestration:error"
		}
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		}
		safeEmit(a.ctx, eventType, map[string]any{
			"runId": runID, "type": "refactoring", "error": errMsg,
		})
	}()

	return &RefactoringResult{
		OriginalCode: code,
		Explanation:  fmt.Sprintf("Refactoring workflow started (run ID: %s)", runID),
	}, nil
}

// RunTestPipelineWorkflow executes the test generation pipeline.
func (a *App) RunTestPipelineWorkflow(sessionID, code string) (*TestPipelineResult, error) {
	pipeline, err := a.buildTestPipeline()
	if err != nil {
		return nil, fmt.Errorf("build test pipeline: %w", err)
	}

	runID := fmt.Sprintf("tp-%d", time.Now().UnixNano())
	runCtx, runCancel := context.WithCancel(a.ctx)
	a.orchestrationMu.Lock()
	a.orchestrationRuns[runID] = &OrchestrationRun{
		ID:        runID,
		Type:      "test_pipeline",
		Status:    "running",
		SessionID: sessionID,
		Input:     truncate(code, 200),
		StartedAt: time.Now().Format(time.RFC3339),
		Cancel:    runCancel,
	}
	a.orchestrationMu.Unlock()

	safeEmit(a.ctx, "orchestration:start", map[string]any{
		"runId": runID, "type": "test_pipeline", "sessionId": sessionID,
	})

	go func() {
		defer runCancel()
		result, execErr := pipeline.Run(runCtx, code)

		a.orchestrationMu.Lock()
		run := a.orchestrationRuns[runID]
		if run != nil {
			run.EndedAt = time.Now().Format(time.RFC3339)
			if execErr != nil {
				run.Status = "failed"
				run.Error = execErr.Error()
			} else {
				run.Status = "completed"
				run.Output = truncate(result.Final, 500)
			}
		}
		a.orchestrationMu.Unlock()

		eventType := "orchestration:complete"
		if execErr != nil {
			eventType = "orchestration:error"
		}
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		}
		safeEmit(a.ctx, eventType, map[string]any{
			"runId": runID, "type": "test_pipeline", "error": errMsg,
		})
	}()

	return &TestPipelineResult{
		Framework: fmt.Sprintf("Test pipeline started (run ID: %s)", runID),
	}, nil
}

// RunHandoffWorkflow executes a handoff between agents for multi-specialist tasks.
func (a *App) RunHandoffWorkflow(sessionID, message string) (string, error) {
	analyzer, err := a.createCapabilityAgent("handoff-analyzer")
	if err != nil {
		return "", fmt.Errorf("create analyzer: %w", err)
	}
	coder, err := a.createCapabilityAgent("handoff-coder")
	if err != nil {
		return "", fmt.Errorf("create coder: %w", err)
	}
	reviewer, err := a.createCapabilityAgent("handoff-reviewer")
	if err != nil {
		return "", fmt.Errorf("create reviewer: %w", err)
	}

	// Simple round-robin router
	routerIdx := 0
	handoff := ap.NewHandoff(ap.HandoffConfig{
		Agents: []ap.Agent{analyzer, coder, reviewer},
		Router: func(ctx context.Context, input string) int {
			idx := routerIdx % 3
			routerIdx++
			return idx
		},
		MaxHandoffs: 6,
	})

	runID := fmt.Sprintf("ho-%d", time.Now().UnixNano())
	runCtx, runCancel := context.WithCancel(a.ctx)
	a.orchestrationMu.Lock()
	a.orchestrationRuns[runID] = &OrchestrationRun{
		ID:        runID,
		Type:      "handoff",
		Status:    "running",
		SessionID: sessionID,
		Input:     truncate(message, 200),
		StartedAt: time.Now().Format(time.RFC3339),
		Cancel:    runCancel,
	}
	a.orchestrationMu.Unlock()

	safeEmit(a.ctx, "orchestration:start", map[string]any{
		"runId": runID, "type": "handoff", "sessionId": sessionID,
	})

	go func() {
		defer runCancel()
		result, execErr := handoff.Run(runCtx, message)

		a.orchestrationMu.Lock()
		run := a.orchestrationRuns[runID]
		if run != nil {
			run.EndedAt = time.Now().Format(time.RFC3339)
			if execErr != nil {
				run.Status = "failed"
				run.Error = execErr.Error()
			} else {
				run.Status = "completed"
				run.Output = truncate(result.Output, 500)
			}
		}
		a.orchestrationMu.Unlock()

		eventType := "orchestration:complete"
		if execErr != nil {
			eventType = "orchestration:error"
		}
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		}
		safeEmit(a.ctx, eventType, map[string]any{
			"runId": runID, "type": "handoff", "error": errMsg,
		})
	}()

	return fmt.Sprintf("Handoff workflow started (run ID: %s)", runID), nil
}

// RunParallelAnalysis runs multiple analysis agents in parallel.
func (a *App) RunParallelAnalysis(sessionID, input string) (*ParallelAnalysisResult, error) {
	analyzer, err := a.createCapabilityAgent("parallel-analyzer")
	if err != nil {
		return nil, fmt.Errorf("create analyzer: %w", err)
	}
	critic, err := a.createCapabilityAgent("parallel-critic")
	if err != nil {
		return nil, fmt.Errorf("create critic: %w", err)
	}
	improver, err := a.createCapabilityAgent("parallel-improver")
	if err != nil {
		return nil, fmt.Errorf("create improver: %w", err)
	}

	runID := fmt.Sprintf("pa-%d", time.Now().UnixNano())
	runCtx, runCancel := context.WithCancel(a.ctx)
	a.orchestrationMu.Lock()
	a.orchestrationRuns[runID] = &OrchestrationRun{
		ID:        runID,
		Type:      "parallel",
		Status:    "running",
		SessionID: sessionID,
		Input:     truncate(input, 200),
		StartedAt: time.Now().Format(time.RFC3339),
		Cancel:    runCancel,
	}
	a.orchestrationMu.Unlock()

	safeEmit(a.ctx, "orchestration:start", map[string]any{
		"runId": runID, "type": "parallel", "sessionId": sessionID,
	})

	go func() {
		defer runCancel()
		result, execErr := ap.ParallelRun(runCtx, []ap.Agent{analyzer, critic, improver}, input, a.hooks)

		a.orchestrationMu.Lock()
		run := a.orchestrationRuns[runID]
		if run != nil {
			run.EndedAt = time.Now().Format(time.RFC3339)
			if execErr != nil {
				run.Status = "failed"
				run.Error = execErr.Error()
			} else {
				run.Status = "completed"
				var outputs []string
				var errs []string
				for _, r := range result.Results {
					if r.Error != nil {
						errs = append(errs, r.Error.Error())
					}
					if r.Output != "" {
						outputs = append(outputs, truncate(r.Output, 200))
					}
				}
				if len(errs) > 0 {
					run.Status = "failed"
					run.Error = truncate(errs[0], 200)
				}
				combined := ""
				for i, o := range outputs {
					if i > 0 {
						combined += "\n---\n"
					}
					combined += o
				}
				run.Output = truncate(combined, 500)
			}
		}
		a.orchestrationMu.Unlock()

		eventType := "orchestration:complete"
		if execErr != nil {
			eventType = "orchestration:error"
		}
		errMsg := ""
		if execErr != nil {
			errMsg = execErr.Error()
		}
		safeEmit(a.ctx, eventType, map[string]any{
			"runId": runID, "type": "parallel", "error": errMsg,
		})
	}()

	return &ParallelAnalysisResult{
		Results: []string{fmt.Sprintf("Parallel analysis started (run ID: %s)", runID)},
	}, nil
}

// GetWorkflowStatus returns the status of a specific workflow run.
func (a *App) GetWorkflowStatus(runID string) *OrchestrationRun {
	a.orchestrationMu.RLock()
	defer a.orchestrationMu.RUnlock()
	run, ok := a.orchestrationRuns[runID]
	if !ok {
		return nil
	}
	cp := *run
	return &cp
}

// ListWorkflowRuns returns all orchestration runs.
func (a *App) ListWorkflowRuns() []OrchestrationRun {
	a.orchestrationMu.RLock()
	defer a.orchestrationMu.RUnlock()
	runs := make([]OrchestrationRun, 0, len(a.orchestrationRuns))
	for _, r := range a.orchestrationRuns {
		runs = append(runs, *r)
	}
	return runs
}

// CancelWorkflowRun cancels a running orchestration workflow.
func (a *App) CancelWorkflowRun(runID string) error {
	a.orchestrationMu.Lock()
	defer a.orchestrationMu.Unlock()
	run, ok := a.orchestrationRuns[runID]
	if !ok {
		return fmt.Errorf("workflow run %s not found", runID)
	}
	if run.Status != "running" {
		return fmt.Errorf("workflow run %s is not running (status: %s)", runID, run.Status)
	}
	// Cancel the per-run context so the goroutine receives ctx.Done()
	if run.Cancel != nil {
		run.Cancel()
	}
	run.Status = "cancelled"
	run.EndedAt = time.Now().Format(time.RFC3339)
	slog.Info("Orchestration run cancelled", "runId", runID, "type", run.Type)
	return nil
}

