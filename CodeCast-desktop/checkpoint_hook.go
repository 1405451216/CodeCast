package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	ap "agentprimordia/pkg"
)

// GuardrailStatusData holds the current guardrail configuration for the frontend.
type GuardrailStatusData struct {
	SanitizerEnabled  bool     `json:"sanitizerEnabled"`
	SanitizerStrategy string   `json:"sanitizerStrategy"`
	TopicConstraints  []string `json:"topicConstraints"`
	RuleCount         int      `json:"ruleCount"`
}

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

	// Topic Constraint Rule — restrict conversations to allowed topics when configured.
	a.mu.RLock()
	topics := append([]string{}, a.settings.TopicConstraints...)
	a.mu.RUnlock()
	if len(topics) > 0 {
		a.guardrail.AddRule(ap.NewTopicConstraintRule(ap.TopicConstraintConfig{
			Mode:     ap.TopicModeAllowlist,
			Topics:   topics,
			Action:   ap.GuardrailReject,
			Severity: ap.SeverityMedium,
		}))
		slog.Info("AP TopicConstraintRule added", "topics", topics)
	}

	return ap.NewGuardrailHook(a.guardrail)
}

// sanitizeOutput applies the configured AP Sanitizer strategy to the given text.
// Returns the original text when sanitizer is disabled, when the sanitizer
// strategy is unrecognized, or when sanitization cannot be applied.
func (a *App) sanitizeOutput(text string) string {
	a.mu.RLock()
	enabled := a.settings.SanitizerEnabled
	strategyName := a.settings.SanitizerStrategy
	a.mu.RUnlock()
	if !enabled {
		return text
	}

	strategy := ap.StrategyMask
	switch strategyName {
	case "Redact":
		strategy = ap.StrategyRedact
	case "Replace":
		strategy = ap.StrategyReplace
	case "Hash":
		strategy = ap.StrategyHash
	}

	sanitizer := ap.NewSanitizer(ap.SanitizerConfig{Strategy: strategy})
	// Without detection positions from a separate detection pass, the
	// sanitizer applies length-based replacement for the whole input.
	// We use a single full-string position so the strategy substitution is visible.
	positions := []ap.SanitizePosition{
		{Start: 0, End: len([]rune(text)), Label: "content"},
	}
	return sanitizer.Sanitize(text, positions)
}

// checkpointHook is an AP HookFunc that intercepts high-risk tool calls
// and waits for user confirmation before proceeding.
// H17 fix: automatically approve when the checkpoint system is not fully
// initialized (e.g. during unit tests), preventing indefinite blocking.
func (a *App) checkpointHook(ctx context.Context, hctx *ap.HookContext) error {
	toolName := hctx.ToolCall.Name

	highRiskTools := map[string]bool{
		"write_file": true, "edit_file": true, "run_command": true,
	}
	if !highRiskTools[toolName] {
		return nil
	}

	// Auto-approve when no UI is available to present the confirmation dialog
	// (e.g. unit tests, CI environments, or early startup before Wails frontend is ready).
	a.mu.RLock()
	confirmMapNil := a.checkpointConfirmations == nil
	busNil := a.eventBus == nil
	a.mu.RUnlock()
	if confirmMapNil || busNil || a.ctx == nil || a.ctx.Value("frontend") == nil {
		slog.Debug("[CHECKPOINT] auto-approved (checkpoint system not initialized or no frontend)",
			"tool", toolName, "agent", hctx.AgentID)
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
	slog.Info("[CHECKPOINT] waiting for confirmation", "checkpoint_id", checkpointID, "timeout", DefaultCheckpointTimeout)

	ch := make(chan bool, 1)
	a.mu.Lock()
	if a.checkpointConfirmations == nil {
		// H17 fix: map not initialized — auto-approve (e.g. in test environments).
		// This is a safety net for checkpointHook which already checks this condition
		// before calling waitForCheckpointConfirmation.
		a.mu.Unlock()
		slog.Debug("[CHECKPOINT] auto-approved: confirmation map not initialized", "checkpoint_id", checkpointID)
		return true
	}
	a.checkpointConfirmations[checkpointID] = ch
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		delete(a.checkpointConfirmations, checkpointID)
		a.mu.Unlock()
		slog.Debug("[CHECKPOINT] confirmation channel cleaned up", "checkpoint_id", checkpointID)
	}()

	select {
	case confirmed := <-ch:
		if confirmed {
			slog.Info("[CHECKPOINT] confirmed by user", "checkpoint_id", checkpointID)
		} else {
			slog.Info("[CHECKPOINT] rejected by user", "checkpoint_id", checkpointID)
		}
		return confirmed
	case <-time.After(DefaultCheckpointTimeout):
		slog.Warn("[CHECKPOINT] timeout waiting for confirmation", "checkpoint_id", checkpointID, "timeout", DefaultCheckpointTimeout)
		return false
	}
}

// ResolveCheckpoint is a Wails binding method called by the frontend.
// M10 fix: validate the checkpointID was actually pending before forwarding
// the approval decision, preventing phantom approvals from XSS-compromised frontends.
func (a *App) ResolveCheckpoint(checkpointID string, approved bool) {
	a.mu.Lock()
	ch, ok := a.checkpointConfirmations[checkpointID]
	if !ok {
		a.mu.Unlock()
		slog.Warn("[Security] ResolveCheckpoint for unknown/expired checkpoint",
			"checkpointID", checkpointID, "approved", approved)
		return
	}
	// Remove the entry before sending to prevent double-resolution
	delete(a.checkpointConfirmations, checkpointID)
	a.mu.Unlock()
	ch <- approved
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

// reinitGuardrails rebuilds the GuardrailEngine and re-registers hooks. Used
// after settings changes (topic constraints, sanitizer, etc.) so the new
// configuration takes effect without restarting the app.
func (a *App) reinitGuardrails() {
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails()

	if a.hooks != nil {
		a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
		a.guardrailHook.RegisterAll(a.hooks)
	}
	slog.Info("AP Guardrails 已重新初始化")
}

// UpdateTopicConstraints updates the allowed topic constraints and refreshes guardrails.
func (a *App) UpdateTopicConstraints(topics []string) error {
	if topics == nil {
		topics = []string{}
	}

	a.mu.Lock()
	a.settings.TopicConstraints = topics
	err := a.saveSettingsToFile()
	a.mu.Unlock()

	if err != nil {
		return err
	}

	// reinitGuardrails reads settings but does not need the lock
	// because it only creates new instances and registers hooks.
	a.reinitGuardrails()
	return nil
}

// GetTopicConstraints returns the current topic constraints (copy).
func (a *App) GetTopicConstraints() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return append([]string{}, a.settings.TopicConstraints...)
}

// ToggleSanitizer enables or disables the output sanitizer. No guardrail rebuild
// is needed because the Sanitizer is applied lazily via sanitizeOutput().
func (a *App) ToggleSanitizer(enabled bool) error {
	a.mu.Lock()
	a.settings.SanitizerEnabled = enabled
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// SetSanitizerStrategy sets the sanitizer strategy (Mask, Redact, Replace, Hash).
func (a *App) SetSanitizerStrategy(strategy string) error {
	switch strategy {
	case "Mask", "Redact", "Replace", "Hash":
		// valid
	default:
		return fmt.Errorf("invalid sanitizer strategy: %s (valid: Mask, Redact, Replace, Hash)", strategy)
	}

	a.mu.Lock()
	a.settings.SanitizerStrategy = strategy
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// GetGuardrailStatus returns the current guardrail configuration for the frontend.
func (a *App) GetGuardrailStatus() GuardrailStatusData {
	a.mu.RLock()
	defer a.mu.RUnlock()

	ruleCount := 0
	if a.guardrail != nil {
		ruleCount = a.guardrail.RuleCount()
	}

	return GuardrailStatusData{
		SanitizerEnabled:  a.settings.SanitizerEnabled,
		SanitizerStrategy: a.settings.SanitizerStrategy,
		TopicConstraints:  append([]string{}, a.settings.TopicConstraints...),
		RuleCount:         ruleCount,
	}
}
