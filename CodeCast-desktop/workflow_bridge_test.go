package main

import (
	"context"
	"encoding/json"
	"testing"
)

func TestNewWorkflowRunStores(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.initWorkflowRuns()
	if app.workflowRuns == nil {
		t.Fatal("expected workflowRuns map to be initialized")
	}
}

func TestRunWorkflowRejectsEmptyDef(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.RunWorkflow("", context.Background())
	if err == nil {
		t.Error("expected error for empty workflow JSON")
	}
}

func TestRunWorkflowRejectsBadJSON(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.RunWorkflow("not json", context.Background())
	if err == nil {
		t.Error("expected error for malformed workflow JSON")
	}
}

func TestRunWorkflowRejectsBadType(t *testing.T) {
	app := &App{ctx: context.Background()}
	def := WorkflowDefinition{
		Type:        "bogus_type",
		Name:        "bad",
		StartNodeID: "n1",
		Nodes:       []WorkflowNodeDef{{ID: "n1", Type: "task"}},
	}
	js, _ := json.Marshal(def)
	_, err := app.RunWorkflow(string(js), context.Background())
	if err == nil {
		t.Error("expected error for invalid workflow type")
	}
}

func TestRunWorkflowRequiresStartNode(t *testing.T) {
	app := &App{ctx: context.Background()}
	def := WorkflowDefinition{
		Type:  "linear",
		Name:  "no-start",
		Nodes: []WorkflowNodeDef{{ID: "n1", Type: "task"}},
	}
	js, _ := json.Marshal(def)
	_, err := app.RunWorkflow(string(js), context.Background())
	if err == nil {
		t.Error("expected error for missing start node")
	}
}

func TestPauseCancelWorkflowNotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.initWorkflowRuns()

	if err := app.PauseWorkflow("missing"); err == nil {
		t.Error("expected error for unknown workflow run")
	}
	if err := app.ResumeWorkflow("missing"); err == nil {
		t.Error("expected error for unknown workflow run")
	}
	if err := app.CancelWorkflow("missing"); err == nil {
		t.Error("expected error for unknown workflow run")
	}
}

func TestGetWorkflowRunNotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.initWorkflowRuns()
	if got := app.GetWorkflowRun("missing"); got != nil {
		t.Errorf("expected nil for unknown run, got %+v", got)
	}
}

func TestListWorkflowRunsEmpty(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.initWorkflowRuns()
	if got := app.ListWorkflowRuns(); len(got) != 0 {
		t.Errorf("expected empty list, got %d runs", len(got))
	}
}

func TestExportWorkflowNotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.initWorkflowRuns()
	_, err := app.ExportWorkflow("missing")
	if err == nil {
		t.Error("expected error for unknown workflow run")
	}
}
