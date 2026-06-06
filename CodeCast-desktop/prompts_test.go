package main

import (
	"strings"
	"testing"
)

// ==================== promptBase 完整性测试 ====================

func TestPromptBaseNotEmpty(t *testing.T) {
	t.Parallel()
	if promptBase == "" {
		t.Fatal("promptBase should not be empty")
	}
	if len(promptBase) < 100 {
		t.Errorf("promptBase too short: %d chars", len(promptBase))
	}
}

func TestPromptBaseVersion(t *testing.T) {
	t.Parallel()
	if !strings.Contains(promptBase, "v3.0") {
		t.Error("promptBase should contain version v3.0")
	}
	if !strings.Contains(promptBase, "2026-05-24") {
		t.Error("promptBase should contain update date")
	}
}

func TestPromptBaseContainsCoreSections(t *testing.T) {
	t.Parallel()
	requiredSections := []string{
		"基础身份",
		"公共行为准则",
		"诚实",
		"直接",
		"格式规范",
		"安全与边界",
		"绝对禁止",
		"能力边界",
		"路径沙箱",
		"记忆系统",
		"个性化覆盖说明",
	}

	for _, section := range requiredSections {
		if !strings.Contains(promptBase, section) {
			t.Errorf("promptBase missing required section: %s", section)
		}
	}
}

// ==================== promptCoding 完整性测试 ====================

func TestPromptCodingNotEmpty(t *testing.T) {
	t.Parallel()
	if promptCoding == "" {
		t.Fatal("promptCoding should not be empty")
	}
	if len(promptCoding) < 500 {
		t.Errorf("promptCoding too short: %d chars", len(promptCoding))
	}
}

func TestPromptCodingContainsToolIndex(t *testing.T) {
	t.Parallel()
	if !strings.Contains(promptCoding, "工具索引") {
		t.Error("promptCoding should have tool index (not full details)")
	}
	if strings.Contains(promptCoding, "--- ReadFile(path) ---") {
		t.Error("promptCoding should NOT contain detailed tool definitions (those are JIT)")
	}
	requiredTools := []string{"ReadFile", "WriteFile", "ListFiles", "ExecuteCommand", "DispatchAgents"}
	for _, tool := range requiredTools {
		if !strings.Contains(promptCoding, tool) {
			t.Errorf("promptCoding missing tool reference: %s", tool)
		}
	}
}

func TestPromptCodingContainsKeyChapters(t *testing.T) {
	t.Parallel()
	chapters := []string{
		"核心工作流程",
		"代码质量标准",
		"命名",
		"结构",
		"错误处理",
		"安全编码",
		"性能意识",
		"测试与质量保障",
		"项目适配规则",
		"多语言编程指南",
		"文件操作与命令执行规范",
		"Git 与版本控制规范",
		"调试方法论",
		"架构设计与技术决策",
		"交互规范",
		"错误恢复策略",
	}

	for _, chapter := range chapters {
		if !strings.Contains(promptCoding, chapter) {
			t.Errorf("promptCoding missing chapter: %s", chapter)
		}
	}
}

func TestPromptCodingHasTestChapter(t *testing.T) {
	t.Parallel()
	testKeywords := []string{
		"测试即代码的一部分",
		"覆盖率目标",
		"Table-driven tests",
		"Vitest",
		"pytest",
		"运行测试确认无回归",
		"单元测试",
		"集成测试",
		"端到端测试",
		"benchmark",
	}

	for _, kw := range testKeywords {
		if !strings.Contains(promptCoding, kw) {
			t.Errorf("Test chapter missing keyword: %s", kw)
		}
	}
}

func TestPromptCodingHasPerformanceSection(t *testing.T) {
	t.Parallel()
	perfKeywords := []string{
		"N+1",
		"连接池复用",
		"O(1)",
		"异步 I/O",
	}

	for _, kw := range perfKeywords {
		if !strings.Contains(promptCoding, kw) {
			t.Errorf("Performance section missing: %s", kw)
		}
	}
}

// ==================== promptDaily 完整性测试 ====================

func TestPromptDailyNotEmpty(t *testing.T) {
	t.Parallel()
	if promptDaily == "" {
		t.Fatal("promptDaily should not be empty")
	}
	if len(promptDaily) < 300 {
		t.Errorf("promptDaily too short: %d chars", len(promptDaily))
	}
}

func TestPromptDailyContainsPersonality(t *testing.T) {
	t.Parallel()
	personality := []string{
		"性格五维",
		"坦诚",
		"直接",
		"温和",
		"有主见",
		"好奇",
	}

	for _, p := range personality {
		if !strings.Contains(promptDaily, p) {
			t.Errorf("promptDaily missing personality trait: %s", p)
		}
	}
}

func TestPromptDailyContainsScenarios(t *testing.T) {
	t.Parallel()
	scenarios := []string{
		"寻求建议",
		"创意工作",
		"学习新知识",
		"写作帮助",
		"争议话题",
		"情绪不佳",
		"闲聊",
		"翻译",
		"数据分析",
		"决策帮助",
		"头脑风暴",
		"学习路径建议",
		"分享好消息",
	}

	for _, s := range scenarios {
		if !strings.Contains(promptDaily, s) {
			t.Errorf("promptDaily missing scenario: %s", s)
		}
	}
}

func TestPromptDailySlimmerThanV2(t *testing.T) {
	t.Parallel()
	dailyRunes := []rune(promptDaily)
	if len(dailyRunes) > 8000 {
		t.Errorf("promptDaily seems too long for v3 slimmed version: %d runes", len(dailyRunes))
	}
}

// ==================== toolDetail 常量完整性 ====================

func TestToolDetailReadFile(t *testing.T) {
	t.Parallel()
	if toolDetailReadFile == "" {
		t.Fatal("toolDetailReadFile should not be empty")
	}
	required := []string{"ReadFile", "ListFiles", "GetWorkspaceFiles", "4MB"}
	for _, r := range required {
		if !strings.Contains(toolDetailReadFile, r) {
			t.Errorf("toolDetailReadFile missing: %s", r)
		}
	}
}

func TestToolDetailWriteFile(t *testing.T) {
	t.Parallel()
	if toolDetailWriteFile == "" {
		t.Fatal("toolDetailWriteFile should not be empty")
	}
	required := []string{"WriteFile", "10MB"}
	for _, r := range required {
		if !strings.Contains(toolDetailWriteFile, r) {
			t.Errorf("toolDetailWriteFile missing: %s", r)
		}
	}
}

func TestToolDetailCommand(t *testing.T) {
	t.Parallel()
	if toolDetailCommand == "" {
		t.Fatal("toolDetailCommand should not be empty")
	}
	required := []string{"ExecuteCommand", "30s", "安全直行", "禁止/授权"}
	for _, r := range required {
		if !strings.Contains(toolDetailCommand, r) {
			t.Errorf("toolDetailCommand missing: %s", r)
		}
	}
}

func TestToolDetailAgents(t *testing.T) {
	t.Parallel()
	if toolDetailAgents == "" {
		t.Fatal("toolDetailAgents should not be empty")
	}
	if !strings.Contains(toolDetailAgents, "DispatchAgents") {
		t.Error("toolDetailAgents missing DispatchAgents")
	}
}

func TestPromptBasePlusCodingFormat(t *testing.T) {
	t.Parallel()
	combined := promptBase + "\n\n" + promptCoding
	if !strings.HasPrefix(combined, "# CodeCast System Prompt v3.0") {
		t.Error("Combined prompt should start with promptBase header")
	}
	baseEndIdx := strings.Index(combined, "\n\n"+strings.TrimSpace(strings.Split(promptCoding, "\n")[0]))
	if baseEndIdx < 0 {
		t.Error("Should find promptBase followed by promptCoding")
	}
}

func TestPromptBasePlusDailyFormat(t *testing.T) {
	t.Parallel()
	combined := promptBase + "\n\n" + promptDaily
	if !strings.HasPrefix(combined, "# CodeCast System Prompt v3.0") {
		t.Error("Combined daily prompt should start with promptBase header")
	}
}
