package main

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// ==================== Session 基础测试 ====================

func TestSessionModeField(t *testing.T) {
	session := NewSession("test", "skill_1")
	if session.Mode != "" {
		t.Errorf("NewSession Mode should default to empty, got '%s'", session.Mode)
	}
}

func TestSessionModeCoding(t *testing.T) {
	session := NewSession("test", "")
	session.Mode = "coding"
	if session.Mode != "coding" {
		t.Error("Mode should be settable to coding")
	}
}

func TestSessionModeDaily(t *testing.T) {
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
	if !strings.Contains(prompt, string(PromptDaily)) {
		t.Error("Empty mode should fall back to settings.WorkMode (daily)")
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
	if !strings.Contains(prompt, string(PromptDaily)) {
		t.Error("Both empty should default to Daily mode")
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

	if !strings.Contains(prompt, "未指定项目") {
		t.Error("Should indicate no project is specified")
	}
}

// ==================== buildSystemPrompt 个性化风格 ====================

func TestBuildSystemPromptPersonalityFriendly(t *testing.T) {
	app := NewApp()
	app.settings.Personality = "friendly"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "轻松友好") {
		t.Error("Friendly personality should inject friendly style")
	}
}

func TestBuildSystemPromptPersonalityProfessional(t *testing.T) {
	app := NewApp()
	app.settings.Personality = "professional"

	session := &Session{ID: "s1", Name: "Test", Mode: "daily"}
	prompt := app.buildSystemPrompt(session)

	if !strings.Contains(prompt, "专业严谨") {
		t.Error("Professional personality should inject professional style")
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

	if !strings.Contains(prompt, "无。") {
		t.Error("No custom instructions should show '无'")
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
	if prompt != customSkill.Prompt {
		t.Errorf("When SkillID matches, skill prompt should override everything, got: %s", truncateForLog2(prompt, 100))
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

// ==================== recordNotesAsync 测试 ====================

func TestRecordNotesAsyncTaskDetection(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)
	app := &App{notes: store}

	app.recordNotesAsync("sess1", "帮我写一个用户认证模块", "好的，我来帮你实现 JWT 认证功能")

	time.Sleep(50 * time.Millisecond)
	loaded, _ := store.Load("sess1")
	if loaded.CurrentTask == "" {
		t.Error("'帮我写' should trigger SetTask")
	}
	if !strings.Contains(loaded.CurrentTask, "用户认证模块") {
		t.Errorf("Task content wrong: %s", loaded.CurrentTask)
	}
}

func TestRecordNotesAsyncIssueDetection(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)
	app := &App{notes: store}

	app.recordNotesAsync("sess1", "修复登录超时的 bug", "已修复，问题是连接池配置错误")

	time.Sleep(50 * time.Millisecond)
	loaded, _ := store.Load("sess1")
	foundIssue := false
	for _, issue := range loaded.PendingIssues {
		if strings.Contains(issue, "登录超时") {
			foundIssue = true
			break
		}
	}
	if !foundIssue {
		t.Error("'修复' should trigger AddIssue")
	}
}

func TestRecordNotesAsyncDecisionDetection(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)
	app := &App{notes: store}

	app.recordNotesAsync("sess1", "实现 OAuth 登录", "已完成 OAuth 集成，支持 Google 和 GitHub 登录")

	time.Sleep(50 * time.Millisecond)
	loaded, _ := store.Load("sess1")
	foundDecision := false
	for _, d := range loaded.Decisions {
		if strings.Contains(d, "已完成") && strings.Contains(d, "OAuth") {
			foundDecision = true
			break
		}
	}
	if !foundDecision {
		t.Error("Assistant '已完成' should trigger AddDecision")
	}
}

func TestRecordNotesAsyncNonCodingSkipped(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)
	app := &App{notes: store}

	app.recordNotesAsync("sess1", "今天天气怎么样", "天气不错，适合出门散步")

	time.Sleep(50 * time.Millisecond)
	loaded, _ := store.Load("sess1")
	if loaded.CurrentTask != "" || len(loaded.Decisions) > 0 || len(loaded.PendingIssues) > 0 {
		t.Error("Non-coding session should not trigger notes recording via this path")
	}
}

func TestRecordNotesAsyncPanicRecovery(t *testing.T) {
	app := &App{notes: nil}
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("recordNotesAsync should not panic with nil notes: %v", r)
		}
	}()
	app.recordNotesAsync("sess1", "test input", "test output")
}

func TestRecordNotesAsyncTruncation(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)
	app := &App{notes: store}

	longInput := strings.Repeat("a", 200)
	app.recordNotesAsync("sess1", fmt.Sprintf("帮我写%s", longInput), "done")

	time.Sleep(50 * time.Millisecond)
	loaded, _ := store.Load("sess1")
	runes := []rune(loaded.CurrentTask)
	if len(runes) > 103 {
		t.Errorf("Long task should be truncated to ~100 + ..., got %d", len(runes))
	}
}

// ==================== deepCopySession 测试 ====================

func TestDeepCopySessionIndependence(t *testing.T) {
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

func TestBuildMessageSequenceBasic(t *testing.T) {
	app := &App{settings: &Settings{MessageHistoryLimit: 20}}
	session := &Session{
		Messages: []Message{
			{Role: "user", Content: "hello"},
			{Role: "assistant", Content: "hi"},
		},
	}

	result := app.buildMessageSequence(session, "hello", false, "sys_prompt")
	if result[0].Role != "system" {
		t.Error("First message should be system")
	}
	if len(result) != 3 {
		t.Errorf("Expected 3 messages (system+user+assistant), got %d", len(result))
	}
}

func TestBuildMessageSequenceTruncation(t *testing.T) {
	app := &App{settings: &Settings{MessageHistoryLimit: 5}}
	session := &Session{}
	for i := 0; i < 20; i++ {
		session.Messages = append(session.Messages, Message{Role: "user", Content: fmt.Sprintf("msg_%d", i)})
	}

	result := app.buildMessageSequence(session, "latest", false, "sys")
	chatCount := 0
	for _, m := range result {
		if m.Role != "system" {
			chatCount++
		}
	}
	if chatCount > 5 {
		t.Errorf("Should truncate to history limit (5), got %d chat messages", chatCount)
	}
}

func TestBuildMessageSequenceLongContext(t *testing.T) {
	app := &App{settings: &Settings{MessageHistoryLimit: 5}}
	session := &Session{}
	for i := 0; i < 20; i++ {
		session.Messages = append(session.Messages, Message{Role: "user", Content: fmt.Sprintf("msg_%d", i)})
	}

	result := app.buildMessageSequence(session, "input", true, "sys")
	chatCount := 0
	for _, m := range result {
		if m.Role != "system" {
			chatCount++
		}
	}
	if chatCount < 20 {
		t.Errorf("Long context should NOT truncate, got %d chat messages", chatCount)
	}
}

func truncateForLog2(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}
