package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// ==================== NewNotesStore 测试 ====================

func TestNewNotesStore(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewNotesStore(tmpDir)
	if err != nil {
		t.Fatalf("NewNotesStore failed: %v", err)
	}
	if store == nil {
		t.Fatal("NewNotesStore returned nil")
	}
	if store.notesDir == "" {
		t.Error("notesDir should not be empty")
	}

	expectedPath := filepath.Join(tmpDir, "notes")
	if store.notesDir != expectedPath {
		t.Errorf("Expected notesDir '%s', got '%s'", expectedPath, store.notesDir)
	}

	info, err := os.Stat(store.notesDir)
	if err != nil {
		t.Fatalf("Notes dir doesn't exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("notesDir should be a directory")
	}
}

func TestNewNotesStoreCreatesNested(t *testing.T) {
	tmpDir := t.TempDir()
	nestedDir := filepath.Join(tmpDir, "a", "b", "c")
	store, err := NewNotesStore(nestedDir)
	if err != nil {
		t.Fatalf("NewNotesStore with nested path failed: %v", err)
	}
	if store == nil {
		t.Fatal("Should create nested dirs")
	}
}

// ==================== Load/Save 测试 ====================

func TestLoadNonExistentSession(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	notes, err := store.Load("nonexistent_session")
	if err != nil {
		t.Fatalf("Load should not error for nonexistent session: %v", err)
	}
	if notes == nil {
		t.Fatal("Load should return empty SessionNotes, not nil")
	}
	if notes.SessionID != "nonexistent_session" {
		t.Errorf("SessionID mismatch: '%s'", notes.SessionID)
	}
	if notes.CurrentTask != "" || len(notes.Decisions) > 0 {
		t.Error("Empty session should have no content")
	}
}

func TestSaveAndLoadRoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	original := &SessionNotes{
		SessionID:     "session_123",
		ProjectPath:   "/project/test",
		CurrentTask:   "实现用户认证模块",
		Decisions:     []string{"[10:00] 使用 JWT 认证", "[10:30] 选择 bcrypt 加密"},
		ModifiedFiles: []string{"src/auth/login.ts", "src/auth/jwt.ts"},
		PendingIssues: []string{"Token 刷新逻辑待实现"},
		NextSteps:     []string{"编写单元测试", "集成到主路由"},
		KeyFindings:   "项目已有中间件模式可复用",
		UpdatedAt:     time.Now(),
	}

	err := store.Save(original)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load("session_123")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if loaded.SessionID != original.SessionID {
		t.Errorf("SessionID mismatch after round-trip")
	}
	if loaded.CurrentTask != original.CurrentTask {
		t.Errorf("CurrentTask mismatch: got '%s', want '%s'", loaded.CurrentTask, original.CurrentTask)
	}
	if len(loaded.Decisions) != len(original.Decisions) {
		t.Errorf("Decisions count mismatch: got %d, want %d", len(loaded.Decisions), len(original.Decisions))
	}
	if len(loaded.ModifiedFiles) != len(original.ModifiedFiles) {
		t.Errorf("ModifiedFiles count mismatch")
	}
	if len(loaded.PendingIssues) != 1 {
		t.Errorf("PendingIssues count wrong")
	}
	if len(loaded.NextSteps) != 2 {
		t.Errorf("NextSteps count wrong")
	}
	if loaded.KeyFindings != original.KeyFindings {
		t.Errorf("KeyFindings mismatch")
	}
}

func TestSaveCreatesFile(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	notes := &SessionNotes{SessionID: "test_file"}
	err := store.Save(notes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	expectedFile := filepath.Join(store.notesDir, "test_file.md")
	if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
		t.Errorf("Save should create file at '%s'", expectedFile)
	}
}

// ==================== AddDecision 测试 ====================

func TestAddDecision(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	err := store.AddDecision("sess1", "使用 RESTful API 设计")
	if err != nil {
		t.Fatalf("AddDecision failed: %v", err)
	}

	loaded, _ := store.Load("sess1")
	if len(loaded.Decisions) != 1 {
		t.Errorf("Expected 1 decision, got %d", len(loaded.Decisions))
	}
	if !strings.Contains(loaded.Decisions[0], "RESTful API") {
		t.Errorf("Decision content missing: %s", loaded.Decisions[0])
	}
	if !strings.Contains(loaded.Decisions[0], ":") {
		t.Error("Decision should include timestamp prefix")
	}
}

func TestAddMultipleDecisions(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	for i := 0; i < 5; i++ {
		store.AddDecision("sess_multi", fmt.Sprintf("decision_%d", i))
	}

	loaded, _ := store.Load("sess_multi")
	if len(loaded.Decisions) != 5 {
		t.Errorf("Expected 5 decisions, got %d", len(loaded.Decisions))
	}
}

func TestAddDecisionCapAt20(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	for i := 0; i < 25; i++ {
		store.AddDecision("sess_cap", fmt.Sprintf("decision_%d", i))
	}

	loaded, _ := store.Load("sess_cap")
	if len(loaded.Decisions) != 20 {
		t.Errorf("Decisions should be capped at 20, got %d", len(loaded.Decisions))
	}
	if !strings.Contains(loaded.Decisions[0], "decision_5") {
		t.Error("First 5 oldest decisions should be dropped, keeping newest 20")
	}
	if !strings.Contains(loaded.Decisions[19], "decision_24") {
		t.Error("Last decision should be the newest one (decision_24)")
	}
}

// ==================== AddModifiedFile 测试 ====================

func TestAddModifiedFile(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.AddModifiedFile("sess1", "src/main.go")
	store.AddModifiedFile("sess1", "src/utils.ts")

	loaded, _ := store.Load("sess1")
	if len(loaded.ModifiedFiles) != 2 {
		t.Errorf("Expected 2 files, got %d", len(loaded.ModifiedFiles))
	}
}

func TestAddModifiedFileDedup(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.AddModifiedFile("sess_dup", "src/main.go")
	store.AddModifiedFile("sess_dup", "src/main.go")
	store.AddModifiedFile("sess_dup", "src/main.go")

	loaded, _ := store.Load("sess_dup")
	if len(loaded.ModifiedFiles) != 1 {
		t.Errorf("Duplicate file should be ignored, got %d", len(loaded.ModifiedFiles))
	}
}

// ==================== SetTask / AddIssue / AddNextStep / SetFinding ====================

func TestSetTask(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.SetTask("sess1", "实现登录功能")
	loaded, _ := store.Load("sess1")
	if loaded.CurrentTask != "实现登录功能" {
		t.Errorf("Task not set: '%s'", loaded.CurrentTask)
	}

	store.SetTask("sess1", "更新任务：添加 OAuth")
	loaded, _ = store.Load("sess1")
	if loaded.CurrentTask != "更新任务：添加 OAuth" {
		t.Errorf("Task should be overwritten: '%s'", loaded.CurrentTask)
	}
}

func TestAddIssue(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.AddIssue("sess1", "Bug: 登录超时")
	store.AddIssue("sess1", "Feature: 记住我功能")
	loaded, _ := store.Load("sess1")
	if len(loaded.PendingIssues) != 2 {
		t.Errorf("Expected 2 issues, got %d", len(loaded.PendingIssues))
	}
}

func TestAddNextStep(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	for i := 0; i < 5; i++ {
		store.AddNextStep("sess1", fmt.Sprintf("step_%d", i))
	}
	loaded, _ := store.Load("sess1")
	if len(loaded.NextSteps) != 5 {
		t.Errorf("Expected 5 steps, got %d", len(loaded.NextSteps))
	}
}

func TestAddNextStepCapAt15(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	for i := 0; i < 20; i++ {
		store.AddNextStep("sess_cap15", fmt.Sprintf("step_%d", i))
	}
	loaded, _ := store.Load("sess_cap15")
	if len(loaded.NextSteps) != 15 {
		t.Errorf("NextSteps capped at 15, got %d", len(loaded.NextSteps))
	}
}

func TestSetFinding(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.SetFinding("sess1", "发现项目使用了依赖注入模式")
	loaded, _ := store.Load("sess1")
	if loaded.KeyFindings != "发现项目使用了依赖注入模式" {
		t.Errorf("Finding not set: '%s'", loaded.KeyFindings)
	}

	store.SetFinding("sess1", "更新发现")
	loaded, _ = store.Load("sess1")
	if loaded.KeyFindings != "更新发现" {
		t.Error("Finding should be overwritten")
	}
}

// ==================== ToContextPrompt 测试 ====================

func TestToContextPromptEmpty(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	prompt, err := store.ToContextPrompt("empty_sess")
	if err != nil {
		t.Fatalf("ToContextPrompt error: %v", err)
	}
	if prompt != "" {
		t.Errorf("Empty notes should return empty prompt, got: %s", prompt)
	}
}

func TestToContextPromptWithContent(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.SetTask("full_sess", "实现 API 网关")
	store.AddDecision("full_sess", "选择 Kong 作为网关")
	store.AddModifiedFile("full_sess", "api/gateway.go")

	prompt, err := store.ToContextPrompt("full_sess")
	if err != nil {
		t.Fatalf("ToContextPrompt error: %v", err)
	}
	if prompt == "" {
		t.Fatal("ToContextPrompt should return non-empty for populated notes")
	}
	if !strings.Contains(prompt, "【项目工作笔记") {
		t.Error("Should have header marker")
	}
	if !strings.Contains(prompt, "API 网关") {
		t.Error("Should contain task")
	}
	if !strings.Contains(prompt, "Kong") {
		t.Error("Should contain decision")
	}
	if !strings.Contains(prompt, "gateway.go") {
		t.Error("Should contain modified file")
	}
}

func TestToContextPromptFormat(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.AddDecision("fmt_sess", "决策一")
	store.AddNextStep("fmt_sess", "第一步")
	store.AddNextStep("fmt_sess", "第二步")
	store.AddIssue("fmt_sess", "问题一")

	prompt, _ := store.ToContextPrompt("fmt_sess")
	if !strings.Contains(prompt, "后续步骤:") {
		t.Error("Should have steps section")
	}
	if !strings.Contains(prompt, "1. 第一步") {
		t.Error("Steps should use numbered format")
	}
	if !strings.Contains(prompt, "待处理:") {
		t.Error("Should have issues section")
	}
}

// ==================== CleanupOld 测试 ====================

func TestCleanupOldRemovesExpired(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.Save(&SessionNotes{SessionID: "old_note"})
	oldPath := filepath.Join(store.notesDir, "old_note.md")

	pastTime := time.Now().Add(-60 * 24 * time.Hour).Unix()
	os.Chtimes(oldPath, time.Unix(pastTime, pastTime), time.Unix(pastTime, pastTime))

	deleted, err := store.CleanupOld(30)
	if err != nil {
		t.Fatalf("CleanupOld error: %v", err)
	}
	if deleted != 1 {
		t.Errorf("Expected 1 deleted, got %d", deleted)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("Expired note file should be deleted")
	}
}

func TestCleanupOldKeepsRecent(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	store.Save(&SessionNotes{SessionID: "recent_note"})
	recentPath := filepath.Join(store.notesDir, "recent_note.md")

	deleted, _ := store.CleanupOld(30)
	if deleted != 0 {
		t.Errorf("Recent note should NOT be deleted, got %d", deleted)
	}
	if _, err := os.Stat(recentPath); os.IsNotExist(err) {
		t.Error("Recent note file should still exist")
	}
}

func TestCleanupOldEmptyDir(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	deleted, err := store.CleanupOld(30)
	if err != nil {
		t.Fatalf("CleanupOld on empty dir should not error: %v", err)
	}
	if deleted != 0 {
		t.Errorf("Expected 0 deletions in empty dir, got %d", deleted)
	}
}

func TestCleanupOldOnlyMDFiles(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	junkFile := filepath.Join(store.notesDir, "junk.txt")
	os.WriteFile(junkFile, []byte("junk"), 0644)

	store.Save(&SessionNotes{SessionID: "valid_note"})
	validPath := filepath.Join(store.notesDir, "valid_note.md")
	pastTime := time.Now().Add(-60 * 24 * time.Hour).Unix()
	os.Chtimes(validPath, time.Unix(pastTime, pastTime), time.Unix(pastTime, pastTime))

	deleted, _ := store.CleanupOld(30)
	if _, err := os.Stat(junkFile); os.IsNotExist(err) {
		t.Error("Non-.md files should not be cleaned up")
	}
	if deleted != 1 {
		t.Errorf("Only .md files should be cleaned, got %d", deleted)
	}
}

// ==================== 并发安全测试 ====================

func TestConcurrentWrites(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			store.AddDecision("concurrent_sess", fmt.Sprintf("decision_%d", idx))
		}(i)
	}
	wg.Wait()

	loaded, err := store.Load("concurrent_sess")
	if err != nil {
		t.Fatalf("Load after concurrent writes failed: %v", err)
	}
	if len(loaded.Decisions) != 20 {
		t.Errorf("Expected 20 decisions (cap) after concurrent writes, got %d", len(loaded.Decisions))
	}
}

// ==================== 文件格式验证 ====================

func TestSavedFileFormat(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewNotesStore(tmpDir)

	notes := &SessionNotes{
		SessionID:     "format_test",
		CurrentTask:   "测试任务",
		Decisions:     []string{"决策A"},
		ModifiedFiles: []string{"file.go"},
		PendingIssues: []string{"问题B"},
		NextSteps:     []string{"步骤C"},
		KeyFindings:   "发现D",
		UpdatedAt:     time.Date(2026, 5, 24, 12, 0, 0, 0, time.UTC),
	}
	store.Save(notes)

	data, err := os.ReadFile(filepath.Join(store.notesDir, "format_test.md"))
	if err != nil {
		t.Fatalf("Failed to read saved file: %v", err)
	}

	content := string(data)
	checks := []struct {
		mustContain string
		description string
	}{
		{"# CodeCast 工作笔记", "Header"},
		{"会话: format_test", "Session ID in metadata"},
		{"# 当前任务", "Task section header"},
		{"- 测试任务", "Task content"},
		{"# 决策记录", "Decisions section header"},
		{"- 决策A", "Decision content"},
		{"# 已修改文件", "Files section header"},
		{"- file.go", "File content"},
		{"# 待处理问题", "Issues section header"},
		{"# 下一步计划", "Steps section header"},
		{"- 步骤C", "Dash-prefixed step content"},
		{"# 关键发现", "Findings section header"},
		{"发现D", "Finding content"},
	}

	for _, check := range checks {
		if !strings.Contains(content, check.mustContain) {
			t.Errorf("Missing expected content [%s]: %s", check.description, check.mustContain)
		}
	}
}
