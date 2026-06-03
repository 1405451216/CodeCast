package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	ap "agentprimordia/pkg"
	"github.com/google/uuid"
)

// ==================== Core Types ====================

type ToolCall struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Args string `json:"args"`
}

type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	Reasoning  string     `json:"reasoning,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type Skill struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
	Type        string `json:"type"`
	CreatedAt   int64  `json:"created_at"`
}

type Task struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Command     string `json:"command"`
	Schedule    string `json:"schedule"`
	Enabled     bool   `json:"enabled"`
	LastRun     int64  `json:"last_run"`
	NextRun     int64  `json:"next_run"`
	Status      string `json:"status"`
	LastError   string `json:"last_error"`
}

type Session struct {
	ID        string
	Name      string
	CreatedAt time.Time
	SkillID   string
	Mode      string // "" | "coding" | "daily"
	Messages  []Message
}

func NewSession(name string, skillID string) *Session {
	return &Session{
		ID:        "sess_" + uuid.New().String()[:8],
		Name:      name,
		CreatedAt: time.Now(),
		SkillID:   skillID,
		Mode:      "",
		Messages:  []Message{},
	}
}

func (s *Session) AddMessage(msg Message) {
	s.Messages = append(s.Messages, msg)
}

func deepCopySession(src *Session) *Session {
	cp := *src
	cp.Messages = make([]Message, len(src.Messages))
	for i, m := range src.Messages {
		cp.Messages[i] = m
	}
	return &cp
}

// ==================== Sessions CRUD ====================

func (a *App) GetSessions() []*Session {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]*Session, len(a.sessions))
	for i, s := range a.sessions {
		result[i] = deepCopySession(s)
	}
	return result
}

func (a *App) CreateSession(name, skillID, mode string) *Session {
	a.mu.Lock()
	defer a.mu.Unlock()

	session := NewSession(name, skillID)
	session.Mode = mode
	a.sessions = append(a.sessions, session)
	go a.persistSession(session)
	return deepCopySession(session)
}

func (a *App) GetSession(id string) *Session {
	a.mu.RLock()
	defer a.mu.RUnlock()

	for _, s := range a.sessions {
		if s.ID == id {
			return deepCopySession(s)
		}
	}
	return nil
}

func (a *App) DeleteSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.sessions {
		if s.ID == id {
			a.sessions = append(a.sessions[:i], a.sessions[i+1:]...)
			a.CancelSessionRequest(id)
			go a.deletePersistedSession(id)
			return nil
		}
	}
	return fmt.Errorf("session not found")
}

func (a *App) getSessionByID(id string) *Session {
	for _, s := range a.sessions {
		if s.ID == id {
			return deepCopySession(s)
		}
	}
	return nil
}

func (a *App) getSessionByIDLocked(id string) *Session {
	for _, s := range a.sessions {
		if s.ID == id {
			return s
		}
	}
	return nil
}

// ==================== Session Experience Enhancement ====================

func (a *App) SearchSessions(keyword string) []*Session {
	if keyword == "" {
		return a.GetSessions()
	}

	a.mu.RLock()
	defer a.mu.RUnlock()

	keyword = strings.ToLower(keyword)
	var result []*Session

	for _, s := range a.sessions {
		if matchesKeyword(s, keyword) {
			result = append(result, deepCopySession(s))
		}
	}
	return result
}

func matchesKeyword(s *Session, keyword string) bool {
	if strings.Contains(strings.ToLower(s.Name), keyword) {
		return true
	}
	for _, msg := range s.Messages {
		if strings.Contains(strings.ToLower(msg.Content), keyword) {
			return true
		}
	}
	return false
}

func (a *App) ExportSession(id, format string) (string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	session := a.getSessionByIDLocked(id)
	if session == nil {
		return "", fmt.Errorf("session not found: %s", id)
	}

	switch format {
	case "json":
		return a.exportSessionJSON(session)
	case "markdown", "":
		return a.exportSessionMarkdown(session), nil
	default:
		return a.exportSessionMarkdown(session), nil
	}
}

func (a *App) exportSessionJSON(s *Session) (string, error) {
	export := struct {
		ID        string    `json:"id"`
		Name      string    `json:"name"`
		CreatedAt time.Time `json:"created_at"`
		SkillID   string    `json:"skill_id,omitempty"`
		Mode      string    `json:"mode,omitempty"`
		Messages  []Message `json:"messages"`
	}{
		ID:        s.ID,
		Name:      s.Name,
		CreatedAt: s.CreatedAt,
		SkillID:   s.SkillID,
		Mode:      s.Mode,
		Messages:  s.Messages,
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to export session: %v", err)
	}
	return string(data), nil
}

func (a *App) exportSessionMarkdown(s *Session) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("# %s\n\n", s.Name))
	b.WriteString(fmt.Sprintf("- **ID**: %s\n", s.ID))
	b.WriteString(fmt.Sprintf("- **Created**: %s\n", s.CreatedAt.Format("2006-01-02 15:04:05")))
	if s.SkillID != "" {
		b.WriteString(fmt.Sprintf("- **Skill**: %s\n", s.SkillID))
	}
	if s.Mode != "" {
		b.WriteString(fmt.Sprintf("- **Mode**: %s\n", s.Mode))
	}
	b.WriteString("\n---\n\n")

	for _, msg := range s.Messages {
		role := msg.Role
		if role == "user" {
			role = "👤 User"
		} else if role == "assistant" {
			role = "🤖 Assistant"
		}
		b.WriteString(fmt.Sprintf("### %s\n\n%s\n\n", role, msg.Content))
	}

	return b.String()
}

func (a *App) RenameSession(id, newName string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range a.sessions {
		if s.ID == id {
			s.Name = newName
			go a.persistSession(s)
			return nil
		}
	}
	return fmt.Errorf("session not found")
}

func (a *App) GetSessionsByMode(mode string) []*Session {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []*Session
	for _, s := range a.sessions {
		effectiveMode := s.Mode
		if effectiveMode == "" {
			effectiveMode = "daily"
		}
		if effectiveMode == mode {
			result = append(result, deepCopySession(s))
		}
	}
	return result
}

func (a *App) BatchDeleteSessions(ids []string) []string {
	a.mu.Lock()
	defer a.mu.Unlock()

	var deleted []string
	for _, id := range ids {
		for i, s := range a.sessions {
			if s.ID == id {
				a.sessions = append(a.sessions[:i], a.sessions[i+1:]...)
				a.CancelSessionRequest(id)
				go a.deletePersistedSession(id)
				deleted = append(deleted, id)
				break
			}
		}
	}
	return deleted
}


// ==================== Cancel — AP sessionCancels ====================

func (a *App) CancelRequest() {
	a.mu.Lock()
	for id, cancel := range a.sessionCancels {
		cancel()
		delete(a.sessionCancels, id)
	}
	a.mu.Unlock()
}

func (a *App) CancelSessionRequest(sessionID string) {
	a.mu.Lock()
	if cancel, ok := a.sessionCancels[sessionID]; ok {
		cancel()
		delete(a.sessionCancels, sessionID)
	}
	a.mu.Unlock()
}
// ==================== Tool Event Bridge ====================
// emitToolEvent replaces the old recordToolIfEnabled. It publishes a tool-use
// event via the AP EventBus so the Memory and Metrics subsystems can consume it.

func (a *App) emitToolEvent(toolName, detail string) {
	if a.eventBus == nil {
		return
	}
	a.eventBus.PublishAsync(ap.Event{
		Type:    ap.EventToolCall,
		Source:  "system",
		Payload: map[string]string{
			"tool":   toolName,
			"detail": detail,
		},
	})
}

// ==================== Notes Recording ====================

func (a *App) recordNotesAsync(sessionID, userMsg, assistantMsg string) {
	if a.notes == nil {
		return
	}

	inputLower := strings.ToLower(userMsg)

	if strings.Contains(inputLower, "帮我写") || strings.Contains(inputLower, "实现") ||
		strings.Contains(inputLower, "添加") || strings.Contains(inputLower, "创建") {
		a.notes.SetTask(sessionID, truncateLine(userMsg, 100))
	}

	if strings.Contains(inputLower, "修改") || strings.Contains(inputLower, "改") ||
		strings.Contains(inputLower, "fix") || strings.Contains(inputLower, "修复") {
		a.notes.AddIssue(sessionID, truncateLine(userMsg, 100))
	}

	assistantLower := strings.ToLower(assistantMsg)
	if strings.Contains(assistantLower, "已完成") || strings.Contains(assistantLower, "修改了") ||
		strings.Contains(assistantLower, "创建了") || strings.Contains(assistantLower, "实现了") {
		a.notes.AddDecision(sessionID, truncateLine(assistantMsg, 150))
	}
}

func truncateLine(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}

// ==================== Skills ====================

func (a *App) GetSkills() []*Skill {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]*Skill, len(a.skills))
	for i, s := range a.skills {
		copy := *s
		result[i] = &copy
	}
	return result
}

func (a *App) CreateSkill(name, description, prompt string) (*Skill, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	skill := &Skill{
		ID:          "sk_" + uuid.New().String()[:8],
		Name:        name,
		Description: description,
		Prompt:      prompt,
		Type:        "custom",
		CreatedAt:   time.Now().Unix(),
	}

	a.skills = append(a.skills, skill)
	return skill, nil
}

func (a *App) DeleteSkill(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.skills {
		if s.ID == id && s.Type == "custom" {
			a.skills = append(a.skills[:i], a.skills[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("skill not found or cannot be deleted")
}

func (a *App) UpdateSkill(id, name, description, prompt string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range a.skills {
		if s.ID == id {
			s.Name = name
			s.Description = description
			s.Prompt = prompt
			return nil
		}
	}
	return fmt.Errorf("skill not found")
}

func (a *App) ImportSkill(jsonStr string) (*Skill, error) {
	var data struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Prompt      string `json:"prompt"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, fmt.Errorf("JSON 解析失败: %v", err)
	}
	if data.Name == "" {
		return nil, fmt.Errorf("技能名称不能为空")
	}
	if data.Prompt == "" {
		return nil, fmt.Errorf("技能 Prompt 不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	skill := &Skill{
		ID:          "sk_" + uuid.New().String()[:8],
		Name:        data.Name,
		Description: data.Description,
		Prompt:      data.Prompt,
		Type:        "custom",
		CreatedAt:   time.Now().Unix(),
	}
	a.skills = append(a.skills, skill)
	return skill, nil
}

func (a *App) initDefaultSkills() {
	a.skills = []*Skill{
		{
			ID:          "code_gen",
			Name:        "代码生成",
			Description: "帮助生成各种编程语言的代码",
			Prompt: `你是一个专业的代码生成助手。根据用户需求生成高质量、可维护的代码。

要求：
1. 先理解需求再写代码，必要时询问澄清
2. 代码要有清晰的命名和适当的注释
3. 提供完整的、可直接运行的代码片段
4. 考虑边界情况和错误处理
5. 如果涉及框架或库的使用，说明依赖关系
6. 优先使用现代语言特性和最佳实践`,
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
		{
			ID:          "code_review",
			Name:        "代码审查",
			Description: "审查代码并提供改进建议",
			Prompt: `你是一个资深代码审查专家。对用户提供的代码进行全面审查。

审查维度：
1. **正确性**: 逻辑错误、边界条件、竞态条件
2. **安全性**: 注入风险、敏感信息泄露、权限问题
3. **性能**: 算法复杂度、内存使用、I/O 效率
4. **可维护性**: 命名规范、代码结构、职责分离
5. **最佳实践**: 语言惯用法、设计模式应用

输出格式：
- 先给出总体评价（优点 + 需改进）
- 按严重程度排列问题（🔴严重 🟡建议 💡优化）
- 每个问题给出：位置、问题描述、修复建议代码`,
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
		{
			ID:          "doc_writer",
			Name:        "文档生成",
			Description: "生成技术文档和注释",
			Prompt: `你是一个技术文档专家。为代码生成清晰、专业的文档。

文档原则：
1. **准确性**: 文档必须与代码行为一致
2. **完整性**: 覆盖公共 API、关键算法、设计决策
3. **简洁性**: 避免冗余，每句话都有信息量
4. **结构化**: 使用标题、列表、表格组织信息

能生成的文档类型：
- API 文档（函数签名、参数说明、返回值、示例）
- 架构设计文档（模块关系、数据流、决策理由）
- README（项目介绍、快速开始、使用指南）
- 代码内联注释（复杂逻辑解释、TODO/FIXME 标记）
- 变更日志（按版本记录重要变更）`,
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
	}
}

