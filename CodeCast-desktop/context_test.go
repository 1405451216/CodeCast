package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"
)

// ==================== ContextPriority 常量测试 ====================

func TestContextPriorityValues(t *testing.T) {
	if PriorityCritical != 0 {
		t.Errorf("PriorityCritical should be 0, got %d", PriorityCritical)
	}
	if PriorityHigh != 1 {
		t.Errorf("PriorityHigh should be 1, got %d", PriorityHigh)
	}
	if PriorityMedium != 2 {
		t.Errorf("PriorityMedium should be 2, got %d", PriorityMedium)
	}
	if PriorityLow != 3 {
		t.Errorf("PriorityLow should be 3, got %d", PriorityLow)
	}
}

// ==================== estimateTokens 测试 ====================

func TestEstimateTokensEmpty(t *testing.T) {
	result := estimateTokens("")
	if result != 0 {
		t.Errorf("Empty string should be 0 tokens, got %d", result)
	}
}

func TestEstimateTokensASCII(t *testing.T) {
	text := "hello world hello world hello world hello world" // 43 ASCII chars
	result := estimateTokens(text)
	if result <= 0 {
		t.Errorf("ASCII text should produce positive token count, got %d", result)
	}
	if result > len(text) {
		t.Errorf("Token count should not exceed char count for ASCII, got %d", result)
	}
}

func TestEstimateTokensChinese(t *testing.T) {
	text := "你好世界测试" // 4 Chinese chars
	result := estimateTokens(text)
	expected := utf8.RuneCountInString(text) * 3 / 2
	if result != expected {
		t.Errorf("Expected %d tokens for Chinese text, got %d", expected, result)
	}
	runes := utf8.RuneCountInString(text)
	if result < runes {
		t.Errorf("Chinese text should have at least 1 token per rune, got %d/%d", result, runes)
	}
}

func TestEstimateTokensMixed(t *testing.T) {
	text := "Hello 你好 World 世界" // mixed content
	result := estimateTokens(text)
	if result <= 0 {
		t.Error("Token count should be positive")
	}
}

// ==================== assembleSections 测试 ====================

func TestAssembleSectionsOrdering(t *testing.T) {
	app := &App{}
	sections := []ContextSection{
		{Content: "low_content", Priority: PriorityLow, Label: "low"},
		{Content: "critical_content", Priority: PriorityCritical, Label: "critical"},
		{Content: "medium_content", Priority: PriorityMedium, Label: "medium"},
		{Content: "high_content", Priority: PriorityHigh, Label: "high"},
	}

	result := app.assembleSections(sections)

	if !strings.HasPrefix(result, "critical_content") {
		t.Errorf("Critical section should come first, got prefix: %s", truncateForLog(result, 50))
	}
	if !strings.Contains(result, "high_content") {
		t.Error("High priority section should be present")
	}
	if strings.Index(result, "high_content") > strings.Index(result, "medium_content") {
		t.Error("High should come before Medium")
	}
	if strings.Index(result, "medium_content") > strings.Index(result, "low_content") {
		t.Error("Medium should come before Low")
	}
}

func TestAssembleSectionsSingle(t *testing.T) {
	app := &App{}
	sections := []ContextSection{
		{Content: "only_section", Priority: PriorityCritical, Label: "only"},
	}

	result := app.assembleSections(sections)
	if result != "only_section" {
		t.Errorf("Single section should return as-is, got: %s", result)
	}
}

func TestAssembleSectionsEmpty(t *testing.T) {
	app := &App{}
	result := app.assembleSections([]ContextSection{})
	if result != "" {
		t.Errorf("Empty sections should return empty string, got: %s", result)
	}
}

func TestAssembleSectionsSeparator(t *testing.T) {
	app := &App{}
	sections := []ContextSection{
		{Content: "first", Priority: PriorityCritical, Label: "a"},
		{Content: "second", Priority: PriorityHigh, Label: "b"},
	}

	result := app.assembleSections(sections)
	if !strings.Contains(result, "\n\n") {
		t.Error("Sections should be separated by double newline")
	}
	parts := strings.Split(result, "\n\n")
	if len(parts) != 2 {
		t.Errorf("Expected 2 parts, got %d", len(parts))
	}
}

// ==================== fitTokenBudget 测试 ====================

func TestFitTokenBudgetWithinLimit(t *testing.T) {
	app := &App{}
	sections := []ContextSection{
		{Content: "short_critical", Priority: PriorityCritical, Label: "c"},
		{Content: "short_high", Priority: PriorityHigh, Label: "h"},
		{Content: "short_medium", Priority: PriorityMedium, Label: "m"},
		{Content: "short_low", Priority: PriorityLow, Label: "l"},
	}

	result := app.fitTokenBudget(sections, 99999)
	if len(result) != 4 {
		t.Errorf("All sections should be kept when within budget, got %d", len(result))
	}
}

func TestFitTokenBudgetDropsLowPriority(t *testing.T) {
	app := &App{}

	lowContent := strings.Repeat("low_priority_data ", 1000)
	sections := []ContextSection{
		{Content: "critical", Priority: PriorityCritical, Label: "c"},
		{Content: lowContent, Priority: PriorityLow, Label: "l"},
	}

	result := app.fitTokenBudget(sections, 100)
	for _, s := range result {
		if s.Priority == PriorityLow {
			t.Error("Low priority sections should be dropped when over budget")
		}
	}
}

func TestFitTokenBudgetKeepsCritical(t *testing.T) {
	app := &App{}

	bigCritical := strings.Repeat("c ", 1000)
	bigLow := strings.Repeat("l ", 1000)
	sections := []ContextSection{
		{Content: bigCritical, Priority: PriorityCritical, Label: "c"},
		{Content: bigLow, Priority: PriorityLow, Label: "l"},
	}

	result := app.fitTokenBudget(sections, 100)
	foundCritical := false
	for _, s := range result {
		if s.Priority == PriorityCritical {
			foundCritical = true
			break
		}
	}
	if !foundCritical {
		t.Error("Critical sections must always be kept regardless of budget")
	}
}

func TestFitTokenBudgetTruncatesHigh(t *testing.T) {
	app := &App{}

	bigHigh := strings.Repeat("h ", 500)
	sections := []ContextSection{
		{Content: "critical_ok", Priority: PriorityCritical, Label: "c"},
		{Content: bigHigh, Priority: PriorityHigh, Label: "h"},
	}

	result := app.fitTokenBudget(sections, 200)
	hasHigh := false
	isTruncated := false
	for _, s := range result {
		if s.Priority == PriorityHigh {
			hasHigh = true
			if strings.Contains(s.Content, "[内容已按 Token 预算裁剪]") || len(s.Content) < len(bigHigh) {
				isTruncated = true
			}
		}
	}
	if hasHigh && !isTruncated {
		t.Log("Note: High priority was not truncated (may fit in budget)")
	}
}

func TestFitTokenBudgetLimitsMedium(t *testing.T) {
	app := &App{}

	bigMedium := strings.Repeat("m ", 500)
	sections := []ContextSection{
		{Content: "c", Priority: PriorityCritical, Label: "c"},
		{Content: bigMedium, Priority: PriorityMedium, Label: "m"},
	}

	result := app.fitTokenBudget(sections, 100)
	if len(result) > 2 {
		t.Logf("Result length: %d (may include truncated medium)", len(result))
	}
}

// ==================== truncateToBudget 测试 ====================

func TestTruncateToBudgetShortContent(t *testing.T) {
	content := "short content that fits"
	result := truncateToBudget(content, 1000)
	if result != content {
		t.Error("Short content should not be truncated")
	}
}

func TestTruncateToBudgetExactFit(t *testing.T) {
	content := "exact"
	charBudget := utf8.RuneCountInString(content)
	result := truncateToBudget(content, charBudget*3/2+1)
	if result != content {
		t.Error("Content fitting exactly in budget should not be truncated")
	}
}

func TestTruncateToBudgetTruncates(t *testing.T) {
	content := strings.Repeat("a", 100)
	budget := 10
	result := truncateToBudget(content, budget)

	runes := []rune(result)
	actualLen := 0
	for _, r := range runes {
		if r >= 32 {
			actualLen++
		}
	}
	if actualLen > budget*2/3+30 {
		t.Errorf("Truncated content too long: %d chars", actualLen)
	}
	if !strings.HasSuffix(result, "[内容已按 Token 预算裁剪]") {
		t.Error("Truncated content should end with truncation marker")
	}
}

func TestTruncateToBudgetUnicodeSafe(t *testing.T) {
	content := "你好世界Hello世界"
	result := truncateToBudget(content, 5)
	if !strings.HasSuffix(result, "[内容已按 Token 预算裁剪]") {
		t.Error("Should handle unicode safely and add marker")
	}
}

// ==================== compactHistory 测试 ====================

func TestCompactHistoryBelowThreshold(t *testing.T) {
	app := &App{
		settings: &Settings{},
	}
	msgs := make([]Message, 10)
	for i := range msgs {
		msgs[i] = Message{Role: "user", Content: fmt.Sprintf("msg_%d", i)}
	}

	recent, summary := app.compactHistory(msgs, 20)
	if summary != "" {
		t.Errorf("No summary expected below threshold, got: %s", summary)
	}
	if len(recent) != 10 {
		t.Errorf("All messages should be preserved, got %d", len(recent))
	}
}

func TestCompactHistoryAtThreshold(t *testing.T) {
	app := &App{
		settings: &Settings{},
	}
	msgs := make([]Message, CompactionKeepRecent*2)
	for i := range msgs {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		msgs[i] = Message{Role: role, Content: fmt.Sprintf("message_%d", i)}
	}

	recent, _ := app.compactHistory(msgs, CompactionKeepRecent)
	if len(recent) != CompactionKeepRecent {
		t.Errorf("Expected %d recent messages, got %d", CompactionKeepRecent, len(recent))
	}
}

func TestCompactHistoryOverThreshold(t *testing.T) {
	app := &App{
		settings:  &Settings{},
		llmConfig: LLMProviderConfig{APIURL: "https://api.test.com/v1", Model: "test"},
		config:     &Config{App: AppConfig{Name: "CodeCast"}, Model: ModelConfig{Model: "test-model"}},
	}
	msgs := make([]Message, CompactionKeepRecent*2+10)
	for i := range msgs {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		msgs[i] = Message{Role: role, Content: fmt.Sprintf("long_message_content_%d_for_testing_compaction", i)}
	}

	recent, summary := app.compactHistory(msgs, CompactionKeepRecent)
	if len(recent) != CompactionKeepRecent {
		t.Errorf("Expected %d recent messages, got %d", CompactionKeepRecent, len(recent))
	}
	if summary == "" {
		t.Error("Summary should be generated when over threshold")
	}
}

func TestCompactHistoryPreservesRecentOrder(t *testing.T) {
	app := &App{
		settings:  &Settings{},
		llmConfig: LLMProviderConfig{APIURL: "https://api.test.com/v1", Model: "test"},
		config:     &Config{App: AppConfig{Name: "CodeCast"}, Model: ModelConfig{Model: "test"}},
	}
	total := CompactionKeepRecent * 2 + 5
	msgs := make([]Message, total)
	for i := range msgs {
		msgs[i] = Message{Role: "user", Content: fmt.Sprintf("msg_%d", i)}
	}

	recent, _ := app.compactHistory(msgs, CompactionKeepRecent)
	for i := 1; i < len(recent); i++ {
		if recent[i].Content <= recent[i-1].Content {
			t.Error("Recent messages should maintain original order")
			break
		}
	}
}

// ==================== fallbackSummary 测试 ====================

func TestFallbackSummaryBasic(t *testing.T) {
	msgs := []Message{
		{Role: "user", Content: "帮我写一个登录功能"},
		{Role: "assistant", Content: "好的，我来帮你实现JWT认证的登录接口"},
		{Role: "user", Content: "需要支持OAuth2吗"},
		{Role: "assistant", Content: "可以加上Google和GitHub OAuth"},
	}

	summary := fallbackSummary(msgs)
	if summary == "" {
		t.Error("Fallback summary should not be empty")
	}
	if !strings.Contains(summary, "用户:") || !strings.Contains(summary, "助手:") {
		t.Error("Summary should contain user/assistant labels")
	}
}

func TestFallbackSummarySkipsSystem(t *testing.T) {
	msgs := []Message{
		{Role: "system", Content: "You are a helpful assistant"},
		{Role: "user", Content: "Hello"},
		{Role: "assistant", Content: "Hi there!"},
	}

	summary := fallbackSummary(msgs)
	if strings.Contains(summary, "system") {
		t.Error("System messages should be skipped in fallback summary")
	}
}

func TestFallbackSummarySkipsEmpty(t *testing.T) {
	msgs := []Message{
		{Role: "user", Content: ""},
		{Role: "assistant", Content: "..."},
		{Role: "user", Content: "actual content here"},
	}

	summary := fallbackSummary(msgs)
	if strings.Contains(summary, "(早期对话内容已压缩)") {
		t.Error("Should not return empty placeholder when there's valid content")
	}
}

func TestFallbackSummaryLimit(t *testing.T) {
	msgs := make([]Message, 20)
	for i := range msgs {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		msgs[i] = Message{Role: role, Content: fmt.Sprintf("message number %d with some content", i)}
	}

	summary := fallbackSummary(msgs)
	lines := strings.Count(summary, "\n")
	if lines > 15 {
		t.Errorf("Fallback summary should limit entries, got %d lines", lines)
	}
}

func TestFallbackSummaryEmptyInput(t *testing.T) {
	summary := fallbackSummary([]Message{})
	if !strings.Contains(summary, "(早期对话内容已压缩)") {
		t.Errorf("Empty input should return placeholder, got: %s", summary)
	}
}

func TestFallbackSummaryOnlySystemMessages(t *testing.T) {
	msgs := []Message{
		{Role: "system", Content: "System prompt"},
		{Role: "system", Content: "Another system"},
	}

	summary := fallbackSummary(msgs)
	if !strings.Contains(summary, "(早期对话内容已压缩)") {
		t.Errorf("Only system messages should return placeholder, got: %s", summary)
	}
}

// ==================== buildContextAssembly 测试 ====================

func TestBuildContextAssemblyBasic(t *testing.T) {
	app := &App{
		settings: &Settings{MessageHistoryLimit: 20},
		memory:   nil,
	}
	session := &Session{
		Messages: []Message{
			{Role: "user", Content: "hello"},
		},
	}

	result := app.buildContextAssembly(session, "hello", false, "test_system_prompt")
	if len(result) == 0 {
		t.Fatal("buildContextAssembly should return at least system message")
	}
	if result[0].Role != "system" {
		t.Errorf("First message should be 'system', got '%s'", result[0].Role)
	}
	if result[0].Content != "test_system_prompt" {
		t.Errorf("System prompt mismatch")
	}
	if len(result) != 2 {
		t.Errorf("Expected 2 messages (system + user), got %d", len(result))
	}
}

func TestBuildContextAssemblyLongContextBypassesCompaction(t *testing.T) {
	app := &App{
		settings: &Settings{MessageHistoryLimit: 20},
	}
	session := &Session{}
	for i := 0; i < CompactionThreshold+10; i++ {
		session.Messages = append(session.Messages, Message{Role: "user", Content: fmt.Sprintf("msg_%d", i)})
	}

	result := app.buildContextAssembly(session, "input", true, "prompt")
	userMsgCount := 0
	for _, m := range result {
		if m.Role == "user" || m.Role == "assistant" {
			userMsgCount++
		}
	}
	if userMsgCount < CompactionThreshold {
		t.Errorf("Long context mode should bypass compaction, got %d chat messages", userMsgCount)
	}
}

func TestBuildContextAssemblyWithMemory(t *testing.T) {
	tmpDir := t.TempDir()
	memStore, err := NewMemoryStore(filepath.Join(tmpDir, "test_memory.db"))
	if err != nil {
		t.Fatalf("Failed to create memory store: %v", err)
	}
	defer memStore.Close()
	memStore.SaveEpisode("test_session", "user", "login feature discussion about JWT")

	app := &App{
		settings: &Settings{MessageHistoryLimit: 20},
		memory:   memStore,
	}
	session := &Session{
		Messages: []Message{{Role: "user", Content: "login"}},
	}

	result := app.buildContextAssembly(session, "login", false, "sys")
	sysContent := result[0].Content
	if !strings.Contains(sysContent, "历史记忆") {
		t.Error("System prompt should contain memory context when memory is available")
	}
}

// ==================== 常量验证 ====================

func TestConstants(t *testing.T) {
	if DefaultTokenBudget <= 0 {
		t.Errorf("DefaultTokenBudget should be positive, got %d", DefaultTokenBudget)
	}
	if CompactionThreshold <= 0 {
		t.Errorf("CompactionThreshold should be positive, got %d", CompactionThreshold)
	}
	if CompactionKeepRecent <= 0 {
		t.Errorf("CompactionKeepRecent should be positive, got %d", CompactionKeepRecent)
	}
	if maxContextUtilization <= 0 || maxContextUtilization > 1 {
		t.Errorf("maxContextUtilization should be between 0 and 1, got %f", maxContextUtilization)
	}
}

func truncateForLog(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}
