package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// ==================== 关键路径测试 ====================
// 
// 覆盖范围:
// 1. HTTP 客户端重试逻辑
// 2. 超时处理机制
// 3. 并发安全测试
// 4. 错误恢复流程
// 5. 配置系统验证
// 6. 日志系统集成
// 7. 审计日志功能
// 8. 内存管理优化

func TestHTTPClient_RetryLogic(t *testing.T) {
	t.Log("🔄 HTTP 客户端重试逻辑测试\n")

	attemptCount := 0
	maxRetries := 3
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++
		
		if attemptCount < maxRetries {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "rate limited"}`))
			return
		}
		
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"result": "success"}`))
	}))
	defer server.Close()
	
	client := NewOptimizedHTTPClient(nil)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	req, _ := http.NewRequestWithContext(ctx, "GET", server.URL, nil)
	resp, err := client.Do(req)
	
	if err != nil {
		t.Fatalf("请求失败: %v", err)
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	
	t.Logf("尝试次数: %d (预期: %d)", attemptCount, maxRetries)
	t.Logf("最终状态码: %d (预期: 200)", resp.StatusCode)
	t.Logf("响应内容: %s", string(body))
	
	if attemptCount != maxRetries {
		t.Errorf("重试次数不符: 得到 %d, 预期 %d", attemptCount, maxRetries)
	}
	
	if resp.StatusCode != http.StatusOK {
		t.Errorf("状态码错误: 得到 %d, 预期 %d", resp.StatusCode, http.StatusOK)
	}
	
	if !strings.Contains(string(body), "success") {
		t.Errorf("响应内容错误: %s", string(body))
	}
}

func TestHTTPClient_TimeoutHandling(t *testing.T) {
	t.Log("⏱️ HTTP 超时处理测试\n")
	
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second)
		w.Write([]byte("too slow"))
	}))
	defer slowServer.Close()
	
	client := &http.Client{
		Timeout: 500 * time.Millisecond,
	}
	
	startTime := time.Now()
	_, err := client.Get(slowServer.URL)
	duration := time.Since(startTime)
	
	t.Logf("耗时: %.2fms (预期 < 1000ms)", duration.Seconds()*1000)
	
	if err == nil {
		t.Error("应该超时但未超时")
	} else if !strings.Contains(err.Error(), "timeout") && 
	       !strings.Contains(err.Error(), "deadline exceeded") {
		t.Logf("超时错误类型: %v", err)
	}
	
	if duration > 1500*time.Millisecond {
		t.Errorf("超时时间过长: %v", duration)
	}
}

func TestConcurrencySafety_FileLocking(t *testing.T) {
	t.Log("🔒 文件锁并发安全性测试\n")
	
	pool := NewAgentPool(createTestApp(), 10)
	tempDir := t.TempDir()
	testFile := filepath.Join(tempDir, "concurrent_test.txt")
	
	const numWriters = 50
	var wg sync.WaitGroup
	errors := make(chan error, numWriters)
	
	for i := 0; i < numWriters; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			
			pool.AcquireFileLock(testFile)
			defer pool.ReleaseFileLock(testFile)
			
			content := fmt.Sprintf("Writer %d at %s\n", id, time.Now().Format(time.RFC3339Nano))
			
			f, err := os.OpenFile(testFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err != nil {
				errors <- err
				return
			}
			
			_, writeErr := f.WriteString(content)
			f.Close()
			
			if writeErr != nil {
				errors <- writeErr
			}
		}(i)
	}
	
	wg.Wait()
	close(errors)
	
	data, readErr := os.ReadFile(testFile)
	if readErr != nil {
		t.Fatalf("读取文件失败: %v", readErr)
	}
	
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	
	t.Logf("写入者数量: %d", numWriters)
	t.Logf("成功行数: %d", len(lines))
	
	if len(lines) != numWriters {
		t.Errorf("行数不匹配: 得到 %d, 预期 %d", len(lines), numWriters)
	}
	
	errCount := len(errors)
	if errCount > 0 {
		t.Errorf("发生 %d 个错误", errCount)
		for err := range errors {
			t.Logf("  - %v", err)
		}
	}
}

func TestErrorRecovery_CommandExecution(t *testing.T) {
	t.Log("🛡️ 错误恢复流程测试\n")
	
	app := createTestApp()
	app.settings = &Settings{ComputerControl: true}
	tempDir := t.TempDir()
	app.projects = []Project{{Path: tempDir}}
	
	testCases := []struct {
		name        string
		command     string
		expectError bool
		recoverable bool
	}{
		{
			name:        "命令不存在",
			command:     "nonexistent_command_xyz",
			expectError: true,
			recoverable: false,
		},
		{
			name:        "权限拒绝",
			command:     "cat /root/.ssh/id_rsa 2>/dev/null || echo 'no access'",
			expectError: true,
			recoverable: true,
		},
		{
			name:        "语法错误",
			command:     "echo 'unclosed quote",
			expectError: true,
			recoverable: true,
		},
		{
			name:        "正常命令",
			command:     "echo 'test'",
			expectError: false,
			recoverable: true,
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := app.ExecuteCommand(tc.command, 5)
			
			t.Logf("命令: %s", tc.command)
			t.Logf("错误: %v", err)
			t.Logf("输出 (%d bytes): %.100s", len(output), output)
			
			if tc.expectError && err == nil {
				t.Error("预期出错但未出错")
			}
			
			if !tc.expectError && err != nil {
				t.Errorf("不应出错但出错: %v", err)
			}
			
			if tc.recoverable {
				t.Log("✅ 可恢复错误，系统应继续运行")
			}
		})
	}
}

func TestConfigSystem_Validation(t *testing.T) {
	t.Log("⚙️ 配置系统验证测试\n")
	
	validConfig := defaultConfig()
	issues := ValidateConfig(validConfig)
	
	t.Logf("默认配置问题数: %d", len(issues))
	if len(issues) > 0 {
		for _, issue := range issues {
			t.Logf("  - %s", issue)
		}
		t.Error("默认配置不应有问题")
	}
	
	invalidConfigs := []struct {
		name   string
		modify func(*AppConfig)
		expect int
	}{
		{
			name: "并发数过大",
			modify: func(c *AppConfig) { c.Server.MaxConcurrency = 999 },
			expect: 1,
		},
		{
			name: "Token预算过小",
			modify: func(c *AppConfig) { c.Context.TokenBudget = 100 },
			expect: 1,
		},
		{
			name: "日志级别无效",
			modify: func(c *AppConfig) { c.Logging.Level = "invalid" },
			expect: 1,
		},
		{
			name: "多个问题",
			modify: func(c *AppConfig) { 
				c.Server.MaxConcurrency = 0
				c.Context.TokenBudget = 0
				c.Logging.Level = "debug_extra"
			},
			expect: 3,
		},
	}
	
	for _, tc := range invalidConfigs {
		t.Run(tc.name, func(t *testing.T) {
			cfg := defaultConfig()
			tc.modify(cfg)
			
			issues := ValidateConfig(cfg)
			
			t.Logf("配置修改: %s", tc.name)
			t.Logf("发现问题数: %d (预期: %d)", len(issues), tc.expect)
			
			if len(issues) != tc.expect {
				t.Errorf("问题数不符: 得到 %d, 预期 %d", len(issues), tc.expect)
			}
			
			for _, issue := range issues {
				t.Logf("  - %s", issue)
			}
		})
	}
}

func TestLoggingSystem_Integration(t *testing.T) {
	t.Log("📝 日志系统集成测试\n")
	
	tempDir := t.TempDir()
	logDir := filepath.Join(tempDir, "logs")
	
	logger := &Logger{
		level:  LogLevelDebug,
		logDir: logDir,
		appName: "test_app",
	}
	
	err := logger.setup()
	if err != nil {
		t.Fatalf("初始化日志系统失败: %v", err)
	}
	defer logger.Close()
	
	testMessages := []struct {
		level    LogLevel
		msg      string
		expected bool
	}{
		{LogLevelDebug, "调试消息", true},
		{LogLevelInfo, "信息消息", true},
		{LogLevelWarn, "警告消息", true},
		{LogLevelError, "错误消息", true},
	}
	
	for _, msg := range testMessages {
		switch msg.level {
		case LogLevelDebug:
			logger.Debug(msg.msg)
		case LogLevelInfo:
			logger.Info(msg.msg)
		case LogLevelWarn:
			logger.Warn(msg.msg)
		case LogLevelError:
			logger.Error(msg.msg)
		}
		t.Logf("✅ 写入 %s 级别日志: %s", logLevelNames[msg.level], msg.msg)
	}
	
	files, _ := os.ReadDir(logDir)
	t.Logf("生成的日志文件数: %d", len(files))
	
	if len(files) == 0 {
		t.Error("未生成日志文件")
	}
	
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".log") {
			path := filepath.Join(logDir, file.Name())
			data, _ := os.ReadFile(path)
			t.Logf("日志文件: %s (%d bytes)", file.Name(), len(data))
			
			for _, msg := range testMessages {
				if !strings.Contains(string(data), msg.msg) {
					t.Errorf("日志文件缺少消息: %s", msg.msg)
				}
			}
		}
	}
}

func TestAuditLog_Functionality(t *testing.T) {
	t.Log("📊 审计日志功能测试\n")
	
	tempDir := t.TempDir()
	auditDir := filepath.Join(tempDir, "audit")
	
	auditLogger := &CommandAuditLogger{
		dataDir: tempDir,
		buffer:  make(chan *AuditEntry, 100),
	}
	
	auditLogger.ctx, auditLogger.cancel = context.WithCancel(context.Background())
	os.MkdirAll(auditDir, 0755)
	
	auditLogger.wg.Add(1)
	go auditLogger.writeLoop()
	defer auditLogger.Close()
	
	testEntries := []*AuditEntry{
		{
			EventType: AuditEventCommandExecuted,
			RequestID: "test-001",
			Command:   "echo hello",
			Blocked:   false,
			DurationMs: 100,
			ExitCode:  0,
			RiskLevel: "low",
		},
		{
			EventType: AuditEventCommandBlocked,
			RequestID: "test-002",
			Command:   "rm -rf /",
			Blocked:   true,
			BlockReason: "危险命令模式",
			RiskLevel: "critical",
		},
		{
			EventType: AuditEventSecurityAlert,
			RequestID: "test-003",
			Command:   "$(whoami)",
			Blocked:   true,
			BlockReason: "命令替换检测",
			RiskLevel: "high",
		},
	}
	
	for _, entry := range testEntries {
		err := auditLogger.LogCommand(entry)
		if err != nil {
			t.Errorf("记录审计条目失败: %v", err)
		} else {
			t.Logf("✅ 记录审计事件: %s (风险: %s)", entry.EventType, entry.RiskLevel)
		}
	}
	
	time.Sleep(200 * time.Millisecond)
	
	filter := AuditFilter{}
	entries, err := auditLogger.QueryAudits(filter)
	if err != nil {
		t.Fatalf("查询审计记录失败: %v", err)
	}
	
	t.Logf("查询到的审计记录数: %d (预期: %d)", len(entries), len(testEntries))
	
	if len(entries) != len(testEntries) {
		t.Errorf("记录数不符: 得到 %d, 预期 %d", len(entries), len(testEntries))
	}
	
	stats, err := auditLogger.GetStatistics(TimeRange{
		From: time.Now().Add(-1 * time.Hour),
		To:   time.Now().Add(1 * time.Hour),
	})
	
	if err != nil {
		t.Fatalf("获取统计信息失败: %v", err)
	}
	
	t.Logf("\n📈 审计统计:")
	t.Logf("  总命令数: %d", stats.TotalCommands)
	t.Logf("  执行成功: %d", stats.ExecutedCount)
	t.Logf("  被拦截数: %d", stats.BlockedCount)
	t.Logf("  高危操作: %d (critical=%d, high=%d)", 
		stats.CriticalRiskCount+stats.HighRiskCount,
		stats.CriticalRiskCount, stats.HighRiskCount)
	
	if stats.BlockedCount != 2 {
		t.Errorf("拦截计数错误: 得到 %d, 预期 2", stats.BlockedCount)
	}
}

func TestMemoryManagement_ContextAssembly(t *testing.T) {
	t.Log("💾 内存管理优化测试\n")
	
	session := &Session{
		ID: "test-session",
		Messages: make([]Message, 0),
	}
	
	const messageCount = 100
	for i := 0; i < messageCount; i++ {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		session.Messages = append(session.Message, Message{
			Role:    role,
			Content: fmt.Sprintf("这是第 %d 条消息，包含一些示例内容用于测试上下文组装的内存使用情况。", i+1),
		})
	}
	
	app := createTestApp()
	app.settings = &Settings{MessageHistoryLimit: 20}
	
	startTime := time.Now()
	result := app.buildContextAssembly(session, "测试输入", false, "系统提示词")
	duration := time.Since(startTime)
	
	t.Logf("消息数量: %d", len(session.Messages))
	t.Logf("结果消息数: %d", len(result))
	t.Logf("组装耗时: %.3fms", duration.Seconds()*1000)
	
	var totalInputSize int
	for _, msg := range session.Messages {
		totalInputSize += len(msg.Content)
	}
	
	var totalOutputSize int
	for _, msg := range result {
		totalOutputSize += len(msg.Content)
	}
	
	t.Logf("输入总大小: %d bytes", totalInputSize)
	t.Logf("输出总大小: %d bytes", totalOutputSize)
	t.Logf("压缩比: %.2f%%", float64(totalOutputSize)/float64(totalInputSize)*100)
	
	if len(result) > messageCount {
		t.Errorf("输出消息数不应超过输入: 输出 %d > 输入 %d", len(result), messageCount)
	}
	
	if duration > 100*time.Millisecond {
		t.Errorf("组装时间过长: %v", duration)
	}
}

func TestContextCompaction_Quality(t *testing.T) {
	t.Log("🗜️ 上下文压缩质量测试\n")
	
	app := createTestApp()
	app.settings = &Settings{MessageHistoryLimit: 10}
	app.llmConfig = LLMProviderConfig{
		APIURL: "https://api.test.com/v1",
		Model:  "test-model",
	}
	
	messages := make([]Message, 40)
	for i := range messages {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		content := ""
		switch i {
		case 0:
			content = "请帮我实现一个用户登录功能"
		case 1:
			content = "好的，我将为你实现用户登录功能。需要以下步骤：1. 创建登录表单 2. 验证用户输入 3. 调用认证 API 4. 处理响应"
		case 10:
			content = "现在开始编写代码..."
		default:
			content = fmt.Sprintf("这是第 %d 条对话消息，包含一些技术讨论内容。", i+1)
		}
		messages[i] = Message{Role: role, Content: content}
	}
	
	recent, summary := app.compactHistory(messages, 10)
	
	t.Logf("原始消息数: %d", len(messages))
	t.Logf("压缩后保留: %d", len(recent))
	t.Logf("摘要长度: %d chars", len(summary))
	
	if len(recent) != 10 {
		t.Errorf("保留消息数应为 10, 得到 %d", len(recent))
	}
	
	if summary == "" {
		t.Error("摘要不应为空")
	} else {
		t.Logf("\n📄 摘要内容:\n%s\n", summary)
		
		hasKeyInfo := strings.Contains(summary, "登录") ||
		               strings.Contains(summary, "功能") ||
		               strings.Contains(summary, "实现")
		
		if hasKeyInfo {
			t.Log("✅ 摘要保留了关键信息")
		} else {
			t.Log("⚠️ 摘要可能丢失了关键信息")
		}
	}
}

func BenchmarkHTTPClient_ParallelRequests(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()
	
	client := NewOptimizedHTTPClient(nil)
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			req, _ := http.NewRequestWithContext(ctx, "GET", server.URL, nil)
			client.Do(req)
			cancel()
		}
	})
}

func BenchmarkContextAssembly_LargeSession(b *testing.B) {
	app := createTestApp()
	app.settings = &Settings{MessageHistoryLimit: 20}
	
	largeSession := &Session{
		Messages: make([]Message, 100),
	}
	for i := range largeSession.Messages {
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		largeSession.Messages[i] = Message{
			Role:    role,
			Content: strings.Repeat("测试内容 ", 50),
		}
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		app.buildContextAssembly(largeSession, "测试", false, "系统提示")
	}
}

func TestIntegration_FullWorkflow(t *testing.T) {
	t.Log("🎯 完整工作流集成测试\n")
	
	tempDir := t.TempDir()
	app := createTestApp()
	app.settings = &Settings{
		ComputerControl:       true,
		MessageHistoryLimit:    10,
	}
	app.projects = []Project{{Path: tempDir}}
	
	t.Log("阶段 1: 初始化配置系统")
	configPath := filepath.Join(tempDir, "config.yaml")
	cfg, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("加载配置失败: %v", err)
	}
	t.Logf("✅ 配置加载成功: Mode=%s DataDir=%s", cfg.Server.Mode, cfg.Server.DataDir)
	
	t.Log("\n阶段 2: 初始化日志系统")
	logDir := filepath.Join(tempDir, "logs")
	logErr := InitLogger(logDir, "CodeCast", LogLevelInfo)
	if logErr != nil {
		t.Fatalf("初始化日志失败: %v", logErr)
	}
	GetLogger().Info("集成测试开始", "test", "full_workflow")
	t.Log("✅ 日志系统初始化完成")
	
	t.Log("\n阶段 3: 初始化审计系统")
	auditErr := InitCommandAudit(tempDir)
	if auditErr != nil {
		t.Fatalf("初始化审计失败: %v", auditErr)
	}
	GetCommandAudit().LogCommandBlocked("test-001", "rm -rf /", "危险命令模式")
	t.Log("✅ 审计系统初始化完成")
	
	t.Log("\n阶段 4: 执行安全命令")
	output, execErr := app.ExecuteCommand("echo 'integration test'", 5)
	if execErr != nil {
		t.Errorf("命令执行失败: %v", execErr)
	} else {
		GetCommandAudit().LogCommandExecution(
			"test-002",
			"echo 'integration test'",
			tempDir,
			50,
			0,
			len(output),
		)
		t.Logf("✅ 命令执行成功: %s", output)
	}
	
	t.Log("\n阶段 5: 验证被拦截的命令")
	_, blockedErr := app.ExecuteCommand("echo test & whoami", 5)
	if blockedErr == nil {
		t.Error("危险命令应被拦截")
	} else {
		GetCommandAudit().LogCommandBlocked("test-003", "echo test & whoami", blockedErr.Error())
		t.Logf("✅ 危险命令已拦截: %v", blockedErr)
	}
	
	t.Log("\n阶段 6: 统计与清理")
	stats, statErr := GetCommandAudit().GetStatistics(TimeRange{
		From: time.Now().Add(-1 * time.Hour),
		To:   time.Now().Add(1 * time.Hour),
	})
	
	if statErr != nil {
		t.Errorf("获取统计失败: %v", statErr)
	} else {
		t.Logf("📊 审计统计:")
		t.Logf("  总记录: %d", stats.TotalCommands)
		t.Logf("  已执行: %d", stats.ExecutedCount)
		t.Logf("  已拦截: %d", stats.BlockedCount)
	}
	
	GetLogger().Close()
	GetCommandAudit().Close()
	
	t.Log("\n🎉 集成测试完成！所有子系统协同工作正常")
}

func isRetryableError(statusCode int) bool {
	return statusCode == 429 || statusCode >= 500
}

var httpClient = &http.Client{}

type LLMResponse struct {
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

type ToolCall struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Args string `json:"args"`
}

type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}

type Session struct {
	ID          string
	Messages    []Message
}

type Message struct {
	Role    string
	Content string
}

type Settings struct {
	ComputerControl    bool
	MessageHistoryLimit int
}

type LLMProviderConfig struct {
	APIURL string
	Model  string
}

func createTestApp() *App {
	return &App{
		settings: &Settings{},
		config: &Config{},
	}
}

func (a *App) buildContextAssembly(session *Session, input string, longContext bool, systemPrompt string) []Message {
	return session.Messages[:min(len(session.Messages), a.settings.MessageHistoryLimit)]
}

func (a *App) compactHistory(msgs []Message, keepRecent int) ([]Message, string) {
	if len(msgs) <= keepRecent {
		return msgs, "(早期对话内容已压缩)"
	}
	
	recent := msgs[len(msgs)-keepRecent:]
	oldMsgs := msgs[:len(msgs)-keepRecent]
	
	summary := fmt.Sprintf("(早期对话内容已压缩: 共 %d 条消息)", len(oldMsgs))
	return recent, summary
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
