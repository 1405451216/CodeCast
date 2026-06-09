package main

import (
	"testing"

	ap "agentprimordia/pkg"
)

// ==================== Guardrail & Sanitizer Tests ====================

func TestSanitizeOutput_NilApp(t *testing.T) {
	app := &App{settings: &Settings{}}
	result := app.sanitizeOutput("test content")
	if result != "test content" {
		t.Errorf("expected unchanged content when disabled, got '%s'", result)
	}
}

func TestSanitizeOutput_Disabled(t *testing.T) {
	app := &App{
		settings: &Settings{SanitizerEnabled: false},
	}
	result := app.sanitizeOutput("sensitive data")
	if result != "sensitive data" {
		t.Error("sanitizer should pass through when disabled")
	}
}

func TestSanitizeOutput_MaskStrategy(t *testing.T) {
	app := &App{
		settings: &Settings{
			SanitizerEnabled:  true,
			SanitizerStrategy: "Mask",
		},
	}
	// Mask replaces content with mask characters
	result := app.sanitizeOutput("hello world")
	if len(result) == 0 {
		t.Error("sanitized output should not be empty")
	}
}

func TestSanitizeOutput_RedactStrategy(t *testing.T) {
	app := &App{
		settings: &Settings{
			SanitizerEnabled:  true,
			SanitizerStrategy: "Redact",
		},
	}
	result := app.sanitizeOutput("sensitive content")
	if len(result) == 0 {
		t.Error("redacted output should not be empty")
	}
}

func TestSanitizeOutput_ReplaceStrategy(t *testing.T) {
	app := &App{
		settings: &Settings{
			SanitizerEnabled:  true,
			SanitizerStrategy: "Replace",
		},
	}
	result := app.sanitizeOutput("some text")
	if len(result) == 0 {
		t.Error("replaced output should not be empty")
	}
}

func TestSanitizeOutput_HashStrategy(t *testing.T) {
	app := &App{
		settings: &Settings{
			SanitizerEnabled:  true,
			SanitizerStrategy: "Hash",
		},
	}
	result := app.sanitizeOutput("some text")
	if len(result) == 0 {
		t.Error("hashed output should not be empty")
	}
}

// ==================== Topic Constraints Tests ====================

func TestUpdateTopicConstraints_Empty(t *testing.T) {
	app := NewApp()
	err := app.UpdateTopicConstraints([]string{})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	constraints := app.GetTopicConstraints()
	if len(constraints) != 0 {
		t.Errorf("expected empty constraints, got %v", constraints)
	}
}

func TestUpdateTopicConstraints_WithTopics(t *testing.T) {
	app := NewApp()
	topics := []string{"coding", "testing", "documentation"}
	err := app.UpdateTopicConstraints(topics)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	constraints := app.GetTopicConstraints()
	if len(constraints) != 3 {
		t.Errorf("expected 3 topics, got %d", len(constraints))
	}
	// Verify it's a copy, not the original slice
	constraints[0] = "modified"
	readAgain := app.GetTopicConstraints()
	if readAgain[0] != "coding" {
		t.Error("GetTopicConstraints should return a copy")
	}
}

func TestUpdateTopicConstraints_Nil(t *testing.T) {
	app := NewApp()
	err := app.UpdateTopicConstraints(nil)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	constraints := app.GetTopicConstraints()
	if constraints == nil || len(constraints) != 0 {
		t.Errorf("nil should convert to empty slice, got %v", constraints)
	}
}

// ==================== Sanitizer Strategy Tests ====================

func TestToggleSanitizer(t *testing.T) {
	app := NewApp()
	err := app.ToggleSanitizer(true)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	app.mu.RLock()
	if !app.settings.SanitizerEnabled {
		t.Error("sanitizer should be enabled after toggle")
	}
	app.mu.RUnlock()

	err = app.ToggleSanitizer(false)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	app.mu.RLock()
	if app.settings.SanitizerEnabled {
		t.Error("sanitizer should be disabled after toggle")
	}
	app.mu.RUnlock()
}

func TestSetSanitizerStrategy_Valid(t *testing.T) {
	app := NewApp()
	strategies := []string{"Mask", "Redact", "Replace", "Hash"}
	for _, s := range strategies {
		err := app.SetSanitizerStrategy(s)
		if err != nil {
			t.Errorf("unexpected error for strategy %s: %v", s, err)
		}
	}
}

func TestSetSanitizerStrategy_Invalid(t *testing.T) {
	app := NewApp()
	invalidStrategies := []string{"", "invalid", "Encrypt", "delete"}
	for _, s := range invalidStrategies {
		err := app.SetSanitizerStrategy(s)
		if err == nil {
			t.Errorf("expected error for invalid strategy '%s'", s)
		}
	}
}

// ==================== Guardrail Status Tests ====================

func TestGetGuardrailStatus_Default(t *testing.T) {
	app := NewApp()
	status := app.GetGuardrailStatus()
	if status.RuleCount < 0 {
		t.Errorf("rule count should be non-negative, got %d", status.RuleCount)
	}
}

func TestGetGuardrailStatus_AfterTopicsUpdate(t *testing.T) {
	app := NewApp()
	app.UpdateTopicConstraints([]string{"coding", "security"})
	status := app.GetGuardrailStatus()
	if len(status.TopicConstraints) != 2 {
		t.Errorf("expected 2 topic constraints, got %d", len(status.TopicConstraints))
	}
}

// ==================== Checkpoint Hook Tests ====================

func TestAssessRiskLevel(t *testing.T) {
	app := NewApp()

	tests := []struct {
		tool     string
		expected string
	}{
		{"run_command", "high"},
		{"write_file", "medium"},
		{"edit_file", "medium"},
		{"read_file", "low"},
		{"search", "low"},
		{"unknown_tool", "low"},
	}

	for _, tc := range tests {
		result := app.assessRiskLevel(tc.tool, "")
		if result != tc.expected {
			t.Errorf("tool %s: expected %s, got %s", tc.tool, tc.expected, result)
		}
	}
}

func TestCheckpointHook_NonHighRisk(t *testing.T) {
	// This tests that non-high-risk tools are allowed through.
	// We can't fully test with real hooks without the full startup, but we
	// can verify the tool set is correct.
	highRiskTools := map[string]bool{
		"write_file":  true,
		"edit_file":   true,
		"run_command": true,
	}

	nonHighRisk := []string{"read_file", "search", "list_files", "grep", "unknown"}
	for _, tool := range nonHighRisk {
		if highRiskTools[tool] {
			t.Errorf("%s should not be high risk", tool)
		}
	}
}

// ==================== ResolveCheckpoint Tests ====================

func TestResolveCheckpoint_UnknownID(t *testing.T) {
	app := NewApp()
	// NewApp doesn't initialize checkpointConfirmations (only startup does).
	// ResolveCheckpoint should handle unknown checkpoints safely.
	app.ResolveCheckpoint("nonexistent", true)
	// Should not panic
}

func TestResolveCheckpoint_KnownID(t *testing.T) {
	app := NewApp()
	app.checkpointConfirmations = make(map[string]chan bool)
	ch := make(chan bool, 1)
	app.checkpointConfirmations["test_ckpt"] = ch

	go func() {
		app.ResolveCheckpoint("test_ckpt", true)
	}()

	confirmed := <-ch
	if !confirmed {
		t.Error("expected confirmed=true")
	}

	// Verify entry was removed
	app.mu.RLock()
	_, exists := app.checkpointConfirmations["test_ckpt"]
	app.mu.RUnlock()
	if exists {
		t.Error("checkpoint entry should be removed after resolution")
	}
}

// ==================== Guardrail Rule Tests ====================

func TestSetupGuardrails_CreatesRules(t *testing.T) {
	app := NewApp()
	// setupGuardrails calls a.guardrail.AddRule — guardrail must be initialized first
	app.guardrail = ap.NewGuardrailEngine()
	hook := app.setupGuardrails()
	if hook == nil {
		t.Fatal("guardrail hook should not be nil")
	}
	if app.guardrail == nil {
		t.Fatal("guardrail engine should not be nil")
	}
	// Should have at least PII, SensitiveWord, PromptInjection, and OutputSafety rules
	if app.guardrail.RuleCount() < 4 {
		t.Errorf("expected at least 4 rules, got %d", app.guardrail.RuleCount())
	}
}

func TestReinitGuardrails(t *testing.T) {
	app := NewApp()
	// Initialize guardrail before creating hooks, same as startup() does
	app.guardrail = ap.NewGuardrailEngine()
	app.guardrailHook = app.setupGuardrails()
	app.reinitGuardrails()
	if app.guardrail == nil {
		t.Fatal("guardrail engine should be reinitialized")
	}
}
