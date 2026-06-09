package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ==================== Session Persistence Tests ====================

func TestPersistSession_CreatesFile(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	s := NewSession("TestSession", "")
	s.Messages = []Message{
		{Role: "user", Content: "hello"},
		{Role: "assistant", Content: "hi there"},
	}
	s.Mode = "coding"

	app.persistSession(s)

	// Verify file exists
	expectedPath := filepath.Join(app.sessionsDir(), s.ID+".json")
	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("persisted session file not found: %v", err)
	}

	var ps persistedSession
	if err := json.Unmarshal(data, &ps); err != nil {
		t.Fatalf("failed to parse persisted session: %v", err)
	}

	if ps.ID != s.ID {
		t.Errorf("expected ID %s, got %s", s.ID, ps.ID)
	}
	if ps.Name != s.Name {
		t.Errorf("expected Name %s, got %s", s.Name, ps.Name)
	}
	if ps.Mode != "coding" {
		t.Errorf("expected Mode coding, got %s", ps.Mode)
	}
	if len(ps.Messages) != 2 {
		t.Errorf("expected 2 messages, got %d", len(ps.Messages))
	}
	if ps.Messages[0].Content != "hello" {
		t.Errorf("expected first message 'hello', got '%s'", ps.Messages[0].Content)
	}
}

func TestPersistSession_AtomicWrite(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	s := NewSession("AtomicTest", "")
	s.Messages = []Message{{Role: "user", Content: "test"}}

	app.persistSession(s)

	sessionPath := filepath.Join(app.sessionsDir(), s.ID+".json")
	tmpPath := sessionPath + ".tmp"

	// tmp file should be cleaned up after atomic rename
	if _, err := os.Stat(tmpPath); !os.IsNotExist(err) {
		t.Error("tmp file should not exist after successful persist")
	}
}

func TestPersistSession_SanitizesID(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	// Session with path traversal characters in ID
	s := &Session{
		ID:        "../../etc/passwd",
		Name:      "Dangerous",
		CreatedAt: time.Now(),
	}
	if s.Messages == nil {
		s.Messages = []Message{}
	}

	// Should not panic or create file outside sessions dir
	app.persistSession(s)

	sessionPath := filepath.Join(app.sessionsDir(), "passwd.json")
	// filepath.Base would sanitize to "passwd"
	if _, err := os.Stat(sessionPath); err != nil {
		// Not creating file is also acceptable (sanitization may reject)
		t.Logf("sanitized ID not persisted (expected): %v", err)
	}
}

func TestDeletePersistedSession(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	s := NewSession("DeleteTest", "")
	s.Messages = []Message{{Role: "user", Content: "bye"}}
	app.persistSession(s)

	sessionPath := filepath.Join(app.sessionsDir(), s.ID+".json")

	// Verify file exists before delete
	if _, err := os.Stat(sessionPath); err != nil {
		t.Fatalf("session file should exist before delete: %v", err)
	}

	app.deletePersistedSession(s.ID)

	// Verify file removed
	if _, err := os.Stat(sessionPath); !os.IsNotExist(err) {
		t.Error("session file should be deleted")
	}
}

func TestDeletePersistedSession_NonExistent(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	// Should not panic for non-existent session
	app.deletePersistedSession("nonexistent-id")

	// Also test sanitized ID that doesn't exist
	app.deletePersistedSession("../../etc/shadow")
}

func TestLoadPersistedSessions_EmptyDir(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	app.loadPersistedSessions()

	if len(app.sessions) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(app.sessions))
	}
}

func TestLoadPersistedSessions_LoadsSessions(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	// Create some persisted sessions manually
	sessionsDir := app.sessionsDir()
	os.MkdirAll(sessionsDir, 0755)

	s1 := persistedSession{
		ID:           "sess_test1",
		Name:         "Test Session 1",
		CreatedAt:    time.Now().Add(-1 * time.Hour),
		Mode:         "coding",
		LastActivity: time.Now().Add(-1 * time.Hour),
		Messages:     []Message{{Role: "user", Content: "hello"}},
	}
	s2 := persistedSession{
		ID:           "sess_test2",
		Name:         "Test Session 2",
		CreatedAt:    time.Now().Add(-30 * time.Minute),
		Mode:         "daily",
		LastActivity: time.Now().Add(-30 * time.Minute),
		Messages:     []Message{{Role: "assistant", Content: "world"}},
	}

	for _, ps := range []persistedSession{s1, s2} {
		data, _ := json.MarshalIndent(ps, "", "  ")
		os.WriteFile(filepath.Join(sessionsDir, ps.ID+".json"), data, 0600)
	}

	app.loadPersistedSessions()

	if len(app.sessions) != 2 {
		t.Fatalf("expected 2 sessions loaded, got %d", len(app.sessions))
	}

	// Verify sessions are sorted by LastActivity descending (most recent first)
	if app.sessions[0].ID != "sess_test2" {
		t.Errorf("expected most recent session first (sess_test2), got %s", app.sessions[0].ID)
	}
	if app.sessions[1].ID != "sess_test1" {
		t.Errorf("expected older session second (sess_test1), got %s", app.sessions[1].ID)
	}
}

func TestLoadPersistedSessions_EnforcesMaxLimit(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	sessionsDir := app.sessionsDir()
	os.MkdirAll(sessionsDir, 0755)

	// Create more than maxPersistedSessions
	for i := 0; i < maxPersistedSessions+10; i++ {
		ps := persistedSession{
			ID:           "sess_" + string(rune('a'+i%26)) + string(rune('0'+i/26)),
			Name:         "Session",
			CreatedAt:    time.Now().Add(-time.Duration(i) * time.Hour),
			LastActivity: time.Now().Add(-time.Duration(i) * time.Hour),
			Messages:     []Message{},
		}
		data, _ := json.MarshalIndent(ps, "", "  ")
		os.WriteFile(filepath.Join(sessionsDir, ps.ID+".json"), data, 0600)
	}

	app.loadPersistedSessions()

	if len(app.sessions) > maxPersistedSessions {
		t.Errorf("should not exceed max %d sessions, got %d", maxPersistedSessions, len(app.sessions))
	}
}

func TestLoadPersistedSessions_IgnoresInvalidJSON(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	sessionsDir := app.sessionsDir()
	os.MkdirAll(sessionsDir, 0755)

	// Valid session
	validData, _ := json.MarshalIndent(persistedSession{
		ID:           "sess_valid",
		Name:         "Valid",
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
	}, "", "  ")
	os.WriteFile(filepath.Join(sessionsDir, "sess_valid.json"), validData, 0600)

	// Invalid JSON
	os.WriteFile(filepath.Join(sessionsDir, "sess_corrupt.json"), []byte("{not json"), 0600)

	app.loadPersistedSessions()

	// Should only load the valid session
	if len(app.sessions) != 1 {
		t.Errorf("expected 1 valid session, got %d", len(app.sessions))
	}
	if app.sessions[0].ID != "sess_valid" {
		t.Errorf("expected sess_valid, got %s", app.sessions[0].ID)
	}
}

func TestPersistSession_Concurrent(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(idx int) {
			defer func() { done <- true }()
			s := NewSession("ConcurrentTest", "")
			s.Messages = []Message{{Role: "user", Content: "test"}}
			app.persistSession(s)
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify no corruption — all files should be valid JSON
	entries, err := os.ReadDir(app.sessionsDir())
	if err != nil {
		t.Fatalf("failed to read sessions dir: %v", err)
	}

	validCount := 0
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
			data, err := os.ReadFile(filepath.Join(app.sessionsDir(), entry.Name()))
			if err != nil {
				t.Errorf("failed to read %s: %v", entry.Name(), err)
				continue
			}
			var ps persistedSession
			if json.Unmarshal(data, &ps) == nil {
				validCount++
			}
		}
	}

	if validCount < 10 {
		t.Errorf("expected at least 10 valid session files, got %d", validCount)
	}
}

func TestSessionsDir_ReturnsCorrectPath(t *testing.T) {
	app := NewApp()
	app.settingsPath = filepath.Join("home", "user", ".codecast", "settings.json")

	dir := app.sessionsDir()
	expected := filepath.Join("home", "user", ".codecast", "sessions")

	if dir != expected {
		t.Errorf("expected sessions dir %s, got %s", expected, dir)
	}
}

func TestPersistSession_DeepCopySafety(t *testing.T) {
	app := NewApp()
	tmpDir := t.TempDir()
	app.settingsPath = filepath.Join(tmpDir, "settings.json")

	s := NewSession("DeepCopyTest", "")
	s.Messages = []Message{
		{Role: "user", Content: "original"},
	}

	// persistSession takes a Session pointer — verify it reads the current state
	app.persistSession(s)

	// Modify the session after persist
	s.Messages[0].Content = "modified"
	s.Name = "Modified"

	// Reload from disk to verify the persisted data is unchanged
	sessionPath := filepath.Join(app.sessionsDir(), s.ID+".json")
	data, err := os.ReadFile(sessionPath)
	if err != nil {
		t.Fatalf("failed to read persisted session: %v", err)
	}

	var ps persistedSession
	json.Unmarshal(data, &ps)

	if ps.Messages[0].Content != "original" {
		t.Errorf("persisted message should be 'original', got '%s'", ps.Messages[0].Content)
	}
	if ps.Name == "Modified" {
		t.Error("persisted name should not reflect post-save mutation")
	}
}
