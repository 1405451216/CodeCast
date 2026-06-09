package main

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	ap "agentprimordia/pkg"
)

// ==================== Code Completion ====================

// CompletionRequest represents a code completion request.
type CompletionRequest struct {
	Language string `json:"language"`
	Code     string `json:"code"`
	Position int    `json:"position"`
	FilePath string `json:"filePath"`
}

// CompletionResult represents code completion suggestions.
type CompletionResult struct {
	Suggestions []string `json:"suggestions"`
	Confidence  float64  `json:"confidence"`
}

// GetCodeCompletions returns code completion suggestions using AP CachedProvider.
// H14 fix: use a.ctx for cancellation support and avoid provider leak by not creating
// a throwaway provider when cachedProvider is nil.
func (a *App) GetCodeCompletions(req CompletionRequest) (*CompletionResult, error) {
	a.mu.RLock()
	provider := a.cachedProvider
	a.mu.RUnlock()

	if provider == nil {
		slog.Debug("code completion skipped: no cached provider available")
		return &CompletionResult{Suggestions: []string{}}, nil
	}

	// Extract context around cursor position
	codeBefore := req.Code
	if req.Position > 0 && req.Position <= len(req.Code) {
		codeBefore = req.Code[:req.Position]
	}

	// Build completion prompt
	systemPrompt := fmt.Sprintf("You are a code completion assistant. Complete the %s code.", req.Language)

	// Use a.ctx so completion requests are cancelled on app shutdown
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	temp := 0.3
	resp, err := provider.Complete(ctx, &ap.CompletionRequest{
		Messages: []ap.ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: codeBefore},
		},
		Temperature: &temp,
		MaxTokens:   256,
	})
	if err != nil {
		slog.Warn("code completion failed", "error", err)
		return &CompletionResult{Suggestions: []string{}}, nil
	}

	// Parse suggestions from response
	suggestions := parseSuggestions(resp.Content)

	return &CompletionResult{
		Suggestions: suggestions,
		Confidence:  0.8,
	}, nil
}

func parseSuggestions(response string) []string {
	// Simple parsing: split by newlines and filter empty lines
	lines := strings.Split(response, "\n")
	var suggestions []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "//") && !strings.HasPrefix(line, "#") {
			suggestions = append(suggestions, line)
		}
	}
	if len(suggestions) > 5 {
		suggestions = suggestions[:5]
	}
	return suggestions
}
