package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// createTestApp creates a test App instance (without Wails).
func createTestApp() *App {
	app := &App{
		sessions:  []*Session{},
		tasks:     []*Task{},
		skills:    []*Skill{},
		projects:  []Project{},
		llmConfig: DefaultLLMProviderConfig(),
	}
	return app
}

// setupTestDir creates a temporary test directory.
func setupTestDir(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(os.TempDir(), "codecast-test-"+time.Now().Format("20060102-150405.000"))
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("创建测试目录失败: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return dir
}
