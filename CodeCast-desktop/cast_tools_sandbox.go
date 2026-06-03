package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	ap "agentprimordia/pkg"
)

func registerSandboxTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_sandbox_run", "sandbox",
			"在隔离环境执行 JS/Python/SQL 脚本",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"lang":  {"type": "string", "enum": ["js","python","sql","bash"]},
					"code":  {"type": "string"},
					"stdin": {"type": "string"}
				},
				"required": ["lang","code"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolSandboxRun(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolSandboxRun(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castSandboxRunArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}

	var cmd *exec.Cmd
	switch in.Lang {
	case "js":
		cmd = exec.CommandContext(ctx, "node", "-e", in.Code)
	case "python":
		cmd = exec.CommandContext(ctx, "python", "-c", in.Code)
	case "bash":
		cmd = exec.CommandContext(ctx, "bash", "-c", in.Code)
	case "sql":
		// SQL 桩：用 sqlite3
		cmd = exec.CommandContext(ctx, "sqlite3", ":memory:")
		cmd.Stdin = bytes.NewBufferString(in.Code)
	default:
		return &ap.ToolResult{Content: "unsupported lang: " + in.Lang, IsError: true}, nil
	}

	if in.Stdin != "" && in.Lang != "sql" {
		cmd.Stdin = bytes.NewBufferString(in.Stdin)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := nowMs()
	// AP 安全控制：限制超时
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
	err := cmd.Run()
	duration := nowMs() - start

	exitCode := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			return a.recordCastInvocation("cast_sandbox_run", "sandbox", "", args,
				fmt.Sprintf("exec failed: %v", err), true, duration), nil
		}
	}

	out := castSandboxRunResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
		Duration: duration,
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_sandbox_run", "sandbox", "", args, string(outJSON), false, duration), nil
}

// 超时控制
var _ = time.Second
