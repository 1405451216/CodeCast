package main

import (
	"fmt"

	ap "agentprimordia/pkg"
)

// createProvider creates an AP LLM Provider based on current settings.
// Uses resolveCredentialsLocked() for API key/URL, guessProviderForModel() for provider type.
// All AP Provider constructors return (*Provider, error).
//
// IMPORTANT: Caller MUST hold a.mu lock before calling this method.
// resolveCredentialsLocked() requires the caller to hold a.mu (see config.go:862 comment).
// Go's sync.RWMutex is NOT reentrant — do NOT add a.mu.RLock() here or it will deadlock.
func (a *App) createProvider() (ap.Provider, error) {
	creds, err := a.resolveCredentialsLocked("")
	if err != nil {
		return nil, fmt.Errorf("resolve credentials: %w", err)
	}

	providerID := a.guessProviderForModel(creds.Model)

	var primary ap.Provider
	switch providerID {
	case "openai":
		p, err := ap.NewOpenAIProvider(ap.Config{APIKey: creds.APIKey, BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create OpenAI provider: %w", err)
		}
		primary = p
	case "anthropic":
		p, err := ap.NewAnthropicProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Anthropic provider: %w", err)
		}
		primary = p
	case "gemini":
		p, err := ap.NewGeminiProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Gemini provider: %w", err)
		}
		primary = p
	case "ollama":
		p, err := ap.NewOllamaProvider(ap.Config{BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Ollama provider: %w", err)
		}
		primary = p
	case "azure":
		p, err := ap.NewAzureOpenAIProvider(ap.AzureConfig{
			DeploymentName: creds.Model,
			APIKey:         creds.APIKey,
			BaseURL:        creds.APIURL,
			Temperature:    0.7,
		})
		if err != nil {
			return nil, fmt.Errorf("create Azure provider: %w", err)
		}
		primary = p
	case "qwen":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create Qwen provider: %w", err)
		}
		primary = p
	case "glm":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://open.bigmodel.cn/api/paas/v4",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create GLM provider: %w", err)
		}
		primary = p
	case "mistral":
		p, err := ap.NewMistralProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Mistral provider: %w", err)
		}
		primary = p
	case "cohere":
		p, err := ap.NewCohereProvider(ap.Config{APIKey: creds.APIKey, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create Cohere provider: %w", err)
		}
		primary = p
	case "deepseek":
		p, err := ap.NewOpenAIProvider(ap.Config{
			APIKey:  creds.APIKey,
			BaseURL: "https://api.deepseek.com",
			Model:   creds.Model,
		})
		if err != nil {
			return nil, fmt.Errorf("create DeepSeek provider: %w", err)
		}
		primary = p
	default:
		p, err := ap.NewOpenAIProvider(ap.Config{APIKey: creds.APIKey, BaseURL: creds.APIURL, Model: creds.Model})
		if err != nil {
			return nil, fmt.Errorf("create default provider: %w", err)
		}
		primary = p
	}

	resilient, err := ap.NewResilientProvider(primary, ap.DefaultResilientConfig())
	if err != nil {
		return nil, fmt.Errorf("create resilient provider: %w", err)
	}
	return resilient, nil
}

// createCachedProvider creates a cached provider for code completion use cases.
// Uses AP's CachedProvider with fingerprint + vector similarity cache.
// IMPORTANT: Caller MUST hold a.mu lock (calls createProvider which requires it).
func (a *App) createCachedProvider() (ap.Provider, error) {
	primary, err := a.createProvider()
	if err != nil {
		return nil, err
	}

	fpCache := ap.NewFingerprintCache()
	vecCache := ap.NewInMemoryCache(1536)
	hybridCache := ap.NewHybridCache(fpCache, vecCache, 0.95)

	cached, err := ap.NewCachedProvider(primary, hybridCache, 0.95)
	if err != nil {
		return nil, fmt.Errorf("create cached provider: %w", err)
	}
	return cached, nil
}
