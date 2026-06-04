package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

func registerWorkflowTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_workflow_run", "workflow",
			"执行 AP WorkflowExecution 工作流（支持 linear/conditional/loop/parallel_fork_join/state_machine 五种类型）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"definition": {
						"type": "string",
						"description": "工作流定义的 JSON 字符串。结构：{type, name, startNodeId, nodes[], transitions[], errorHandling, maxIterations, timeoutSec}"
					}
				},
				"required": ["definition"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWorkflowRun(ctx, args)
			},
		),
		newCastTool(a, "cast_workflow_pause", "workflow",
			"暂停正在执行的工作流",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"runId": {"type": "string", "description": "RunWorkflow 返回的工作流运行 ID"}
				},
				"required": ["runId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWorkflowPause(ctx, args)
			},
		),
		newCastTool(a, "cast_workflow_resume", "workflow",
			"恢复已暂停的工作流",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"runId": {"type": "string", "description": "工作流运行 ID"}
				},
				"required": ["runId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWorkflowResume(ctx, args)
			},
		),
		newCastTool(a, "cast_workflow_cancel", "workflow",
			"取消正在执行或暂停的工作流",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"runId": {"type": "string", "description": "工作流运行 ID"}
				},
				"required": ["runId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWorkflowCancel(ctx, args)
			},
		),
		newCastTool(a, "cast_workflow_status", "workflow",
			"查询工作流运行状态",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"runId": {"type": "string", "description": "工作流运行 ID"}
				},
				"required": ["runId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWorkflowStatus(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

type castWorkflowArgs struct {
	Definition string `json:"definition"`
}

type castWorkflowIdArgs struct {
	RunID string `json:"runId"`
}

func (a *App) castToolWorkflowRun(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWorkflowArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	if in.Definition == "" {
		return &ap.ToolResult{Content: "definition is required", IsError: true}, nil
	}
	start := nowMs()
	runID, err := a.RunWorkflow(in.Definition, ctx)
	if err != nil {
		return a.recordCastInvocation("cast_workflow_run", "workflow", "", args,
			fmt.Sprintf(`{"error":"%s"}`, escapeJSON(err.Error())), true, nowMs()-start), nil
	}
	out := map[string]any{
		"runId":  runID,
		"status": "running",
		"hint":   "Use cast_workflow_status to poll progress, or subscribe to Wails event 'workflow_event' for streaming updates.",
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_workflow_run", "workflow", "", args,
		string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolWorkflowPause(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWorkflowIdArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	if err := a.PauseWorkflow(in.RunID); err != nil {
		return a.recordCastInvocation("cast_workflow_pause", "workflow", "", args,
			fmt.Sprintf(`{"error":"%s"}`, escapeJSON(err.Error())), true, nowMs()-start), nil
	}
	return a.recordCastInvocation("cast_workflow_pause", "workflow", "", args,
		fmt.Sprintf(`{"runId":"%s","status":"paused"}`, in.RunID), false, nowMs()-start), nil
}

func (a *App) castToolWorkflowResume(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWorkflowIdArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	if err := a.ResumeWorkflow(in.RunID); err != nil {
		return a.recordCastInvocation("cast_workflow_resume", "workflow", "", args,
			fmt.Sprintf(`{"error":"%s"}`, escapeJSON(err.Error())), true, nowMs()-start), nil
	}
	return a.recordCastInvocation("cast_workflow_resume", "workflow", "", args,
		fmt.Sprintf(`{"runId":"%s","status":"running"}`, in.RunID), false, nowMs()-start), nil
}

func (a *App) castToolWorkflowCancel(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWorkflowIdArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	if err := a.CancelWorkflow(in.RunID); err != nil {
		return a.recordCastInvocation("cast_workflow_cancel", "workflow", "", args,
			fmt.Sprintf(`{"error":"%s"}`, escapeJSON(err.Error())), true, nowMs()-start), nil
	}
	return a.recordCastInvocation("cast_workflow_cancel", "workflow", "", args,
		fmt.Sprintf(`{"runId":"%s","status":"cancelled"}`, in.RunID), false, nowMs()-start), nil
}

func (a *App) castToolWorkflowStatus(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWorkflowIdArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	run := a.GetWorkflowRun(in.RunID)
	if run == nil {
		return a.recordCastInvocation("cast_workflow_status", "workflow", "", args,
			fmt.Sprintf(`{"error":"workflow run %s not found"}`, in.RunID), true, nowMs()-start), nil
	}
	outJSON, _ := json.Marshal(run)
	return a.recordCastInvocation("cast_workflow_status", "workflow", "", args,
		string(outJSON), false, nowMs()-start), nil
}
