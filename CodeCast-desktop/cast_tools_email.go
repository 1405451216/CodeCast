package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/smtp"

	ap "agentprimordia/pkg"
)

const (
	promptEmailSystem = `你是一位专业邮件撰写助手。根据用户提供的信息生成正式/友好/紧急/歉意等不同语气的邮件正文。

规则：
1. 严格按 Tone 选择语气
2. 称呼和落款根据收件人自动判断
3. 保持专业、简洁、礼貌
4. Markdown 格式：主题用 Subject: 开头，正文段落之间空行
5. 输出仅含邮件内容，不加解释`
)

func registerEmailTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_email_draft", "email",
			"起草邮件（不发送）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"to":      {"type": "string"},
					"subject": {"type": "string"},
					"body":    {"type": "string", "description": "要点或草稿"},
					"tone":    {"type": "string", "enum": ["formal","friendly","urgent","apologetic"]}
				},
				"required": ["to","subject","body"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolEmailDraft(ctx, args)
			},
		),
		newCastTool(a, "cast_email_send", "email",
			"通过 SMTP 发送邮件（需要先在 settings 配置 SMTP）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"to":      {"type": "string"},
					"subject": {"type": "string"},
					"body":    {"type": "string"}
				},
				"required": ["to","subject","body"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolEmailSend(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolEmailDraft(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castEmailDraftArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	tone := orDefault(in.Tone, "formal")
	userPrompt := fmt.Sprintf("To: %s\nTone: %s\n\nBody:\n%s", in.To, tone, in.Body)

	start := nowMs()
	content, err := a.castLLM(ctx, promptEmailSystem, userPrompt)
	if err != nil {
		return a.recordCastInvocation("cast_email_draft", "email", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castEmailDraftResult{Subject: in.Subject, Body: content}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_email_draft", "email", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolEmailSend(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castEmailSendArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	// 从 settings 取 SMTP 配置
	if a.settings == nil {
		return a.recordCastInvocation("cast_email_send", "email", "", args, "settings not initialized", true, 0), nil
	}
	host := a.settings.SMTPHost
	port := a.settings.SMTPPort
	user := a.settings.SMTPUser
	pass := a.settings.SMTPPass
	if host == "" || user == "" {
		return a.recordCastInvocation("cast_email_send", "email", "", args,
			"SMTP not configured (Settings → SMTP)", true, 0), nil
	}

	auth := smtp.PlainAuth("", user, pass, host)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n",
		user, in.To, in.Subject, in.Body))

	start := nowMs()
	addr := fmt.Sprintf("%s:%d", host, port)
	if err := smtp.SendMail(addr, auth, user, []string{in.To}, msg); err != nil {
		return a.recordCastInvocation("cast_email_send", "email", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := map[string]any{"to": in.To, "subject": in.Subject, "sent": true}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_email_send", "email", "", args, string(outJSON), false, nowMs()-start), nil
}
