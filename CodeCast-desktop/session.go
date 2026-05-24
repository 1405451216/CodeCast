package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Core Types ====================

type Message struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"`
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

// ==================== cancelEntry 存储取消函数及其创建时间 ====================

type cancelEntry struct {
	cancel context.CancelFunc
	createdAt time.Time
}

var activeCancels = make(map[string]cancelEntry)
var cancelMu sync.Mutex

var cleanupStopCh = make(chan struct{})
var cleanupOnce sync.Once

const (
	maxCancelEntryAge = 30 * time.Minute
	cleanupInterval = 5 * time.Minute
	warnMapSizeThreshold = 100
	criticalMapSizeThreshold = 1000
)

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        50,
		MaxIdleConnsPerHost: 20,
		MaxConnsPerHost:     20,
		IdleConnTimeout:     90 * time.Second,
	},
}

func startCleanupGoroutine() {
	ticker := time.NewTicker(cleanupInterval)
	go func() {
		for {
			select {
			case <-ticker.C:
				cleanupExpiredEntries()
			case <-cleanupStopCh:
				ticker.Stop()
				return
			}
		}
	}()
}

func cleanupExpiredEntries() {
	cancelMu.Lock()
	defer cancelMu.Unlock()

	now := time.Now()
	expiredCount := 0
	var expiredIDs []string

	for id, entry := range activeCancels {
		if now.Sub(entry.createdAt) > maxCancelEntryAge {
			expiredIDs = append(expiredIDs, id)
		}
	}

	for _, id := range expiredIDs {
		if entry, ok := activeCancels[id]; ok {
			entry.cancel()
			delete(activeCancels, id)
			expiredCount++
		}
	}

	if expiredCount > 0 {
		slog.Info("已清理过期的活跃连接", "count", expiredCount)
	}

	checkAndLogMapSize(len(activeCancels))
}

func checkAndLogMapSize(size int) {
	switch {
	case size >= criticalMapSizeThreshold:
		slog.Warn("活跃连接数达到严重阈值，可能存在内存泄漏",
			"size", size, "threshold", criticalMapSizeThreshold)
	case size >= warnMapSizeThreshold:
		slog.Info("活跃连接数较高",
			"size", size, "warn_threshold", warnMapSizeThreshold)
	}
}

func getActiveCancelCount() int {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	return len(activeCancels)
}

// ==================== Sessions ====================

func (a *App) GetSessions() []*Session {
	a.mu.Lock()
	defer a.mu.Unlock()
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
	return deepCopySession(session)
}

func (a *App) GetSession(id string) *Session {
	a.mu.Lock()
	defer a.mu.Unlock()

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

// ==================== Cancel Request ====================

func (a *App) CancelRequest() {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	for id, entry := range activeCancels {
		entry.cancel()
		delete(activeCancels, id)
	}
}

func (a *App) CancelSessionRequest(sessionID string) {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	if entry, ok := activeCancels[sessionID]; ok {
		entry.cancel()
		delete(activeCancels, sessionID)
	}
}

// ==================== Message Handling / API Call ====================

func (a *App) SendMessage(sessionID, input string) ([]Message, error) {
	return a.SendMessageEx(sessionID, input, "deepseek-v4-flash", false)
}

func (a *App) SendMessageEx(sessionID, input, modelName string, thinking bool) ([]Message, error) {
	var (
		apiKey      string
		apiURL      string
		actualModel string
		longContext bool
	)

	a.mu.Lock()

	apiKey = a.settings.APIKey
	if apiKey == "" {
		apiKey = a.config.Model.APIKey
	}
	if apiKey == "" {
		a.mu.Unlock()
		return nil, fmt.Errorf("请先设置 API Key")
	}

	apiURL = a.llmConfig.APIURL
	if modelName == "" {
		modelName = a.llmConfig.Model
	}
	actualModel = modelName
	longContext = a.settings.LongContext

	session := a.getSessionByIDLocked(sessionID)
	if session == nil {
		session = NewSession("新对话", "")
		a.sessions = append(a.sessions, session)
		sessionID = session.ID
	}
	a.activeSessionID = sessionID

	session.AddMessage(Message{Role: "user", Content: input})

	systemPrompt := a.buildSystemPrompt(session)
	if session.Mode == "coding" {
		systemPrompt = a.injectToolDetails(systemPrompt, input)
	}

	allMessages := a.buildContextAssembly(session, input, longContext, systemPrompt)

	if a.notes != nil {
		if notesCtx, err := a.notes.ToContextPrompt(sessionID); err == nil && notesCtx != "" {
			allMessages = append([]Message{{Role: "system", Content: notesCtx}}, allMessages[1:]...)
		}
	}

	a.mu.Unlock()

	resp, err := a.callAPIEx(allMessages, apiKey, apiURL, actualModel, longContext, thinking, sessionID)
	if err != nil {
		return nil, err
	}

	a.saveResultToSession(sessionID, resp)
	a.saveMemoryAsync(sessionID, input, resp.Content)

	if a.notes != nil && session.Mode == "coding" {
		go a.recordNotesAsync(sessionID, input, resp.Content)
	}

	return []Message{resp}, nil
}

func (a *App) injectToolDetails(systemPrompt, userInput string) string {
	inputLower := strings.ToLower(userInput)
	needsReadFile := strings.Contains(inputLower, "读取") || strings.Contains(inputLower, "查看") ||
		strings.Contains(inputLower, "read") || strings.Contains(inputLower, "view") ||
		strings.Contains(inputLower, "list") || strings.Contains(inputLower, ".go") ||
		strings.Contains(inputLower, ".ts") || strings.Contains(inputLower, ".py") ||
		strings.Contains(inputLower, "文件内容")
	needsWriteFile := strings.Contains(inputLower, "写") || strings.Contains(inputLower, "修改") ||
		strings.Contains(inputLower, "编辑") || strings.Contains(inputLower, "创建") ||
		strings.Contains(inputLower, "write") || strings.Contains(inputLower, "edit") ||
		strings.Contains(inputLower, "create") || strings.Contains(inputLower, "file")
	needsCommand := strings.Contains(inputLower, "运行") || strings.Contains(inputLower, "执行") ||
		strings.Contains(inputLower, "编译") || strings.Contains(inputLower, "测试") ||
		strings.Contains(inputLower, "安装") || strings.Contains(inputLower, "build") ||
		strings.Contains(inputLower, "test") || strings.Contains(inputLower, "install") ||
		strings.Contains(inputLower, "run") || strings.Contains(inputLower, "npm") ||
		strings.Contains(inputLower, "git ") || strings.Contains(inputLower, "命令")
	needsAgents := strings.Contains(inputLower, "并行") || strings.Contains(inputLower, "同时") ||
		strings.Contains(inputLower, "多个") || strings.Contains(inputLower, "dispatch") ||
		strings.Contains(inputLower, "agent")

	var details string
	if needsReadFile {
		details += ToolDetailReadFile
	}
	if needsWriteFile {
		details += ToolDetailWriteFile
	}
	if needsCommand {
		details += ToolDetailCommand
	}
	if needsAgents {
		details += ToolDetailAgents
	}

	if details != "" {
		systemPrompt += details
	}
	return systemPrompt
}

func (a *App) recordNotesAsync(sessionID, userMsg, assistantMsg string) {
	defer func() {
		if r := recover(); r != nil {
			slog.Warn("笔记记录异常恢复", "recover", r)
		}
	}()

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

func (a *App) buildSystemPrompt(session *Session) string {
	var modePrompt string

	effectiveMode := session.Mode
	if effectiveMode == "" {
		effectiveMode = a.settings.WorkMode
	}

	if effectiveMode == "coding" {
		modePrompt = PromptCoding
	} else {
		modePrompt = PromptDaily
	}

	systemPrompt := PromptBase + "\n\n" + modePrompt

	if cp := a.getCurrentProjectLocked(); cp != nil {
		systemPrompt += fmt.Sprintf("\n\n【当前项目】\n项目名称: %s\n项目路径: %s\n所有文件操作默认基于此项目目录。", cp.Name, cp.Path)
	} else {
		systemPrompt += "\n\n【当前项目】\n未指定项目。"
	}

	switch a.settings.Personality {
	case "friendly":
		systemPrompt += "\n\n【个性化风格】\n请用轻松友好、热情的语气回复用户。可以适当使用表情符号和口语化表达，让对话更自然。"
	case "professional":
		systemPrompt += "\n\n【个性化风格】\n请保持专业严谨的语气。回答要结构化、准确、简洁，使用正式的表达方式。"
	case "concise":
		systemPrompt += "\n\n【个性化风格】\n请尽可能简洁地回答。直接给出核心信息，避免冗余说明。代码优先于文字解释。"
	case "detailed":
		systemPrompt += "\n\n【个性化风格】\n请提供详尽完整的回答。包含背景知识、多种方案对比、注意事项等。代码要有充分的注释。"
	default:
		systemPrompt += "\n\n【个性化风格】\n使用默认风格，遵循系统提示词中的交互规范。"
	}

	if a.settings.CustomInstructions != "" {
		systemPrompt += "\n\n【用户自定义指令】\n" + a.settings.CustomInstructions
	} else {
		systemPrompt += "\n\n【用户自定义指令】\n无。"
	}

	if session.SkillID != "" {
		for _, skill := range a.skills {
			if skill.ID == session.SkillID {
				systemPrompt = skill.Prompt
				break
			}
		}
	}

	return systemPrompt
}

func (a *App) buildMessageSequence(session *Session, input string, longContext bool, systemPrompt string) []Message {
	allMessages := []Message{
		{Role: "system", Content: systemPrompt},
	}

	msgs := make([]Message, len(session.Messages))
	copy(msgs, session.Messages)

	limit := a.settings.MessageHistoryLimit
	if limit < 1 {
		limit = 20
	}
	if !longContext && len(msgs) > limit {
		msgs = msgs[len(msgs)-limit:]
	}
	for _, msg := range msgs {
		allMessages = append(allMessages, msg)
	}

	if a.memory != nil {
		memoryContext, err := a.memory.RecallEpisodes(input, 5)
		if err == nil && memoryContext != "" {
			allMessages = append(allMessages, Message{
				Role:    "system",
				Content: "【相关历史记忆（仅供参考，不必主动提及）】\n" + memoryContext,
			})
		}
	}

	return allMessages
}

func (a *App) saveResultToSession(sessionID string, resp Message) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if saveSession := a.getSessionByIDLocked(sessionID); saveSession != nil {
		saveSession.AddMessage(resp)
	}
}

func (a *App) saveMemoryAsync(sessionID, userIn, assistContent string) {
	if a.memory == nil || assistContent == "" {
		return
	}
	go func(sid, uIn, aContent string) {
		if _, err := a.memory.SaveEpisode(sid, "user", uIn); err != nil {
			slog.Error("保存用户消息失败", "error", err)
		}
		if _, err := a.memory.SaveEpisode(sid, "assistant", aContent); err != nil {
			slog.Error("保存AI回复失败", "error", err)
		}
		if a.settings.AutoMemory || len(uIn) > 20 {
			a.ExtractSummaryAsync(sid, uIn, aContent)
		}
	}(sessionID, userIn, assistContent)
}

func (a *App) callAPI(messages []Message, apiKey, apiURL, modelName string, longContext bool) (Message, error) {
	return a.callAPIEx(messages, apiKey, apiURL, modelName, longContext, false, "_default")
}

func (a *App) callAPIEx(messages []Message, apiKey, apiURL, modelName string, longContext bool, thinking bool, sessionID string) (Message, error) {
	reqBody := map[string]any{
		"model":    modelName,
		"messages": messages,
		"stream":   true,
	}

	if longContext {
		reqBody["max_tokens"] = DefaultMaxTokensLongCtx
	} else {
		reqBody["max_tokens"] = DefaultMaxTokensNormal
	}

	if thinking {
		reqBody["thinking"] = true
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return Message{}, fmt.Errorf("序列化请求失败: %v", err)
	}

	timeout := 120 * time.Second
	if longContext {
		timeout = 600 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)

	cancelMu.Lock()
	if len(activeCancels) > criticalMapSizeThreshold {
		now := time.Now()
		for id, entry := range activeCancels {
			if now.Sub(entry.createdAt) > maxCancelEntryAge {
				entry.cancel()
				delete(activeCancels, id)
			}
		}
	}
	activeCancels[sessionID] = cancelEntry{
		cancel:     cancel,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	defer func() {
		cancelMu.Lock()
		delete(activeCancels, sessionID)
		cancelMu.Unlock()
		cancel()
	}()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL+"/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return Message{}, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return Message{}, fmt.Errorf("request cancelled")
		}
		return Message{}, err
	}
	defer resp.Body.Close()

	// 非流式响应回退（某些 API 不支持 stream）
	if resp.Header.Get("Content-Type") != "" && !strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		respBody, err := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
		if err != nil {
			return Message{}, fmt.Errorf("读取响应失败: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			return Message{}, fmt.Errorf("API 请求失败 (HTTP %d): %s", resp.StatusCode, string(respBody))
		}
		var result map[string]any
		if err := json.Unmarshal(respBody, &result); err != nil {
			return Message{}, fmt.Errorf("failed to parse response: %v", err)
		}
		choices, ok := result["choices"].([]any)
		if !ok || len(choices) == 0 {
			return Message{}, fmt.Errorf("no response from model")
		}
		choice, ok := choices[0].(map[string]any)
		if !ok {
			return Message{}, fmt.Errorf("invalid response format")
		}
		msg, ok := choice["message"].(map[string]any)
		if !ok {
			return Message{}, fmt.Errorf("no message in response")
		}
		content, _ := msg["content"].(string)
		reasoning, _ := msg["reasoning_content"].(string)
		return Message{Role: "assistant", Content: content, Reasoning: reasoning}, nil
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
		return Message{}, fmt.Errorf("API 请求失败 (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	// 流式 SSE 解析
	var contentBuilder strings.Builder
	var reasoningBuilder strings.Builder
	eventName := "stream:" + sessionID

	// 通知前端流式开始
	wailsRuntime.EventsEmit(a.ctx, eventName, map[string]interface{}{
		"type": "start",
	})

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 512*1024)

	for scanner.Scan() {
		line := scanner.Text()

		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk map[string]any
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		choices, ok := chunk["choices"].([]any)
		if !ok || len(choices) == 0 {
			continue
		}
		choice, ok := choices[0].(map[string]any)
		if !ok {
			continue
		}
		delta, ok := choice["delta"].(map[string]any)
		if !ok {
			continue
		}

		// 处理思考内容（DeepSeek reasoning_content）
		if rc, ok := delta["reasoning_content"].(string); ok && rc != "" {
			reasoningBuilder.WriteString(rc)
			wailsRuntime.EventsEmit(a.ctx, eventName, map[string]interface{}{
				"type":    "reasoning",
				"content": rc,
			})
		}

		// 处理正文内容
		if c, ok := delta["content"].(string); ok && c != "" {
			contentBuilder.WriteString(c)
			wailsRuntime.EventsEmit(a.ctx, eventName, map[string]interface{}{
				"type":    "content",
				"content": c,
			})
		}
	}

	// 通知前端流式结束
	wailsRuntime.EventsEmit(a.ctx, eventName, map[string]interface{}{
		"type": "done",
	})

	return Message{
		Role:      "assistant",
		Content:   contentBuilder.String(),
		Reasoning: reasoningBuilder.String(),
	}, nil
}

// ==================== Skills ====================

func (a *App) GetSkills() []*Skill {
	a.mu.Lock()
	defer a.mu.Unlock()
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

// ==================== Memory Helpers ====================

func (a *App) ResetMemory() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.settings.CustomInstructions = ""
	a.settings.AutoMemory = false
	a.settings.ToolMemory = false
	if a.memory != nil {
		if err := a.memory.ClearAll(); err != nil {
			return fmt.Errorf("清空记忆失败: %v", err)
		}
	}
	return a.saveSettingsToFile()
}

func (a *App) GetMemoryStats() map[string]interface{} {
	result := map[string]interface{}{
		"enabled":       a.memory != nil,
		"totalEpisodes": 0,
		"dbSize":       "0 B",
	}

	if a.memory != nil {
		totalEpisodes, dbSize, err := a.memory.Stats()
		if err == nil {
			result["totalEpisodes"] = totalEpisodes
			result["dbSize"] = formatFileSize(dbSize)
		}
	}

	return result
}

func (a *App) ClearMemory() error {
	if a.memory != nil {
		if err := a.memory.ClearAll(); err != nil {
			return fmt.Errorf("清空记忆数据失败: %v", err)
		}
		slog.Info("记忆数据已清空")
	}
	return nil
}

func (a *App) recordToolIfEnabled(sessionID, toolName, detail string) {
	if !a.settings.ToolMemory || a.memory == nil || sessionID == "" {
		return
	}
	go func() {
		if err := a.memory.RecordToolUse(sessionID, toolName, detail); err != nil {
			slog.Error("记录工具操作失败", "error", err, "tool", toolName)
		}
	}()
}

// ==================== Sub-Agent Dispatch ====================

func (a *App) DispatchAgents(tasksJSON string) ([]string, error) {
	var input struct {
		Tasks []struct {
			Title      string   `json:"title"`
			Prompt     string   `json:"prompt"`
			FilesScope []string `json:"files_scope"`
		} `json:"tasks"`
		Mode string `json:"mode"`
	}

	if err := json.Unmarshal([]byte(tasksJSON), &input); err != nil {
		return nil, fmt.Errorf("参数解析失败: %v", err)
	}

	if len(input.Tasks) == 0 {
		return nil, fmt.Errorf("至少需要一个子任务")
	}

	// Layer 1 + 3: Validate files_scope — no overlap, at most 1 global writer
	scopes := make([][]string, len(input.Tasks))
	for i, t := range input.Tasks {
		scopes[i] = t.FilesScope
	}
	if err := ValidateFilesScopes(scopes); err != nil {
		return nil, fmt.Errorf("files_scope 冲突校验失败: %v", err)
	}

	mode := AgentModeExplicit
	if input.Mode == "implicit" {
		mode = AgentModeImplicit
	}

	a.mu.Lock()
	sessionID := a.activeSessionID
	a.mu.Unlock()

	var agentIDs []string
	for _, task := range input.Tasks {
		agent := &SubAgent{
			ID:         uuid.New().String(),
			SessionID:  sessionID,
			Title:      task.Title,
			Prompt:     task.Prompt,
			FilesScope: task.FilesScope,
			MaxTurns:   DefaultMaxTurns,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
			Mode:       mode,
		}

		a.agentPool.Submit(agent)
		agentIDs = append(agentIDs, agent.ID)
	}

	return agentIDs, nil
}

func (a *App) GetAgents(sessionID string) []*SubAgent {
	if a.agentPool == nil {
		return nil
	}

	agents := a.agentPool.GetAgentsBySession(sessionID)
	if len(agents) > 0 {
		return agents
	}

	persisted, err := listAgentsBySession(sessionID)
	if err != nil {
		slog.Error("加载持久化 agents 失败", "error", err)
		return nil
	}
	return persisted
}

func (a *App) GetAgentDetail(agentID string) *SubAgent {
	if a.agentPool == nil {
		return nil
	}
	return a.agentPool.GetAgent(agentID)
}

func (a *App) CancelAgent(agentID string) error {
	if a.agentPool == nil {
		return fmt.Errorf("agent pool 未初始化")
	}
	a.agentPool.Cancel(agentID)
	return nil
}

func (a *App) CancelSessionAgents(sessionID string) error {
	if a.agentPool == nil {
		return fmt.Errorf("agent pool 未初始化")
	}
	a.agentPool.CancelBySession(sessionID)
	return nil
}
