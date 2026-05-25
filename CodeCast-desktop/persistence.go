package main

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maxPersistedSessions = 50

// persistedSession is the JSON-serializable representation of a Session.
type persistedSession struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	SkillID      string    `json:"skill_id,omitempty"`
	Mode         string    `json:"mode,omitempty"`
	Messages     []Message `json:"messages"`
	LastActivity time.Time `json:"last_activity"`
}

// sessionsDir returns the path to the sessions storage directory.
func (a *App) sessionsDir() string {
	return filepath.Join(filepath.Dir(a.settingsPath), "sessions")
}

// persistSession saves a single session to disk as a JSON file.
// It is safe to call from a goroutine.
func (a *App) persistSession(s *Session) {
	dir := a.sessionsDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		slog.Warn("创建 sessions 目录失败", "error", err, "dir", dir)
		return
	}

	ps := persistedSession{
		ID:           s.ID,
		Name:         s.Name,
		CreatedAt:    s.CreatedAt,
		SkillID:      s.SkillID,
		Mode:         s.Mode,
		Messages:     s.Messages,
		LastActivity: time.Now(),
	}

	data, err := json.MarshalIndent(ps, "", "  ")
	if err != nil {
		slog.Warn("序列化 session 失败", "error", err, "session_id", s.ID)
		return
	}

	filePath := filepath.Join(dir, s.ID+".json")
	// Write to temp file first, then rename for atomicity
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		slog.Warn("写入 session 文件失败", "error", err, "path", tmpPath)
		return
	}
	if err := os.Rename(tmpPath, filePath); err != nil {
		slog.Warn("重命名 session 文件失败", "error", err, "path", filePath)
		// Clean up tmp file on failure
		os.Remove(tmpPath)
		return
	}
}

// loadPersistedSessions loads all persisted sessions from disk at startup.
// If more than maxPersistedSessions exist, the oldest (by LastActivity) are deleted.
func (a *App) loadPersistedSessions() {
	dir := a.sessionsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return // No sessions directory yet — that's fine
		}
		slog.Warn("读取 sessions 目录失败", "error", err, "dir", dir)
		return
	}

	type loadedEntry struct {
		session      *Session
		lastActivity time.Time
		fileName     string
	}

	var loaded []loadedEntry

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(dir, entry.Name())
		data, readErr := os.ReadFile(filePath)
		if readErr != nil {
			slog.Warn("读取 session 文件失败", "error", readErr, "file", entry.Name())
			continue
		}

		var ps persistedSession
		if jsonErr := json.Unmarshal(data, &ps); jsonErr != nil {
			slog.Warn("解析 session 文件失败", "error", jsonErr, "file", entry.Name())
			continue
		}

		session := &Session{
			ID:        ps.ID,
			Name:      ps.Name,
			CreatedAt: ps.CreatedAt,
			SkillID:   ps.SkillID,
			Mode:      ps.Mode,
			Messages:  ps.Messages,
		}
		if session.Messages == nil {
			session.Messages = []Message{}
		}

		loaded = append(loaded, loadedEntry{
			session:      session,
			lastActivity: ps.LastActivity,
			fileName:     entry.Name(),
		})
	}

	if len(loaded) == 0 {
		return
	}

	// Sort by LastActivity descending (most recent first)
	sort.Slice(loaded, func(i, j int) bool {
		return loaded[i].lastActivity.After(loaded[j].lastActivity)
	})

	// Keep only the most recent maxPersistedSessions
	if len(loaded) > maxPersistedSessions {
		// Delete the excess (oldest) sessions from disk
		for _, excess := range loaded[maxPersistedSessions:] {
			excessPath := filepath.Join(dir, excess.fileName)
			if rmErr := os.Remove(excessPath); rmErr != nil {
				slog.Warn("删除过期 session 文件失败", "error", rmErr, "file", excess.fileName)
			}
		}
		loaded = loaded[:maxPersistedSessions]
		slog.Info("已清理超出上限的持久化 session", "kept", maxPersistedSessions)
	}

	// Load sessions into memory
	a.mu.Lock()
	defer a.mu.Unlock()

	// Build a set of existing session IDs to avoid duplicates
	existingIDs := make(map[string]bool, len(a.sessions))
	for _, s := range a.sessions {
		existingIDs[s.ID] = true
	}

	loadedCount := 0
	for _, entry := range loaded {
		if !existingIDs[entry.session.ID] {
			a.sessions = append(a.sessions, entry.session)
			loadedCount++
		}
	}

	if loadedCount > 0 {
		slog.Info("已从磁盘恢复 session", "count", loadedCount)
	}
}

// deletePersistedSession removes a session's JSON file from disk.
// It is safe to call from a goroutine.
func (a *App) deletePersistedSession(id string) {
	filePath := filepath.Join(a.sessionsDir(), id+".json")
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		slog.Warn("删除 session 文件失败", "error", err, "session_id", id)
	}
}
