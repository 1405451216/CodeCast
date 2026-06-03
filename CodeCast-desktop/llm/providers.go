package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type DeepSeekProvider struct {
	*BaseProvider
}

func NewDeepSeekProvider(apiKey string) *DeepSeekProvider {
	return &DeepSeekProvider{
		BaseProvider: NewBaseProvider(
			"https://api.deepseek.com/v1",
			apiKey,
			"deepseek-v4-flash",
			60*time.Second,
		),
	}
}

func (p *DeepSeekProvider) GetName() string { return "DeepSeek" }
func (p *DeepSeekProvider) GetID() string   { return "deepseek" }

func (p *DeepSeekProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	if req.Model == "" {
		req.Model = p.model
	}

	body, err := p.doRequest(ctx, "POST", "/chat/completions", req, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		ID         string  `json:"id"`
		Model      string  `json:"model"`
		Choices    []struct {
			Message      Message `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &Response{
		ID:          resp.ID,
		Model:       resp.Model,
		Content:     resp.Choices[0].Message.Content,
		Role:        resp.Choices[0].Message.Role,
		FinishReason: resp.Choices[0].FinishReason,
		Usage:       resp.Usage,
	}, nil
}

func (p *DeepSeekProvider) SendWithSystem(ctx context.Context, systemPrompt string, messages []Message, model string) (*Response, error) {
	allMessages := make([]Message, 0, len(messages)+1)
	allMessages = append(allMessages, Message{Role: "system", Content: systemPrompt})
	allMessages = append(allMessages, messages...)

	req := &Request{
		Model:    model,
		Messages: allMessages,
	}
	return p.Send(ctx, req)
}

func (p *DeepSeekProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	if req.Model == "" {
		req.Model = p.model
	}
	req.Stream = true

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := NewSSEScanner(resp.Body)
		for scanner.Scan() {
			data := scanner.Bytes()
			
			if bytes.HasPrefix(data, []byte("data: [DONE]")) {
				break
			}

			if !bytes.HasPrefix(data, []byte("data: ")) {
				continue
			}

			jsonData := bytes.TrimPrefix(data, []byte("data: "))
			
			var chunk StreamChunk
			if err := json.Unmarshal(jsonData, &chunk); err != nil {
				continue
			}

			select {
			case ch <- &chunk:
			case <-ctx.Done():
				return
			}
		}

		if err := scanner.Err(); err != nil {
			// 发送错误到 channel 或记录日志
		}
	}()

	return ch, nil
}

// OpenAI 兼容 Provider（可用于 OpenAI、Azure、兼容 API）
type OpenAIProvider struct {
	*BaseProvider
}

func NewOpenAIProvider(baseURL, apiKey string) *OpenAIProvider {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &OpenAIProvider{
		BaseProvider: NewBaseProvider(baseURL, apiKey, "gpt-4o", 60*time.Second),
	}
}

func (p *OpenAIProvider) GetName() string { return "OpenAI" }
func (p *OpenAIProvider) GetID() string   { return "openai" }

func (p *OpenAIProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	if req.Model == "" {
		req.Model = p.model
	}

	body, err := p.doRequest(ctx, "POST", "/chat/completions", req, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		ID         string  `json:"id"`
		Model      string  `json:"model"`
		Choices    []struct {
			Message      Message `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}

	return &Response{
		ID:          resp.ID,
		Model:       resp.Model,
		Content:     resp.Choices[0].Message.Content,
		Role:        resp.Choices[0].Message.Role,
		FinishReason: resp.Choices[0].FinishReason,
		Usage:       resp.Usage,
	}, nil
}

func (p *OpenAIProvider) SendWithSystem(ctx context.Context, systemPrompt string, messages []Message, model string) (*Response, error) {
	allMessages := make([]Message, 0, len(messages)+1)
	allMessages = append(allMessages, Message{Role: "system", Content: systemPrompt})
	allMessages = append(allMessages, messages...)
	
	req := &Request{
		Model:    model,
		Messages: allMessages,
	}
	return p.Send(ctx, req)
}

func (p *OpenAIProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	if req.Model == "" {
		req.Model = p.model
	}
	req.Stream = true

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := NewSSEScanner(resp.Body)
		for scanner.Scan() {
			data := scanner.Bytes()
			
			if bytes.HasPrefix(data, []byte("data: [DONE]")) {
				break
			}

			if !bytes.HasPrefix(data, []byte("data: ")) {
				continue
			}

			jsonData := bytes.TrimPrefix(data, []byte("data: "))
			
			var chunk StreamChunk
			if err := json.Unmarshal(jsonData, &chunk); err != nil {
				continue
			}

			select {
			case ch <- &chunk:
			case <-ctx.Done():
				return
			}
		}
	}()

	return ch, nil
}

// Anthropic Claude Provider
type AnthropicProvider struct {
	*BaseProvider
}

func NewAnthropicProvider(apiKey string) *AnthropicProvider {
	return &AnthropicProvider{
		BaseProvider: NewBaseProvider(
			"https://api.anthropic.com/v1",
			apiKey,
			"claude-sonnet-4-20250514",
			60*time.Second,
		),
	}
}

func (p *AnthropicProvider) GetName() string { return "Anthropic Claude" }
func (p *AnthropicProvider) GetID() string   { return "anthropic" }

type anthropicRequest struct {
	Model     string              `json:"model"`
	MaxTokens int                 `json:"max_tokens"`
	System    string              `json:"system,omitempty"`
	Messages  []anthropicMessage   `json:"messages"`
	Stream    bool                `json:"stream,omitempty"`
	Tools     []anthropicTool      `json:"tools,omitempty"`
}

type anthropicMessage struct {
	Role    string                   `json:"role"`
	Content []anthropicContentBlock  `json:"content"`
}

type anthropicContentBlock struct {
	Type  string `json:"type"`
	Text  string `json:"text,omitempty"`
	Type2 string `json:"type,omitempty"` // for tool_use/tool_result
	ID    string `json:"id,omitempty"`
	Name  string `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

type anthropicTool struct {
	Name        string          `json:"name"`
	Description string         `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

type anthropicResponse struct {
	ID           string                    `json:"id"`
	Type         string                    `json:"type"`
	Role         string                    `json:"role"`
	Content      []anthropicContentBlock   `json:"content"`
	Model        string                    `json:"model"`
	StopReason   string                    `json:"stop_reason"`
	Usage        anthropicUsage            `json:"usage"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func (p *AnthropicProvider) convertMessages(req *Request) ([]anthropicMessage, string) {
	var systemPrompt string
	messages := make([]anthropicMessage, 0)

	for _, msg := range req.Messages {
		if msg.Role == "system" {
			systemPrompt = msg.Content
			continue
		}

		content := []anthropicContentBlock{
			{
				Type: "text",
				Text: msg.Content,
			},
		}

		role := msg.Role
		if msg.Role == "assistant" {
			role = "assistant"
		}

		messages = append(messages, anthropicMessage{
			Role:    role,
			Content: content,
		})
	}

	return messages, systemPrompt
}

func (p *AnthropicProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	model := req.Model
	if model == "" {
		model = p.model
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	messages, systemPrompt := p.convertMessages(req)

	aReq := anthropicRequest{
		Model:     model,
		MaxTokens: maxTokens,
		System:    systemPrompt,
		Messages:  messages,
		Stream:    false,
	}

	headers := map[string]string{
		"x-api-key":        p.apiKey,
		"anthropic-version": "2023-06-01",
	}

	body, err := p.doRequest(ctx, "POST", "/messages", aReq, headers)
	if err != nil {
		return nil, err
	}

	var aResp anthropicResponse
	if err := json.Unmarshal(body, &aResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	content := ""
	for _, block := range aResp.Content {
		if block.Type == "text" {
			content += block.Text
		}
	}

	finishReason := aResp.StopReason
	if finishReason == "end_turn" {
		finishReason = "stop"
	} else if finishReason == "max_tokens" {
		finishReason = "length"
	}

	return &Response{
		ID:          aResp.ID,
		Model:       aResp.Model,
		Content:     content,
		Role:        aResp.Role,
		FinishReason: finishReason,
		Usage: Usage{
			PromptTokens:     aResp.Usage.InputTokens,
			CompletionTokens: aResp.Usage.OutputTokens,
			TotalTokens:      aResp.Usage.InputTokens + aResp.Usage.OutputTokens,
		},
	}, nil
}

func (p *AnthropicProvider) SendWithSystem(ctx context.Context, systemPrompt string, messages []Message, model string) (*Response, error) {
	req := &Request{
		Model:    model,
		Messages: append([]Message{{Role: "system", Content: systemPrompt}}, messages...),
	}
	return p.Send(ctx, req)
}

func (p *AnthropicProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	model := req.Model
	if model == "" {
		model = p.model
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}

	messages, systemPrompt := p.convertMessages(req)

	aReq := anthropicRequest{
		Model:     model,
		MaxTokens: maxTokens,
		System:    systemPrompt,
		Messages:  messages,
		Stream:    true,
	}

	jsonBody, err := json.Marshal(aReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("x-api-key", p.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := NewSSEScanner(resp.Body)
		for scanner.Scan() {
			data := scanner.Bytes()

			if bytes.HasPrefix(data, []byte("event: message_stop")) || 
			   bytes.HasPrefix(data, []byte("data: [DONE]")) {
				break
			}

			if !bytes.HasPrefix(data, []byte("data: ")) {
				continue
			}

			jsonData := bytes.TrimPrefix(data, []byte("data: "))
			
			// 解析 Anthropic SSE 格式
			var event struct {
				Type    string `json:"type"`
				Index   *int   `json:"index,omitempty"`
				Delta   *struct {
					Type       string `json:"type,omitempty"`
					Text       string `json:"text,omitempty"`
					StopReason *string `json:"stop_reason,omitempty"`
				} `json:"delta,omitempty"`
			}
			if err := json.Unmarshal(jsonData, &event); err != nil {
				continue
			}

			if event.Type == "content_block_delta" && event.Delta != nil && event.Delta.Text != "" {
				chunk := &StreamChunk{
					ID:      "",
					Object:  "chat.completion.chunk",
					Created: time.Now().Unix(),
					Model:   model,
					Choices: []StreamChoice{
						{
							Index: 0,
							Delta: StreamDelta{
								Content: event.Delta.Text,
							},
						},
					},
				}

				select {
				case ch <- chunk:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return ch, nil
}

// ==================== Kimi (Moonshot) Provider ====================
// 月之暗面 Kimi 模型 - OpenAI 兼容 API
type KimiProvider struct {
	*BaseProvider
}

func NewKimiProvider(apiKey string) *KimiProvider {
	return &KimiProvider{
		BaseProvider: NewBaseProvider(
			"https://api.moonshot.cn/v1",
			apiKey,
			"kimi-k2.6",
			60*time.Second,
		),
	}
}

func (p *KimiProvider) GetName() string { return "Kimi (Moonshot)" }
func (p *KimiProvider) GetID() string   { return "kimi" }

func (p *KimiProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	if req.Model == "" {
		req.Model = p.model
	}

	body, err := p.doRequest(ctx, "POST", "/chat/completions", req, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		ID         string  `json:"id"`
		Model      string  `json:"model"`
		Choices    []struct {
			Message      Message `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Kimi response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in Kimi response")
	}

	return &Response{
		ID:          resp.ID,
		Model:       resp.Model,
		Content:     resp.Choices[0].Message.Content,
		Role:        resp.Choices[0].Message.Role,
		FinishReason: resp.Choices[0].FinishReason,
		Usage:       resp.Usage,
	}, nil
}

func (p *KimiProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	if req.Model == "" {
		req.Model = p.model
	}
	req.Stream = true

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send Kimi request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("Kimi API error: status=%d body=%s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		for scanner.Scan() {
			line := scanner.Bytes()
			line = bytes.TrimSpace(line)

			if !bytes.HasPrefix(line, []byte("data: ")) {
				continue
			}
			data := bytes.TrimPrefix(line, []byte("data: "))
			if bytes.Equal(data, []byte("[DONE]")) {
				break
			}

			var chunk struct {
				ID      string `json:"id"`
			 Choices []struct {
					Delta struct {
						Role    string `json:"role,omitempty"`
						Content string `json:"content,omitempty"`
					} `json:"delta"`
					FinishReason *string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal(data, &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				finishReason := ""
				if chunk.Choices[0].FinishReason != nil {
					finishReason = *chunk.Choices[0].FinishReason
				}

				ch <- &StreamChunk{
					Content:     chunk.Choices[0].Delta.Content,
					FinishReason: finishReason,
				}
			}
		}

		if err := scanner.Err(); err != nil {
			// 记录日志或忽略流式读取错误
		}
	}()

	return ch, nil
}

// ==================== GLM (智谱清言) Provider ====================
// 智谱 AI GLM 模型 - OpenAI 兼容 API
type GLMProvider struct {
	*BaseProvider
}

func NewGLMProvider(apiKey string) *GLMProvider {
	return &GLMProvider{
		BaseProvider: NewBaseProvider(
			"https://open.bigmodel.cn/api/paas/v4",
			apiKey,
			"glm-5",
			60*time.Second,
		),
	}
}

func (p *GLMProvider) GetName() string { return "GLM (智谱)" }
func (p *GLMProvider) GetID() string   { return "glm" }

func (p *GLMProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	if req.Model == "" {
		req.Model = p.model
	}

	body, err := p.doRequest(ctx, "POST", "/chat/completions", req, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		ID         string  `json:"id"`
		Model      string  `json:"model"`
		Choices    []struct {
			Message      Message `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse GLM response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in GLM response")
	}

	return &Response{
		ID:          resp.ID,
		Model:       resp.Model,
		Content:     resp.Choices[0].Message.Content,
		Role:        resp.Choices[0].Message.Role,
		FinishReason: resp.Choices[0].FinishReason,
		Usage:       resp.Usage,
	}, nil
}

func (p *GLMProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	if req.Model == "" {
		req.Model = p.model
	}
	req.Stream = true

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send GLM request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("GLM API error: status=%d body=%s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		for scanner.Scan() {
			line := scanner.Bytes()
			line = bytes.TrimSpace(line)

			if !bytes.HasPrefix(line, []byte("data: ")) {
				continue
			}
			data := bytes.TrimPrefix(line, []byte("data: "))
			if bytes.Equal(data, []byte("[DONE]")) {
				break
			}

			var chunk struct {
				ID      string `json:"id"`
				Choices []struct {
					Delta struct {
						Role    string `json:"role,omitempty"`
						Content string `json:"content,omitempty"`
					} `json:"delta"`
					FinishReason *string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal(data, &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				finishReason := ""
				if chunk.Choices[0].FinishReason != nil {
					finishReason = *chunk.Choices[0].FinishReason
				}

				ch <- &StreamChunk{
					Content:     chunk.Choices[0].Delta.Content,
					FinishReason: finishReason,
				}
			}
		}

		if err := scanner.Err(); err != nil {
			// 记录日志或忽略流式读取错误
		}
	}()

	return ch, nil
}

// ==================== MiMo (小米) Provider ====================
// 小米 MiMo 模型 - OpenAI 兼容 API（2026年5月降价后超性价比）
type MimoProvider struct {
	*BaseProvider
}

func NewMimoProvider(apiKey string) *MimoProvider {
	return &MimoProvider{
		BaseProvider: NewBaseProvider(
			"https://api.xiaomimimo.com/v1",
			apiKey,
			"mimo-v2.5-pro",
			60*time.Second,
		),
	}
}

func (p *MimoProvider) GetName() string { return "MiMo (小米)" }
func (p *MimoProvider) GetID() string   { return "mimo" }

func (p *MimoProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	if req.Model == "" {
		req.Model = p.model
	}

	body, err := p.doRequest(ctx, "POST", "/chat/completions", req, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		ID         string  `json:"id"`
		Model      string  `json:"model"`
		Choices    []struct {
			Message      Message `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse MiMo response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in MiMo response")
	}

	return &Response{
		ID:          resp.ID,
		Model:       resp.Model,
		Content:     resp.Choices[0].Message.Content,
		Role:        resp.Choices[0].Message.Role,
		FinishReason: resp.Choices[0].FinishReason,
		Usage:       resp.Usage,
	}, nil
}

func (p *MimoProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	if req.Model == "" {
		req.Model = p.model
	}
	req.Stream = true

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send MiMo request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("MiMo API error: status=%d body=%s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		for scanner.Scan() {
			line := scanner.Bytes()
			line = bytes.TrimSpace(line)

			if !bytes.HasPrefix(line, []byte("data: ")) {
				continue
			}
			data := bytes.TrimPrefix(line, []byte("data: "))
			if bytes.Equal(data, []byte("[DONE]")) {
				break
			}

			var chunk struct {
				ID      string `json:"id"`
				Choices []struct {
					Delta struct {
						Role    string `json:"role,omitempty"`
						Content string `json:"content,omitempty"`
					} `json:"delta"`
					FinishReason *string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal(data, &chunk); err != nil {
				continue
			}

			if len(chunk.Choices) > 0 {
				finishReason := ""
				if chunk.Choices[0].FinishReason != nil {
					finishReason = *chunk.Choices[0].FinishReason
				}

				ch <- &StreamChunk{
					Content:     chunk.Choices[0].Delta.Content,
					FinishReason: finishReason,
				}
			}
		}

		if err := scanner.Err(); err != nil {
			// 记录日志或忽略流式读取错误
		}
	}()

	return ch, nil
}

// Ollama 本地模型 Provider
type OllamaProvider struct {
	*BaseProvider
}

func NewOllamaProvider(baseURL string) *OllamaProvider {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	return &OllamaProvider{
		BaseProvider: NewBaseProvider(baseURL, "", "qwen2.5-coder:32b", 120*time.Second),
	}
}

func (p *OllamaProvider) GetName() string { return "Ollama (本地)" }
func (p *OllamaProvider) GetID() string   { return "ollama" }
func (p *OllamaProvider) ValidateConfig(config map[string]string) error {
	// Ollama 不需要 API Key，只需检查连接
	return nil
}

type ollamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt,omitempty"`
	Stream bool   `json:"stream"`
	Messages []ollamaMessage `json:"messages,omitempty"`
	System  string `json:"system,omitempty"`
	Options ollamaOptions `json:"options,omitempty"`
}

type ollamaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaOptions struct {
	Temperature float64 `json:"temperature,omitempty"`
	NumPredict  int     `json:"num_predict,omitempty"`
}

type ollamaResponse struct {
	Model   string `json:"model"`
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	Done    bool `json:"done"`
}

func (p *OllamaProvider) Send(ctx context.Context, req *Request) (*Response, error) {
	model := req.Model
	if model == "" {
		model = p.model
	}

	oReq := ollamaRequest{
		Model:  model,
		Stream: false,
		System: "",
		Options: ollamaOptions{
			Temperature: req.Temperature,
			NumPredict:  req.MaxTokens,
		},
	}

	// 转换消息格式
	var promptParts []string
	for _, msg := range req.Messages {
		switch msg.Role {
		case "system":
			oReq.System = msg.Content
		case "user":
			promptParts = append(promptParts, msg.Content)
		case "assistant":
			promptParts = append(promptParts, msg.Content)
		}
	}

	if len(oReq.System) > 0 && len(oReq.System) < 1000 {
		// 对于短系统提示，使用 messages 格式
		oReq.Messages = []ollamaMessage{}
		for _, msg := range req.Messages {
			oReq.Messages = append(oReq.Messages, ollamaMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
		oReq.Prompt = ""
	} else {
		oReq.Prompt = strings.Join(promptParts, "\n")
	}

	body, err := p.doRequest(ctx, "POST", "/api/chat", oReq, nil)
	if err != nil {
		return nil, err
	}

	var oResp ollamaResponse
	if err := json.Unmarshal(body, &oResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &Response{
		ID:          fmt.Sprintf("ollama-%d", time.Now().Unix()),
		Model:       oResp.Model,
		Content:     oResp.Message.Content,
		Role:        oResp.Message.Role,
		FinishReason: "stop",
		Usage: Usage{
			TotalTokens: len(oResp.Message.Content) / 4, // 粗略估算
		},
	}, nil
}

func (p *OllamaProvider) SendWithSystem(ctx context.Context, systemPrompt string, messages []Message, model string) (*Response, error) {
	req := &Request{
		Model:    model,
		Messages: append([]Message{{Role: "system", Content: systemPrompt}}, messages...),
	}
	return p.Send(ctx, req)
}

func (p *OllamaProvider) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	model := req.Model
	if model == "" {
		model = p.model
	}

	oReq := ollamaRequest{
		Model:  model,
		Stream: true,
		Options: ollamaOptions{
			Temperature: req.Temperature,
		},
	}

	var promptParts []string
	for _, msg := range req.Messages {
		promptParts = append(promptParts, msg.Content)
	}
	oReq.Prompt = strings.Join(promptParts, "\n")

	jsonBody, err := json.Marshal(oReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/chat", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("Ollama error (status %d): %s", resp.StatusCode, string(body))
	}

	ch := make(chan *StreamChunk, 10)

	go func() {
		defer resp.Body.Close()
		defer close(ch)

		decoder := json.NewDecoder(resp.Body)
		for {
			var chunk struct {
				Message struct {
					Content string `json:"content"`
					Role    string `json:"role"`
				} `json:"message"`
				Done bool `json:"done"`
			}

			if err := decoder.Decode(&chunk); err != nil {
				if err == io.EOF {
					break
				}
				continue
			}

			if chunk.Done {
				break
			}

			if chunk.Message.Content != "" {
				streamChunk := &StreamChunk{
					ID:      fmt.Sprintf("ollama-%d", time.Now().Unix()),
					Object:  "chat.completion.chunk",
					Created: time.Now().Unix(),
					Model:   model,
					Choices: []StreamChoice{
						{
							Index: 0,
							Delta: StreamDelta{
								Content: chunk.Message.Content,
								Role:    chunk.Message.Role,
							},
						},
					},
				}

				select {
				case ch <- streamChunk:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return ch, nil
}

// SSE Scanner 用于解析 Server-Sent Events
type SSEScanner struct {
	scanner *bufio.Scanner
	reader  io.Reader
}

func NewSSEScanner(r io.Reader) *SSEScanner {
	return &SSEScanner{
		scanner: bufio.NewScanner(r),
		reader:  r,
	}
}

func (s *SSEScanner) Scan() bool {
	return s.scanner.Scan()
}

func (s *SSEScanner) Bytes() []byte {
	return s.scanner.Bytes()
}

func (s *SSEScanner) Err() error {
	return s.scanner.Err()
}
