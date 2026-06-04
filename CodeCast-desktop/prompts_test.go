package main

import (
	"strings"
	"testing"
)

// ==================== PromptBase 完整性测试 ====================

func TestPromptBaseNotEmpty(t *testing.T) {
	t.Parallel()
	if PromptBase == "" {
		t.Fatal("PromptBase should not be empty")
	}
	if len(PromptBase) < 100 {
		t.Errorf("PromptBase too short: %d chars", len(PromptBase))
	}
}

func TestPromptBaseVersion(t *testing.T) {
	t.Parallel()
	if !strings.Contains(PromptBase, "v3.0") {
		t.Error("PromptBase should contain version v3.0")
	}
	if !strings.Contains(PromptBase, "2026-05-24") {
		t.Error("PromptBase should contain update date")
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
		if !strings.Contains(PromptBase, section) {
			t.Errorf("PromptBase missing required section: %s", section)
		}
	}
}

// ==================== PromptCoding 完整性测试 ====================

func TestPromptCodingNotEmpty(t *testing.T) {
	t.Parallel()
	if PromptCoding == "" {
		t.Fatal("PromptCoding should not be empty")
	}
	if len(PromptCoding) < 500 {
		t.Errorf("PromptCoding too short: %d chars", len(PromptCoding))
	}
}

func TestPromptCodingContainsToolIndex(t *testing.T) {
	t.Parallel()
	if !strings.Contains(PromptCoding, "工具索引") {
		t.Error("PromptCoding should have tool index (not full details)")
	}
	if strings.Contains(PromptCoding, "--- ReadFile(path) ---") {
		t.Error("PromptCoding should NOT contain detailed tool definitions (those are JIT)")
	}
	requiredTools := []string{"ReadFile", "WriteFile", "ListFiles", "ExecuteCommand", "DispatchAgents"}
	for _, tool := range requiredTools {
		if !strings.Contains(PromptCoding, tool) {
			t.Errorf("PromptCoding missing tool reference: %s", tool)
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
		if !strings.Contains(PromptCoding, chapter) {
			t.Errorf("PromptCoding missing chapter: %s", chapter)
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
		if !strings.Contains(PromptCoding, kw) {
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
		if !strings.Contains(PromptCoding, kw) {
			t.Errorf("Performance section missing: %s", kw)
		}
	}
}

// ==================== PromptDaily 完整性测试 ====================

func TestPromptDailyNotEmpty(t *testing.T) {
	t.Parallel()
	if PromptDaily == "" {
		t.Fatal("PromptDaily should not be empty")
	}
	if len(PromptDaily) < 300 {
		t.Errorf("PromptDaily too short: %d chars", len(PromptDaily))
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
		if !strings.Contains(PromptDaily, p) {
			t.Errorf("PromptDaily missing personality trait: %s", p)
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
		if !strings.Contains(PromptDaily, s) {
			t.Errorf("PromptDaily missing scenario: %s", s)
		}
	}
}

func TestPromptDailySlimmerThanV2(t *testing.T) {
	t.Parallel()
	dailyRunes := []rune(PromptDaily)
	if len(dailyRunes) > 8000 {
		t.Errorf("PromptDaily seems too long for v3 slimmed version: %d runes", len(dailyRunes))
	}
}

// ==================== ToolDetail 常量完整性 ====================

func TestToolDetailReadFile(t *testing.T) {
	t.Parallel()
	if ToolDetailReadFile == "" {
		t.Fatal("ToolDetailReadFile should not be empty")
	}
	required := []string{"ReadFile", "ListFiles", "GetWorkspaceFiles", "4MB"}
	for _, r := range required {
		if !strings.Contains(ToolDetailReadFile, r) {
			t.Errorf("ToolDetailReadFile missing: %s", r)
		}
	}
}

func TestToolDetailWriteFile(t *testing.T) {
	t.Parallel()
	if ToolDetailWriteFile == "" {
		t.Fatal("ToolDetailWriteFile should not be empty")
	}
	required := []string{"WriteFile", "10MB"}
	for _, r := range required {
		if !strings.Contains(ToolDetailWriteFile, r) {
			t.Errorf("ToolDetailWriteFile missing: %s", r)
		}
	}
}

func TestToolDetailCommand(t *testing.T) {
	t.Parallel()
	if ToolDetailCommand == "" {
		t.Fatal("ToolDetailCommand should not be empty")
	}
	required := []string{"ExecuteCommand", "30s", "安全直行", "禁止/授权"}
	for _, r := range required {
		if !strings.Contains(ToolDetailCommand, r) {
			t.Errorf("ToolDetailCommand missing: %s", r)
		}
	}
}

func TestToolDetailAgents(t *testing.T) {
	t.Parallel()
	if ToolDetailAgents == "" {
		t.Fatal("ToolDetailAgents should not be empty")
	}
	if !strings.Contains(ToolDetailAgents, "DispatchAgents") {
		t.Error("ToolDetailAgents missing DispatchAgents")
	}
}

func TestPromptBasePlusCodingFormat(t *testing.T) {
	t.Parallel()
	combined := PromptBase + "\n\n" + PromptCoding
	if !strings.HasPrefix(combined, "# CodeCast System Prompt v3.0") {
		t.Error("Combined prompt should start with PromptBase header")
	}
	baseEndIdx := strings.Index(combined, "\n\n"+strings.TrimSpace(strings.Split(PromptCoding, "\n")[0]))
	if baseEndIdx < 0 {
		t.Error("Should find PromptBase followed by PromptCoding")
	}
}

func TestPromptBasePlusDailyFormat(t *testing.T) {
	t.Parallel()
	combined := PromptBase + "\n\n" + PromptDaily
	if !strings.HasPrefix(combined, "# CodeCast System Prompt v3.0") {
		t.Error("Combined daily prompt should start with PromptBase header")
	}
}
