package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ==================== Notes System ====================

// Note represents a user-created note with optional tags.
type Note struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
	CreatedAt int64    `json:"created_at"`
	UpdatedAt int64    `json:"updated_at"`
}

// notesFilePath returns the path to the notes JSON file.
func (a *App) notesFilePath() string {
	return filepath.Join(filepath.Dir(a.settingsPath), "notes.json")
}

// loadNotes loads persisted notes from disk. Called at startup.
func (a *App) loadNotes() {
	path := a.notesFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return
		}
		slog.Warn("读取 notes 文件失败", "error", err)
		return
	}

	var notes []Note
	if err := json.Unmarshal(data, &notes); err != nil {
		slog.Warn("解析 notes 文件失败", "error", err)
		return
	}

	a.notes = notes
	slog.Info("已从磁盘恢复笔记", "count", len(notes))
}

// saveNotes persists all notes to disk atomically.
// Caller MUST hold a.mu.
func (a *App) saveNotesLocked() error {
	path := a.notesFilePath()
	data, err := json.MarshalIndent(a.notes, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 notes 失败: %w", err)
	}

	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("写入 notes 临时文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("重命名 notes 文件失败: %w", err)
	}
	return nil
}

// GetNotes returns all notes.
func (a *App) GetNotes() []Note {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]Note, len(a.notes))
	copy(result, a.notes)
	return result
}

// CreateNote creates a new note with the given title, content, and tags.
// Automatically persists to disk.
func (a *App) CreateNote(title, content string, tags []string) *Note {
	if tags == nil {
		tags = []string{}
	}

	now := time.Now().UnixMilli()
	note := Note{
		ID:        uuid.New().String(),
		Title:     title,
		Content:   content,
		Tags:      tags,
		CreatedAt: now,
		UpdatedAt: now,
	}

	a.mu.Lock()
	a.notes = append(a.notes, note)
	err := a.saveNotesLocked()
	a.mu.Unlock()

	if err != nil {
		slog.Warn("保存 notes 失败", "error", err)
	}
	return &note
}

// UpdateNote updates an existing note by ID.
// Automatically persists to disk.
func (a *App) UpdateNote(id, title, content string, tags []string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, note := range a.notes {
		if note.ID == id {
			a.notes[i].Title = title
			a.notes[i].Content = content
			a.notes[i].Tags = tags
			a.notes[i].UpdatedAt = time.Now().UnixMilli()
			if err := a.saveNotesLocked(); err != nil {
				slog.Warn("保存 notes 失败", "error", err)
			}
			return nil
		}
	}
	return fmt.Errorf("note not found: %s", id)
}

// DeleteNote deletes a note by ID.
// Automatically persists to disk.
func (a *App) DeleteNote(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, note := range a.notes {
		if note.ID == id {
			a.notes = append(a.notes[:i], a.notes[i+1:]...)
			if err := a.saveNotesLocked(); err != nil {
				slog.Warn("保存 notes 失败", "error", err)
			}
			return nil
		}
	}
	return fmt.Errorf("note not found: %s", id)
}

// SearchNotes searches notes by keyword in title and content using
// case-insensitive matching via Go standard library.
func (a *App) SearchNotes(keyword string) []Note {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if keyword == "" {
		result := make([]Note, len(a.notes))
		copy(result, a.notes)
		return result
	}

	keywordLower := strings.ToLower(keyword)
	var results []Note
	for _, note := range a.notes {
		if strings.Contains(strings.ToLower(note.Title), keywordLower) ||
			strings.Contains(strings.ToLower(note.Content), keywordLower) {
			results = append(results, note)
		}
	}
	return results
}
