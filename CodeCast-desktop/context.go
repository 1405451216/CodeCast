package main

import (
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	DefaultTokenBudget    = 120000
	CompactionThreshold   = 30
	CompactionKeepRecent = 8
	maxContextUtilization = 0.7
)

type ContextPriority int

const (
	PriorityCritical ContextPriority = iota
	PriorityHigh
	PriorityMedium
	PriorityLow
)

type ContextSection struct {
	Content  string
	Priority ContextPriority
	Label    string
}

func (a *App) buildContextAssembly(session *Session, input string, longContext bool, systemPrompt string) []Message {
	sections := []ContextSection{
		{Content: systemPrompt, Priority: PriorityCritical, Label: "system"},
	}

	if a.memory != nil {
		if memCtx, err := a.memory.RecallEpisodes(input, 5); err == nil && memCtx != "" {
			sections = append(sections, ContextSection{
				Content: "【相关历史记忆（仅供参考，不必主动提及）】\n" + memCtx,
				Priority: PriorityHigh,
				Label:   "memory",
			})
		}
	}

	msgs := make([]Message, len(session.Messages))
	copy(msgs, session.Messages)

	historyLimit := a.settings.MessageHistoryLimit
	if historyLimit < 1 {
		historyLimit = 20
	}

	compacted := false
	if !longContext && len(msgs) > CompactionThreshold {
		compactedMsgs, summary := a.compactHistory(msgs, historyLimit)
		if summary != "" {
			sections = append(sections, ContextSection{
				Content: fmt.Sprintf("【对话摘要（早期内容已压缩）】\n%s", summary),
				Priority: PriorityMedium,
				Label:   "compaction",
			})
		}
		msgs = compactedMsgs
		compacted = true
	} else if !longContext && len(msgs) > historyLimit {
		msgs = msgs[len(msgs)-historyLimit:]
	}

	allMessages := []Message{{Role: "system", Content: a.assembleSections(sections)}}
	for _, msg := range msgs {
		allMessages = append(allMessages, msg)
	}

	if compacted {
		slog.Info("已压缩历史消息", "before", len(session.Messages), "after", len(msgs))
	}

	return allMessages
}

func (a *App) assembleSections(sections []ContextSection) string {
	ranked := make([]ContextSection, len(sections))
	copy(ranked, sections)
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].Priority < ranked[j].Priority
	})
	var parts []string
	for _, s := range ranked {
		parts = append(parts, s.Content)
	}
	return strings.Join(parts, "\n\n")
}

func estimateTokens(text string) int {
	runes := []rune(text)
	var tokens int
	for _, r := range runes {
		if r >= 0x4E00 && r <= 0x9FFF ||
			r >= 0x3400 && r <= 0x4DBF ||
			r >= 0x3000 && r <= 0x303F ||
			r >= 0xFF00 && r <= 0xFFEF {
			tokens += 1
		} else if r <= 127 {
			tokens += 1
		} else {
			tokens += 1
		}
	}
	if tokens == 0 {
		return utf8.RuneCountInString(text) * 3 / 2
	}
	asciiRatio := float64(countASCII(text)) / float64(len(runes))
	if asciiRatio > 0.8 {
		return len(runes) / 4
	}
	return tokens * 3 / 2
}

func countASCII(text string) int {
	n := 0
	for _, r := range text {
		if r <= 127 {
			n++
		}
	}
	return n
}

func (a *App) fitTokenBudget(sections []ContextSection, budget int) []ContextSection {
	total := 0
	for _, s := range sections {
		total += estimateTokens(s.Content)
	}

	if total <= budget {
		return sections
	}

	target := int(float64(budget) * maxContextUtilization)
	result := make([]ContextSection, 0, len(sections))

	for _, s := range sections {
		switch s.Priority {
		case PriorityCritical:
			result = append(result, s)
			target -= estimateTokens(s.Content)
		case PriorityHigh:
			if est := estimateTokens(s.Content); est <= target {
				result = append(result, s)
				target -= est
			} else {
				truncated := truncateToBudget(s.Content, target)
				result = append(result, ContextSection{Content: truncated, Priority: s.Priority, Label: s.Label})
				target = 0
			}
		case PriorityMedium:
			if target > 500 {
				truncated := truncateToBudget(s.Content, target/2)
				result = append(result, ContextSection{Content: truncated, Priority: s.Priority, Label: s.Label})
				target -= estimateTokens(truncated)
			}
		case PriorityLow:
			continue
		}
	}

	return result
}

func truncateToBudget(content string, tokenBudget int) string {
	charBudget := tokenBudget * 2 / 3
	if utf8.RuneCountInString(content) <= charBudget {
		return content
	}
	runes := []rune(content)
	if charBudget > len(runes) {
		charBudget = len(runes)
	}
	return string(runes[:charBudget]) + "\n... [内容已按 Token 预算裁剪]"
}

func (a *App) compactHistory(msgs []Message, keepRecent int) ([]Message, string) {
	if len(msgs) <= keepRecent*2 {
		if len(msgs) > keepRecent {
			return msgs[len(msgs)-keepRecent:], ""
		}
		return msgs, ""
	}

	splitPoint := len(msgs) - keepRecent
	oldMsgs := msgs[:splitPoint]
	recentMsgs := msgs[splitPoint:]

	summary := fallbackSummary(oldMsgs)
	return recentMsgs, summary
}

func (a *App) generateCompactionSummary(msgs []Message) string {
	a.mu.Lock()
	apiKey := a.settings.APIKey
	apiURL := a.llmConfig.APIURL
	modelName := a.config.Model.Model
	a.mu.Unlock()

	if apiKey == "" {
		return fallbackSummary(msgs)
	}

	var sb strings.Builder
	sb.WriteString("请将以下对话历史压缩为一段简洁的摘要。保留：\n")
	sb.WriteString("- 关键决策和结论\n- 用户明确的要求和偏好\n- 正在进行中的任务状态\n- 重要的事实信息\n")
	sb.WriteString("省略：重复的确认语、工具调用的详细输出、中间过程。输出摘要即可。\n\n--- 对话历史 ---\n")

	count := 0
	for _, m := range msgs {
		prefix := "用户"
		if m.Role == "assistant" {
			prefix = "助手"
		} else if m.Role == "system" {
			continue
		}
		content := m.Content
		if utf8.RuneCountInString(content) > 300 {
			runes := []rune(content)
			content = string(runes[:300]) + "...[截断]"
		}
		sb.WriteString(fmt.Sprintf("[%s] %s\n\n", prefix, content))
		count++
		if count >= 20 {
			sb.WriteString(fmt.Sprintf("... (省略 %d 条更早的消息)\n", len(msgs)-count))
			break
		}
	}

	flashModel := modelName
	if strings.Contains(modelName, "deepseek") {
		flashModel = "deepseek-v4-flash"
	} else if strings.Contains(modelName, "gpt") {
		flashModel = "gpt-4o-mini"
	}

	reqMessages := []Message{
		{Role: "system", Content: "你是一个专业的对话压缩助手。将长对话历史压缩为结构化摘要。只输出摘要内容，不要添加解释或元评论。"},
		{Role: "user", Content: sb.String()},
	}

	resp, err := a.callAPIEx(reqMessages, apiKey, apiURL, flashModel, false, false, "_compaction")
	if err != nil {
		slog.Warn("摘要生成失败，使用降级方案", "error", err)
		return fallbackSummary(msgs)
	}

	result := strings.TrimSpace(resp.Content)
	if utf8.RuneCountInString(result) > 800 {
		runes := []rune(result)
		result = string(runes[:800])
	}
	slog.Info("压缩完成", "msg_count", len(msgs), "summary_chars", utf8.RuneCountInString(result))
	return result
}

func fallbackSummary(msgs []Message) string {
	var decisions, tasks, facts []string
	count := 0
	for _, m := range msgs {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		content := strings.TrimSpace(m.Content)
		if content == "" || content == "..." {
			continue
		}
		runes := []rune(content)
		label := "用户"
		if m.Role == "assistant" {
			label = "助手"
		}
		snippet := content
		if len(runes) > 80 {
			snippet = string(runes[:80]) + "..."
		}
		facts = append(facts, fmt.Sprintf("%s: %s", label, snippet))
		count++
		if count >= 10 {
			break
		}
	}

	var parts []string
	if len(decisions) > 0 {
		parts = append(parts, "决策: "+strings.Join(decisions, "; "))
	}
	if len(tasks) > 0 {
		parts = append(parts, "进行中: "+strings.Join(tasks, "; "))
	}
	if len(facts) > 0 {
		parts = append(parts, "要点:\n"+strings.Join(facts, "\n"))
	}
	if len(parts) == 0 {
		return "(早期对话内容已压缩)"
	}
	return strings.Join(parts, "\n")
}
