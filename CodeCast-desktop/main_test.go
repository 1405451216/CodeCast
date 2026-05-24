package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
)

func TestNewApp(t *testing.T) {
	app := NewApp()
	if app == nil {
		t.Fatal("NewApp() returned nil")
	}
	if app.config == nil {
		t.Error("app.config is nil")
	}
	if app.settings == nil {
		t.Error("app.settings is nil")
	}
	if app.sessions == nil {
		t.Error("app.sessions is nil")
	}
	if app.tasks == nil {
		t.Error("app.tasks is nil")
	}
	if app.skills == nil {
		t.Error("app.skills is nil")
	}
}

func TestDefaultSettings(t *testing.T) {
	settings := DefaultSettings

	if settings.WorkMode != "daily" {
		t.Errorf("Expected WorkMode 'daily', got '%s'", settings.WorkMode)
	}
	if settings.Theme != "dark" {
		t.Errorf("Expected Theme 'dark', got '%s'", settings.Theme)
	}
	expectedShell := "powershell"
	if runtime.GOOS == "darwin" {
		expectedShell = "zsh"
	} else if runtime.GOOS == "linux" {
		expectedShell = "bash"
	}
	if settings.Shell != expectedShell {
		t.Errorf("Expected Shell '%s', got '%s'", expectedShell, settings.Shell)
	}
	if len(settings.MCPServers) == 0 {
		t.Error("MCPServers should contain at least one builtin server")
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig

	if cfg.App.Name != "CodeCast" {
		t.Errorf("Expected App.Name 'CodeCast', got '%s'", cfg.App.Name)
	}
	if cfg.Model.Provider != "deepseek" {
		t.Errorf("Expected Model.Provider 'deepseek', got '%s'", cfg.Model.Provider)
	}
	if cfg.Model.BaseURL != "https://api.deepseek.com/v1" {
		t.Errorf("Expected Model.BaseURL 'https://api.deepseek.com/v1', got '%s'", cfg.Model.BaseURL)
	}
}

func TestNewSession(t *testing.T) {
	session := NewSession("Test Session", "skill_123")

	if session.ID == "" {
		t.Error("Session ID should not be empty")
	}
	if session.Name != "Test Session" {
		t.Errorf("Expected Name 'Test Session', got '%s'", session.Name)
	}
	if session.SkillID != "skill_123" {
		t.Errorf("Expected SkillID 'skill_123', got '%s'", session.SkillID)
	}
	if session.CreatedAt.IsZero() {
		t.Error("CreatedAt should not be zero")
	}
	if session.Messages == nil {
		t.Error("Messages should not be nil")
	}
}

func TestSessionAddMessage(t *testing.T) {
	session := NewSession("Test", "")

	session.AddMessage(Message{Role: "user", Content: "Hello"})
	if len(session.Messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(session.Messages))
	}
	if session.Messages[0].Role != "user" {
		t.Errorf("Expected Role 'user', got '%s'", session.Messages[0].Role)
	}
	if session.Messages[0].Content != "Hello" {
		t.Errorf("Expected Content 'Hello', got '%s'", session.Messages[0].Content)
	}

	session.AddMessage(Message{Role: "assistant", Content: "Hi there!"})
	if len(session.Messages) != 2 {
		t.Errorf("Expected 2 messages, got %d", len(session.Messages))
	}
}

func TestAppGetSettings(t *testing.T) {
	app := NewApp()
	settings := app.GetSettings()

	if settings.WorkMode != DefaultSettings.WorkMode {
		t.Errorf("Expected WorkMode '%s', got '%s'", DefaultSettings.WorkMode, settings.WorkMode)
	}
}

func TestAppSaveSettings(t *testing.T) {
	app := NewApp()

	originalSettings := app.GetSettings()
	newSettings := originalSettings
	newSettings.WorkMode = "coding"
	newSettings.Theme = "light"

	err := app.SaveSettings(newSettings)
	if err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	retrievedSettings := app.GetSettings()
	if retrievedSettings.WorkMode != "coding" {
		t.Errorf("Expected WorkMode 'coding', got '%s'", retrievedSettings.WorkMode)
	}
	if retrievedSettings.Theme != "light" {
		t.Errorf("Expected Theme 'light', got '%s'", retrievedSettings.Theme)
	}

	app.SaveSettings(originalSettings)
}

func TestAppUpdateSetting(t *testing.T) {
	app := NewApp()

	originalWorkMode := app.settings.WorkMode

	err := app.UpdateSetting("work_mode", "coding")
	if err != nil {
		t.Fatalf("UpdateSetting failed: %v", err)
	}

	if app.settings.WorkMode != "coding" {
		t.Errorf("Expected WorkMode 'coding', got '%s'", app.settings.WorkMode)
	}

	app.settings.WorkMode = originalWorkMode
}

func TestAppUpdateSettingInvalidKey(t *testing.T) {
	app := NewApp()

	err := app.UpdateSetting("nonexistent_key", "value")
	if err == nil {
		t.Error("Expected error for invalid key, got nil")
	}
}

func TestAppUpdateSettingTypeConversion(t *testing.T) {
	app := NewApp()

	err := app.UpdateSetting("theme", "light")
	if err != nil {
		t.Errorf("UpdateSetting(string) failed: %v", err)
	}

	err = app.UpdateSetting("auto_review", true)
	if err != nil {
		t.Errorf("UpdateSetting(bool) failed: %v", err)
	}
}

func TestMCPServerManagement(t *testing.T) {
	app := NewApp()

	initialCount := len(app.settings.MCPServers)

	server, err := app.AddMCPServer("Test MCP", "ws://localhost:8080")
	if err != nil {
		t.Fatalf("AddMCPServer failed: %v", err)
	}
	if server == nil {
		t.Fatal("AddMCPServer returned nil server")
	}
	if server.Name != "Test MCP" {
		t.Errorf("Expected Name 'Test MCP', got '%s'", server.Name)
	}
	if server.Type != "websocket" {
		t.Errorf("Expected Type 'websocket', got '%s'", server.Type)
	}

	if len(app.settings.MCPServers) != initialCount+1 {
		t.Errorf("Expected %d MCPServers, got %d", initialCount+1, len(app.settings.MCPServers))
	}

	err = app.ToggleMCPServer(server.ID, false)
	if err != nil {
		t.Fatalf("ToggleMCPServer failed: %v", err)
	}

	err = app.RemoveMCPServer(server.ID)
	if err != nil {
		t.Fatalf("RemoveMCPServer failed: %v", err)
	}

	if len(app.settings.MCPServers) != initialCount {
		t.Errorf("Expected %d MCPServers after removal, got %d", initialCount, len(app.settings.MCPServers))
	}
}

func TestBuiltinMCPServerCannotBeRemoved(t *testing.T) {
	app := NewApp()

	builtinServer := MCPServer{
		ID:      "builtin_test",
		Name:    "Test Builtin",
		Command: "test",
		Type:    "stdio",
		Builtin: true,
	}
	app.settings.MCPServers = append([]MCPServer{builtinServer}, app.settings.MCPServers...)

	err := app.RemoveMCPServer(builtinServer.ID)
	if err == nil {
		t.Error("Expected error when trying to remove builtin server")
	}
}

func TestEnvVarManagement(t *testing.T) {
	app := NewApp()

	initialCount := len(app.settings.EnvVars)

	err := app.AddEnvVar("TEST_KEY", "test_value")
	if err != nil {
		t.Fatalf("AddEnvVar failed: %v", err)
	}

	if len(app.settings.EnvVars) != initialCount+1 {
		t.Errorf("Expected %d EnvVars, got %d", initialCount+1, len(app.settings.EnvVars))
	}

	envVars := app.GetEnvVars()
	if len(envVars) != initialCount+1 {
		t.Errorf("GetEnvVars returned %d items, expected %d", len(envVars), initialCount+1)
	}

	err = app.RemoveEnvVar("TEST_KEY")
	if err != nil {
		t.Fatalf("RemoveEnvVar failed: %v", err)
	}

	if len(app.settings.EnvVars) != initialCount {
		t.Errorf("Expected %d EnvVars after removal, got %d", initialCount, len(app.settings.EnvVars))
	}
}

func TestEnvVarUpdateExisting(t *testing.T) {
	app := NewApp()

	app.AddEnvVar("MY_VAR", "original")
	app.AddEnvVar("MY_VAR", "updated")

	if len(app.settings.EnvVars) != 1 {
		t.Errorf("Expected 1 EnvVar after update, got %d", len(app.settings.EnvVars))
	}

	if app.settings.EnvVars[0].Value != "updated" {
		t.Errorf("Expected value 'updated', got '%s'", app.settings.EnvVars[0].Value)
	}
}

func TestSlashCommandManagement(t *testing.T) {
	app := NewApp()

	cmd, err := app.AddSlashCommand("test", "Test command", "/test")
	if err != nil {
		t.Fatalf("AddSlashCommand failed: %v", err)
	}
	if cmd.Name != "test" {
		t.Errorf("Expected Name 'test', got '%s'", cmd.Name)
	}

	cmds := app.GetSlashCommands()
	found := false
	for _, c := range cmds {
		if c.ID == cmd.ID {
			found = true
			break
		}
	}
	if !found {
		t.Error("Added command not found in GetSlashCommands")
	}

	err = app.UpdateSlashCommand(cmd.ID, "newtest", "Updated desc", "/newtest")
	if err != nil {
		t.Fatalf("UpdateSlashCommand failed: %v", err)
	}

	err = app.RemoveSlashCommand(cmd.ID)
	if err != nil {
		t.Fatalf("RemoveSlashCommand failed: %v", err)
	}
}

func TestSlashCommandDuplicateName(t *testing.T) {
	app := NewApp()

	app.AddSlashCommand("duplicate", "First", "/duplicate")
	_, err := app.AddSlashCommand("duplicate", "Second", "/duplicate2")

	if err == nil {
		t.Error("Expected error for duplicate command name")
	}
}

func TestSlashCommandEmptyName(t *testing.T) {
	app := NewApp()

	_, err := app.AddSlashCommand("", "Desc", "/cmd")
	if err == nil {
		t.Error("Expected error for empty command name")
	}
}

func TestArchiveSession(t *testing.T) {
	app := NewApp()

	session := app.CreateSession("Test Session", "", "")
	if session == nil {
		t.Fatal("CreateSession returned nil")
	}

	err := app.ArchiveSession(session.ID)
	if err != nil {
		t.Fatalf("ArchiveSession failed: %v", err)
	}

	found := false
	for _, id := range app.settings.ArchivedSessions {
		if id == session.ID {
			found = true
			break
		}
	}
	if !found {
		t.Error("Session ID not found in ArchivedSessions")
	}

	err = app.ArchiveSession(session.ID)
	if err != nil {
		t.Error("Duplicate ArchiveSession should not error")
	}
}

func TestUnarchiveSession(t *testing.T) {
	app := NewApp()

	session := app.CreateSession("Test", "", "")
	app.ArchiveSession(session.ID)

	err := app.UnarchiveSession(session.ID)
	if err != nil {
		t.Fatalf("UnarchiveSession failed: %v", err)
	}

	for _, id := range app.settings.ArchivedSessions {
		if id == session.ID {
			t.Error("Session should not be in ArchivedSessions after UnarchiveSession")
		}
	}
}

func TestResetMemory(t *testing.T) {
	app := NewApp()

	app.settings.CustomInstructions = "Some custom instructions"
	app.settings.AutoMemory = true
	app.settings.ToolMemory = true

	err := app.ResetMemory()
	if err != nil {
		t.Fatalf("ResetMemory failed: %v", err)
	}

	if app.settings.CustomInstructions != "" {
		t.Error("CustomInstructions should be empty after ResetMemory")
	}
	if app.settings.AutoMemory {
		t.Error("AutoMemory should be false after ResetMemory")
	}
	if app.settings.ToolMemory {
		t.Error("ToolMemory should be false after ResetMemory")
	}
}

func TestDomainManagement(t *testing.T) {
	app := NewApp()

	err := app.AddBlockedDomain("example.com")
	if err != nil {
		t.Fatalf("AddBlockedDomain failed: %v", err)
	}

	err = app.AddBlockedDomain("example.com")
	if err == nil {
		t.Error("Expected error for duplicate blocked domain")
	}

	err = app.AddAllowedDomain("trusted.com")
	if err != nil {
		t.Fatalf("AddAllowedDomain failed: %v", err)
	}

	err = app.RemoveBlockedDomain("example.com")
	if err != nil {
		t.Fatalf("RemoveBlockedDomain failed: %v", err)
	}

	err = app.RemoveAllowedDomain("trusted.com")
	if err != nil {
		t.Fatalf("RemoveAllowedDomain failed: %v", err)
	}
}

func TestDomainEmptyValue(t *testing.T) {
	app := NewApp()

	err := app.AddBlockedDomain("")
	if err == nil {
		t.Error("Expected error for empty domain")
	}

	err = app.AddAllowedDomain("")
	if err == nil {
		t.Error("Expected error for empty domain")
	}
}

func TestProjectManagement(t *testing.T) {
	app := NewApp()

	tmpDir := t.TempDir()
	projectPath := filepath.Join(tmpDir, "testproject")
	err := os.MkdirAll(projectPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}

	project, err := app.AddProject(projectPath)
	if err != nil {
		t.Fatalf("AddProject failed: %v", err)
	}
	if project.Path != projectPath {
		t.Errorf("Expected Path '%s', got '%s'", projectPath, project.Path)
	}
	if project.Name != "testproject" {
		t.Errorf("Expected Name 'testproject', got '%s'", project.Name)
	}

	projects := app.GetProjects()
	if len(projects) != 1 {
		t.Errorf("Expected 1 project, got %d", len(projects))
	}

	duplicate, err := app.AddProject(projectPath)
	if err != nil {
		t.Error("Adding same project twice should not error")
	}
	if duplicate.Path != projectPath {
		t.Error("Should return existing project for duplicate path")
	}

	err = app.RemoveProject(projectPath)
	if err != nil {
		t.Fatalf("RemoveProject failed: %v", err)
	}

	projects = app.GetProjects()
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects after removal, got %d", len(projects))
	}
}

func TestAddProjectInvalidPath(t *testing.T) {
	app := NewApp()

	_, err := app.AddProject("")
	if err == nil {
		t.Error("Expected error for empty path")
	}

	_, err = app.AddProject("nonexistent/path/to/nowhere")
	if err == nil {
		t.Error("Expected error for nonexistent path")
	}
}

func TestIsPathAllowed(t *testing.T) {
	app := NewApp()

	tmpDir := t.TempDir()
	projectPath := filepath.Join(tmpDir, "myproject")
	err := os.MkdirAll(projectPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}

	app.AddProject(projectPath)

	err = app.isPathAllowed(projectPath)
	if err != nil {
		t.Errorf("isPathAllowed should allow project path, got error: %v", err)
	}

	subPath := filepath.Join(projectPath, "subdir", "file.txt")
	err = app.isPathAllowed(subPath)
	if err != nil {
		t.Errorf("isPathAllowed should allow subdirectory, got error: %v", err)
	}

	forbiddenPath := filepath.Join(tmpDir, "otherproject")
	err = app.isPathAllowed(forbiddenPath)
	if err == nil {
		t.Error("isPathAllowed should reject paths outside project directory")
	}
}

func TestIsPathAllowedNoProjects(t *testing.T) {
	app := &App{
		projects: []Project{},
		mu:       sync.Mutex{},
	}

	err := app.isPathAllowed("/some/path")
	if err == nil {
		t.Error("Expected error when no projects configured")
	}
}

func TestSyncSettingsToConfig(t *testing.T) {
	app := NewApp()

	originalKey := app.settings.APIKey
	originalBaseURL := app.config.Model.BaseURL
	originalModel := app.config.Model.Model

	app.settings.APIKey = "test-api-key-12345"
	app.syncSettingsToConfig()

	if app.config.Model.APIKey != "test-api-key-12345" {
		t.Error("APIKey not synced to config")
	}
	if app.config.Model.BaseURL != "https://api.deepseek.com" {
		t.Errorf("Expected BaseURL 'https://api.deepseek.com', got '%s'", app.config.Model.BaseURL)
	}
	if app.config.Model.Model != "deepseek-v4-flash" {
		t.Errorf("Expected Model 'deepseek-v4-flash', got '%s'", app.config.Model.Model)
	}

	app.settings.APIKey = originalKey
	app.syncSettingsToConfig()
	app.config.Model.BaseURL = originalBaseURL
	app.config.Model.Model = originalModel
}

func TestGetConfig(t *testing.T) {
	app := NewApp()

	config := app.GetConfig()

	if config["settings_path"] == "" {
		t.Error("settings_path should not be empty")
	}

	model, ok := config["model"].(map[string]any)
	if !ok {
		t.Fatal("model should be a map")
	}

	if model["base_url"] != "https://api.deepseek.com" {
		t.Errorf("Expected base_url 'https://api.deepseek.com', got '%v'", model["base_url"])
	}
}

func TestSkillManagement(t *testing.T) {
	app := NewApp()

	initialCount := len(app.skills)

	skill, err := app.CreateSkill("Test Skill", "Test description", "You are a test assistant")
	if err != nil {
		t.Fatalf("CreateSkill failed: %v", err)
	}
	if skill.Name != "Test Skill" {
		t.Errorf("Expected Name 'Test Skill', got '%s'", skill.Name)
	}
	if skill.Type != "custom" {
		t.Errorf("Expected Type 'custom', got '%s'", skill.Type)
	}

	skills := app.GetSkills()
	if len(skills) != initialCount+1 {
		t.Errorf("Expected %d skills, got %d", initialCount+1, len(skills))
	}

	err = app.DeleteSkill(skill.ID)
	if err != nil {
		t.Fatalf("DeleteSkill failed: %v", err)
	}

	skills = app.GetSkills()
	if len(skills) != initialCount {
		t.Errorf("Expected %d skills after deletion, got %d", initialCount, len(skills))
	}
}

func TestSkillImport(t *testing.T) {
	app := NewApp()

	jsonStr := `{"name":"Imported Skill","description":"Imported description","prompt":"You are imported"}`
	skill, err := app.ImportSkill(jsonStr)
	if err != nil {
		t.Fatalf("ImportSkill failed: %v", err)
	}
	if skill.Name != "Imported Skill" {
		t.Errorf("Expected Name 'Imported Skill', got '%s'", skill.Name)
	}

	_, err = app.ImportSkill(`{"name":"","prompt":"test"}`)
	if err == nil {
		t.Error("Expected error for empty name")
	}

	_, err = app.ImportSkill(`{"name":"test","prompt":""}`)
	if err == nil {
		t.Error("Expected error for empty prompt")
	}
}

func TestTaskManagement(t *testing.T) {
	app := NewApp()

	task, err := app.CreateTask("Test Task", "Description", "echo hello", "0 8 * * *")
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}
	if task.Name != "Test Task" {
		t.Errorf("Expected Name 'Test Task', got '%s'", task.Name)
	}
	if task.Schedule != "0 8 * * *" {
		t.Errorf("Expected Schedule '0 8 * * *', got '%s'", task.Schedule)
	}
	if !task.Enabled {
		t.Error("New task should be enabled")
	}
	if task.Status != "pending" {
		t.Errorf("Expected Status 'pending', got '%s'", task.Status)
	}

	tasks := app.GetTasks()
	if len(tasks) != 1 {
		t.Errorf("Expected 1 task, got %d", len(tasks))
	}

	err = app.ToggleTask(task.ID, false)
	if err != nil {
		t.Fatalf("ToggleTask failed: %v", err)
	}

	err = app.DeleteTask(task.ID)
	if err != nil {
		t.Fatalf("DeleteTask failed: %v", err)
	}

	tasks = app.GetTasks()
	if len(tasks) != 0 {
		t.Errorf("Expected 0 tasks after deletion, got %d", len(tasks))
	}
}

func TestSettingsNilSlicesAfterLoad(t *testing.T) {
	app := &App{}

	tmpDir := t.TempDir()
	settingsFile := filepath.Join(tmpDir, "settings.json")

	settingsJSON := `{"work_mode": "coding"}`
	err := os.WriteFile(settingsFile, []byte(settingsJSON), 0644)
	if err != nil {
		t.Fatalf("Failed to write test settings: %v", err)
	}

	app.settingsPath = settingsFile
	app.loadSettings()

	if app.settings.MCPServers == nil {
		t.Error("MCPServers should not be nil after loading")
	}
	if app.settings.EnvVars == nil {
		t.Error("EnvVars should not be nil after loading")
	}
	if app.settings.BlockedDomains == nil {
		t.Error("BlockedDomains should not be nil after loading")
	}
}

func TestEnsureBuiltinMCP(t *testing.T) {
	settings := &Settings{
		MCPServers: []MCPServer{
			{ID: "custom_mcp", Name: "Custom MCP", Type: "websocket"},
		},
	}

	app := &App{settings: settings}
	app.ensureBuiltinMCP(settings)

	if len(settings.MCPServers) != 2 {
		t.Errorf("Expected 2 MCPServers (1 custom + 1 builtin), got %d", len(settings.MCPServers))
	}

	hasBuiltin := false
	for _, s := range settings.MCPServers {
		if s.Builtin {
			hasBuiltin = true
			break
		}
	}
	if !hasBuiltin {
		t.Error("Builtin MCP server should be added")
	}

	app.ensureBuiltinMCP(settings)
	if len(settings.MCPServers) != 2 {
		t.Error("ensureBuiltinMCP should not add duplicate builtin server")
	}
}

func TestLoadSettingsNilSlices(t *testing.T) {
	app := &App{}

	tmpDir := t.TempDir()
	settingsFile := filepath.Join(tmpDir, "settings.json")

	settingsJSON := `{
		"work_mode": "coding",
		"api_key": "test-key"
	}`
	err := os.WriteFile(settingsFile, []byte(settingsJSON), 0644)
	if err != nil {
		t.Fatalf("Failed to write test settings: %v", err)
	}

	app.settingsPath = settingsFile
	app.loadSettings()

	if app.settings.MCPServers == nil {
		t.Error("MCPServers should not be nil after loading")
	}
	if app.settings.EnvVars == nil {
		t.Error("EnvVars should not be nil after loading")
	}
	if app.settings.BlockedDomains == nil {
		t.Error("BlockedDomains should not be nil after loading")
	}
}

var originalExecutable = os.Executable

func init() {
	originalExecutable = os.Executable
}

// ==================== 内存泄漏修复测试 (W-03) ====================

func TestCancelEntryStructure(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	entry := cancelEntry{
		cancel:     cancel,
		createdAt: time.Now(),
	}

	if entry.cancel == nil {
		t.Error("cancel function should not be nil")
	}
	if entry.createdAt.IsZero() {
		t.Error("createdAt should not be zero")
	}
}

func TestActiveCancelsMapOperations(t *testing.T) {
	// 清理 map，确保测试环境干净
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	// 测试添加条目
	_, cancel1 := context.WithCancel(context.Background())
	cancelMu.Lock()
	activeCancels["session_1"] = cancelEntry{
		cancel:     cancel1,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	if getActiveCancelCount() != 1 {
		t.Errorf("Expected 1 active cancel, got %d", getActiveCancelCount())
	}

	// 测试添加第二个条目
	_, cancel2 := context.WithCancel(context.Background())
	cancelMu.Lock()
	activeCancels["session_2"] = cancelEntry{
		cancel:     cancel2,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	if getActiveCancelCount() != 2 {
		t.Errorf("Expected 2 active cancels, got %d", getActiveCancelCount())
	}

	// 测试删除单个条目
	app := &App{}
	app.CancelSessionRequest("session_1")

	if getActiveCancelCount() != 1 {
		t.Errorf("Expected 1 active cancel after removal, got %d", getActiveCancelCount())
	}

	// 测试删除所有条目
	app.CancelRequest()

	if getActiveCancelCount() != 0 {
		t.Errorf("Expected 0 active cancels after CancelRequest, got %d", getActiveCancelCount())
	}
}

func TestCleanupExpiredEntries(t *testing.T) {
	// 清理 map
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	// 添加一个已过期的条目（创建时间为 31 分钟前）
	_, oldCancel := context.WithCancel(context.Background())
	cancelMu.Lock()
	activeCancels["expired_session"] = cancelEntry{
		cancel:     oldCancel,
		createdAt: time.Now().Add(-31 * time.Minute),
	}
	cancelMu.Unlock()

	// 添加一个未过期的条目（刚刚创建）
	_, newCancel := context.WithCancel(context.Background())
	cancelMu.Lock()
	activeCancels["active_session"] = cancelEntry{
		cancel:     newCancel,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	if getActiveCancelCount() != 2 {
		t.Fatalf("Expected 2 entries before cleanup, got %d", getActiveCancelCount())
	}

	// 执行清理
	cleanupExpiredEntries()

	// 验证只有过期条目被清理
	if getActiveCancelCount() != 1 {
		t.Errorf("Expected 1 entry after cleanup, got %d", getActiveCancelCount())
	}

	cancelMu.Lock()
	if _, ok := activeCancels["expired_session"]; ok {
		t.Error("Expired session should have been removed")
	}
	if _, ok := activeCancels["active_session"]; !ok {
		t.Error("Active session should still exist")
	}
	cancelMu.Unlock()
}

func TestDeleteSessionCleansUpCancel(t *testing.T) {
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	app := NewApp()

	// 创建 session
	session := app.CreateSession("Test Session", "", "")
	if session == nil {
		t.Fatal("CreateSession returned nil")
	}

	// 为该 session 注册一个 cancel 函数
	_, cancel := context.WithCancel(context.Background())
	cancelMu.Lock()
	activeCancels[session.ID] = cancelEntry{
		cancel:     cancel,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	if getActiveCancelCount() != 1 {
		t.Fatalf("Expected 1 active cancel before delete, got %d", getActiveCancelCount())
	}

	// 删除 session
	err := app.DeleteSession(session.ID)
	if err != nil {
		t.Fatalf("DeleteSession failed: %v", err)
	}

	// 验证 cancel 函数已被清理
	if getActiveCancelCount() != 0 {
		t.Errorf("Expected 0 active cancels after DeleteSession, got %d", getActiveCancelCount())
	}
}

func TestConcurrentAccessToActiveCancels(t *testing.T) {
	// 清理 map
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	// 并发写入
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			_, cancel := context.WithCancel(context.Background())
			cancelMu.Lock()
			activeCancels[fmt.Sprintf("session_%d", id)] = cancelEntry{
				cancel:     cancel,
				createdAt: time.Now(),
			}
			cancelMu.Unlock()
		}(i)
	}
	wg.Wait()

	if getActiveCancelCount() != 100 {
		t.Errorf("Expected 100 entries, got %d", getActiveCancelCount())
	}

	// 并发读取和删除
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			app := &App{}
			app.CancelSessionRequest(fmt.Sprintf("session_%d", id))
		}(i)
	}
	wg.Wait()

	if getActiveCancelCount() != 50 {
		t.Errorf("Expected 50 entries after concurrent deletion, got %d", getActiveCancelCount())
	}
}

func TestMassiveSessionCreationAndDestruction(t *testing.T) {
	app := NewApp()

	// 清理初始状态
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	// 模拟大量会话的创建和销毁
	const sessionCount = 1000

	var sessionIDs []string
	for i := 0; i < sessionCount; i++ {
		session := app.CreateSession(fmt.Sprintf("Session_%d", i), "", "")
		sessionIDs = append(sessionIDs, session.ID)

		// 为每个 session 注册 cancel 函数
		_, cancel := context.WithCancel(context.Background())
		cancelMu.Lock()
		activeCancels[session.ID] = cancelEntry{
			cancel:     cancel,
			createdAt: time.Now(),
		}
		cancelMu.Unlock()
	}

	if getActiveCancelCount() != sessionCount {
		t.Errorf("Expected %d entries, got %d", sessionCount, getActiveCancelCount())
	}

	// 删除一半的 sessions
	for i := 0; i < sessionCount/2; i++ {
		app.DeleteSession(sessionIDs[i])
	}

	expectedRemaining := sessionCount / 2
	if getActiveCancelCount() != expectedRemaining {
		t.Errorf("Expected %d entries after partial deletion, got %d",
			expectedRemaining, getActiveCancelCount())
	}

	// 删除剩余的所有 sessions
	for i := sessionCount / 2; i < sessionCount; i++ {
		app.DeleteSession(sessionIDs[i])
	}

	if getActiveCancelCount() != 0 {
		t.Errorf("Expected 0 entries after all deletions, got %d", getActiveCancelCount())
	}
}

func TestCheckAndLogMapSize(t *testing.T) {
	// 这个测试主要验证函数不会 panic
	// 实际日志输出需要人工检查

	// 测试正常情况（低于阈值）
	checkAndLogMapSize(50)

	// 测试警告阈值
	checkAndLogMapSize(warnMapSizeThreshold)

	// 测试严重阈值
	checkAndLogMapSize(criticalMapSizeThreshold)

	// 如果没有 panic，测试通过
}

func TestStartupInitiatesCleanup(t *testing.T) {
	app := NewApp()

	// 创建一个假的 context 用于 startup
	ctx := context.Background()
	app.startup(ctx)

	// 等待一小段时间让 goroutine 启动
	time.Sleep(10 * time.Millisecond)

	// 验证清理机制已启动（通过检查是否有 goroutine 在运行）
	// 这里我们无法直接验证，但可以确保不会 panic

	// 停止清理 goroutine 以避免影响其他测试
	cleanupOnce.Do(func() { close(cleanupStopCh) })
}

func TestShutdownCleansAllResources(t *testing.T) {
	cancelMu.Lock()
	activeCancels = make(map[string]cancelEntry)
	cancelMu.Unlock()

	app := NewApp()

	for i := 0; i < 10; i++ {
		_, cancel := context.WithCancel(context.Background())
		cancelMu.Lock()
		activeCancels[fmt.Sprintf("session_%d", i)] = cancelEntry{
			cancel:     cancel,
			createdAt: time.Now(),
		}
		cancelMu.Unlock()
	}

	if getActiveCancelCount() != 10 {
		t.Fatalf("Expected 10 entries before shutdown, got %d", getActiveCancelCount())
	}

	ctx := context.Background()
	app.shutdown(ctx)

	if getActiveCancelCount() != 0 {
		t.Errorf("Expected 0 entries after shutdown, got %d", getActiveCancelCount())
	}
}

// ==================== API Key 加密功能测试 (W-01) ====================

func TestGenerateKey(t *testing.T) {
	key, err := generateKey()
	if err != nil {
		t.Fatalf("generateKey failed: %v", err)
	}
	if len(key) != keyLength {
		t.Errorf("Expected key length %d, got %d", keyLength, len(key))
	}

	key2, err := generateKey()
	if err != nil {
		t.Fatalf("generateKey failed: %v", err)
	}
	if string(key) == string(key2) {
		t.Error("Generated keys should be different")
	}
}

func TestEncryptDecryptAPIKey(t *testing.T) {
	key, _ := generateKey()

	testCases := []string{
		"",
		"sk-test-api-key-12345",
		"a",
		"very-long-api-key-with-special-chars-!@#$%^&*()_+-=[]{}|;':\",./<>?",
		string(make([]byte, 1000)),
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("len_%d", len(tc)), func(t *testing.T) {
			encrypted, err := encryptAPIKey(tc, key)
			if err != nil {
				t.Fatalf("encryptAPIKey failed: %v", err)
			}

			if tc == "" && encrypted != "" {
				t.Error("Empty plaintext should return empty encrypted")
			}

			if tc != "" && !isEncrypted(encrypted) {
				t.Error("Encrypted value should have 'enc:' prefix")
			}

			decrypted, err := decryptAPIKey(encrypted, key)
			if err != nil {
				t.Fatalf("decryptAPIKey failed: %v", err)
			}

			if decrypted != tc {
				t.Errorf("Decrypted value '%s' doesn't match original '%s'", decrypted, tc)
			}
		})
	}
}

func TestDecryptUnencryptedValue(t *testing.T) {
	key, _ := generateKey()

	unencrypted := "plain-text-value"
	result, err := decryptAPIKey(unencrypted, key)
	if err != nil {
		t.Errorf("decryptAPIKey should not error for unencrypted value: %v", err)
	}
	if result != unencrypted {
		t.Errorf("Expected original value returned, got '%s'", result)
	}
}

func TestIsEncrypted(t *testing.T) {
	testCases := []struct {
		value    string
		expected bool
	}{
		{"enc:abc123", true},
		{"enc:", false},
		{"", false},
		{"plain-text", false},
		{"enc:some-base64-encoded-value", true},
	}

	for _, tc := range testCases {
		result := isEncrypted(tc.value)
		if result != tc.expected {
			t.Errorf("isEncrypted('%s') = %v, expected %v", tc.value, result, tc.expected)
		}
	}
}

func TestEncryptWithInvalidKey(t *testing.T) {
	invalidKey := make([]byte, 15) // AES 不支持 15 字节

	_, err := encryptAPIKey("test-key", invalidKey)
	if err == nil {
		t.Error("Expected error for invalid key length (15 bytes)")
	}
}

func TestDecryptWithCorruptedData(t *testing.T) {
	key, _ := generateKey()

	corruptedValues := []string{
		"enc:not-valid-base64!!!",
		"enc:" + string(make([]byte, 10)),
		"enc:YWJj", // valid base64 but too short
	}

	for _, corrupted := range corruptedValues {
		_, err := decryptAPIKey(corrupted, key)
		if err == nil {
			t.Errorf("Expected error for corrupted data: '%s'", corrupted)
		}
	}
}

func TestLoadOrCreateKey(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "test_key")

	key1, err := loadOrCreateKey(keyPath)
	if err != nil {
		t.Fatalf("loadOrCreateKey failed: %v", err)
	}
	if len(key1) != keyLength {
		t.Errorf("Expected key length %d, got %d", keyLength, len(key1))
	}

	data, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("Failed to read key file: %v", err)
	}
	if len(data) == 0 {
		t.Error("Key file should not be empty")
	}

	key2, err := loadOrCreateKey(keyPath)
	if err != nil {
		t.Fatalf("loadOrCreateKey failed on second call: %v", err)
	}
	if string(key1) != string(key2) {
		t.Error("Same key should be returned on subsequent calls")
	}
}

func TestGetKeyPath(t *testing.T) {
	testCases := []struct {
		settingsPath string
		expected     string
	}{
		{filepath.Join("path", "to", "settings.json"), filepath.Join("path", "to", ".encryption_key")},
		{filepath.Join("C:", "Users", "test", "settings.json"), filepath.Join("C:", "Users", "test", ".encryption_key")},
		{"settings.json", ".encryption_key"},
	}

	for _, tc := range testCases {
		result := getKeyPath(tc.settingsPath)
		if result != tc.expected {
			t.Errorf("getKeyPath('%s') = '%s', expected '%s'", tc.settingsPath, result, tc.expected)
		}
	}
}

func TestEncryptionIntegration(t *testing.T) {
	tmpDir := t.TempDir()
	settingsPath := filepath.Join(tmpDir, "settings.json")
	keyPath := getKeyPath(settingsPath)

	key, err := loadOrCreateKey(keyPath)
	if err != nil {
		t.Fatalf("Failed to create key: %v", err)
	}

	settings := Settings{
		WorkMode: "daily",
		Theme:   "dark",
		APIKey:  "sk-secure-api-key-for-testing",
	}

	encryptedKey, err := encryptAPIKey(settings.APIKey, key)
	if err != nil {
		t.Fatalf("Failed to encrypt API key: %v", err)
	}
	settings.APIKey = encryptedKey

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal settings: %v", err)
	}

	err = os.WriteFile(settingsPath, data, 0600)
	if err != nil {
		t.Fatalf("Failed to write settings: %v", err)
	}

	var loadedSettings Settings
	readData, err := os.ReadFile(settingsPath)
	if err != nil {
		t.Fatalf("Failed to read settings: %v", err)
	}
	err = json.Unmarshal(readData, &loadedSettings)
	if err != nil {
		t.Fatalf("Failed to unmarshal settings: %v", err)
	}

	if !isEncrypted(loadedSettings.APIKey) {
		t.Error("API key should be encrypted in file")
	}

	decryptedKey, err := decryptAPIKey(loadedSettings.APIKey, key)
	if err != nil {
		t.Fatalf("Failed to decrypt API key: %v", err)
	}

	if decryptedKey != "sk-secure-api-key-for-testing" {
		t.Errorf("Decrypted key '%s' doesn't match original", decryptedKey)
	}
}

func TestBackwardCompatibilityMigration(t *testing.T) {
	tmpDir := t.TempDir()
	settingsPath := filepath.Join(tmpDir, "settings.json")

	unencryptedSettings := `{
		"work_mode": "daily",
		"theme": "dark",
		"api_key": "sk-old-unencrypted-key"
	}`

	err := os.WriteFile(settingsPath, []byte(unencryptedSettings), 0644)
	if err != nil {
		t.Fatalf("Failed to write unencrypted settings: %v", err)
	}

	app := &App{}
	app.settingsPath = settingsPath
	app.encryptionKey, _ = generateKey()
	app.loadSettings()

	if app.settings.APIKey != "sk-old-unencrypted-key" {
		t.Errorf("API key should be loaded as-is for migration, got '%s'", app.settings.APIKey)
	}

	if !migrationNeeded {
		t.Error("migrationNeeded should be set to true for unencrypted keys")
	}

	err = app.saveSettingsToFile()
	if err != nil {
		t.Fatalf("saveSettingsToFile failed: %v", err)
	}

	savedData, err := os.ReadFile(settingsPath)
	if err != nil {
		t.Fatalf("Failed to read saved settings: %v", err)
	}

	var savedSettings Settings
	err = json.Unmarshal(savedData, &savedSettings)
	if err != nil {
		t.Fatalf("Failed to unmarshal saved settings: %v", err)
	}

	if !isEncrypted(savedSettings.APIKey) {
		t.Error("After migration, API key should be encrypted in file")
	}
}

func TestMultipleEncryptDecryptCycles(t *testing.T) {
	key, _ := generateKey()
	originalKey := "sk-test-api-key-multiple-cycles"

	for i := 0; i < 10; i++ {
		encrypted, err := encryptAPIKey(originalKey, key)
		if err != nil {
			t.Fatalf("Cycle %d - encryption failed: %v", i, err)
		}

		decrypted, err := decryptAPIKey(encrypted, key)
		if err != nil {
			t.Fatalf("Cycle %d - decryption failed: %v", i, err)
		}

		if decrypted != originalKey {
			t.Errorf("Cycle %d - decrypted value doesn't match original", i)
		}
	}
}
