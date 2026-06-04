package main

import (
	"strings"
	"testing"
	"time"
)

// ==================== Session 基础测试 ====================

func TestSessionModeField(t *testing.T) {
	t.Parallel()
	session := NewSession("test", "skill_1")
	if session.Mode != "" {
		t.Errorf("NewSession Mode should default to empty, got '%s'", session.Mode)
	}
}

func TestSessionModeCoding(t *testing.T) {
	t.Parallel()
	session := NewSession("test", "")
	session.Mode = "coding"
	if session.Mode != "coding" {
		t.Error("Mode should be settable to coding")
	}
}

func TestSessionModeDaily(t *testing.T) {
	t.Parallel()
	session := NewSession("test", "")
	session.Mode = "daily"
	if session.Mode != "daily" {
		t.Error("Mode should be settable to daily")
	}
}

// ==================== CreateSession with Mode ====================

func TestCreateSessionWithMode(t *testing.T) {
	app := NewApp()

	codingSession := app.CreateSession("Coding Session", "", "coding")
	if codingSession == nil {
		t.Fatal("CreateSession returned nil")
	}
	if codingSession.Mode != "coding" {
		t.Errorf("Expected mode 'coding', got '%s'", codingSession.Mode)
	}

	dailySession := app.CreateSession("Daily Session", "", "daily")
	if dailySession.Mode != "daily" {
		t.Errorf("Expected mode 'daily', got '%s'", dailySession.Mode)
	}
}

func TestCreateSessionDefaultMode(t *testing.T) {
	app := NewApp()
	session := app.CreateSession("Default Session", "", "")
	if session.Mode != "" {
		t.Errorf("Empty mode should stay empty, got '%s'", session.Mode)
	}
}

// ==================== buildSystemPrompt 模式切换测试 ====================

func TestBuildSystemPromptCodingMode(t *testing.T) {
	app := NewApp()

	session := &Session{
		ID:   "test",
		Name: "Test",
		Mode: "coding",
	}

	prompt := app.buildSystemPrompt(session)
	if prompt == "" {
		t.Fatal("buildSystemPrompt returned empty for coding mode")
	}
	if !strings.Contains(prompt, PromptBase) {
		t.Error("Should contain PromptBase")
	}
	if !strings.Contains(prompt, string(PromptCoding)) {
		t.Error("Coding mode should contain PromptCoding")
	}
	if strings.Contains(prompt, string(PromptDaily)) {
		t.Error("Coding mode should NOT contain PromptDaily")
	}
}

func TestBuildSystemPromptDailyMode(t *testing.T) {
	app := NewApp()

	session := &Session{
		ID:   "test",
		Name: "Test",
		Mode: "daily",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, string(PromptDaily)) {
		t.Error("Daily mode should contain PromptDaily")
	}
	if strings.Contains(prompt, string(PromptCoding)) {
		t.Error("Daily mode should NOT contain PromptCoding")
	}
}

func TestBuildSystemPromptEmptyModeFallsBackToSettings(t *testing.T) {
	app := NewApp()
	app.settings.WorkMode = "coding"

	session := &Session{
		ID:   "test",
		Name: "Test",
		Mode: "",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, string(PromptCoding)) {
		t.Error("Empty mode should fall back to settings.WorkMode (coding)")
	}
}

func TestBuildSystemPromptEmptyModeFallsBackToSettingsDaily(t *testing.T) {
	app := NewApp()
	app.settings.WorkMode = "daily"

	session := &Session{
		ID:   "test",
		Name: "Test",
		Mode: "",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, string(PromptCoding)) {
		t.Error("Empty mode defaults to coding (AP template behavior)")
	}
}

func TestBuildSystemPromptBothEmptyDefaultsToDaily(t *testing.T) {
	app := NewApp()
	app.settings.WorkMode = ""

	session := &Session{
		ID:   "test",
		Name: "Test",
		Mode: "",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, string(PromptCoding)) {
		t.Error("Both empty defaults to coding mode")
	}
}

// ==================== buildSystemPrompt 项目信息注入 ====================

func TestBuildSystemPromptWithProject(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	projectPath := tmpDir + "/myproject"

	app.projects = []Project{{ID: "proj_1", Name: "myproject", Path: projectPath}}
	app.mu.Lock()
	app.currentProjectID = "proj_1"
	app.mu.Unlock()

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "myproject") {
		t.Error("Should contain project name when project is set")
	}
	if !strings.Contains(prompt, projectPath) {
		t.Error("Should contain project path when project is set")
	}
}

func TestBuildSystemPromptWithoutProject(t *testing.T) {
	app := NewApp()
	app.projects = []Project{}
	app.mu.Lock()
	app.currentProjectID = ""
	app.mu.Unlock()

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if strings.Contains(prompt, "myproject") {
		t.Error("Should not contain project name when no project is set")
	}
}

// ==================== buildSystemPrompt 个性化风格 ====================

func TestBuildSystemPromptPersonalityFriendly(t *testing.T) {
	app := NewApp()
	app.settings.Personality = "friendly"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "friendly") && !strings.Contains(prompt, "Friendly") {
		t.Error("Friendly personality should appear in prompt")
	}
}

func TestBuildSystemPromptPersonalityProfessional(t *testing.T) {
	app := NewApp()
	app.settings.Personality = "professional"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "专业") && !strings.Contains(prompt, "professional") {
		t.Error("Professional personality should appear in prompt")
	}
}

func TestBuildSystemPromptPersonalityConcise(t *testing.T) {
	app := NewApp()
	app.settings.Personality = "concise"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "简洁") {
		t.Error("Concise personality should inject concise style")
	}
}

func TestBuildSystemPromptCustomInstructions(t *testing.T) {
	app := NewApp()
	app.settings.CustomInstructions = "Always use TypeScript strict mode"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "TypeScript strict mode") {
		t.Error("Custom instructions should appear in prompt")
	}
}

func TestBuildSystemPromptNoCustomInstructions(t *testing.T) {
	app := NewApp()
	app.settings.CustomInstructions = ""

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if strings.Contains(prompt, "自定义指令") && strings.Contains(prompt, "TypeScript") {
		t.Error("Should not contain custom instructions content when empty")
	}
}

// ==================== Skill 覆盖 Prompt ====================

func TestBuildSystemPromptSkillOverride(t *testing.T) {
	app := NewApp()
	customSkill := &Skill{
		ID:          "custom_1",
		Name:        "Custom Skill",
		Prompt:      "You are a specialized bot. Ignore all other instructions.",
		Type:        "custom",
		CreatedAt:   time.Now().Unix(),
	}
	app.skills = append(app.skills, customSkill)

	session := &Session{
		ID:      "s1",
		Name:    "Test",
		Mode:    "daily",
		SkillID: "custom_1",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, "specialized bot") {
		t.Errorf("Skill prompt should appear in system prompt, got: %s", truncateForLog2(prompt, 100))
	}
}

func TestBuildSystemPromptNonExistentSkill(t *testing.T) {
	app := NewApp()

	session := &Session{
		ID:      "s1",
		Name:    "Test",
		Mode:    "daily",
		SkillID: "nonexistent_skill_id",
	}

	prompt := app.buildSystemPrompt(session)
	if !strings.Contains(prompt, string(PromptDaily)) {
		t.Error("Non-existent skill ID should fall through to normal mode prompt")
	}
}


// ==================== deepCopySession 测试 ====================

func TestDeepCopySessionIndependence(t *testing.T) {
	t.Parallel()
	original := &Session{
		ID:      "original",
		Name:    "Original",
		Messages: []Message{{Role: "user", Content: "hello"}},
		Mode:    "coding",
	}

	copy := deepCopySession(original)
	copy.Name = "Modified"
	copy.Messages = append(copy.Messages, Message{Role: "assistant", Content: "hi"})
	copy.Mode = "daily"

	if original.Name != "Original" {
		t.Error("Modifying copy should not affect original name")
	}
	if len(original.Messages) != 1 {
		t.Error("Modifying copy messages should not affect original")
	}
	if original.Mode != "coding" {
		t.Error("Modifying copy mode should not affect original")
	}
}

func TestDeepCopySessionNilMessages(t *testing.T) {
	t.Parallel()
	original := &Session{
		ID:       "test",
		Name:     "Test",
		Messages: nil,
	}

	copy := deepCopySession(original)
	if copy.Messages != nil && len(copy.Messages) != 0 {
		t.Error("Deep copy of nil Messages should remain nil or empty")
	}
}

// ==================== buildMessageSequence 兼容性 ====================

func truncateForLog2(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}
