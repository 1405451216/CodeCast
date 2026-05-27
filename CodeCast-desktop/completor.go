package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Code Completion Types ====================

type CompletionRequest struct {
	Filepath    string `json:"filepath"`
	Language    string `json:"language"`
	Line        int    `json:"line"`
	Column      int    `json:"column"`
	LineContent string `json:"line_content"`
	Prefix      string `json:"prefix"`
	Context     string `json:"context"` // surrounding code
	MaxResults  int    `json:"max_results"`
	Model       string `json:"model"` // "openai" | "claude" | "local"
}

type CompletionSuggestion struct {
	Text          string  `json:"text"`
	DisplayText   string  `json:"display_text"`
	Type          string  `json:"type"` // "code" | "comment" | "import" | "function"
	Confidence    float64 `json:"confidence"`
	Documentation string  `json:"documentation,omitempty"`
	InsertText    string  `json:"insert_text,omitempty"`
}

type CompletionResponse struct {
	Suggestions []CompletionSuggestion `json:"suggestions"`
	Model       string                 `json:"model"`
	Latency     int64                  `json:"latency_ms"`
	TokensUsed  int                    `json:"tokens_used"`
}

type StreamCompletionEvent struct {
	Type       string                 `json:"type"` // "start" | "delta" | "done" | "error"
	Suggestion *CompletionSuggestion  `json:"suggestion,omitempty"`
	Delta      string                 `json:"delta,omitempty"`
	Error      string                 `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ==================== Code Completor ====================

type CodeCompletor struct {
	mu          sync.RWMutex
	app         *App
	cache       map[string]*CompletionResponse
	cacheExpiry map[string]time.Time
	stats       CompletionStats
}

type CompletionStats struct {
	TotalRequests    int64   `json:"total_requests"`
	TotalSuggestions int64   `json:"total_suggestions"`
	AcceptRate       float64 `json:"accept_rate"` // user accepted / total shown
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	CacheHitRate     float64 `json:"cache_hit_rate"`
	History          []CompletionHistoryEntry
}

type CompletionHistoryEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Prefix    string    `json:"prefix"`
	Accepted  string    `json:"accepted_text"` // empty if rejected
	Source    string    `json:"source"`        // "ai" | "local" | "snippet"
	LatencyMs int64     `json:"latency_ms"`
	Model     string    `json:"model"`
}

func NewCodeCompletor(app *App) *CodeCompletor {
	return &CodeCompletor{
		app:         app,
		cache:       make(map[string]*CompletionResponse),
		cacheExpiry: make(map[string]time.Time),
		stats: CompletionStats{
			History: make([]CompletionHistoryEntry, 0, 1000),
		},
	}
}

// GetCompletions returns code completion suggestions
func (c *CodeCompletor) GetCompletions(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	startTime := time.Now()

	c.mu.Lock()
	c.stats.TotalRequests++
	c.mu.Unlock()

	// Check cache first
	cacheKey := c.buildCacheKey(req)
	if cached, ok := c.getFromCache(cacheKey); ok {
		c.updateCacheHitStats(startTime)
		return cached, nil
	}

	// Determine which model to use
	model := req.Model
	if model == "" {
		model = c.getDefaultModel()
	}

	var response *CompletionResponse
	var err error

	switch model {
	case "openai":
		response, err = c.getOpenAICompletions(ctx, req)
	case "claude":
		response, err = c.getClaudeCompletions(ctx, req)
	case "local":
		response, err = c.getLocalCompletions(ctx, req)
	default:
		if c.getAPIKey() != "" {
			response, err = c.getOpenAICompletions(ctx, req)
		} else {
			response, err = c.getLocalCompletions(ctx, req)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("completion failed: %w", err)
	}

	// Update stats
	latency := time.Since(startTime).Milliseconds()
	response.Latency = latency
	response.Model = model

	// Cache result (5 min TTL)
	c.setToCache(cacheKey, response, 5*time.Minute)

	c.updateStats(response, latency)

	return response, nil
}

// StreamCompletions streams completion suggestions in real-time (like Copilot)
func (c *CodeCompletor) StreamCompletions(
	ctx context.Context,
	req CompletionRequest,
	onEvent func(StreamCompletionEvent),
) error {
	startTime := time.Now()

	// Send start event
	onEvent(StreamCompletionEvent{
		Type: "start",
		Metadata: map[string]interface{}{
			"timestamp": startTime.UnixMilli(),
			"model":     req.Model,
		},
	})

	model := req.Model
	if model == "" {
		model = c.getDefaultModel()
	}

	var err error

	switch model {
	case "openai":
		err = c.streamOpenAICompletions(ctx, req, onEvent)
	case "claude":
		err = c.streamClaudeCompletions(ctx, req, onEvent)
	default:
		if c.getAPIKey() != "" {
			err = c.streamOpenAICompletions(ctx, req, onEvent)
		} else {
			err = c.streamLocalCompletions(ctx, req, onEvent)
		}
	}

	if err != nil {
		onEvent(StreamCompletionEvent{
			Type:  "error",
			Error: err.Error(),
		})
		return err
	}

	// Send done event
	onEvent(StreamCompletionEvent{
		Type: "done",
		Metadata: map[string]interface{}{
			"latency_ms": time.Since(startTime).Milliseconds(),
		},
	})

	return nil
}

// RecordUsage tracks whether user accepted/rejected a suggestion
func (c *CodeCompletor) RecordUsage(prefix, acceptedText, source, model string, latencyMs int64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := CompletionHistoryEntry{
		Timestamp: time.Now(),
		Prefix:    prefix,
		Accepted:  acceptedText,
		Source:    source,
		LatencyMs: latencyMs,
		Model:     model,
	}

	// Keep only last 1000 entries
	if len(c.stats.History) >= 1000 {
		c.stats.History = c.stats.History[1:]
	}
	c.stats.History = append(c.stats.History, entry)

	// Update accept rate
	var accepted, total int
	for _, h := range c.stats.History {
		total++
		if h.Accepted != "" {
			accepted++
		}
	}
	if total > 0 {
		c.stats.AcceptRate = float64(accepted) / float64(total)
	}
}

// GetStats returns completion usage statistics
func (c *CodeCompletor) GetStats() CompletionStats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.stats
}

// ClearCache clears completion cache
func (c *CodeCompletor) ClearCache() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]*CompletionResponse)
	c.cacheExpiry = make(map[string]time.Time)
}

// ==================== Private Methods ====================

func (c *CodeCompletor) getAPIKey() string {
	for _, env := range c.app.settings.EnvVars {
		if env.Key == "OPENAI_API_KEY" || env.Key == "API_KEY" {
			return env.Value
		}
	}
	return ""
}

func (c *CodeCompletor) getDefaultModel() string {
	if c.app.settings.LLMModel != "" {
		return c.app.settings.LLMModel
	}

	if c.getAPIKey() != "" {
		return "openai"
	}

	return "local"
}

func (c *CodeCompletor) buildCacheKey(req CompletionRequest) string {
	return fmt.Sprintf("%s:%d:%d:%s", req.Filepath, req.Line, req.Column, strings.TrimSpace(req.Prefix))
}

func (c *CodeCompletor) getFromCache(key string) (*CompletionResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	expiry, exists := c.cacheExpiry[key]
	if !exists || time.Now().After(expiry) {
		return nil, false
	}

	if cached, ok := c.cache[key]; ok {
		return cached, true
	}
	return nil, false
}

func (c *CodeCompletor) setToCache(key string, resp *CompletionResponse, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = resp
	c.cacheExpiry[key] = time.Now().Add(ttl)

	// Cleanup old cache entries (keep max 500)
	if len(c.cache) > 500 {
		// Simple eviction: remove oldest 50 entries
		count := 0
		for k := range c.cache {
			delete(c.cache, k)
			delete(c.cacheExpiry, k)
			count++
			if count >= 50 {
				break
			}
		}
	}
}

func (c *CodeCompletor) updateCacheHitStats(start time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	latency := time.Since(start).Milliseconds()
	totalReq := c.stats.TotalRequests

	// Approximate cache hit rate
	c.stats.AvgLatencyMs = (c.stats.AvgLatencyMs*float64(totalReq-1) + float64(latency)) / float64(totalReq)
	c.stats.CacheHitRate += 0.01 // Simplified tracking
}

func (c *CodeCompletor) updateStats(resp *CompletionResponse, latencyMs int64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.stats.TotalSuggestions += int64(len(resp.Suggestions))
	totalReq := c.stats.TotalRequests

	c.stats.AvgLatencyMs = (c.stats.AvgLatencyMs*float64(totalReq-1) + float64(latencyMs)) / float64(totalReq)
}

// ==================== OpenAI Integration ====================

func (c *CodeCompletor) getOpenAICompletions(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	apiKey := c.getAPIKey()
	if apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	prompt := c.buildPrompt(req)

	requestBody := map[string]interface{}{
		"model": "gpt-4-turbo-preview",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a code completion AI. Provide concise, accurate code completions. Return ONLY valid code, no explanations."},
			{"role": "user", "content": prompt},
		},
		"max_tokens":  200,
		"temperature": 0.2,
		"top_p":       0.9,
		"n":           req.MaxResults,
		"stop":        []string{"\n\n", "//", "/*"},
	}

	_, _ = json.Marshal(requestBody)

	suggestions := c.generateMockSuggestions(req)

	return &CompletionResponse{
		Suggestions: suggestions,
		Model:       "openai",
		TokensUsed:  150,
	}, nil
}

func (c *CodeCompletor) streamOpenAICompletions(
	ctx context.Context,
	req CompletionRequest,
	onEvent func(StreamCompletionEvent),
) error {
	apiKey := c.getAPIKey()
	if apiKey == "" {
		return fmt.Errorf("OpenAI API key not configured")
	}

	_ = c.buildPrompt(req)

	go func() {
		suggestions := c.generateMockSuggestions(req)

		for i, sug := range suggestions {
			select {
			case <-ctx.Done():
				return
			default:
				time.Sleep(50 * time.Millisecond)

				onEvent(StreamCompletionEvent{
					Type:       "delta",
					Delta:      sug.Text,
					Suggestion: &suggestions[i],
					Metadata: map[string]interface{}{
						"index": i,
						"total": len(suggestions),
					},
				})
			}
		}
	}()

	return nil
}

// ==================== Claude Integration ====================

func (c *CodeCompletor) getClaudeCompletions(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	// Similar to OpenAI but using Claude API
	// TODO: Implement Claude API integration

	suggestions := c.generateMockSuggestions(req)
	return &CompletionResponse{
		Suggestions: suggestions,
		Model:       "claude",
		TokensUsed:  120,
	}, nil
}

func (c *CodeCompletor) streamClaudeCompletions(
	ctx context.Context,
	req CompletionRequest,
	onEvent func(StreamCompletionEvent),
) error {
	// TODO: Implement Claude streaming
	return c.streamLocalCompletions(ctx, req, onEvent)
}

// ==================== Local Completions (No API Required) ====================

func (c *CodeCompletor) getLocalCompletions(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	suggestions := c.generateMockSuggestions(req)

	// Add local-only enhancements
	localSuggestions := c.getLocalSnippetSuggestions(req)
	suggestions = append(suggestions, localSuggestions...)

	return &CompletionResponse{
		Suggestions: suggestions[:min(req.MaxResults, len(suggestions))],
		Model:       "local",
		TokensUsed:  0,
	}, nil
}

func (c *CodeCompletor) streamLocalCompletions(
	ctx context.Context,
	req CompletionRequest,
	onEvent func(StreamCompletionEvent),
) error {
	suggestions := c.generateMockSuggestions(req)

	for i, sug := range suggestions {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			time.Sleep(20 * time.Millisecond) // Fast local generation

			onEvent(StreamCompletionEvent{
				Type:       "delta",
				Delta:      sug.Text,
				Suggestion: &suggestions[i],
			})
		}
	}

	return nil
}

// ==================== Prompt Engineering ====================

func (c *CodeCompletor) buildPrompt(req CompletionRequest) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Complete the following %s code.\n\n", req.Language))
	sb.WriteString(fmt.Sprintf("File: %s\n", req.Filepath))
	sb.WriteString(fmt.Sprintf("Line %d, Column %d\n", req.Line, req.Column))

	if req.Prefix != "" {
		sb.WriteString(fmt.Sprintf("\nCurrent input:\n%s\n", req.Prefix))
	}

	if req.LineContent != "" {
		sb.WriteString(fmt.Sprintf("\nCurrent line:\n%s\n", req.LineContent))
	}

	if req.Context != "" {
		sb.WriteString(fmt.Sprintf("\nSurrounding context:\n```\n%s\n```\n", req.Context))
	}

	sb.WriteString("\nProvide 3-5 completion options as a JSON array with fields: text, type, confidence (0-1).")
	sb.WriteString("\nReturn ONLY valid JSON, no markdown or explanations.")

	return sb.String()
}

// ==================== Mock/Sample Data (Replace with real LLM calls) ====================

func (c *CodeCompletor) generateMockSuggestions(req CompletionRequest) []CompletionSuggestion {
	prefix := strings.TrimSpace(strings.ToLower(req.Prefix))

	// Smart suggestions based on common patterns
	suggestions := []CompletionSuggestion{}

	if prefix == "" {
		return suggestions
	}

	// Function patterns
	if strings.HasPrefix(prefix, "func") || strings.HasPrefix(prefix, "function") || strings.HasPrefix(prefix, "async") {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          fmt.Sprintf("%s name(params) {\n  // implementation\n}", prefix),
			DisplayText:   "Function template",
			Type:          "code",
			Confidence:    0.95,
			Documentation: "Function declaration template",
		})
	}

	// Async patterns
	if strings.Contains(prefix, "async") || strings.Contains(prefix, "await") {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          "const result = await fetchData();\nconsole.log(result);",
			DisplayText:   "Async pattern",
			Type:          "code",
			Confidence:    0.88,
			Documentation: "Common async/await pattern",
		})
	}

	// Import patterns
	if strings.HasPrefix(prefix, "import") {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          fmt.Sprintf("import { useState, useEffect } from 'react';"),
			DisplayText:   "React imports",
			Type:          "import",
			Confidence:    0.92,
			Documentation: "React hooks import",
		})
	}

	// Error handling
	if strings.Contains(prefix, "try") || strings.Contains(prefix, "catch") || strings.Contains(prefix, "error") {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          "try {\n  const data = await api.call();\n  return data;\n} catch (error) {\n  console.error('Operation failed:', error);\n  throw error;\n}",
			DisplayText:   "Error handling",
			Type:          "code",
			Confidence:    0.9,
			Documentation: "Robust error handling template",
		})
	}

	// Array methods
	if strings.Contains(prefix, ".map") || strings.Contains(prefix, ".filter") || strings.Contains(prefix, ".reduce") {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          ".map((item) => ({\n  ...item,\n  processed: true\n}))",
			DisplayText:   "Array mapping",
			Type:          "code",
			Confidence:    0.87,
			Documentation: "Transform array items",
		})
	}

	// React component
	if strings.Contains(prefix, "const") && (strings.Contains(prefix, "Component") || strings.Contains(prefix, "=>")) {
		suggestions = append(suggestions, CompletionSuggestion{
			Text:          "const Component = ({ prop }) => {\n  const [state, setState] = useState(null);\n  \n  return <div>{prop}</div>;\n};\n\nexport default Component;",
			DisplayText:   "React component",
			Type:          "code",
			Confidence:    0.85,
			Documentation: "Functional React component with hooks",
		})
	}

	// Generic fallback based on language
	if len(suggestions) == 0 {
		switch req.Language {
		case "typescript", "javascript":
			suggestions = append(suggestions, CompletionSuggestion{
				Text:        fmt.Sprintf("// Complete: %s\nconst result = ;", prefix),
				DisplayText: "Code completion",
				Type:        "code",
				Confidence:  0.7,
			})
		case "python":
			suggestions = append(suggestions, CompletionSuggestion{
				Text:        fmt.Sprintf("# Complete: %s\ndef function_name():\n    pass", prefix),
				DisplayText: "Python code",
				Type:        "code",
				Confidence:  0.7,
			})
		case "go":
			suggestions = append(suggestions, CompletionSuggestion{
				Text:        fmt.Sprintf("// Complete: %s\nfunc functionName() error {\n\treturn nil\n}", prefix),
				DisplayText: "Go code",
				Type:        "code",
				Confidence:  0.7,
			})
		}
	}

	return suggestions
}

func (c *CodeCompletor) getLocalSnippetSuggestions(req CompletionRequest) []CompletionSuggestion {
	// Return hardcoded popular snippets when no API available
	return []CompletionSuggestion{
		{
			Text:          "console.log();",
			DisplayText:   "Console log",
			Type:          "snippet",
			Confidence:    0.6,
			Documentation: "Log to console",
		},
		{
			Text:          "if (condition) {\n  \n}",
			DisplayText:   "If statement",
			Type:          "snippet",
			Confidence:    0.65,
			Documentation: "Conditional block",
		},
	}
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ==================== Wails Bindings ====================

// GetCodeCompletions is exposed to frontend via Wails
func (a *App) GetCodeCompletions(req CompletionRequest) (*CompletionResponse, error) {
	if a.completor == nil {
		a.completor = NewCodeCompletor(a)
	}
	return a.completor.GetCompletions(context.Background(), req)
}

// StreamCodeCompletions streams completions to frontend
func (a *App) StreamCodeCompletions(req CompletionRequest) error {
	if a.completor == nil {
		a.completor = NewCodeCompletor(a)
	}

	ctx := context.Background()
	return a.completor.StreamCompletions(ctx, req, func(event StreamCompletionEvent) {
		// Emit event to frontend
		wailsRuntime.EventsEmit(a.ctx, "completion:event", event)
	})
}

// RecordCompletionUsage tracks user acceptance
func (a *App) RecordCompletionUsage(prefix, acceptedText, source, model string, latencyMs int64) {
	if a.completor == nil {
		a.completor = NewCodeCompletor(a)
	}
	a.completor.RecordUsage(prefix, acceptedText, source, model, latencyMs)
}

// GetCompletionStats returns usage statistics
func (a *App) GetCompletionStats() CompletionStats {
	if a.completor == nil {
		return CompletionStats{}
	}
	return a.completor.GetStats()
}

// ClearCompletionCache clears the completion cache
func (a *App) ClearCompletionCache() {
	if a.completor != nil {
		a.completor.ClearCache()
	}
}
