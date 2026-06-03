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
	if a.notes != nil && session != nil {
		if ctx, err := a.notes.ToContextPrompt(session.ID); err == nil {
			notesContext = ctx
		}
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
`, PromptBase, modePrompt(mode)))

	result := tmpl.Execute(map[string]string{
		"ProjectPath":        projectPath,
		"Mode":               mode,
		"Personality":        personality,
		"CustomInstructions": customInstructions,
		"SkillPrompt":        skillPrompt,
		"NotesContext":       notesContext,
	})

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
