package main

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type NotesStore struct {
	mu       sync.RWMutex
	notesDir string
}

type SessionNotes struct {
	SessionID    string    `json:"session_id"`
	ProjectPath  string    `json:"project_path"`
	CurrentTask  string    `json:"current_task"`
	Decisions    []string  `json:"decisions"`
	ModifiedFiles []string `json:"modified_files"`
	PendingIssues []string `json:"pending_issues"`
	NextSteps    []string  `json:"next_steps"`
	KeyFindings  string    `json:"key_findings"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func NewNotesStore(baseDir string) (*NotesStore, error) {
	dir := filepath.Join(baseDir, "notes")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建笔记目录失败: %w", err)
	}
	return &NotesStore{notesDir: dir}, nil
}

func (n *NotesStore) notesPath(sessionID string) string {
	return filepath.Join(n.notesDir, sessionID+".md")
}

func (n *NotesStore) Load(sessionID string) (*SessionNotes, error) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.loadLocked(sessionID)
}

func (n *NotesStore) loadLocked(sessionID string) (*SessionNotes, error) {

	path := n.notesPath(sessionID)
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &SessionNotes{
				SessionID: sessionID,
				UpdatedAt: time.Now(),
			}, nil
		}
		return nil, fmt.Errorf("打开笔记文件失败: %w", err)
	}
	defer f.Close()

	notes := &SessionNotes{SessionID: sessionID}
	scanner := bufio.NewScanner(f)
	currentSection := ""

	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "# 当前任务"):
			currentSection = "task"
		case strings.HasPrefix(line, "# 决策记录"):
			currentSection = "decisions"
		case strings.HasPrefix(line, "# 已修改文件"):
			currentSection = "files"
		case strings.HasPrefix(line, "# 待处理问题"):
			currentSection = "issues"
		case strings.HasPrefix(line, "# 下一步计划"):
			currentSection = "steps"
		case strings.HasPrefix(line, "# 关键发现"):
			currentSection = "findings"
		case strings.HasPrefix(line, "- ") && currentSection != "":
			item := strings.TrimPrefix(line, "- ")
			switch currentSection {
			case "task":
				notes.CurrentTask = item
			case "decisions":
				notes.Decisions = append(notes.Decisions, item)
			case "files":
				notes.ModifiedFiles = append(notes.ModifiedFiles, item)
			case "issues":
				notes.PendingIssues = append(notes.PendingIssues, item)
			case "steps":
				notes.NextSteps = append(notes.NextSteps, item)
			case "findings":
				notes.KeyFindings = item
			}
		}
	}
	notes.UpdatedAt = time.Now()
	return notes, nil
}

func (n *NotesStore) Save(notes *SessionNotes) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.saveLocked(notes)
}

func (n *NotesStore) saveLocked(notes *SessionNotes) error {

	var sb strings.Builder
	sb.WriteString("# CodeCast 工作笔记\n")
	sb.WriteString(fmt.Sprintf("> 会话: %s | 更新: %s\n\n", notes.SessionID, notes.UpdatedAt.Format("2006-01-02 15:04:05")))

	if notes.CurrentTask != "" {
		sb.WriteString(fmt.Sprintf("# 当前任务\n- %s\n\n", notes.CurrentTask))
	}
	if len(notes.Decisions) > 0 {
		sb.WriteString("# 决策记录\n")
		for _, d := range notes.Decisions {
			sb.WriteString(fmt.Sprintf("- %s\n", d))
		}
		sb.WriteString("\n")
	}
	if len(notes.ModifiedFiles) > 0 {
		sb.WriteString("# 已修改文件\n")
		for _, f := range notes.ModifiedFiles {
			sb.WriteString(fmt.Sprintf("- %s\n", f))
		}
		sb.WriteString("\n")
	}
	if len(notes.PendingIssues) > 0 {
		sb.WriteString("# 待处理问题\n")
		for _, i := range notes.PendingIssues {
			sb.WriteString(fmt.Sprintf("- %s\n", i))
		}
		sb.WriteString("\n")
	}
	if len(notes.NextSteps) > 0 {
		// 注意: ToContextPrompt 展示时使用编号格式 "1. xxx"，
		// 但存储格式统一使用 "- xxx" 前缀以保证 Load 解析一致性。
		sb.WriteString("# 下一步计划\n")
		for _, s := range notes.NextSteps {
			sb.WriteString(fmt.Sprintf("- %s\n", s))
		}
		sb.WriteString("\n")
	}
	if notes.KeyFindings != "" {
		sb.WriteString("# 关键发现\n")
		sb.WriteString(fmt.Sprintf("- %s\n", notes.KeyFindings))
	}

	path := n.notesPath(notes.SessionID)
	return os.WriteFile(path, []byte(sb.String()), 0644)
}

func (n *NotesStore) AddDecision(sessionID, decision string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	notes.Decisions = append(notes.Decisions, fmt.Sprintf("[%s] %s", time.Now().Format("15:04"), decision))
	if len(notes.Decisions) > 20 {
		notes.Decisions = notes.Decisions[len(notes.Decisions)-20:]
	}
	return n.saveLocked(notes)
}

func (n *NotesStore) AddModifiedFile(sessionID, filePath string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	for _, f := range notes.ModifiedFiles {
		if f == filePath {
			return nil
		}
	}
	notes.ModifiedFiles = append(notes.ModifiedFiles, filePath)
	return n.saveLocked(notes)
}

func (n *NotesStore) SetTask(sessionID, task string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	notes.CurrentTask = task
	return n.saveLocked(notes)
}

func (n *NotesStore) AddIssue(sessionID, issue string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	notes.PendingIssues = append(notes.PendingIssues, issue)
	return n.saveLocked(notes)
}

func (n *NotesStore) AddNextStep(sessionID, step string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	notes.NextSteps = append(notes.NextSteps, step)
	if len(notes.NextSteps) > 15 {
		notes.NextSteps = notes.NextSteps[len(notes.NextSteps)-15:]
	}
	return n.saveLocked(notes)
}

func (n *NotesStore) SetFinding(sessionID, finding string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	notes, err := n.loadLocked(sessionID)
	if err != nil {
		return err
	}
	notes.KeyFindings = finding
	return n.saveLocked(notes)
}

func (n *NotesStore) ToContextPrompt(sessionID string) (string, error) {
	notes, err := n.Load(sessionID)
	if err != nil {
		return "", err
	}

	if notes.CurrentTask == "" && len(notes.Decisions) == 0 && len(notes.ModifiedFiles) == 0 && len(notes.PendingIssues) == 0 && len(notes.NextSteps) == 0 {
		return "", nil
	}

	var sb strings.Builder
	sb.WriteString("【项目工作笔记（来自之前的对话）】\n")

	if notes.CurrentTask != "" {
		sb.WriteString(fmt.Sprintf("当前任务: %s\n", notes.CurrentTask))
	}
	if len(notes.Decisions) > 0 {
		sb.WriteString("已做决策:\n")
		for _, d := range notes.Decisions {
			sb.WriteString(fmt.Sprintf("  - %s\n", d))
		}
	}
	if len(notes.ModifiedFiles) > 0 {
		sb.WriteString("已修改文件:\n")
		for _, f := range notes.ModifiedFiles {
			sb.WriteString(fmt.Sprintf("  - %s\n", f))
		}
	}
	if len(notes.PendingIssues) > 0 {
		sb.WriteString("待处理:\n")
		for _, i := range notes.PendingIssues {
			sb.WriteString(fmt.Sprintf("  - %s\n", i))
		}
	}
	if len(notes.NextSteps) > 0 {
		sb.WriteString("后续步骤:\n")
		for i, s := range notes.NextSteps {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, s))
		}
	}
	if notes.KeyFindings != "" {
		sb.WriteString(fmt.Sprintf("关键发现: %s\n", notes.KeyFindings))
	}

	return sb.String(), nil
}

func (n *NotesStore) CleanupOld(maxAgeDays int) (int64, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	cutoff := time.Now().AddDate(0, 0, -maxAgeDays).Unix()
	var deleted int64

	filepath.Walk(n.notesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if info.ModTime().Unix() < cutoff && strings.HasSuffix(path, ".md") {
			if err := os.Remove(path); err == nil {
				deleted++
			}
		}
		return nil
	})

	if deleted > 0 {
		slog.Info("清理了过期笔记", "count", deleted, "max_age_days", maxAgeDays)
	}
	return deleted, nil
}
