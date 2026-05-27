package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

type Request struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stop        []string  `json:"stop,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
	Tools       []Tool    `json:"tools,omitempty"`
}

type Tool struct {
	Type     string          `json:"type"`
	Function json.RawMessage `json:"function"`
}

type Response struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Content string `json:"content"`
	Role    string `json:"role"`
	FinishReason string `json:"finish_reason"`
	Usage   Usage  `json:"usage"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type StreamChunk struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
}

type StreamChoice struct {
	Index        int           `json:"index"`
	Delta        StreamDelta   `json:"delta"`
	FinishReason *string       `json:"finish_reason"`
}

type StreamDelta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

// Provider 接口定义所有 LLM 提供商必须实现的方法
type Provider interface {
	Send(ctx context.Context, req *Request) (*Response, error)
	SendWithSystem(ctx context.Context, systemPrompt string, messages []Message, model string) (*Response, error)
	Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error)
	ValidateConfig(config map[string]string) error
	GetName() string
	GetID() string
}

// BaseProvider 提供通用的 HTTP 客户端功能
type BaseProvider struct {
	client  *http.Client
	baseURL string
	apiKey  string
	model   string
	timeout time.Duration
}

func NewBaseProvider(baseURL, apiKey, model string, timeout time.Duration) *BaseProvider {
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	return &BaseProvider{
		client: &http.Client{
			Timeout: timeout,
		},
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		model:   model,
	}
}

func (p *BaseProvider) doRequest(ctx context.Context, method, endpoint string, body interface{}, headers map[string]string) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, p.baseURL+endpoint, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

func (p *BaseProvider) GetName() string { return "base" }
func (p *BaseProvider) GetID() string   { return "base" }
func (p *BaseProvider) ValidateConfig(config map[string]string) error {
	if _, ok := config["api_key"]; !ok && p.apiKey == "" {
		return fmt.Errorf("api_key is required")
	}
	return nil
}
