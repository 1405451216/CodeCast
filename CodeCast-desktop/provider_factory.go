package main

import (
	"context"
	"fmt"
	"hash/fnv"
	"log/slog"

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

	// Wrap with CacheManager-backed caching if available
	if a.cacheManager != nil {
		cached, cacheErr := ap.NewCachedProviderWithManager(resilient, a.cacheManager, 0.95)
		if cacheErr != nil {
			slog.Warn("AP CachedProviderWithManager creation failed, using uncached", "error", cacheErr)
			return resilient, nil
		}
		return cached, nil
	}

	return resilient, nil
}

// createCachedProvider creates a cached provider for code completion use cases.
// Now delegates to createProvider() since CacheManager-backed caching is always active.
// IMPORTANT: Caller MUST hold a.mu lock (calls createProvider which requires it).
func (a *App) createCachedProvider() (ap.Provider, error) {
	return a.createProvider()
}

// simpleEmbeddingFunc provides a deterministic hash-based embedding for cache keys.
// This avoids calling the LLM just for cache lookups.
func simpleEmbeddingFunc(ctx context.Context, text string) ([]float32, error) {
	h := fnv.New32a()
	h.Write([]byte(text))
	hash := h.Sum32()
	vec := make([]float32, 64)
	for i := range vec {
		vec[i] = float32((hash >> (i % 32)) & 1)
	}
	return vec, nil
}

// createMultimodalProvider creates an AP MultimodalProvider from current settings.
// Returns the multimodal provider for vision/image/audio/video capabilities.
//
// IMPORTANT: Caller MUST hold a.mu lock — calls createProvider (and resolveCredentialsLocked)
// which require it. Do NOT add a.mu.Lock() here; Go's sync.RWMutex is not reentrant.
func (a *App) createMultimodalProvider() (ap.MultimodalProvider, error) {
	creds, err := a.resolveCredentialsLocked("")
	if err != nil {
		return nil, fmt.Errorf("resolve credentials for multimodal: %w", err)
	}

	mm, err := ap.NewMultimodalProvider(ap.Config{
		APIKey:  creds.APIKey,
		BaseURL: creds.APIURL,
		Model:   creds.Model,
	})
	if err != nil {
		return nil, fmt.Errorf("create multimodal provider: %w", err)
	}
	return mm, nil
}
