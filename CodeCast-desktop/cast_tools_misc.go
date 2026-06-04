package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

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

func registerMiscTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_brainstorm", "misc",
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
		newCastTool(a, "cast_meeting_minutes", "misc",
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
		newCastTool(a, "cast_ocr_image", "misc",
			"OCR 真实实现：读图片提取文字（需 Anthropic API Key）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"imagePath": {"type": "string", "description": "本地路径或 data:image/...;base64,..."},
					"prompt":    {"type": "string", "description": "提取指令，默认提取所有文字"},
					"lang":      {"type": "string", "description": "期望语言，如 zh/en/ja"},
					"model":     {"type": "string", "description": "覆盖默认 claude-sonnet-4-5"},
					"maxTokens": {"type": "integer", "description": "最大输出 token，默认 4096"}
				},
				"required": ["imagePath"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolOCR(ctx, args)
			},
		),
		newCastTool(a, "cast_password_gen", "misc",
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
		newCastTool(a, "cast_chart_generate", "misc",
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
		newCastTool(a, "cast_format_convert", "misc",
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
	if in.ImagePath == "" {
		return a.recordCastInvocation("cast_ocr_image", "misc", "", args,
			`{"text":"","lang":"","error":"imagePath is required"}`, true, 0), nil
	}

	start := nowMs()
	text, model, inTok, outTok, err := a.doOCR(ctx, in)
	if err != nil {
		return a.recordCastInvocation("cast_ocr_image", "misc", "", args,
			`{"text":"","error":"`+escapeJSON(err.Error())+`"}`, true, nowMs()-start), nil
	}

	out := castOCRResult{
		Text:  text,
		Lang:  in.Lang,
		Model: model,
	}
	out.Usage.InputTokens = inTok
	out.Usage.OutputTokens = outTok
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_ocr_image", "misc", "", args, string(outJSON), false, nowMs()-start), nil
}

// doOCR 真实实现：读图片 → base64 → 通过 AP MultimodalProvider 调 vision API → 提取文字
// 如果当前 Provider 不支持多模态，回退到原 HTTP 实现
func (a *App) doOCR(ctx context.Context, in castOCRArgs) (text, model string, inTok, outTok int, err error) {
	// 1. 读取图片
	imgData, mimeType, err := a.loadImageAsBase64(in.ImagePath)
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("load image: %w", err)
	}

	// 2. 构造 prompt
	prompt := in.Prompt
	if prompt == "" {
		prompt = "请提取这张图片中的所有文字，保持原始排版结构。如果是表格请用 Markdown 表格输出。"
	}
	if in.Lang != "" {
		prompt += "\n\n输出语言：" + in.Lang
	}

	maxTokens := in.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	// 3. 优先走 AP MultimodalProvider
	if a.multimodalProvider != nil && a.multimodalProvider.Capabilities().HasCapability(ap.CapVision) {
		req := &ap.CompletionRequestExt{
			Model:     in.Model,
			MaxTokens: maxTokens,
			Messages: []*ap.ChatMessageExt{
				ap.NewUserMultimodalMessage(
					ap.NewImageB64Content(imgData, mimeType),
					ap.NewTextContent(prompt),
				),
			},
		}
		ocrCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
		defer cancel()

		resp, mmErr := a.multimodalProvider.CompleteMultimodal(ocrCtx, req)
		if mmErr == nil {
			modelUsed := in.Model
			if resp.Model != "" {
				modelUsed = resp.Model
			}
			return resp.Content, modelUsed, resp.Usage.PromptTokens, resp.Usage.CompletionTokens, nil
		}
		slog.Warn("MultimodalProvider OCR failed, falling back to manual HTTP", "error", mmErr)
	}

	// 4. 回退：原始 HTTP 实现
	a.mu.RLock()
	creds, credsErr := a.resolveCredentialsLocked("")
	a.mu.RUnlock()
	if credsErr != nil || creds.APIKey == "" {
		return "", "", 0, 0, fmt.Errorf("API key not configured (Settings → API Key)")
	}

	providerID := ""
	if a.settings != nil {
		providerID = a.settings.LLMProvider
	}
	if providerID == "" {
		providerID = guessProviderForModel(creds.Model)
	}

	model = in.Model
	if model == "" {
		model = creds.Model
	}

	switch {
	case isAnthropicProvider(providerID):
		return doAnthropicVision(ctx, creds, model, prompt, imgData, mimeType, maxTokens)
	case isOpenAIVision(providerID, model):
		return doOpenAIVision(ctx, creds, model, prompt, imgData, mimeType, maxTokens)
	case isGeminiProvider(providerID):
		return doGeminiVision(ctx, creds, model, prompt, imgData, mimeType, maxTokens)
	default:
		return doOpenAIVision(ctx, creds, model, prompt, imgData, mimeType, maxTokens)
	}
}

// isOpenAIVision 检测 OpenAI 或 OpenAI 兼容 vision 模型
func isOpenAIVision(providerID, model string) bool {
	p := strings.ToLower(providerID)
	m := strings.ToLower(model)
	if strings.Contains(p, "openai") || strings.Contains(p, "gpt") {
		return true
	}
	// gpt-4o / gpt-4-vision / o1 都支持 vision
	return strings.HasPrefix(m, "gpt-4o") ||
		strings.HasPrefix(m, "gpt-4-vision") ||
		strings.Contains(m, "vision")
}

func isGeminiProvider(id string) bool {
	id = strings.ToLower(id)
	return strings.Contains(id, "gemini") || strings.Contains(id, "google")
}

// doAnthropicVision 调用 Anthropic Messages API
func doAnthropicVision(ctx context.Context, creds APICredentials, model, prompt, imgData, mimeType string, maxTokens int) (text, modelRet string, inTok, outTok int, err error) {
	baseURL := creds.APIURL
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	url := baseURL + "/v1/messages"

	reqBody := map[string]any{
		"model":      model,
		"max_tokens": maxTokens,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "image",
						"source": map[string]any{
							"type":       "base64",
							"media_type": mimeType,
							"data":       imgData,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	bodyJSON, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", creds.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
	if resp.StatusCode >= 400 {
		return "", "", 0, 0, fmt.Errorf("anthropic API %d: %s", resp.StatusCode, truncate(string(respBody), 200))
	}

	var ar struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &ar); err != nil {
		return "", "", 0, 0, fmt.Errorf("parse anthropic response: %w", err)
	}

	var textBuilder strings.Builder
	for _, c := range ar.Content {
		if c.Type == "text" {
			textBuilder.WriteString(c.Text)
		}
	}
	return textBuilder.String(), model, ar.Usage.InputTokens, ar.Usage.OutputTokens, nil
}

// doOpenAIVision 调用 OpenAI Chat Completions API（兼容所有 OpenAI 格式第三方）
func doOpenAIVision(ctx context.Context, creds APICredentials, model, prompt, imgData, mimeType string, maxTokens int) (text, modelRet string, inTok, outTok int, err error) {
	baseURL := creds.APIURL
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	url := baseURL + "/v1/chat/completions"

	// OpenAI 用 data URL 形式传图
	dataURL := "data:" + mimeType + ";base64," + imgData
	reqBody := map[string]any{
		"model": model,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "image_url",
						"image_url": map[string]any{
							"url": dataURL,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
		"max_tokens": maxTokens,
	}

	bodyJSON, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+creds.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
	if resp.StatusCode >= 400 {
		return "", "", 0, 0, fmt.Errorf("openai API %d: %s", resp.StatusCode, truncate(string(respBody), 200))
	}

	var ar struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &ar); err != nil {
		return "", "", 0, 0, fmt.Errorf("parse openai response: %w", err)
	}
	if len(ar.Choices) == 0 {
		return "", "", 0, 0, fmt.Errorf("openai returned no choices")
	}
	return ar.Choices[0].Message.Content, model, ar.Usage.PromptTokens, ar.Usage.CompletionTokens, nil
}

// doGeminiVision 调用 Google Gemini generateContent API
func doGeminiVision(ctx context.Context, creds APICredentials, model, prompt, imgData, mimeType string, maxTokens int) (text, modelRet string, inTok, outTok int, err error) {
	baseURL := creds.APIURL
	if baseURL == "" {
		baseURL = "https://generativelanguage.googleapis.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent", baseURL, model)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{
						"inline_data": map[string]any{
							"mime_type": mimeType,
							"data":      imgData,
						},
					},
					{
						"text": prompt,
					},
				},
			},
		},
		"generationConfig": map[string]any{
			"maxOutputTokens": maxTokens,
		},
	}

	bodyJSON, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", creds.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("gemini request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
	if resp.StatusCode >= 400 {
		return "", "", 0, 0, fmt.Errorf("gemini API %d: %s", resp.StatusCode, truncate(string(respBody), 200))
	}

	var ar struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount  int `json:"candidatesTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(respBody, &ar); err != nil {
		return "", "", 0, 0, fmt.Errorf("parse gemini response: %w", err)
	}
	if len(ar.Candidates) == 0 || len(ar.Candidates[0].Content.Parts) == 0 {
		return "", "", 0, 0, fmt.Errorf("gemini returned no content")
	}
	return ar.Candidates[0].Content.Parts[0].Text, model, ar.UsageMetadata.PromptTokenCount, ar.UsageMetadata.CandidatesTokenCount, nil
}

// loadImageAsBase64 读取本地文件或解析 data URL，返回 base64 字符串 + MIME。
// For local files, it checks that the path is within an allowed project directory.
func (a *App) loadImageAsBase64(path string) (data, mime string, err error) {
	// data URL: data:image/png;base64,xxxxx
	if strings.HasPrefix(path, "data:") {
		comma := strings.Index(path, ",")
		if comma < 0 {
			return "", "", fmt.Errorf("invalid data URL")
		}
		header := path[5:comma] // "image/png;base64"
		mime = strings.SplitN(header, ";", 2)[0]
		data = path[comma+1:]
		return data, mime, nil
	}

	// Local file: validate path is within allowed project directories
	if err := a.isPathAllowedBridge(path); err != nil {
		return "", "", fmt.Errorf("path not allowed: %w", err)
	}

	ext := strings.ToLower(path)
	if idx := strings.LastIndex(ext, "."); idx >= 0 {
		ext = ext[idx+1:]
	}
	mime = mimeFromExt(ext)
	if mime == "" {
		return "", "", fmt.Errorf("unsupported image extension: .%s", ext)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", "", fmt.Errorf("read file: %w", err)
	}
	return base64.StdEncoding.EncodeToString(raw), mime, nil
}

func mimeFromExt(ext string) string {
	switch ext {
	case "png":
		return "image/png"
	case "jpg", "jpeg":
		return "image/jpeg"
	case "gif":
		return "image/gif"
	case "webp":
		return "image/webp"
	default:
		return ""
	}
}

func isAnthropicProvider(id string) bool {
	id = strings.ToLower(id)
	return strings.Contains(id, "anthropic") || strings.Contains(id, "claude")
}

func escapeJSON(s string) string {
	b, _ := json.Marshal(s)
	// json.Marshal(s) returns a quoted JSON string like "\"foo\"",
	// strip the outer quotes so it can be embedded inside a larger JSON value.
	if len(b) >= 2 && b[0] == '"' && b[len(b)-1] == '"' {
		return string(b[1 : len(b)-1])
	}
	return string(b)
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
	// Rejection sampling to avoid modulo bias
	charsetLen := byte(len(charset))
	// maxAccept is the largest multiple of charsetLen that fits in a byte
	maxAccept := 256 - (256 % int(charsetLen))
	pwd := make([]byte, length)
	for i := 0; i < length; {
		randBytes := make([]byte, length-i)
		if _, err := rand.Read(randBytes); err != nil {
			return &ap.ToolResult{Content: err.Error(), IsError: true}, nil
		}
		for _, v := range randBytes {
			if int(v) < maxAccept {
				pwd[i] = charset[v%charsetLen]
				i++
				if i >= length {
					break
				}
			}
		}
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

