package main

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
)

// castPersistentStore provides thread-safe JSON file persistence for cast tool data.
// It follows the same atomic-write pattern as persistence.go (tmp + rename, 0600 permissions).
type castPersistentStore[T any] struct {
	mu       sync.RWMutex
	data     T
	filePath string
}

// newCastStore creates a new persistent store. It loads existing data from disk
// or uses the provided initial value if no file exists yet.
func newCastStore[T any](basePath, name string, initial T) *castPersistentStore[T] {
	s := &castPersistentStore[T]{
		data:     initial,
		filePath: filepath.Join(basePath, name+".json"),
	}
	s.load()
	return s
}

func (s *castPersistentStore[T]) load() {
	b, err := os.ReadFile(s.filePath)
	if err != nil {
		return // First run — use initial value
	}
	if err := json.Unmarshal(b, &s.data); err != nil {
		slog.Warn("cast store: failed to parse, using defaults", "file", s.filePath, "error", err)
	}
}

// save writes data to disk using atomic write (tmp + rename) to prevent corruption.
func (s *castPersistentStore[T]) save() {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		slog.Warn("cast store: marshal failed", "file", s.filePath, "error", err)
		return
	}
	tmp := s.filePath + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		slog.Warn("cast store: write tmp failed", "file", tmp, "error", err)
		return
	}
	if err := os.Rename(tmp, s.filePath); err != nil {
		slog.Warn("cast store: rename failed", "file", s.filePath, "error", err)
		os.Remove(tmp)
	}
}

// Get reads data under RLock. The callback must not mutate the data.
func (s *castPersistentStore[T]) Get(fn func(T)) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	fn(s.data)
}

// Mutate acquires a write lock, runs the callback (which may mutate data), then saves.
func (s *castPersistentStore[T]) Mutate(fn func(T)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn(s.data)
	s.save()
}

// initCastStores initializes all persistent cast tool stores.
// Must be called once during App.startup(), after settingsDir is known.
func (a *App) initCastStores() {
	basePath := filepath.Join(filepath.Dir(a.settingsPath), "cast_data")
	os.MkdirAll(basePath, 0700)

	todoStore = newCastStore(basePath, "todos", map[string]*castTodoItem{})
	globalScheduleStore = newCastStore(basePath, "schedules", castScheduleTaskData{Tasks: map[string]*castScheduleTask{}})
	pluginStore = newCastStore(basePath, "plugins", map[string]*castPluginInfo{
		"weather":        {ID: "weather", Name: "Weather", Version: "1.0.0", Status: "active", Source: "builtin"},
		"json-tools":     {ID: "json-tools", Name: "JSON Tools", Version: "1.0.0", Status: "active", Source: "builtin"},
		"github-notifier": {ID: "github-notifier", Name: "GitHub Notifier", Version: "0.9.0", Status: "active", Source: "builtin"},
		"news-summarizer": {ID: "news-summarizer", Name: "News Summarizer", Version: "1.2.0", Status: "active", Source: "builtin"},
		"snippet-manager": {ID: "snippet-manager", Name: "Snippet Manager", Version: "0.5.0", Status: "active", Source: "builtin"},
		"unit-converter":  {ID: "unit-converter", Name: "Unit Converter", Version: "1.0.0", Status: "active", Source: "builtin"},
	})
	securityEventsStore = newCastStore(basePath, "security_events", []castSecurityEvent{})
	securityStatsStore = newCastStore(basePath, "security_stats", castSecurityStats{TopPatterns: map[string]int{}})
	learningPatternsStore = newCastStore(basePath, "learning_patterns", map[string]*castLearningPattern{})
	soulListStore = newCastStore(basePath, "soul_personas", []*castSoulPersona{
		{ID: "friendly", Name: "友好", Description: "亲切自然的对话风格", IsActive: false},
		{ID: "professional", Name: "专业", Description: "严谨专业的技术回答", IsActive: true},
		{ID: "concise", Name: "简洁", Description: "精炼要点式回答", IsActive: false},
		{ID: "detailed", Name: "详细", Description: "深入全面的解释和示例", IsActive: false},
	})

	// Sync soulList IsActive with settings.Personality
	if a.settings != nil && a.settings.Personality != "" {
		soulListStore.Mutate(func(list []*castSoulPersona) {
			for _, p := range list {
				p.IsActive = (p.ID == a.settings.Personality)
			}
		})
	}

	slog.Info("Cast persistent stores initialized", "path", basePath)
}
