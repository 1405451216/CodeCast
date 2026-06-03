package main

import (
	"context"
	"fmt"
	"time"

	ap "agentprimordia/pkg"
)

// setupGuardrails configures AP GuardrailEngine with safety rules
// and returns a GuardrailHook that can be registered with HookManager.
func (a *App) setupGuardrails() *ap.GuardrailHook {
	a.guardrail.AddRule(ap.NewPIIRule(ap.DefaultPIIRuleConfig()))

	a.guardrail.AddRule(ap.NewSensitiveWordRule(ap.SensitiveWordConfig{
		Words: []string{"rm -rf /", "DROP TABLE", "DELETE FROM", "format C:"},
	}))

	a.guardrail.AddRule(ap.NewPromptInjectionRule(ap.PromptInjectionConfig{
		Action:   ap.GuardrailReject,
		Severity: ap.SeverityHigh,
	}))

	a.guardrail.AddRule(ap.NewOutputSafetyRule(ap.OutputSafetyConfig{
		Action:         ap.GuardrailReject,
		Severity:       ap.SeverityHigh,
		CustomPatterns: []string{`(?i)password\s*=\s*['"]`},
	}))

	return ap.NewGuardrailHook(a.guardrail)
}

// checkpointHook is an AP HookFunc that intercepts high-risk tool calls
// and waits for user confirmation before proceeding.
func (a *App) checkpointHook(ctx context.Context, hctx *ap.HookContext) error {
	toolName := hctx.ToolCall.Name

	highRiskTools := map[string]bool{
		"write_file": true, "edit_file": true, "run_command": true,
	}
	if !highRiskTools[toolName] {
		return nil
	}

	checkpointID := hctx.AgentID + "_" + toolName + "_" + fmt.Sprintf("%d", time.Now().UnixNano())
	riskLevel := a.assessRiskLevel(toolName, hctx.ToolCall.Args)

	a.eventBus.PublishAsync(ap.Event{
		Type:   ap.EventToolCall,
		Source: "checkpoint",
		Payload: map[string]any{
			"checkpoint_id": checkpointID,
			"tool_name":     toolName,
			"tool_args":     hctx.ToolCall.Args,
			"risk_level":    riskLevel,
			"agent_id":      hctx.AgentID,
			"session_id":    hctx.SessionID,
		},
	})

	confirmed := a.waitForCheckpointConfirmation(checkpointID)
	if !confirmed {
		return fmt.Errorf("用户拒绝了工具调用: %s", toolName)
	}
	return nil
}

func (a *App) waitForCheckpointConfirmation(checkpointID string) bool {
	ch := make(chan bool, 1)
	a.mu.Lock()
	a.checkpointConfirmations[checkpointID] = ch
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		delete(a.checkpointConfirmations, checkpointID)
		a.mu.Unlock()
	}()

	select {
	case confirmed := <-ch:
		return confirmed
	case <-time.After(5 * time.Minute):
		return false
	}
}

// ResolveCheckpoint is a Wails binding method called by the frontend.
func (a *App) ResolveCheckpoint(checkpointID string, approved bool) {
	a.mu.Lock()
	ch, ok := a.checkpointConfirmations[checkpointID]
	a.mu.Unlock()
	if ok {
		ch <- approved
	}
}

func (a *App) assessRiskLevel(toolName string, args string) string {
	switch toolName {
	case "run_command":
		return "high"
	case "write_file", "edit_file":
		return "medium"
	default:
		return "low"
	}
}
