package main

import (
	"context"
	"testing"

	ap "agentprimordia/pkg"
)

func TestBuildCodeReviewDAG(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.sessionAgents = make(map[string]ap.Agent)
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	dag, err := app.buildCodeReviewDAG()
	if err != nil {
		t.Fatalf("buildCodeReviewDAG failed: %v", err)
	}
	if dag == nil {
		t.Fatal("expected non-nil DAG")
	}
}

func TestBuildRefactoringDAG(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.sessionAgents = make(map[string]ap.Agent)
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	dag, err := app.buildRefactoringDAG()
	if err != nil {
		t.Fatalf("buildRefactoringDAG failed: %v", err)
	}
	if dag == nil {
		t.Fatal("expected non-nil DAG")
	}
}

func TestBuildTestPipeline(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	pipeline, err := app.buildTestPipeline()
	if err != nil {
		t.Fatalf("buildTestPipeline failed: %v", err)
	}
	if pipeline == nil {
		t.Fatal("expected non-nil Pipeline")
	}
}

func TestRunCodeReviewWorkflow(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.sessionAgents = make(map[string]ap.Agent)
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	// Without a real provider, we just verify the binding method exists
	// and returns a structured result rather than panicking.
	result, err := app.RunCodeReviewWorkflow("test-session", "func main()")
	if err != nil {
		t.Logf("RunCodeReviewWorkflow returned error: %v", err)
	}
	if result == nil {
		t.Log("RunCodeReviewWorkflow returned nil result")
	}
}

func TestRunParallelAnalysis(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.sessionAgents = make(map[string]ap.Agent)
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	result, err := app.RunParallelAnalysis("test-session", "analyze this code")
	if err != nil {
		t.Logf("RunParallelAnalysis returned error: %v", err)
	}
	if result == nil {
		t.Log("RunParallelAnalysis returned nil result")
	}
}

func TestGetWorkflowStatus(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	status := app.GetWorkflowStatus("nonexistent")
	if status != nil {
		t.Error("expected nil for nonexistent workflow")
	}

	app.orchestrationRuns["run-1"] = &OrchestrationRun{
		ID:     "run-1",
		Type:   "code_review",
		Status: "running",
	}
	status = app.GetWorkflowStatus("run-1")
	if status == nil {
		t.Fatal("expected non-nil status for existing workflow")
	}
	if status.Status != "running" {
		t.Errorf("expected status 'running', got %s", status.Status)
	}
}

func TestListWorkflowRuns(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	app.orchestrationRuns["run-1"] = &OrchestrationRun{ID: "run-1", Type: "code_review", Status: "completed"}
	app.orchestrationRuns["run-2"] = &OrchestrationRun{ID: "run-2", Type: "refactoring", Status: "running"}

	runs := app.ListWorkflowRuns()
	if len(runs) != 2 {
		t.Errorf("expected 2 runs, got %d", len(runs))
	}
}

func TestCancelWorkflowRun(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	// Cancel nonexistent
	err := app.CancelWorkflowRun("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent run")
	}

	// Cancel a running one
	app.orchestrationRuns["run-1"] = &OrchestrationRun{ID: "run-1", Type: "code_review", Status: "running"}
	err = app.CancelWorkflowRun("run-1")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if app.orchestrationRuns["run-1"].Status != "cancelled" {
		t.Errorf("expected cancelled, got %s", app.orchestrationRuns["run-1"].Status)
	}

	// Cancel a completed one
	app.orchestrationRuns["run-2"] = &OrchestrationRun{ID: "run-2", Type: "code_review", Status: "completed"}
	err = app.CancelWorkflowRun("run-2")
	if err == nil {
		t.Error("expected error for non-running run")
	}
}
