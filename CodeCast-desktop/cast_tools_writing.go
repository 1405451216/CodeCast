package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

const (
	promptWritingSystem = `你是一位专业的中文写作助手。根据用户的文档类型、主题、风格要求，输出结构化、可直接使用的高质量内容。

规则：
1. 严格按用户指定的 DocType 决定格式（周报/方案/文案/总结/邮件/PPT大纲/简历/博客/其他）
2. 严格按 Style 选择语气（正式/轻松/学术/营销/技术/创意）
3. 严格按 Length 控制篇幅（短<500字/中500-1500字/长>1500字）
4. 如果用户给了 Outline，必须按大纲结构展开，不要自由发挥
5. 输出 Markdown 格式，标题用 # ## ###，列表用 - 1. 2. 3.
6. 不要解释，不要加前言后语，直接给内容`
)

func registerWritingTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_writing_generate", "writing",
			"生成结构化文档（周报/方案/文案/总结/邮件/PPT/简历/博客/其他）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"docType": {"type": "string", "description": "文档类型", "enum": ["weekly","plan","copy","summary","email","ppt","resume","blog","custom"]},
					"topic":   {"type": "string", "description": "主题/标题"},
					"style":   {"type": "string", "description": "写作风格", "enum": ["formal","casual","academic","marketing","technical","creative"]},
					"length":  {"type": "string", "description": "篇幅", "enum": ["short","medium","long"]},
					"outline": {"type": "string", "description": "可选大纲（Markdown）"}
				},
				"required": ["docType","topic"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWritingGenerate(ctx, args)
			},
		),
		newCastTool(a, "cast_writing_polish", "writing",
			"对已有文本进行润色/扩写/缩写/改写",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"text":   {"type": "string", "description": "原始文本"},
					"action": {"type": "string", "description": "操作", "enum": ["polish","expand","shorten","rewrite"]},
					"style":  {"type": "string", "description": "目标风格"}
				},
				"required": ["text","action"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWritingPolish(ctx, args)
			},
		),
		newCastTool(a, "cast_writing_outline", "writing",
			"为主题生成结构化大纲",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"topic":    {"type": "string"},
					"sections": {"type": "integer", "description": "章节数，默认 5"}
				},
				"required": ["topic"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolWritingOutline(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolWritingGenerate(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWritingGenerateArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	style := orDefault(in.Style, "formal")
	length := orDefault(in.Length, "medium")
	userPrompt := fmt.Sprintf("DocType: %s\nTopic: %s\nStyle: %s\nLength: %s\n",
		in.DocType, in.Topic, style, length)
	if in.Outline != "" {
		userPrompt += "\nOutline:\n" + in.Outline
	}

	start := nowMs()
	content, err := a.castLLM(ctx, promptWritingSystem, userPrompt)
	if err != nil {
		return a.recordCastInvocation("cast_writing_generate", "writing", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castWritingGenerateResult{Title: in.Topic, Content: content}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_writing_generate", "writing", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolWritingPolish(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWritingPolishArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	style := orDefault(in.Style, "formal")
	actionText := map[string]string{
		"polish":  "润色，保持原意，提升表达质量",
		"expand":  "扩写，保留核心信息，补充细节和例子",
		"shorten": "缩写，保留核心信息，删除冗余",
		"rewrite": "改写，重新组织结构，使用新的表达",
	}[in.Action]
	if actionText == "" {
		actionText = "润色"
	}
	userPrompt := fmt.Sprintf("Action: %s (%s)\nStyle: %s\n\nText:\n%s", in.Action, actionText, style, in.Text)

	start := nowMs()
	content, err := a.castLLM(ctx, promptWritingSystem, userPrompt)
	if err != nil {
		return a.recordCastInvocation("cast_writing_polish", "writing", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castWritingPolishResult{Content: content}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_writing_polish", "writing", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolWritingOutline(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castWritingOutlineArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	sections := in.Sections
	if sections <= 0 {
		sections = 5
	}
	userPrompt := fmt.Sprintf("Topic: %s\nSections: %d\n\nOutput a numbered list of %d section titles, no explanation.", in.Topic, sections, sections)

	start := nowMs()
	content, err := a.castLLM(ctx, promptWritingSystem, userPrompt)
	if err != nil {
		return a.recordCastInvocation("cast_writing_outline", "writing", "", args, err.Error(), true, nowMs()-start), nil
	}
	// 解析为数组
	outline := parseNumberedList(content)
	out := castWritingOutlineResult{Outline: outline}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_writing_outline", "writing", "", args, string(outJSON), false, nowMs()-start), nil
}
