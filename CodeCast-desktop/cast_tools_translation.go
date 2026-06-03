package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

const (
	promptTranslationSystem = `你是一位专业翻译，擅长多语言互译、术语一致性和语境理解。

规则：
1. 严格按 Target 语言输出（Target 字段是语言代码或语言名）
2. 严格按 Style 调整译文（直译/意译/口语化/正式/学术）
3. 保持原文格式（Markdown 标记、列表、代码块）
4. 专业术语必须保持一致，不擅自翻译标准词汇（如 API、HTTP、Database）
5. 输出仅含译文，不加解释或前言`
)

func registerTranslationTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_translate_text", "translation",
			"翻译文本到目标语言，支持 5 种风格",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"text":   {"type": "string"},
					"target": {"type": "string", "description": "目标语言，如 zh/en/ja/ko/fr/de/es/ru/pt/it"},
					"style":  {"type": "string", "enum": ["literal","free","colloquial","formal","academic"]}
				},
				"required": ["text","target"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolTranslateText(ctx, args)
			},
		),
		newCastTool(a, "cast_translate_glossary", "translation",
			"添加术语表条目（保持关键术语翻译一致）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"term":  {"type": "string"},
					"trans": {"type": "string"}
				},
				"required": ["term","trans"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolTranslateGlossary(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolTranslateText(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castTranslateTextArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	style := orDefault(in.Style, "free")
	userPrompt := fmt.Sprintf("Target: %s\nStyle: %s\n\nText:\n%s", in.Target, style, in.Text)

	start := nowMs()
	content, err := a.castLLM(ctx, promptTranslationSystem, userPrompt)
	if err != nil {
		return a.recordCastInvocation("cast_translate_text", "translation", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castTranslateTextResult{Original: in.Text, Target: in.Target, Content: content}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_translate_text", "translation", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolTranslateGlossary(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castTranslateGlossaryArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	// 术语表存储到 AP Memory（用 RAGStore 也可）
	if a.memory != nil {
		_ = a.memory.Add(ctx, &ap.Episode{
			SessionID: "_glossary",
			Role:      string(ap.RoleSystem),
			Content:   fmt.Sprintf("glossary:%s=%s", in.Term, in.Trans),
		})
	}
	out := map[string]string{"term": in.Term, "translation": in.Trans, "status": "saved"}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_translate_glossary", "translation", "", args, string(outJSON), false, 0), nil
}
