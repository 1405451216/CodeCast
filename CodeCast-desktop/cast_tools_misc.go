package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"strings"

	ap "agentprimordia/pkg"
)

const (
	promptBrainstormSystem = `你是一位创意专家。根据用户给定的主题，从多个维度（技术/商业/用户/创新/风险/落地）生成不同视角的创意方案。

规则：
1. 每条创意独立成行，以 "1. xxx" 格式编号
2. 数量按用户要求（默认 5），不少于 3 不多于 10
3. 创意要具体、可执行，不要泛泛而谈
4. 输出仅含编号列表，不加解释`

	promptMinutesSystem = `你是会议纪要助手。根据对话/转录文本，提取结构化信息：
1. 简要 Summary（2-3 句话）
2. ActionItems（每条以 "- [负责人] 任务内容" 格式）
3. Decisions（已做出的决定）
不要添加原文没提到的内容。`
)

func registerMiscTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_brainstorm", "misc",
			"对主题生成多角度创意方案",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"topic": {"type": "string"},
					"count": {"type": "integer"}
				},
				"required": ["topic"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolBrainstorm(ctx, args)
			},
		),
		newCastTool("cast_meeting_minutes", "misc",
			"从会议转录中提取结构化纪要",
			json.RawMessage(`{
				"type": "object",
				"properties": {"transcript": {"type": "string"}},
				"required": ["transcript"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolMeetingMinutes(ctx, args)
			},
		),
		newCastTool("cast_ocr_image", "misc",
			"从图片提取文字（OCR 桩实现，需配置 Tesseract）",
			json.RawMessage(`{
				"type": "object",
				"properties": {"imagePath": {"type": "string"}},
				"required": ["imagePath"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolOCR(ctx, args)
			},
		),
		newCastTool("cast_password_gen", "misc",
			"生成安全密码",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"length":  {"type": "integer", "description": "默认 16"},
					"symbols": {"type": "boolean", "description": "是否包含特殊字符"}
				}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPasswordGen(ctx, args)
			},
		),
		newCastTool("cast_chart_generate", "misc",
			"从描述生成 Mermaid/PlantUML 图表代码",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"description": {"type": "string"},
					"format":      {"type": "string", "enum": ["mermaid","plantuml"]}
				},
				"required": ["description"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolChartGenerate(ctx, args)
			},
		),
		newCastTool("cast_format_convert", "misc",
			"JSON/YAML/XML/CSV 互转",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"from":  {"type": "string", "enum": ["json","yaml","xml","csv"]},
					"to":    {"type": "string", "enum": ["json","yaml","xml","csv"]},
					"input": {"type": "string"}
				},
				"required": ["from","to","input"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolFormatConvert(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolBrainstorm(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castBrainstormArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	count := in.Count
	if count <= 0 {
		count = 5
	}
	start := nowMs()
	content, err := a.castLLM(ctx, promptBrainstormSystem,
		fmt.Sprintf("Topic: %s\nCount: %d", in.Topic, count))
	if err != nil {
		return a.recordCastInvocation("cast_brainstorm", "misc", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castBrainstormResult{Ideas: parseNumberedList(content)}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_brainstorm", "misc", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolMeetingMinutes(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castMeetingMinutesArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	content, err := a.castLLM(ctx, promptMinutesSystem, in.Transcript)
	if err != nil {
		return a.recordCastInvocation("cast_meeting_minutes", "misc", "", args, err.Error(), true, nowMs()-start), nil
	}
	// 简单解析：按行扫描
	summary, actionItems, decisions := parseMinutes(content)
	out := castMeetingMinutesResult{Summary: summary, ActionItems: actionItems, Decisions: decisions}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_meeting_minutes", "misc", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolOCR(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castOCRArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	// OCR 桩实现：返回提示
	out := castOCRResult{Text: fmt.Sprintf("[OCR stub] Would extract text from: %s", in.ImagePath), Lang: "auto"}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_ocr_image", "misc", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPasswordGen(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPasswordGenArgs
	_ = json.Unmarshal(args, &in)
	length := in.Length
	if length < 8 {
		length = 16
	}
	if length > 128 {
		length = 128
	}
	charset := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	if in.Symbols {
		charset += "!@#$%^&*()-_=+[]{}|;:,.<>?"
	}
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return &ap.ToolResult{Content: err.Error(), IsError: true}, nil
	}
	pwd := make([]byte, length)
	for i, v := range b {
		pwd[i] = charset[int(v)%len(charset)]
	}
	out := castPasswordGenResult{Password: string(pwd)}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_password_gen", "misc", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolChartGenerate(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castChartGenArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	format := orDefault(in.Format, "mermaid")
	prompt := fmt.Sprintf("Generate a %s diagram.\nDescription: %s\n\nOutput only the diagram code, no explanation.",
		format, in.Description)
	start := nowMs()
	code, err := a.castLLM(ctx, "你是图表生成助手，只输出 Mermaid/PlantUML 代码。", prompt)
	if err != nil {
		return a.recordCastInvocation("cast_chart_generate", "misc", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castChartGenResult{Code: code}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_chart_generate", "misc", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolFormatConvert(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castFormatConvertArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	prompt := fmt.Sprintf("Convert the following %s to %s. Output only the converted result, no explanation.\n\n%s",
		in.From, in.To, in.Input)
	content, err := a.castLLM(ctx, "你是格式转换助手，精确转换数据格式不修改内容。", prompt)
	if err != nil {
		return a.recordCastInvocation("cast_format_convert", "misc", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castFormatConvertResult{Output: content}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_format_convert", "misc", "", args, string(outJSON), false, nowMs()-start), nil
}

func parseMinutes(text string) (summary string, actionItems []string, decisions []string) {
	section := ""
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		switch {
		case strings.HasPrefix(lower, "summary") || strings.HasPrefix(lower, "## summary"):
			section = "summary"
		case strings.HasPrefix(lower, "action") || strings.HasPrefix(lower, "## action"):
			section = "action"
		case strings.HasPrefix(lower, "decision") || strings.HasPrefix(lower, "## decision"):
			section = "decision"
		case strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "1.") || strings.HasPrefix(line, "•"):
			item := strings.TrimLeft(line, "- 1234567890. •\t")
			switch section {
			case "action":
				actionItems = append(actionItems, item)
			case "decision":
				decisions = append(decisions, item)
			}
		default:
			if section == "summary" && summary == "" {
				summary = line
			} else if section == "summary" {
				summary += " " + line
			}
		}
	}
	return
}

// 工具注册时间跟踪
var _ = fmt.Sprintf
