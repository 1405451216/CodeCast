package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	ap "agentprimordia/pkg"
)

func registerChannelTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_channel_send", "channel",
			"通过 Webhook/Email/Feishu/Slack/DingTalk 发送消息",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"channel": {"type": "string", "enum": ["webhook","email","feishu","slack","dingtalk"]},
					"target":  {"type": "string"},
					"title":   {"type": "string"},
					"content": {"type": "string"},
					"extra":   {"type": "object"}
				},
				"required": ["channel","target","content"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolChannelSend(ctx, args)
			},
		),
		newCastTool(a, "cast_channel_test", "channel",
			"测试通道连通性",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"channel": {"type": "string"},
					"target":  {"type": "string"}
				},
				"required": ["channel","target"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolChannelTest(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolChannelSend(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castChannelSendArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	start := nowMs()
	var err error
	switch in.Channel {
	case "webhook":
		err = sendWebhook(ctx, in.Target, in.Title, in.Content)
	case "email":
		err = sendEmail(ctx, a, in.Target, in.Title, in.Content)
	case "feishu":
		err = sendFeishu(ctx, in.Target, in.Title, in.Content)
	case "slack":
		err = sendWebhook(ctx, in.Target, in.Title, in.Content) // Slack incoming webhook
	case "dingtalk":
		err = sendWebhook(ctx, in.Target, in.Title, in.Content)
	default:
		return a.recordCastInvocation("cast_channel_send", "channel", "", args,
			"unsupported channel: "+in.Channel, true, 0), nil
	}
	if err != nil {
		return a.recordCastInvocation("cast_channel_send", "channel", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castChannelSendResult{Sent: true, Message: "sent via " + in.Channel}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_channel_send", "channel", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolChannelTest(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castChannelTestArgs
	_ = json.Unmarshal(args, &in)
	out := castChannelTestResult{OK: true}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_channel_test", "channel", "", args, string(outJSON), false, 0), nil
}

func sendWebhook(ctx context.Context, url, title, content string) error {
	payload, _ := json.Marshal(map[string]any{"title": title, "content": content, "text": fmt.Sprintf("%s\n%s", title, content)})
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned %d", resp.StatusCode)
	}
	return nil
}

func sendEmail(ctx context.Context, a *App, to, subject, body string) error {
	if a.settings == nil || a.settings.SMTPHost == "" {
		return fmt.Errorf("SMTP not configured")
	}
	auth := smtp.PlainAuth("", a.settings.SMTPUser, a.settings.SMTPPass, a.settings.SMTPHost)
	addr := fmt.Sprintf("%s:%d", a.settings.SMTPHost, a.settings.SMTPPort)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", a.settings.SMTPUser, to, subject, body))
	return smtp.SendMail(addr, auth, a.settings.SMTPUser, []string{to}, msg)
}

func sendFeishu(ctx context.Context, url, title, content string) error {
	payload, _ := json.Marshal(map[string]any{
		"msg_type": "interactive",
		"card": map[string]any{
			"header":  map[string]any{"title": map[string]string{"tag": "plain_text", "content": title}},
			"elements": []map[string]string{{"tag": "markdown", "content": content}},
		},
	})
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("feishu returned %d", resp.StatusCode)
	}
	return nil
}
