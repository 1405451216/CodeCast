package main

import (
	"fmt"

	ap "agentprimordia/pkg"
)

// buildSystemPrompt constructs the system prompt using AP PromptTemplate.
func (a *App) buildSystemPrompt(session *Session) string {
	mode := "coding"
	personality := "专业"
	notesContext := ""
	skillPrompt := ""
	customInstructions := ""
	projectPath := ""

	if session != nil && session.Mode == "daily" {
		mode = "daily"
	}
	if a.settings != nil {
		personality = a.settings.Personality
		customInstructions = a.settings.CustomInstructions
	}
	a.mu.RLock()
	if cp := a.getCurrentProjectLocked(); cp != nil {
		projectPath = cp.Path
	}
	a.mu.RUnlock()
	if a.castReg != nil {
		// 笔记上下文已通过 cast_kb_search 工具按需获取，无需自动注入
		_ = a.castReg
	}
	if session != nil && session.SkillID != "" {
		a.mu.RLock()
		for _, skill := range a.skills {
			if skill.ID == session.SkillID {
				skillPrompt = skill.Prompt
				break
			}
		}
		a.mu.RUnlock()
	}

	tmpl := ap.NewPromptTemplate(fmt.Sprintf(`%s

%s

## 项目信息
- 项目路径: {{.ProjectPath}}
- 对话模式: {{.Mode}}
- 个性设定: {{.Personality}}

{{if .CustomInstructions}}## 自定义指令
{{.CustomInstructions}}{{end}}

{{if .SkillPrompt}}## 技能提示
{{.SkillPrompt}}{{end}}

{{if .NotesContext}}## 笔记上下文
{{.NotesContext}}{{end}}

{{if .ToolCatalog}}## 可用 Cast 工具（共 {{.ToolCount}} 个）
你有以下 Cast AP 工具可在对话中调用。当用户请求匹配工具能力时，**主动调用工具**而不是用纯文本回答。

{{.ToolCatalog}}

调用规则：
1. 当用户请求涉及某个工具的能力（如"写周报"对应 cast_writing_generate）时，必须调用该工具
2. 参数从用户消息中提取；缺失时使用合理默认值
3. 调用后展示结果给用户，并解释结果
4. 如果不确定该用哪个工具，先问用户
5. 工具结果会显示在 ToolPanel 的"调用历史"中{{end}}
`, PromptBase, modePrompt(mode)))

	result, err := tmpl.
		WithVar("ProjectPath", projectPath).
		WithVar("Mode", mode).
		WithVar("Personality", personality).
		WithVar("CustomInstructions", customInstructions).
		WithVar("SkillPrompt", skillPrompt).
		WithVar("NotesContext", notesContext).
		WithVar("ToolCatalog", buildToolCatalogText(a)).
		WithVar("ToolCount", fmt.Sprintf("%d", len(a.GetToolCatalog()))).
		Render()
	if err != nil {
		// Fallback: return raw template if rendering fails
		return PromptBase + "\n\n" + modePrompt(mode)
	}

	return result
}

func modePrompt(mode string) string {
	switch mode {
	case "coding":
		return PromptCoding
	case "daily":
		return PromptDaily
	default:
		return PromptCoding
	}
}

// buildToolCatalogText 生成 Cast 工具目录文本（注入 system prompt）。
// 按类别分组，最多展示每个类别前 5 个 + 类别总数。
func buildToolCatalogText(a *App) string {
	catalog := a.GetToolCatalog()
	if len(catalog) == 0 {
		return ""
	}
	byCategory := map[string][]ToolCatalogItem{}
	for _, item := range catalog {
		byCategory[item.Category] = append(byCategory[item.Category], item)
	}
	categoryNames := map[string]string{
		"writing":     "写作",
		"translation": "翻译",
		"kb":          "知识库",
		"email":       "邮件",
		"schedule":    "日程",
		"todo":        "待办/番茄钟",
		"misc":        "工具箱",
		"plugin":      "插件",
		"sandbox":     "沙箱",
		"memory":      "记忆",
		"perf":        "性能",
		"learning":    "学习",
		"security":    "安全",
		"channel":     "通知",
		"collab":      "协作",
		"soul":        "人格",
		"marketplace": "市场",
	}
	out := ""
	// 固定顺序
	order := []string{"writing", "translation", "kb", "email", "schedule", "todo", "misc",
		"plugin", "sandbox", "memory", "perf", "learning", "security", "channel", "collab", "soul", "marketplace"}
	for _, cat := range order {
		items, ok := byCategory[cat]
		if !ok || len(items) == 0 {
			continue
		}
		label := categoryNames[cat]
		if label == "" {
			label = cat
		}
		out += fmt.Sprintf("### %s (%d)\n", label, len(items))
		limit := 5
		if len(items) < limit {
			limit = len(items)
		}
		for _, it := range items[:limit] {
			out += fmt.Sprintf("- **%s**: %s\n", it.Name, it.Description)
		}
		if len(items) > limit {
			out += fmt.Sprintf("- ... +%d 个\n", len(items)-limit)
		}
		out += "\n"
	}
	return out
}
