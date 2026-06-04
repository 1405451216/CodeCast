package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// MultimodalCapabilities describes what the current multimodal provider supports.
type MultimodalCapabilities struct {
	Image bool `json:"image"`
	Audio bool `json:"audio"`
	Video bool `json:"video"`
}

// ImageAnalysisResult holds the output of an image analysis call.
type ImageAnalysisResult struct {
	Content     string `json:"content"`
	Model       string `json:"model"`
	InputTokens int    `json:"inputTokens"`
}

// GetMultimodalCapabilities returns the multimodal capabilities of the current provider.
func (a *App) GetMultimodalCapabilities() MultimodalCapabilities {
	caps := MultimodalCapabilities{}
	if a.multimodalProvider == nil {
		return caps
	}
	c := a.multimodalProvider.Capabilities()
	caps.Image = c.HasCapability(ap.CapVision)
	caps.Audio = c.HasCapability(ap.CapAudio)
	caps.Video = c.HasCapability(ap.CapVideo)
	return caps
}

// AnalyzeImage analyzes an image using AP's MultimodalProvider.
// imagePath can be a local file path, http(s) URL, or data:image/...;base64,... URL.
func (a *App) AnalyzeImage(imagePath string, prompt string) (*ImageAnalysisResult, error) {
	if a.multimodalProvider == nil {
		return nil, fmt.Errorf("multimodal provider not initialized (provider may not support vision)")
	}

	ctx, cancel := context.WithTimeout(a.ctx, 120*time.Second)
	defer cancel()

	imgContent, err := a.buildImageContent(imagePath)
	if err != nil {
		return nil, fmt.Errorf("load image: %w", err)
	}

	if prompt == "" {
		prompt = "请详细描述这张图片的内容。"
	}

	req := &ap.CompletionRequestExt{
		Messages: []*ap.ChatMessageExt{
			ap.NewUserMultimodalMessage(imgContent, ap.NewTextContent(prompt)),
		},
	}

	resp, err := a.multimodalProvider.CompleteMultimodal(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("multimodal complete: %w", err)
	}

	result := &ImageAnalysisResult{
		Content: resp.Content,
		Model:   resp.Model,
	}
	result.InputTokens = resp.Usage.PromptTokens
	return result, nil
}

// buildImageContent constructs an AP MultimodalContent from a file path, URL, or data URL.
func (a *App) buildImageContent(imagePath string) (*ap.MultimodalContent, error) {
	// Data URL: data:image/png;base64,xxxxx
	if strings.HasPrefix(imagePath, "data:") {
		comma := strings.Index(imagePath, ",")
		if comma < 0 {
			return nil, fmt.Errorf("invalid data URL format")
		}
		header := imagePath[5:comma] // "image/png;base64"
		mimeType := strings.SplitN(header, ";", 2)[0]
		b64Data := imagePath[comma+1:]
		return ap.NewImageB64Content(b64Data, mimeType), nil
	}

	// URL: http:// or https://
	if strings.HasPrefix(imagePath, "http://") || strings.HasPrefix(imagePath, "https://") {
		return ap.NewImageURLContent(imagePath), nil
	}

	// Local file: validate path is within allowed directories
	if err := a.isPathAllowedBridge(imagePath); err != nil {
		return nil, fmt.Errorf("path not allowed: %w", err)
	}

	raw, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	ext := strings.ToLower(imagePath)
	if idx := strings.LastIndex(ext, "."); idx >= 0 {
		ext = ext[idx+1:]
	}
	mimeType := mimeFromExt(ext)
	if mimeType == "" {
		return nil, fmt.Errorf("unsupported image extension: .%s", ext)
	}

	b64Data := base64.StdEncoding.EncodeToString(raw)
	return ap.NewImageB64Content(b64Data, mimeType), nil
}

// SendMessageWithAttachments sends a chat message with image attachments.
// attachmentsJSON is a JSON array of {type: "image", data: "path_or_base64"} objects.
//
// If multimodalProvider is unavailable or no image attachments, falls back to plain
// text SendMessageEx. Only image attachments are currently supported.
func (a *App) SendMessageWithAttachments(sessionID string, input string, attachmentsJSON string) ([]Message, error) {
	session := a.getSessionByID(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// No attachments or no multimodal provider → fall back to text-only path
	if attachmentsJSON == "" || a.multimodalProvider == nil {
		return a.SendMessageEx(sessionID, input, "", "")
	}

	var attachments []struct {
		Type string `json:"type"`
		Data string `json:"data"`
	}
	if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
		return a.SendMessageEx(sessionID, input, "", "")
	}

	// Build multimodal content list
	contents := []ap.MultimodalContent{*ap.NewTextContent(input)}
	hasImage := false
	for _, att := range attachments {
		if att.Type == "image" {
			img, err := a.buildImageContent(att.Data)
			if err != nil {
				slog.Warn("Failed to load image attachment",
					"data_prefix", att.Data[:minLen(50, len(att.Data))],
					"error", err)
				continue
			}
			contents = append(contents, *img)
			hasImage = true
		}
	}

	// If no images were successfully loaded, fall back to text path
	if !hasImage {
		return a.SendMessageEx(sessionID, input, "", "")
	}

	agentRef, _, err := a.getOrCreateAgent(sessionID, "")
	if err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	ctx, reqCancel := context.WithCancel(a.ctx)
	streamDone := make(chan struct{})
	defer func() {
		<-streamDone
		reqCancel()
	}()

	a.mu.Lock()
	requestIDBytes := make([]byte, 4)
	_, _ = rand.Read(requestIDBytes)
	requestKey := sessionID + "_" + hex.EncodeToString(requestIDBytes)
	a.sessionCancels[requestKey] = reqCancel
	a.mu.Unlock()

	// Build a multimodal message for the agent (ap.Message with ContentParts).
	// AP's MultimodalProvider uses a different message type internally; the agent
	// uses ap.Message with ap.ContentPart for its own StreamRun pipeline.
	parts := make([]ap.ContentPart, 0, len(contents))
	for _, c := range contents {
		switch c.Type {
		case ap.ContentTypeText:
			parts = append(parts, ap.ContentPart{Type: "text", Text: c.Text})
		case ap.ContentTypeImageURL:
			parts = append(parts, ap.ContentPart{Type: "image_url", URL: c.URL})
		case ap.ContentTypeImageB64:
			parts = append(parts, ap.ContentPart{Type: "image_b64", Data: c.Data, MIME: c.MIME})
		case ap.ContentTypeAudio:
			parts = append(parts, ap.ContentPart{Type: "audio", Data: c.Data, MIME: c.MIME})
		case ap.ContentTypeVideo:
			parts = append(parts, ap.ContentPart{Type: "video", Data: c.Data, MIME: c.MIME})
		default:
			parts = append(parts, ap.ContentPart{Type: "text", Text: c.Text})
		}
	}
	streamCh, err := agentRef.StreamRun(ctx, ap.Message{
		Role:         ap.RoleUser,
		Content:      input,
		ContentParts: parts,
	})
	if err != nil {
		close(streamDone)
		return nil, fmt.Errorf("agent stream run: %w", err)
	}

	var fullContent string
	for evt := range streamCh {
		switch evt.Type {
		case ap.StreamEventToken:
			fullContent += evt.Content
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "content", "content": evt.Content,
			})
		case ap.StreamEventThought:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "reasoning", "content": evt.Content,
			})
		case ap.StreamEventToolCall:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "tool_call", "content": evt.Content,
			})
		case ap.StreamEventToolResult:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "tool_result", "content": evt.Content,
			})
		case ap.StreamEventError:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "error", "content": evt.Content,
			})
		case ap.StreamEventComplete:
			wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, map[string]any{
				"type": "done",
			})
		}
	}
	close(streamDone)

	if a.memory != nil {
		a.memory.Add(a.ctx, &ap.Episode{
			SessionID: sessionID,
			Role:      string(ap.RoleUser),
			Content:   input,
		})
		a.memory.Add(a.ctx, &ap.Episode{
			SessionID: sessionID,
			Role:      string(ap.RoleAssistant),
			Content:   fullContent,
		})
	}

	return []Message{
		{Role: "user", Content: input},
		{Role: "assistant", Content: fullContent},
	}, nil
}

func minLen(a, b int) int {
	if a < b {
		return a
	}
	return b
}
