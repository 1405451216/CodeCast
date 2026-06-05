package main

import (
	"context"
	"testing"

	ap "agentprimordia/pkg"
)

func TestCreateMultimodalProvider(t *testing.T) {
	app := &App{
		settings: &Settings{
			ModelConfigs: []ModelConfigItem{
				{
					ID:       "mc_test",
					Provider: "deepseek",
					Model:    "deepseek-v4-flash",
					APIKey:   "test-key",
					APIURL:   "https://api.deepseek.com",
					Enabled:  true,
				},
			},
			LLMProvider: "deepseek",
		},
		llmConfig: DefaultLLMProviderConfig(),
		ctx:       context.Background(),
	}

	// createMultimodalProviderLocked requires a.mu to be held
	app.mu.Lock()
	mmProvider, err := app.createMultimodalProviderLocked()
	app.mu.Unlock()

	if err != nil {
		t.Fatalf("createMultimodalProviderLocked failed: %v", err)
	}
	if mmProvider == nil {
		t.Fatal("expected non-nil MultimodalProvider")
	}
}

func TestAnalyzeImageNoProvider(t *testing.T) {
	app := &App{
		settings:   &Settings{ModelConfigs: []ModelConfigItem{}},
		llmConfig:  DefaultLLMProviderConfig(),
		ctx:        context.Background(),
	}

	// Without a multimodal provider set, should return error
	_, err := app.AnalyzeImage("nonexistent.png", "describe this image")
	if err == nil {
		t.Error("expected error when multimodalProvider is nil")
	}
}

func TestGetMultimodalCapabilitiesEmpty(t *testing.T) {
	app := &App{}

	caps := app.GetMultimodalCapabilities()
	if caps.Image {
		t.Error("expected Image=false when no multimodal provider")
	}
	if caps.Audio {
		t.Error("expected Audio=false when no multimodal provider")
	}
	if caps.Video {
		t.Error("expected Video=false when no multimodal provider")
	}
}

func TestMultimodalCapabilitiesAfterCreate(t *testing.T) {
	app := &App{
		settings: &Settings{
			ModelConfigs: []ModelConfigItem{
				{
					ID:       "mc_test",
					Provider: "openai",
					Model:    "gpt-4o",
					APIKey:   "test-key",
					APIURL:   "https://api.openai.com",
					Enabled:  true,
				},
			},
			LLMProvider: "openai",
			LLMAPIURL:   "https://api.openai.com",
			LLMModel:    "gpt-4o",
		},
		llmConfig: LLMProviderConfig{
			APIURL: "https://api.openai.com",
			Model:  "gpt-4o",
			APIKey: "test-key",
		},
		ctx: context.Background(),
	}

	app.mu.Lock()
	mm, err := app.createMultimodalProviderLocked()
	app.mu.Unlock()
	if err != nil {
		t.Fatalf("createMultimodalProviderLocked failed: %v", err)
	}

	caps := mm.Capabilities()
	if !caps.HasCapability(ap.CapVision) {
		t.Error("expected openai gpt-4o multimodal provider to have vision capability")
	}
}
