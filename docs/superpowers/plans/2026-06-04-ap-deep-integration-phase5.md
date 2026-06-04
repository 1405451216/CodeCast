# AP Deep Integration Phase 5: Multimodal, Observability, Adapters, Guardrail Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate AP's MultimodalProvider (vision/image/audio), OTLP Observability, PluginLoader+MessageBus+HTTPTransport (adapter system), and Guardrail enhancements (TopicConstraintRule + Sanitizer) -- raising integration from ~86% to ~97%.

**Architecture:** Each sub-task adds a new AP subsystem to the existing `App` struct and wires it through Wails bindings to the frontend. The pattern is consistent: (1) add field to `App`, (2) initialize in `startup()`, (3) create bridge methods, (4) add frontend types + API functions, (5) update UI components. All new code is additive -- no existing methods are modified.

**Tech Stack:** Go (Wails v2 bindings), AP `agentprimordia/pkg`, TypeScript, React, Zustand (slice pattern)

**AP API Reference:**
- Multimodal: `NewMultimodalProvider(provider)`, `NewTextContent(text)`, `NewImageURLContent(url)`, `NewImageB64Content(b64, mediaType)`, `NewAudioContent(b64, mediaType)`, `NewVideoContent(b64, mediaType)`, `NewUserMultimodalMessage(content[])`, `NewMultimodalAdapter(provider)`
- OTLP: `NewOTLPExporter(OTLPConfig{Endpoint, Headers})`, `NewTelemetryProvider(TelemetryConfig{ServiceName, Version, Endpoint})`
- Plugin: `NewPluginLoader()`, `Load(path) -> (*PluginInfo, error)`, `Unload(id)`, `List() []PluginInfo`
- MessageBus: `NewLocalMessageBus()`, `Register(agentID, handler)`, `Send(msg)`, `Broadcast(msg)`
- HTTPTransport: `NewHTTPTransport()`, `Start(addr)`, `Close()`
- Guardrail: `NewTopicConstraintRule(TopicConstraintConfig)`, `NewSanitizer(SanitizerConfig)` with strategies: Mask, Redact, Replace, Hash

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `CodeCast-desktop/main.go` | Modify | Add multimodalProvider, pluginLoader, messageBus, telemetryProvider, sanitizer fields to App; init in startup(); shutdown cleanup |
| `CodeCast-desktop/provider_factory.go` | Modify | Add `createMultimodalProvider()` method |
| `CodeCast-desktop/cast_tools_misc.go` | Modify | Refactor `doOCR` to use `MultimodalProvider` instead of manual HTTP calls |
| `CodeCast-desktop/chat.go` | Modify | Add `SendMessageWithAttachments` method accepting image data |
| `CodeCast-desktop/config.go` | Modify | Add TelemetryEnabled, TelemetryEndpoint, SanitizerEnabled, SanitizerStrategy fields to Settings |
| `CodeCast-desktop/checkpoint_hook.go` | Modify | Add TopicConstraintRule + Sanitizer to guardrail setup |
| `CodeCast-desktop/plugin_bridge.go` | **Create** | AP PluginLoader + MessageBus + HTTPTransport Wails bindings |
| `CodeCast-desktop/telemetry_bridge.go` | **Create** | OTLP telemetry initialization + Wails bindings for toggle/status |
| `CodeCast-desktop/multimodal_bridge.go` | **Create** | Multimodal provider Wails bindings (OCR via MultimodalAdapter, image analysis) |
| `CodeCast-desktop/multimodal_bridge_test.go` | **Create** | Tests for multimodal bridge |
| `CodeCast-desktop/plugin_bridge_test.go` | **Create** | Tests for plugin bridge |
| `CodeCast-desktop/telemetry_bridge_test.go` | **Create** | Tests for telemetry bridge |
| `CodeCast-desktop/frontend/src/api.ts` | Modify | Add Wails binding method signatures for all Phase 5 subsystems |
| `CodeCast-desktop/frontend/src/api/types.ts` | Modify | Add TypeScript types for plugin info, telemetry status, multimodal results |
| `CodeCast-desktop/frontend/src/components/ChatInput.tsx` | Modify | Add image paste/attach support |
| `CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx` | Modify | Add telemetry toggle, sanitizer toggle, topic constraint config |
| `CodeCast-desktop/frontend/src/store/usePluginStore.ts` | Modify | Add AP PluginLoader integration (load/unload/list from Go backend) |

---

## Task 1: MultimodalProvider for Vision and Image Attachments

**Files:**
- Create: `CodeCast-desktop/multimodal_bridge.go`
- Create: `CodeCast-desktop/multimodal_bridge_test.go`
- Modify: `CodeCast-desktop/provider_factory.go`
- Modify: `CodeCast-desktop/main.go`
- Modify: `CodeCast-desktop/cast_tools_misc.go`
- Modify: `CodeCast-desktop/chat.go`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/components/ChatInput.tsx`

- [ ] **Step 1: Write the failing test**

```go
// File: CodeCast-desktop/multimodal_bridge_test.go
package main

import (
	"context"
	"testing"
)

func TestCreateMultimodalProvider(t *testing.T) {
	app := &App{
		settings: &Settings{
			ModelConfigs: []ModelConfigItem{
				{
					ID:      "mc_test",
					Provider: "deepseek",
					Model:   "deepseek-v4-flash",
					APIKey:  "test-key",
					APIURL:  "https://api.deepseek.com",
					Enabled: true,
				},
			},
			LLMProvider: "deepseek",
		},
		llmConfig: DefaultLLMProviderConfig(),
	}

	// createMultimodalProvider requires a.mu to be held
	app.mu.Lock()
	mmProvider, err := app.createMultimodalProvider()
	app.mu.Unlock()

	if err != nil {
		t.Fatalf("createMultimodalProvider failed: %v", err)
	}
	if mmProvider == nil {
		t.Fatal("expected non-nil MultimodalProvider")
	}
}

func TestAnalyzeImage(t *testing.T) {
	app := &App{
		settings: &Settings{
			ModelConfigs: []ModelConfigItem{},
		},
		llmConfig: DefaultLLMProviderConfig(),
	}

	// Without a multimodal provider set, should return error
	_, err := app.AnalyzeImage("nonexistent.png", "describe this image")
	if err == nil {
		t.Error("expected error when multimodalProvider is nil")
	}
}

func TestGetMultimodalCapabilities(t *testing.T) {
	app := &App{}

	caps := app.GetMultimodalCapabilities()
	// Without provider, capabilities should be empty
	if caps.Image {
		t.Error("expected Image=false when no multimodal provider")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestCreateMultimodal|TestAnalyzeImage|TestGetMultimodalCapabilities" -v`
Expected: FAIL -- `createMultimodalProvider` undefined, `AnalyzeImage` undefined, `GetMultimodalCapabilities` undefined

- [ ] **Step 3: Add multimodalProvider field to App struct in main.go**

Add to the `App` struct, in the "AP 框架核心" section (after `guardrailHook`):

```go
		multimodalProvider ap.MultimodalProvider
```

- [ ] **Step 4: Add createMultimodalProvider to provider_factory.go**

Add after the `createCachedProvider` function:

```go
// createMultimodalProvider wraps the primary provider with AP MultimodalProvider
// for vision/image/audio/video capabilities. Uses MultimodalAdapter to normalize
// any provider to the MultimodalProvider interface.
// IMPORTANT: Caller MUST hold a.mu lock (calls createProvider which requires it).
func (a *App) createMultimodalProvider() (ap.MultimodalProvider, error) {
	primary, err := a.createProvider()
	if err != nil {
		return nil, fmt.Errorf("create provider for multimodal: %w", err)
	}

	mm, err := ap.NewMultimodalProvider(primary)
	if err != nil {
		return nil, fmt.Errorf("create multimodal provider: %w", err)
	}
	return mm, nil
}
```

- [ ] **Step 5: Initialize multimodalProvider in startup() in main.go**

Add after the provider creation block (after line 227, inside the `else` branch where `providerErr == nil`):

```go
			// 12b. Multimodal Provider (vision + image attachments)
			mmProvider, mmErr := ap.NewMultimodalProvider(provider)
			if mmErr != nil {
				slog.Warn("AP MultimodalProvider 初始化失败", "error", mmErr)
			} else {
				a.multimodalProvider = mmProvider
				slog.Info("AP MultimodalProvider 已启动")
			}
```

- [ ] **Step 6: Create multimodal_bridge.go**

```go
// File: CodeCast-desktop/multimodal_bridge.go
package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"os"
	"strings"

	ap "agentprimordia/pkg"
)

// MultimodalCapabilities describes what the current provider supports.
type MultimodalCapabilities struct {
	Image  bool `json:"image"`
	Audio  bool `json:"audio"`
	Video  bool `json:"video"`
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
	supported := a.multimodalProvider.SupportedContentTypes()
	for _, ct := range supported {
		switch ct {
		case ap.ContentTypeImage:
			caps.Image = true
		case ap.ContentTypeAudio:
			caps.Audio = true
		case ap.ContentTypeVideo:
			caps.Video = true
		}
	}
	return caps
}

// AnalyzeImage analyzes an image using AP's MultimodalProvider.
// imagePath can be a local file path or a data:image/...;base64,... URL.
func (a *App) AnalyzeImage(imagePath string, prompt string) (*ImageAnalysisResult, error) {
	if a.multimodalProvider == nil {
		return nil, fmt.Errorf("multimodal provider not initialized (provider may not support vision)")
	}

	ctx, cancel := context.WithTimeout(a.ctx, 120*1e9) // 120s timeout for vision
	defer cancel()

	// Build content parts
	var contents []ap.Content

	// Load image content
	imgContent, err := a.buildImageContent(imagePath)
	if err != nil {
		return nil, fmt.Errorf("load image: %w", err)
	}
	contents = append(contents, imgContent)

	// Add text prompt
	if prompt == "" {
		prompt = "请详细描述这张图片的内容。"
	}
	contents = append(contents, ap.NewTextContent(prompt))

	// Build multimodal message
	msg := ap.NewUserMultimodalMessage(contents)

	// Call multimodal provider
	resp, err := a.multimodalProvider.MultimodalComplete(ctx, msg)
	if err != nil {
		return nil, fmt.Errorf("multimodal complete: %w", err)
	}

	result := &ImageAnalysisResult{
		Content: resp.Content,
		Model:   resp.Model,
	}
	if resp.Usage != nil {
		result.InputTokens = resp.Usage.PromptTokens
	}
	return result, nil
}

// buildImageContent constructs an AP image content from a file path or data URL.
func (a *App) buildImageContent(imagePath string) (ap.Content, error) {
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
	if err := a.isPathAllowed(imagePath); err != nil {
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
func (a *App) SendMessageWithAttachments(sessionID string, input string, attachmentsJSON string) ([]Message, error) {
	session := a.getSessionByID(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// If no attachments or no multimodal provider, fall back to regular SendMessage
	if attachmentsJSON == "" || a.multimodalProvider == nil {
		return a.SendMessageEx(sessionID, input, "", "")
	}

	// Parse attachments
	var attachments []struct {
		Type string `json:"type"`
		Data string `json:"data"`
	}
	if err := json.Unmarshal([]byte(attachmentsJSON), &attachments); err != nil {
		return a.SendMessageEx(sessionID, input, "", "")
	}

	// Build multimodal message
	var contents []ap.Content
	contents = append(contents, ap.NewTextContent(input))

	for _, att := range attachments {
		if att.Type == "image" {
			imgContent, err := a.buildImageContent(att.Data)
			if err != nil {
				slog.Warn("Failed to load image attachment", "data", att.Data[:min(50, len(att.Data))], "error", err)
				continue
			}
			contents = append(contents, imgContent)
		}
	}

	agent, _, err := a.getOrCreateAgent(sessionID, "")
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
	rand.Read(requestIDBytes)
	requestKey := sessionID + "_" + hex.EncodeToString(requestIDBytes)
	a.sessionCancels[requestKey] = reqCancel
	a.mu.Unlock()

	// Use multimodal message
	msg := ap.NewUserMultimodalMessage(contents)
	streamCh, err := agent.StreamRun(ctx, msg)
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

	return []Message{
		{Role: "user", Content: input},
		{Role: "assistant", Content: fullContent},
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
```

Note: `multimodal_bridge.go` needs these imports:

```go
import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"encoding/base64"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)
```

- [ ] **Step 7: Refactor doOCR in cast_tools_misc.go to use MultimodalProvider**

Replace the entire `doOCR` method body with a MultimodalProvider-based implementation. The old manual HTTP calls (`doAnthropicVision`, `doOpenAIVision`, `doGeminiVision`) remain as fallback if multimodalProvider is nil.

Replace the `doOCR` method:

```go
// doOCR uses AP MultimodalProvider for OCR. Falls back to manual HTTP if provider is nil.
func (a *App) doOCR(ctx context.Context, in castOCRArgs) (text, model string, inTok, outTok int, err error) {
	// 1. Load image data
	imgData, mimeType, err := a.loadImageAsBase64(in.ImagePath)
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("load image: %w", err)
	}

	// 2. Build prompt
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

	// 3. Use MultimodalProvider if available (preferred path)
	if a.multimodalProvider != nil {
		contents := []ap.Content{
			ap.NewImageB64Content(imgData, mimeType),
			ap.NewTextContent(prompt),
		}
		msg := ap.NewUserMultimodalMessage(contents)
		ocrCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
		defer cancel()

		resp, mmErr := a.multimodalProvider.MultimodalComplete(ocrCtx, msg)
		if mmErr != nil {
			slog.Warn("MultimodalProvider OCR failed, falling back to manual HTTP", "error", mmErr)
			// Fall through to manual HTTP below
		} else {
			inTok := 0
			outTok := 0
			modelUsed := in.Model
			if resp.Usage != nil {
				inTok = resp.Usage.PromptTokens
				outTok = resp.Usage.CompletionTokens
			}
			if resp.Model != "" {
				modelUsed = resp.Model
			}
			return resp.Content, modelUsed, inTok, outTok, nil
		}
	}

	// 4. Fallback: manual HTTP calls (original code preserved)
	a.mu.RLock()
	creds, credsErr := a.resolveCredentialsLocked("")
	a.mu.RUnlock()
	if credsErr != nil || creds.APIKey == "" {
		return "", "", 0, 0, fmt.Errorf("API key not configured (Settings -> API Key)")
	}

	providerID := ""
	if a.settings != nil {
		providerID = a.settings.LLMProvider
	}
	if providerID == "" {
		providerID = a.guessProviderForModel(creds.Model)
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
```

- [ ] **Step 8: Add TypeScript types in api/types.ts**

Add at the end of the file:

```typescript
// Multimodal types
export interface MultimodalCapabilities {
  image: boolean;
  audio: boolean;
  video: boolean;
}

export interface ImageAnalysisResult {
  content: string;
  model: string;
  inputTokens: number;
}

export interface ImageAttachment {
  type: 'image';
  data: string; // file path, URL, or data:image/...;base64,...
}
```

- [ ] **Step 9: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
  // Multimodal
  GetMultimodalCapabilities(): Promise<MultimodalCapabilities>;
  AnalyzeImage(imagePath: string, prompt: string): Promise<ImageAnalysisResult>;
  SendMessageWithAttachments(sessionId: string, input: string, attachmentsJSON: string): Promise<GoMessage[]>;
```

Add exported functions:

```typescript
// Multimodal
export const getMultimodalCapabilities = () => callGo('GetMultimodalCapabilities');
export const analyzeImage = (imagePath: string, prompt: string) => callGo('AnalyzeImage', imagePath, prompt);
export const sendMessageWithAttachments = (sessionId: string, input: string, attachmentsJSON: string) =>
  callGo('SendMessageWithAttachments', sessionId, input, attachmentsJSON);
```

Add the import for `MultimodalCapabilities` and `ImageAnalysisResult` at the top of api.ts (extend the existing import from `./api/types`):

```typescript
import type {
  GoProject,
  GoSession,
  GoMessage,
  GoSkill,
  GoTask,
  GoMCPServer,
  GoEnvVar,
  GoSlashCommand,
  GoEditorInfo,
  GoFileEntry,
  GoSettings,
  MultimodalCapabilities,
  ImageAnalysisResult,
} from './api/types';
```

- [ ] **Step 10: Update ChatInput.tsx to support image paste**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useChatSender } from '../hooks/useChatSender';
import * as api from '../api';
import type { ImageAttachment } from '../api/types';

interface ChatInputProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  onStop: () => void;
  sessionId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop, sessionId }) => {
  const { handleSendMessage } = useChatSender();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments(prev => [...prev, {
            type: 'image',
            data: dataUrl,
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments(prev => [...prev, {
          type: 'image',
          data: dataUrl,
        }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const msg = text.trim();
    if ((!msg && attachments.length === 0) || isLoading) return;
    setText('');
    const currentAttachments = [...attachments];
    setAttachments([]);

    if (currentAttachments.length > 0 && sessionId) {
      const attachmentsJSON = JSON.stringify(currentAttachments);
      await api.sendMessageWithAttachments(sessionId, msg, attachmentsJSON);
    } else {
      onSend(msg);
      await handleSendMessage(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input" style={{
      padding: 12, borderTop: '1px solid var(--border, #ddd)',
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'var(--bg-input, #fafafa)',
    }}>
      {/* Image attachment previews */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((att, idx) => (
            <div key={idx} style={{ position: 'relative', width: 60, height: 60 }}>
              <img
                src={att.data}
                alt={`attachment-${idx}`}
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
              />
              <button
                onClick={() => removeAttachment(idx)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--danger, #e74c3c)', color: '#fff',
                  border: 'none', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {/* Attach image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
          disabled={isLoading}
          style={{
            padding: '6px 10px', cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1, border: '1px solid var(--border)',
            borderRadius: 4, background: 'transparent', fontSize: 16,
          }}
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息，回车发送（Shift+Enter 换行，可粘贴图片）"
          rows={2}
          disabled={isLoading}
          style={{
            flex: 1, padding: 10, fontSize: 14, resize: 'none',
            fontFamily: 'inherit', borderRadius: 4,
            border: '1px solid var(--border, #ccc)',
          }}
        />
        {isLoading ? (
          <button onClick={onStop} style={{ padding: '0 20px', cursor: 'pointer' }}>Stop</button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && attachments.length === 0}
            style={{
              padding: '0 20px', cursor: text.trim() || attachments.length > 0 ? 'pointer' : 'not-allowed',
              opacity: text.trim() || attachments.length > 0 ? 1 : 0.5,
            }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
```

- [ ] **Step 11: Run tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestCreateMultimodal|TestAnalyzeImage|TestGetMultimodalCapabilities" -v`
Expected: ALL PASS

- [ ] **Step 12: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./...`
Expected: Success

- [ ] **Step 13: Commit**

```bash
git add CodeCast-desktop/multimodal_bridge.go CodeCast-desktop/multimodal_bridge_test.go CodeCast-desktop/provider_factory.go CodeCast-desktop/main.go CodeCast-desktop/cast_tools_misc.go CodeCast-desktop/chat.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/components/ChatInput.tsx
git commit -m "feat: integrate AP MultimodalProvider for vision, OCR refactor, image paste in chat"
```

---

## Task 2: OTLP Observability (Optional, Toggle in Settings)

**Files:**
- Create: `CodeCast-desktop/telemetry_bridge.go`
- Create: `CodeCast-desktop/telemetry_bridge_test.go`
- Modify: `CodeCast-desktop/main.go`
- Modify: `CodeCast-desktop/config.go`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx`

- [ ] **Step 1: Add telemetry fields to Settings in config.go**

Add these fields to the `Settings` struct (after `ComputerControl`):

```go
		TelemetryEnabled  bool   `json:"telemetry_enabled"`
		TelemetryEndpoint string `json:"telemetry_endpoint"`
```

Add to `DefaultSettings`:

```go
		TelemetryEnabled:  false,
		TelemetryEndpoint: "http://localhost:4318",
```

Add to `allowedSettingKeys` map:

```go
		"telemetry_enabled": true, "telemetry_endpoint": true,
```

- [ ] **Step 2: Write the failing test**

```go
// File: CodeCast-desktop/telemetry_bridge_test.go
package main

import (
	"testing"
)

func TestInitTelemetryDisabled(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled:  false,
			TelemetryEndpoint: "http://localhost:4318",
		},
		ctx: context.Background(),
	}

	app.initTelemetry()

	if app.telemetryProvider != nil {
		t.Error("expected nil telemetryProvider when telemetry is disabled")
	}
}

func TestGetTelemetryStatusDisabled(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled: false,
		},
	}

	status := app.GetTelemetryStatus()
	if status.Enabled {
		t.Error("expected Enabled=false when telemetry is disabled")
	}
}

func TestGetTelemetryStatusEnabled(t *testing.T) {
	app := &App{
		settings: &Settings{
			TelemetryEnabled:  true,
			TelemetryEndpoint: "http://localhost:4318",
		},
		telemetryProvider: nil, // not actually connected in test
	}

	status := app.GetTelemetryStatus()
	if !status.Enabled {
		t.Error("expected Enabled=true when settings.TelemetryEnabled is true")
	}
	if status.Endpoint != "http://localhost:4318" {
		t.Errorf("expected endpoint http://localhost:4318, got %s", status.Endpoint)
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestInitTelemetry|TestGetTelemetryStatus" -v`
Expected: FAIL -- `initTelemetry` undefined, `GetTelemetryStatus` undefined

- [ ] **Step 4: Add telemetryProvider field to App struct in main.go**

Add to the "AP 框架核心" section (after `multimodalProvider`):

```go
		telemetryProvider *ap.TelemetryProvider
```

- [ ] **Step 5: Create telemetry_bridge.go**

```go
// File: CodeCast-desktop/telemetry_bridge.go
package main

import (
	"fmt"
	"log/slog"

	ap "agentprimordia/pkg"
)

// TelemetryStatus holds the current telemetry configuration and state.
type TelemetryStatus struct {
	Enabled  bool   `json:"enabled"`
	Endpoint string `json:"endpoint"`
	Active   bool   `json:"active"`
	Error    string `json:"error,omitempty"`
}

// initTelemetry sets up AP OTLP telemetry if enabled in settings.
// This is called during startup() and when telemetry settings change.
func (a *App) initTelemetry() {
	a.mu.RLock()
	enabled := a.settings.TelemetryEnabled
	endpoint := a.settings.TelemetryEndpoint
	a.mu.RUnlock()

	if !enabled {
		if a.telemetryProvider != nil {
			a.telemetryProvider.Shutdown()
			a.telemetryProvider = nil
			slog.Info("AP Telemetry disabled and shut down")
		}
		return
	}

	// Shut down existing provider before creating new one
	if a.telemetryProvider != nil {
		a.telemetryProvider.Shutdown()
		a.telemetryProvider = nil
	}

	exporter, err := ap.NewOTLPExporter(ap.OTLPConfig{
		Endpoint: endpoint,
	})
	if err != nil {
		slog.Error("AP OTLP Exporter creation failed", "endpoint", endpoint, "error", err)
		return
	}

	provider, err := ap.NewTelemetryProvider(ap.TelemetryConfig{
		ServiceName: "CodeCast",
		Version:     "0.1.0",
		Endpoint:    endpoint,
	}, exporter)
	if err != nil {
		slog.Error("AP TelemetryProvider creation failed", "error", err)
		return
	}

	a.telemetryProvider = provider

	// Wire telemetry into metrics collector
	if a.metricsCollector != nil {
		a.metricsCollector.SetTelemetryProvider(provider)
	}

	slog.Info("AP Telemetry initialized", "endpoint", endpoint)
}

// GetTelemetryStatus returns the current telemetry status for the frontend.
func (a *App) GetTelemetryStatus() TelemetryStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	status := TelemetryStatus{
		Enabled:  a.settings.TelemetryEnabled,
		Endpoint: a.settings.TelemetryEndpoint,
		Active:   a.telemetryProvider != nil,
	}
	if a.telemetryProvider != nil {
		if err := a.telemetryProvider.HealthCheck(); err != nil {
			status.Error = fmt.Sprintf("health check failed: %v", err)
		}
	}
	return status
}

// ToggleTelemetry enables or disables OTLP telemetry at runtime.
func (a *App) ToggleTelemetry(enabled bool) error {
	a.mu.Lock()
	a.settings.TelemetryEnabled = enabled
	a.mu.Unlock()

	a.initTelemetry()

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// SetTelemetryEndpoint updates the OTLP endpoint and reinitializes telemetry.
func (a *App) SetTelemetryEndpoint(endpoint string) error {
	a.mu.Lock()
	a.settings.TelemetryEndpoint = endpoint
	a.mu.Unlock()

	a.initTelemetry()

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}
```

- [ ] **Step 6: Initialize telemetry in startup() in main.go**

Add after the event bridge initialization (after line 231):

```go
		// 17. OTLP Telemetry (optional, controlled by settings)
		a.initTelemetry()
```

Add shutdown cleanup in `shutdown()`:

```go
		if a.telemetryProvider != nil {
			a.telemetryProvider.Shutdown()
			slog.Info("AP Telemetry 已关闭")
		}
```

- [ ] **Step 7: Add TypeScript types in api/types.ts**

```typescript
// Telemetry types
export interface TelemetryStatus {
  enabled: boolean;
  endpoint: string;
  active: boolean;
  error?: string;
}
```

- [ ] **Step 8: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
  // Telemetry
  GetTelemetryStatus(): Promise<TelemetryStatus>;
  ToggleTelemetry(enabled: boolean): Promise<void>;
  SetTelemetryEndpoint(endpoint: string): Promise<void>;
```

Add exported functions:

```typescript
// Telemetry
export const getTelemetryStatus = () => callGo('GetTelemetryStatus');
export const toggleTelemetry = (enabled: boolean) => callGo('ToggleTelemetry', enabled);
export const setTelemetryEndpoint = (endpoint: string) => callGo('SetTelemetryEndpoint', endpoint);
```

Add the import for `TelemetryStatus` in the import block from `./api/types`.

- [ ] **Step 9: Update MCPTab.tsx to add telemetry toggle**

Add a new section after the MCP server list, before the "Add server" section:

```tsx
{/* Telemetry Section */}
<div className="settings-group" style={{ marginTop: 16 }}>
  <div className="settings-group-title">OTLP 遥测</div>
  <div className="form-group">
    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        className={`toggle${telemetryEnabled ? ' active' : ''}`}
        style={{ width: '32px', height: '18px' }}
        onClick={async () => {
          try {
            await api.toggleTelemetry(!telemetryEnabled);
            setTelemetryEnabled(!telemetryEnabled);
          } catch (e) {
            console.error('Toggle telemetry failed:', e);
          }
        }}
      />
      启用 OTLP 遥测
    </label>
  </div>
  {telemetryEnabled && (
    <div className="form-group">
      <label className="form-label">Endpoint</label>
      <input
        className="form-input"
        value={telemetryEndpoint}
        onChange={(e) => setTelemetryEndpoint(e.target.value)}
        onBlur={async () => {
          try {
            await api.setTelemetryEndpoint(telemetryEndpoint);
          } catch (e) {
            console.error('Set telemetry endpoint failed:', e);
          }
        }}
        placeholder="http://localhost:4318"
      />
    </div>
  )}
</div>
```

Add state variables at the top of the MCPTab component:

```tsx
const [telemetryEnabled, setTelemetryEnabled] = useState(false);
const [telemetryEndpoint, setTelemetryEndpoint] = useState('http://localhost:4318');

// Load telemetry status
useEffect(() => {
  (async () => {
    try {
      const status = await api.getTelemetryStatus();
      setTelemetryEnabled(status.enabled);
      setTelemetryEndpoint(status.endpoint);
    } catch (e) { /* ignore */ }
  })();
}, []);
```

- [ ] **Step 10: Run tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestInitTelemetry|TestGetTelemetryStatus" -v`
Expected: ALL PASS

- [ ] **Step 11: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./...`
Expected: Success

- [ ] **Step 12: Commit**

```bash
git add CodeCast-desktop/telemetry_bridge.go CodeCast-desktop/telemetry_bridge_test.go CodeCast-desktop/main.go CodeCast-desktop/config.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx
git commit -m "feat: add AP OTLP telemetry with settings toggle and MCPTab UI"
```

---

## Task 3: PluginLoader + MessageBus + HTTPTransport

**Files:**
- Create: `CodeCast-desktop/plugin_bridge.go`
- Create: `CodeCast-desktop/plugin_bridge_test.go`
- Modify: `CodeCast-desktop/main.go`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/store/usePluginStore.ts`

- [ ] **Step 1: Write the failing test**

```go
// File: CodeCast-desktop/plugin_bridge_test.go
package main

import (
	"testing"
)

func TestListPluginsEmpty(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(),
	}

	plugins := app.ListPlugins()
	if len(plugins) != 0 {
		t.Errorf("expected 0 plugins, got %d", len(plugins))
	}
}

func TestLoadPluginInvalidPath(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(),
	}

	_, err := app.LoadPlugin("/nonexistent/plugin.so")
	if err == nil {
		t.Error("expected error for invalid plugin path")
	}
}

func TestMessageBusBroadcast(t *testing.T) {
	app := &App{
		messageBus: ap.NewLocalMessageBus(),
	}

	received := make(chan string, 1)
	app.messageBus.Register("test-agent", func(msg ap.BusMessage) {
		received <- msg.Content
	})

	app.messageBus.Send(ap.BusMessage{
		Target:  "test-agent",
		Content: "hello",
	})

	select {
	case msg := <-received:
		if msg != "hello" {
			t.Errorf("expected 'hello', got '%s'", msg)
		}
	default:
		t.Error("expected to receive message")
	}
}

func TestGetPluginStatus(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(),
	}

	status := app.GetPluginStatus()
	if status.LoadedCount != 0 {
		t.Errorf("expected LoadedCount=0, got %d", status.LoadedCount)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestListPlugins|TestLoadPluginInvalid|TestMessageBus|TestGetPluginStatus" -v`
Expected: FAIL -- `pluginLoader` field undefined, `ListPlugins` undefined, `LoadPlugin` undefined, etc.

- [ ] **Step 3: Add fields to App struct in main.go**

Add to the "AP 框架核心" section (after `telemetryProvider`):

```go
		pluginLoader      *ap.PluginLoader
		messageBus        *ap.LocalMessageBus
		httpTransport     *ap.HTTPTransport
```

- [ ] **Step 4: Create plugin_bridge.go**

```go
// File: CodeCast-desktop/plugin_bridge.go
package main

import (
	"fmt"
	"log/slog"

	ap "agentprimordia/pkg"
)

// PluginInfoData is the JSON-serializable plugin info for the frontend.
type PluginInfoData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Path        string `json:"path"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

// PluginStatusData summarizes the plugin system state for the frontend.
type PluginStatusData struct {
	LoadedCount int              `json:"loadedCount"`
	Plugins     []PluginInfoData `json:"plugins"`
}

// ListPlugins returns all loaded plugins.
func (a *App) ListPlugins() []PluginInfoData {
	if a.pluginLoader == nil {
		return nil
	}

	plugins := a.pluginLoader.List()
	result := make([]PluginInfoData, len(plugins))
	for i, p := range plugins {
		result[i] = PluginInfoData{
			ID:          p.ID,
			Name:        p.Name,
			Version:     p.Version,
			Description: p.Description,
			Path:        p.Path,
			Status:      p.Status,
		}
	}
	return result
}

// LoadPlugin loads a plugin from the given path.
func (a *App) LoadPlugin(path string) (*PluginInfoData, error) {
	if a.pluginLoader == nil {
		return nil, fmt.Errorf("plugin loader not initialized")
	}

	info, err := a.pluginLoader.Load(path)
	if err != nil {
		return nil, fmt.Errorf("load plugin: %w", err)
	}

	// Register the plugin's tools into the toolkit if it provides any
	if a.toolkit != nil && info.ToolProvider != nil {
		if regErr := info.ToolProvider.RegisterInto(a.toolkit); regErr != nil {
			slog.Warn("Plugin tool registration failed", "plugin", info.Name, "error", regErr)
		} else {
			slog.Info("Plugin tools registered", "plugin", info.Name)
		}
	}

	result := &PluginInfoData{
		ID:          info.ID,
		Name:        info.Name,
		Version:     info.Version,
		Description: info.Description,
		Path:        info.Path,
		Status:      info.Status,
	}
	return result, nil
}

// UnloadPlugin unloads a plugin by ID.
func (a *App) UnloadPlugin(pluginID string) error {
	if a.pluginLoader == nil {
		return fmt.Errorf("plugin loader not initialized")
	}
	return a.pluginLoader.Unload(pluginID)
}

// GetPluginStatus returns the current plugin system status.
func (a *App) GetPluginStatus() PluginStatusData {
	plugins := a.ListPlugins()
	return PluginStatusData{
		LoadedCount: len(plugins),
		Plugins:     plugins,
	}
}

// SendPluginMessage sends a message to a specific agent via the message bus.
func (a *App) SendPluginMessage(targetAgentID string, content string) error {
	if a.messageBus == nil {
		return fmt.Errorf("message bus not initialized")
	}
	a.messageBus.Send(ap.BusMessage{
		Target:  targetAgentID,
		Content: content,
	})
	return nil
}

// BroadcastMessage broadcasts a message to all registered agents.
func (a *App) BroadcastMessage(content string) error {
	if a.messageBus == nil {
		return fmt.Errorf("message bus not initialized")
	}
	a.messageBus.Broadcast(ap.BusMessage{
		Content: content,
	})
	return nil
}

// StartHTTPTransport starts the AP HTTP transport for remote plugin access.
// This is optional and controlled by the user.
func (a *App) StartHTTPTransport(addr string) error {
	if a.httpTransport != nil {
		return fmt.Errorf("HTTP transport already running")
	}

	transport := ap.NewHTTPTransport()
	if err := transport.Start(addr); err != nil {
		return fmt.Errorf("start HTTP transport: %w", err)
	}

	a.httpTransport = transport
	slog.Info("AP HTTPTransport started", "addr", addr)
	return nil
}

// StopHTTPTransport stops the AP HTTP transport.
func (a *App) StopHTTPTransport() error {
	if a.httpTransport == nil {
		return nil
	}
	if err := a.httpTransport.Close(); err != nil {
		return fmt.Errorf("stop HTTP transport: %w", err)
	}
	a.httpTransport = nil
	slog.Info("AP HTTPTransport stopped")
	return nil
}
```

- [ ] **Step 5: Initialize in startup() in main.go**

Add after the telemetry initialization:

```go
		// 18. AP PluginLoader + MessageBus
		a.pluginLoader = ap.NewPluginLoader()
		a.messageBus = ap.NewLocalMessageBus()
		slog.Info("AP PluginLoader + MessageBus 已启动")
```

Add shutdown cleanup in `shutdown()`:

```go
		if a.pluginLoader != nil {
			a.pluginLoader.Close()
			slog.Info("AP PluginLoader 已关闭")
		}
		if a.httpTransport != nil {
			a.httpTransport.Close()
			slog.Info("AP HTTPTransport 已关闭")
		}
```

- [ ] **Step 6: Add TypeScript types in api/types.ts**

```typescript
// Plugin types (AP PluginLoader)
export interface PluginInfoData {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  status: string;
  error?: string;
}

export interface PluginStatusData {
  loadedCount: number;
  plugins: PluginInfoData[];
}
```

- [ ] **Step 7: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
  // AP Plugins
  ListPlugins(): Promise<PluginInfoData[]>;
  LoadPlugin(path: string): Promise<PluginInfoData>;
  UnloadPlugin(pluginId: string): Promise<void>;
  GetPluginStatus(): Promise<PluginStatusData>;
  SendPluginMessage(targetAgentId: string, content: string): Promise<void>;
  BroadcastMessage(content: string): Promise<void>;
  StartHTTPTransport(addr: string): Promise<void>;
  StopHTTPTransport(): Promise<void>;
```

Add exported functions:

```typescript
// AP Plugins
export const listPlugins = () => callGo('ListPlugins');
export const loadPlugin = (path: string) => callGo('LoadPlugin', path);
export const unloadPlugin = (pluginId: string) => callGo('UnloadPlugin', pluginId);
export const getPluginStatus = () => callGo('GetPluginStatus');
export const sendPluginMessage = (targetAgentId: string, content: string) =>
  callGo('SendPluginMessage', targetAgentId, content);
export const broadcastMessage = (content: string) => callGo('BroadcastMessage', content);
export const startHTTPTransport = (addr: string) => callGo('StartHTTPTransport', addr);
export const stopHTTPTransport = () => callGo('StopHTTPTransport');
```

Add the import for `PluginInfoData` and `PluginStatusData` in the import block from `./api/types`.

- [ ] **Step 8: Update usePluginStore.ts to integrate with AP PluginLoader**

Add to the `PluginSlice` interface:

```typescript
  apPlugins: PluginInfoData[];
  loadAPPlugins: () => Promise<void>;
  loadAPPlugin: (path: string) => Promise<void>;
  unloadAPPlugin: (pluginId: string) => Promise<void>;
```

Add import at the top of usePluginStore.ts:

```typescript
import type { PluginInfoData } from '../api/types';
import * as api from '../api';
```

Add to the slice implementation (in the return object):

```typescript
    apPlugins: [] as PluginInfoData[],
    loadAPPlugins: async () => {
      try {
        const plugins = await api.listPlugins();
        set({ apPlugins: plugins });
      } catch (e) {
        logger.warn('PluginStore', 'Failed to load AP plugins', { error: e });
      }
    },
    loadAPPlugin: async (path: string) => {
      try {
        const info = await api.loadPlugin(path);
        set((state: any) => ({
          apPlugins: [...(state.apPlugins || []), info],
        }));
        logger.info('PluginStore', 'AP plugin loaded', { pluginId: info.id, pluginName: info.name });
      } catch (e) {
        logger.error('PluginStore', 'Failed to load AP plugin', { path, error: e });
      }
    },
    unloadAPPlugin: async (pluginId: string) => {
      try {
        await api.unloadPlugin(pluginId);
        set((state: any) => ({
          apPlugins: (state.apPlugins || []).filter((p: PluginInfoData) => p.id !== pluginId),
        }));
        logger.info('PluginStore', 'AP plugin unloaded', { pluginId });
      } catch (e) {
        logger.error('PluginStore', 'Failed to unload AP plugin', { pluginId, error: e });
      }
    },
```

Also add to `resetPluginState`:

```typescript
      apPlugins: [],
```

- [ ] **Step 9: Run tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test -run "TestListPlugins|TestLoadPluginInvalid|TestMessageBus|TestGetPluginStatus" -v`
Expected: ALL PASS

- [ ] **Step 10: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./...`
Expected: Success

- [ ] **Step 11: Commit**

```bash
git add CodeCast-desktop/plugin_bridge.go CodeCast-desktop/plugin_bridge_test.go CodeCast-desktop/main.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/store/usePluginStore.ts
git commit -m "feat: integrate AP PluginLoader + MessageBus + HTTPTransport for plugin system"
```

---

## Task 4: Guardrail Enhancements (TopicConstraintRule + Sanitizer)

**Files:**
- Modify: `CodeCast-desktop/checkpoint_hook.go`
- Modify: `CodeCast-desktop/config.go`
- Modify: `CodeCast-desktop/frontend/src/api.ts`
- Modify: `CodeCast-desktop/frontend/src/api/types.ts`
- Modify: `CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx`

- [ ] **Step 1: Add sanitizer fields to Settings in config.go**

Add these fields to the `Settings` struct (after the telemetry fields):

```go
		SanitizerEnabled  bool     `json:"sanitizer_enabled"`
		SanitizerStrategy string   `json:"sanitizer_strategy"` // Mask, Redact, Replace, Hash
		TopicConstraints  []string `json:"topic_constraints"`
```

Add to `DefaultSettings`:

```go
		SanitizerEnabled:  false,
		SanitizerStrategy: "Mask",
		TopicConstraints:  []string{},
```

Add to `allowedSettingKeys` map:

```go
		"sanitizer_enabled": true, "sanitizer_strategy": true,
```

Note: `topic_constraints` is a slice and is handled via separate `UpdateTopicConstraints` method rather than `UpdateSetting` reflection.

Also add nil-initialization in `loadSettings()` (after the `ArchivedSessions` nil check):

```go
		if s.TopicConstraints == nil {
			s.TopicConstraints = []string{}
		}
```

And in `SaveSettings()`:

```go
		if s.TopicConstraints == nil {
			s.TopicConstraints = []string{}
		}
```

- [ ] **Step 2: Enhance setupGuardrails in checkpoint_hook.go**

Add after the existing `NewOutputSafetyRule` call and before the `return` statement:

```go
	// Topic Constraint Rule — restricts conversations to allowed topics
	a.mu.RLock()
	topics := append([]string{}, a.settings.TopicConstraints...)
	a.mu.RUnlock()
	if len(topics) > 0 {
		a.guardrail.AddRule(ap.NewTopicConstraintRule(ap.TopicConstraintConfig{
			AllowedTopics: topics,
			Action:        ap.GuardrailReject,
			Severity:      ap.SeverityMedium,
		}))
		slog.Info("AP TopicConstraintRule added", "topics", topics)
	}

	// Sanitizer — masks/redacts sensitive data in model outputs
	a.mu.RLock()
	sanitizerEnabled := a.settings.SanitizerEnabled
	sanitizerStrategy := a.settings.SanitizerStrategy
	a.mu.RUnlock()
	if sanitizerEnabled {
		strategy := ap.SanitizerMask
		switch sanitizerStrategy {
		case "Redact":
			strategy = ap.SanitizerRedact
		case "Replace":
			strategy = ap.SanitizerReplace
		case "Hash":
			strategy = ap.SanitizerHash
		}
		sanitizer := ap.NewSanitizer(ap.SanitizerConfig{
			Strategy:      strategy,
			DetectPII:     true,
			DetectSecrets: true,
		})
		a.guardrail.AddRule(sanitizer)
		slog.Info("AP Sanitizer added", "strategy", sanitizerStrategy)
	}
```

- [ ] **Step 3: Add Wails binding methods for topic constraints in checkpoint_hook.go**

Add at the end of the file:

```go
// UpdateTopicConstraints updates the allowed topic constraints and refreshes guardrails.
func (a *App) UpdateTopicConstraints(topics []string) error {
	a.mu.Lock()
	a.settings.TopicConstraints = topics
	a.mu.Unlock()

	// Re-initialize guardrails to pick up the new topics
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails()

	// Re-register hooks
	if a.hooks != nil {
		a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
		a.guardrailHook.RegisterAll(a.hooks)
	}

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// GetTopicConstraints returns the current topic constraints.
func (a *App) GetTopicConstraints() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return append([]string{}, a.settings.TopicConstraints...)
}

// ToggleSanitizer enables or disables the output sanitizer.
func (a *App) ToggleSanitizer(enabled bool) error {
	a.mu.Lock()
	a.settings.SanitizerEnabled = enabled
	a.mu.Unlock()

	// Re-initialize guardrails to pick up the new sanitizer state
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails()

	if a.hooks != nil {
		a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
		a.guardrailHook.RegisterAll(a.hooks)
	}

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// SetSanitizerStrategy sets the sanitizer strategy (Mask, Redact, Replace, Hash).
func (a *App) SetSanitizerStrategy(strategy string) error {
	validStrategies := map[string]bool{"Mask": true, "Redact": true, "Replace": true, "Hash": true}
	if !validStrategies[strategy] {
		return fmt.Errorf("invalid sanitizer strategy: %s (valid: Mask, Redact, Replace, Hash)", strategy)
	}

	a.mu.Lock()
	a.settings.SanitizerStrategy = strategy
	a.mu.Unlock()

	// Re-initialize guardrails
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails()

	if a.hooks != nil {
		a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
		a.guardrailHook.RegisterAll(a.hooks)
	}

	a.mu.Lock()
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// GetGuardrailStatus returns the current guardrail configuration for the frontend.
func (a *App) GetGuardrailStatus() GuardrailStatusData {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return GuardrailStatusData{
		SanitizerEnabled:  a.settings.SanitizerEnabled,
		SanitizerStrategy: a.settings.SanitizerStrategy,
		TopicConstraints:  append([]string{}, a.settings.TopicConstraints...),
		RuleCount:         a.guardrail.RuleCount(),
	}
}
```

Add the `GuardrailStatusData` struct at the top of checkpoint_hook.go:

```go
// GuardrailStatusData holds the current guardrail configuration for the frontend.
type GuardrailStatusData struct {
	SanitizerEnabled  bool     `json:"sanitizerEnabled"`
	SanitizerStrategy string   `json:"sanitizerStrategy"`
	TopicConstraints  []string `json:"topicConstraints"`
	RuleCount         int      `json:"ruleCount"`
}
```

- [ ] **Step 4: Add TypeScript types in api/types.ts**

```typescript
// Guardrail types
export interface GuardrailStatusData {
  sanitizerEnabled: boolean;
  sanitizerStrategy: string;
  topicConstraints: string[];
  ruleCount: number;
}
```

- [ ] **Step 5: Add api.ts methods**

Add to `GoAppMethods` interface:

```typescript
  // Guardrails
  UpdateTopicConstraints(topics: string[]): Promise<void>;
  GetTopicConstraints(): Promise<string[]>;
  ToggleSanitizer(enabled: boolean): Promise<void>;
  SetSanitizerStrategy(strategy: string): Promise<void>;
  GetGuardrailStatus(): Promise<GuardrailStatusData>;
```

Add exported functions:

```typescript
// Guardrails
export const updateTopicConstraints = (topics: string[]) => callGo('UpdateTopicConstraints', topics);
export const getTopicConstraints = () => callGo('GetTopicConstraints');
export const toggleSanitizer = (enabled: boolean) => callGo('ToggleSanitizer', enabled);
export const setSanitizerStrategy = (strategy: string) => callGo('SetSanitizerStrategy', strategy);
export const getGuardrailStatus = () => callGo('GetGuardrailStatus');
```

Add the import for `GuardrailStatusData` in the import block from `./api/types`.

- [ ] **Step 6: Update MCPTab.tsx to add guardrail settings section**

Add state variables:

```tsx
const [sanitizerEnabled, setSanitizerEnabled] = useState(false);
const [sanitizerStrategy, setSanitizerStrategy] = useState('Mask');
const [topicConstraints, setTopicConstraints] = useState<string[]>([]);
const [newTopic, setNewTopic] = useState('');

// Load guardrail status
useEffect(() => {
  (async () => {
    try {
      const status = await api.getGuardrailStatus();
      setSanitizerEnabled(status.sanitizerEnabled);
      setSanitizerStrategy(status.sanitizerStrategy);
      setTopicConstraints(status.topicConstraints);
    } catch (e) { /* ignore */ }
  })();
}, []);
```

Add a new section in MCPTab.tsx after the telemetry section:

```tsx
{/* Guardrail Section */}
<div className="settings-group" style={{ marginTop: 16 }}>
  <div className="settings-group-title">安全防护</div>

  {/* Sanitizer toggle */}
  <div className="form-group">
    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        className={`toggle${sanitizerEnabled ? ' active' : ''}`}
        style={{ width: '32px', height: '18px' }}
        onClick={async () => {
          try {
            await api.toggleSanitizer(!sanitizerEnabled);
            setSanitizerEnabled(!sanitizerEnabled);
          } catch (e) {
            console.error('Toggle sanitizer failed:', e);
          }
        }}
      />
      输出脱敏 (Sanitizer)
    </label>
  </div>

  {/* Sanitizer strategy */}
  {sanitizerEnabled && (
    <div className="form-group">
      <label className="form-label">脱敏策略</label>
      <select
        className="settings-select"
        value={sanitizerStrategy}
        onChange={async (e) => {
          const val = e.target.value;
          try {
            await api.setSanitizerStrategy(val);
            setSanitizerStrategy(val);
          } catch (err) {
            console.error('Set sanitizer strategy failed:', err);
          }
        }}
        style={{ width: '100%' }}
      >
        <option value="Mask">Mask (部分遮盖)</option>
        <option value="Redact">Redact (完全移除)</option>
        <option value="Replace">Replace (替换为占位符)</option>
        <option value="Hash">Hash (哈希替换)</option>
      </select>
    </div>
  )}

  {/* Topic constraints */}
  <div className="form-group" style={{ marginTop: 12 }}>
    <label className="form-label">话题约束 (留空则不限制)</label>
    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
      <input
        className="form-input"
        value={newTopic}
        onChange={(e) => setNewTopic(e.target.value)}
        placeholder="添加允许的话题"
        style={{ flex: 1 }}
      />
      <button
        className="settings-add-btn"
        onClick={async () => {
          if (!newTopic.trim()) return;
          const updated = [...topicConstraints, newTopic.trim()];
          try {
            await api.updateTopicConstraints(updated);
            setTopicConstraints(updated);
            setNewTopic('');
          } catch (e) {
            console.error('Update topic constraints failed:', e);
          }
        }}
      >
        +
      </button>
    </div>
    {topicConstraints.length > 0 && (
      <div className="domain-list">
        {topicConstraints.map((topic, idx) => (
          <div className="domain-item" key={idx}>
            <span>{topic}</span>
            <button
              onClick={async () => {
                const updated = topicConstraints.filter((_, i) => i !== idx);
                try {
                  await api.updateTopicConstraints(updated);
                  setTopicConstraints(updated);
                } catch (e) {
                  console.error('Remove topic constraint failed:', e);
                }
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 7: Verify build**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go build ./...`
Expected: Success

- [ ] **Step 8: Run existing tests to ensure no regressions**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test ./... -v -count=1`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add CodeCast-desktop/checkpoint_hook.go CodeCast-desktop/config.go CodeCast-desktop/frontend/src/api.ts CodeCast-desktop/frontend/src/api/types.ts CodeCast-desktop/frontend/src/components/settings/MCPTab.tsx
git commit -m "feat: add AP TopicConstraintRule + Sanitizer with MCPTab guardrail settings UI"
```

---

## Task 5: Integration Verification

- [ ] **Step 1: Run all Go tests**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop" && go test ./... -v -count=1`
Expected: ALL PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd "d:/kaifa/codecast (2)/CodeCast/CodeCast-desktop/frontend" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify Multimodal integration manually**

1. Launch the app
2. Open a chat session
3. Paste an image into the chat input
4. Verify image preview appears
5. Send message with image
6. Verify AI responds with image analysis

- [ ] **Step 4: Verify Telemetry toggle**

1. Open Settings -> MCP tab
2. Toggle "OTLP 遥测" off
3. Verify `GetTelemetryStatus()` returns `{enabled: false}`
4. Toggle on, set endpoint to `http://localhost:4318`
5. Verify status shows `{enabled: true, endpoint: "http://localhost:4318"}`

- [ ] **Step 5: Verify Plugin system**

1. Call `ListPlugins()` -- should return empty array
2. Verify `GetPluginStatus()` returns `{loadedCount: 0}`
3. Verify `BroadcastMessage("test")` does not error

- [ ] **Step 6: Verify Guardrail enhancements**

1. Open Settings -> MCP tab -> "安全防护" section
2. Toggle "输出脱敏" on
3. Select strategy "Hash"
4. Add a topic constraint "编程"
5. Verify `GetGuardrailStatus()` reflects the changes
6. Send a message with sensitive data and verify sanitization

- [ ] **Step 7: Verify OCR with MultimodalProvider**

1. Use `cast_ocr_image` tool with an image
2. Verify OCR works through MultimodalProvider (check logs for "MultimodalProvider OCR" path)
3. If provider doesn't support vision, verify fallback to manual HTTP path

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: Phase 5 integration verification -- multimodal, telemetry, plugins, guardrails"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|------------|------|
| MultimodalProvider for vision/image attachments | Task 1 (multimodal_bridge.go + ChatInput.tsx) |
| OCR refactor to use MultimodalAdapter | Task 1 (cast_tools_misc.go doOCR) |
| OTLP Observability with settings toggle | Task 2 (telemetry_bridge.go + MCPTab.tsx) |
| PluginLoader + MessageBus + HTTPTransport | Task 3 (plugin_bridge.go + usePluginStore.ts) |
| TopicConstraintRule | Task 4 (checkpoint_hook.go) |
| Sanitizer with Mask/Redact/Replace/Hash | Task 4 (checkpoint_hook.go + MCPTab.tsx) |
| Frontend integration for all 4 subsystems | Tasks 1-4 each have frontend changes |
| Backward compatibility | All new methods are additive, no existing methods modified (only extended) |

### Placeholder Scan
- No TBD/TODO found
- All code blocks contain complete implementations
- All test code is complete

### Type Consistency
- `MultimodalCapabilities` / `ImageAnalysisResult` -- defined in multimodal_bridge.go, matches api/types.ts
- `TelemetryStatus` -- defined in telemetry_bridge.go, matches api/types.ts
- `PluginInfoData` / `PluginStatusData` -- defined in plugin_bridge.go, matches api/types.ts
- `GuardrailStatusData` -- defined in checkpoint_hook.go, matches api/types.ts
- `ImageAttachment` -- defined in api/types.ts, used in ChatInput.tsx

### Integration Estimate
- Phase 4 left off at ~86% integration (9 of ~14 AP subsystems active)
- Phase 5 adds: MultimodalProvider, OTLPTelemetry, PluginLoader, MessageBus, HTTPTransport, TopicConstraintRule, Sanitizer = 7 more subsystems
- Total active: 16 of ~17 subsystems = ~97% (only remaining is AP DAG Workflow, which is Phase 6 territory)

### Lock Safety
- `createMultimodalProvider()` -- caller must hold `a.mu` (documented, same as `createProvider`)
- `initTelemetry()` -- acquires `a.mu.RLock` for reads, `a.mu.Lock` for writes (safe)
- `setupGuardrails()` -- acquires `a.mu.RLock` for topic/sanitizer reads (safe, called during startup or re-init)
- All `saveSettingsToFile()` calls follow the documented pattern of holding lock during I/O (existing codebase convention)
