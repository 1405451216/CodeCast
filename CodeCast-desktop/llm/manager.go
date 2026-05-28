package llm

import (
	"context"
	"fmt"
	"sync"
)

// ProviderManager 管理多个 LLM Provider 实例
type ProviderManager struct {
	providers map[string]Provider
	mu        sync.RWMutex
	defaultProvider string
}

var (
	globalManager *ProviderManager
	once         sync.Once
)

func GetProviderManager() *ProviderManager {
	once.Do(func() {
		globalManager = &ProviderManager{
			providers: make(map[string]Provider),
		}
	})
	return globalManager
}

func (pm *ProviderManager) Register(provider Provider) error {
	pm.mu.Lock()
	defer pm.pm.Unlock()

	id := provider.GetID()
	if _, exists := pm.providers[id]; exists {
		return fmt.Errorf("provider %s already registered", id)
	}

	pm.providers[id] = provider

	if pm.defaultProvider == "" {
		pm.defaultProvider = id
	}

	return nil
}

func (pm *ProviderManager) GetProvider(id string) (Provider, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	provider, exists := pm.providers[id]
	if !exists {
		return nil, fmt.Errorf("provider %s not found", id)
	}
	return provider, nil
}

func (pm *ProviderManager) GetDefaultProvider() (Provider, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if pm.defaultProvider == "" {
		return nil, fmt.Errorf("no default provider set")
	}
	return pm.GetProvider(pm.defaultProvider)
}

func (pm *ProviderManager) SetDefault(id string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if _, exists := pm.providers[id]; !exists {
		return fmt.Errorf("provider %s not found", id)
	}

	pm.defaultProvider = id
	return nil
}

func (pm *ProviderManager) ListProviders() []ProviderInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var infos []ProviderInfo
	for id, p := range pm.providers {
		infos = append(infos, ProviderInfo{
			ID:   id,
			Name: p.GetName(),
		})
	}
	return infos
}

type ProviderInfo struct {
	ID   string
	Name string
}

// Send 使用默认 Provider 发送消息
func (pm *ProviderManager) Send(ctx context.Context, req *Request) (*Response, error) {
	provider, err := pm.GetDefaultProvider()
	if err != nil {
		return nil, err
	}
	return provider.Send(ctx, req)
}

// SendWithProvider 使用指定的 Provider 发送消息
func (pm *ProviderManager) SendWithProvider(ctx context.Context, providerID string, req *Request) (*Response, error) {
	provider, err := pm.GetProvider(providerID)
	if err != nil {
		return nil, err
	}
	return provider.Send(ctx, req)
}

// Stream 使用默认 Provider 流式发送消息
func (pm *ProviderManager) Stream(ctx context.Context, req *Request) (<-chan *StreamChunk, error) {
	provider, err := pm.GetDefaultProvider()
	if err != nil {
		return nil, err
	}
	return provider.Stream(ctx, req)
}

// InitializeProviders 根据配置初始化所有可用的 Provider
func InitializeProviders(config *LLMConfig) error {
	pm := GetProviderManager()

	// DeepSeek Provider
	if config.DeepSeek.APIKey != "" {
		ds := NewDeepSeekProvider(config.DeepSeek.APIKey)
		if config.DeepSeek.BaseURL != "" {
			ds.baseURL = config.DeepSeek.BaseURL
		}
		if err := pm.Register(ds); err != nil {
			return fmt.Errorf("failed to register DeepSeek provider: %w", err)
		}
		if config.DefaultProvider == "deepseek" || config.DefaultProvider == "" {
			pm.SetDefault("deepseek")
		}
	}

	// OpenAI Provider
	if config.OpenAI.APIKey != "" {
		oai := NewOpenAIProvider(config.OpenAI.BaseURL, config.OpenAI.APIKey)
		if err := pm.Register(oai); err != nil {
			return fmt.Errorf("failed to register OpenAI provider: %w", err)
		}
		if config.DefaultProvider == "openai" {
			pm.SetDefault("openai")
		}
	}

	// Anthropic Provider
	if config.Anthropic.APIKey != "" {
		anthropic := NewAnthropicProvider(config.Anthropic.APIKey)
		if err := pm.Register(anthropic); err != nil {
			return fmt.Errorf("failed to register Anthropic provider: %w", err)
		}
		if config.DefaultProvider == "anthropic" {
			pm.SetDefault("anthropic")
		}
	}

	// Ollama Provider (始终尝试注册，因为不需要 API Key)
	if config.Ollama.Enabled {
		ollama := NewOllamaProvider(config.Ollama.BaseURL)
		if err := pm.Register(ollama); err != nil {
			return fmt.Errorf("failed to register Ollama provider: %w", err)
		}
		if config.DefaultProvider == "ollama" {
			pm.SetDefault("ollama")
		}
	}

	// Kimi (Moonshot) Provider
	if config.Kimi.APIKey != "" {
		kimi := NewKimiProvider(config.Kimi.APIKey)
		if config.Kimi.BaseURL != "" {
			kimi.baseURL = config.Kimi.BaseURL
		}
		if err := pm.Register(kimi); err != nil {
			return fmt.Errorf("failed to register Kimi provider: %w", err)
		}
		if config.DefaultProvider == "kimi" {
			pm.SetDefault("kimi")
		}
	}

	// GLM (智谱) Provider
	if config.GLM.APIKey != "" {
		glm := NewGLMProvider(config.GLM.APIKey)
		if config.GLM.BaseURL != "" {
			glm.baseURL = config.GLM.BaseURL
		}
		if err := pm.Register(glm); err != nil {
			return fmt.Errorf("failed to register GLM provider: %w", err)
		}
		if config.DefaultProvider == "glm" {
			pm.SetDefault("glm")
		}
	}

	// MiMo (小米) Provider
	if config.Mimo.APIKey != "" {
		mimo := NewMimoProvider(config.Mimo.APIKey)
		if config.Mimo.BaseURL != "" {
			mimo.baseURL = config.Mimo.BaseURL
		}
		if err := pm.Register(mimo); err != nil {
			return fmt.Errorf("failed to register MiMo provider: %w", err)
		}
		if config.DefaultProvider == "mimo" {
			pm.SetDefault("mimo")
		}
	}

	return nil
}

// LLMConfig 定义所有 Provider 的配置
type LLMConfig struct {
	DefaultProvider string        `json:"default_provider"`
	DeepSeek       DeepSeekConfig `json:"deepseek"`
	OpenAI         OpenAIConfig   `json:"openai"`
	Anthropic      AnthropicConfig `json:"anthropic"`
	Ollama         OllamaConfig   `json:"ollama"`
	Kimi           KimiConfig     `json:"kimi"`
	GLM            GLMConfig      `json:"glm"`
	Mimo           MimoConfig     `json:"mimo"`
}

type DeepSeekConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
}

type OpenAIConfig struct {
	APIKey       string `json:"api_key"`
	BaseURL      string `json:"base_url,omitempty"`
	Organization string `json:"organization,omitempty"`
}

type AnthropicConfig struct {
	APIKey string `json:"api_key"`
}

type OllamaConfig struct {
	Enabled bool   `json:"enabled"`
	BaseURL string `json:"base_url,omitempty"`
}

type KimiConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
}

type GLMConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
}

type MimoConfig struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
}

// GetAvailableModels 返回所有可用模型的列表
func (pm *ProviderManager) GetAvailableModels() []ModelInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var models []ModelInfo
	for id, p := range pm.providers {
		info := ModelInfo{
			ProviderID: id,
			ProviderName: p.GetName(),
		}

		switch prov := p.(type) {
		case *DeepSeekProvider:
			info.Models = []string{"deepseek-v4-flash", "deepseek-v4-pro"}
		case *OpenAIProvider:
			info.Models = []string{"gpt-4o", "gpt-4o-mini", "o3"}
		case *AnthropicProvider:
			info.Models = []string{"claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-3-5-20241022"}
		case *OllamaProvider:
			info.Models = []string{"qwen2.5-coder:32b", "codellama:13b", "mistral:7b"}
		case *KimiProvider:
			info.Models = []string{"kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking", "kimi-k2-thinking-turbo", "kimi-k2-turbo-preview"}
		case *GLMProvider:
			info.Models = []string{"glm-5.1", "glm-5", "glm-5-turbo", "glm-4-plus", "glm-4-air-250414", "glm-4-flashx-250414", "glm-4-flash-250414"}
		case *MimoProvider:
			info.Models = []string{"mimo-v2.5-pro", "mimo-v2.5", "mimo-v2.5-turbo", "mimo-v2.5-thinking", "mimo-v2.5-thinking-turbo", "mimo-v2-pro", "mimo-v2-flash", "mimo-v2-omni"}
		default:
			info.Models = []string{}
		}

		models = append(models, info)
	}
	return models
}

type ModelInfo struct {
	ProviderID   string
	ProviderName string
	Models       []string
}
