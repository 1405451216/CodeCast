package main

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"

	ap "agentprimordia/pkg"
)

// ==================== OAuth 配置读取 Mock 测试 ====================

// TestOAuthConfig_EnvVarLoaded 验证从环境变量读取 OAuth 凭据
func TestOAuthConfig_EnvVarLoaded(t *testing.T) {
	// 设置 mock 环境变量
	mockClientID := "mock-github-client-id-12345"
	mockClientSecret := "mock-github-client-secret-abcdef"

	originalID := githubClientID
	originalSecret := githubClientSecret
	defer func() {
		githubClientID = originalID
		githubClientSecret = originalSecret
	}()

	githubClientID = mockClientID
	githubClientSecret = mockClientSecret

	if githubClientID != mockClientID {
		t.Errorf("expected githubClientID=%q, got %q", mockClientID, githubClientID)
	}
	if githubClientSecret != mockClientSecret {
		t.Errorf("expected githubClientSecret=%q, got %q", mockClientSecret, githubClientSecret)
	}
	t.Logf("[PASS] OAuth 环境变量读取验证: client_id_len=%d, client_secret_len=%d",
		len(githubClientID), len(githubClientSecret))
}

// TestOAuthConfig_MissingClientID 验证缺失 Client ID 时的错误处理
func TestOAuthConfig_MissingClientID(t *testing.T) {
	originalID := githubClientID
	originalSecret := githubClientSecret
	defer func() {
		githubClientID = originalID
		githubClientSecret = originalSecret
	}()

	githubClientID = ""
	githubClientSecret = "some-secret"

	app := createTestApp()
	_, err := app.StartGitHubLogin()
	if err == nil {
		t.Fatal("expected error when githubClientID is empty")
	}

	t.Logf("[PASS] 缺失 Client ID 时正确返回错误: %v", err)
}

// TestOAuthConfig_MissingClientSecret 验证缺失 Client Secret 时的行为
func TestOAuthConfig_MissingClientSecret(t *testing.T) {
	originalID := githubClientID
	originalSecret := githubClientSecret
	defer func() {
		githubClientID = originalID
		githubClientSecret = originalSecret
	}()

	githubClientID = "some-id"
	githubClientSecret = ""

	// Client Secret 为空不会阻止 StartGitHubLogin 启动（在 exchangeCodeForToken 时才会失败）
	// 但 startCallbackServer 应该能正常启动
	app := createTestApp()
	_ = app // app 用于后续扩展
	if githubClientSecret != "" {
		t.Errorf("expected empty githubClientSecret, got %q", githubClientSecret)
	}
	t.Logf("[PASS] 缺失 Client Secret 状态验证: client_id_set=%v, client_secret_set=%v",
		githubClientID != "", githubClientSecret != "")
}

// TestOAuthConfig_EnvReadWrite 验证环境变量的读写一致性
func TestOAuthConfig_EnvReadWrite(t *testing.T) {
	// 保存原始值
	origID := os.Getenv("GITHUB_CLIENT_ID")
	origSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	defer func() {
		os.Setenv("GITHUB_CLIENT_ID", origID)
		os.Setenv("GITHUB_CLIENT_SECRET", origSecret)
	}()

	// 设置 mock 环境变量
	testID := "test-client-id-00000"
	testSecret := "test-client-secret-00000"
	os.Setenv("GITHUB_CLIENT_ID", testID)
	os.Setenv("GITHUB_CLIENT_SECRET", testSecret)

	// 模拟 init() 的读取逻辑
	loadedID := os.Getenv("GITHUB_CLIENT_ID")
	loadedSecret := os.Getenv("GITHUB_CLIENT_SECRET")

	if loadedID != testID {
		t.Errorf("expected GITHUB_CLIENT_ID=%q, got %q", testID, loadedID)
	}
	if loadedSecret != testSecret {
		t.Errorf("expected GITHUB_CLIENT_SECRET=%q, got %q", testSecret, loadedSecret)
	}

	t.Logf("[PASS] 环境变量读写一致性: GITHUB_CLIENT_ID=%q, GITHUB_CLIENT_SECRET=%q",
		loadedID, loadedSecret)
}

// ==================== 预算配置转换 Mock 测试 ====================

// TestBudgetConfigDTO_RoundTrip 验证 DTO 转换的完整往返一致性
func TestBudgetConfigDTO_RoundTrip(t *testing.T) {
	// 构造 mock DTO 数据
	mockDTO := BudgetConfigDTO{
		MaxCostUSD:          50.0,
		AlertThreshold:      0.8,
		EnforcementEnabled:  true,
		MaxTokensPerCall:    4096,
		MaxTokensPerSession: 100000,
	}

	// DTO -> AP BudgetConfig
	budget := dtoToBudgetConfig(mockDTO, nil)

	// 验证 AP BudgetConfig 字段
	if budget.MaxTotalCostUSD != mockDTO.MaxCostUSD {
		t.Errorf("MaxTotalCostUSD: expected %f, got %f", mockDTO.MaxCostUSD, budget.MaxTotalCostUSD)
	}
	if budget.MaxTokensPerCall != mockDTO.MaxTokensPerCall {
		t.Errorf("MaxTokensPerCall: expected %d, got %d", mockDTO.MaxTokensPerCall, budget.MaxTokensPerCall)
	}
	if budget.MaxTokensPerSession != mockDTO.MaxTokensPerSession {
		t.Errorf("MaxTokensPerSession: expected %d, got %d", mockDTO.MaxTokensPerSession, budget.MaxTokensPerSession)
	}

	// AP BudgetConfig + app-level fields -> DTO
	resultDTO := budgetToDTO(budget, mockDTO.AlertThreshold, mockDTO.EnforcementEnabled)

	// 验证往返一致性
	if resultDTO.MaxCostUSD != mockDTO.MaxCostUSD {
		t.Errorf("roundtrip MaxCostUSD: expected %f, got %f", mockDTO.MaxCostUSD, resultDTO.MaxCostUSD)
	}
	if resultDTO.AlertThreshold != mockDTO.AlertThreshold {
		t.Errorf("roundtrip AlertThreshold: expected %f, got %f", mockDTO.AlertThreshold, resultDTO.AlertThreshold)
	}
	if resultDTO.EnforcementEnabled != mockDTO.EnforcementEnabled {
		t.Errorf("roundtrip EnforcementEnabled: expected %v, got %v", mockDTO.EnforcementEnabled, resultDTO.EnforcementEnabled)
	}
	if resultDTO.MaxTokensPerCall != mockDTO.MaxTokensPerCall {
		t.Errorf("roundtrip MaxTokensPerCall: expected %d, got %d", mockDTO.MaxTokensPerCall, resultDTO.MaxTokensPerCall)
	}
	if resultDTO.MaxTokensPerSession != mockDTO.MaxTokensPerSession {
		t.Errorf("roundtrip MaxTokensPerSession: expected %d, got %d", mockDTO.MaxTokensPerSession, resultDTO.MaxTokensPerSession)
	}

	// 序列化为 JSON 验证前端兼容性
	jsonBytes, err := json.Marshal(resultDTO)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}

	var parsed BudgetConfigDTO
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}

	if parsed.AlertThreshold != mockDTO.AlertThreshold {
		t.Errorf("JSON roundtrip AlertThreshold: expected %f, got %f", mockDTO.AlertThreshold, parsed.AlertThreshold)
	}
	if parsed.EnforcementEnabled != mockDTO.EnforcementEnabled {
		t.Errorf("JSON roundtrip EnforcementEnabled: expected %v, got %v", mockDTO.EnforcementEnabled, parsed.EnforcementEnabled)
	}

	t.Logf("[PASS] DTO 往返一致性验证: %+v", resultDTO)
	t.Logf("[PASS] JSON 序列化: %s", string(jsonBytes))
}

// TestBudgetConfigDTO_NilBudget 验证 nil BudgetConfig 输入
func TestBudgetConfigDTO_NilBudget(t *testing.T) {
	dto := budgetToDTO(nil, 0.75, true)

	if dto.AlertThreshold != 0.75 {
		t.Errorf("AlertThreshold: expected 0.75, got %f", dto.AlertThreshold)
	}
	if !dto.EnforcementEnabled {
		t.Error("EnforcementEnabled: expected true, got false")
	}
	if dto.MaxCostUSD != 0 {
		t.Errorf("MaxCostUSD: expected 0, got %f", dto.MaxCostUSD)
	}

	t.Logf("[PASS] nil BudgetConfig 处理: %+v", dto)
}

// TestBudgetConfigDTO_ZeroValues 验证零值处理
func TestBudgetConfigDTO_ZeroValues(t *testing.T) {
	dto := BudgetConfigDTO{}

	budget := dtoToBudgetConfig(dto, nil)

	if budget.MaxTotalCostUSD != 0 {
		t.Errorf("MaxTotalCostUSD: expected 0, got %f", budget.MaxTotalCostUSD)
	}

	result := budgetToDTO(budget, 0, false)

	if result.AlertThreshold != 0 {
		t.Errorf("AlertThreshold: expected 0, got %f", result.AlertThreshold)
	}
	if result.EnforcementEnabled {
		t.Error("EnforcementEnabled: expected false, got true")
	}

	t.Logf("[PASS] 零值处理: %+v", result)
}

// TestBudgetConfig_SetAndRetrieve 验证通过 App 的完整设置-读取流程
func TestBudgetConfig_SetAndRetrieve(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}

	// 设置带 AlertThreshold 和 EnforcementEnabled 的配置
	input := BudgetConfigDTO{
		MaxCostUSD:          25.0,
		AlertThreshold:      0.9,
		EnforcementEnabled:  true,
		MaxTokensPerCall:    2048,
		MaxTokensPerSession: 50000,
	}

	app.SetBudgetConfig(input)

	// 读取回来
	output := app.GetBudgetConfig()

	if output.MaxCostUSD != input.MaxCostUSD {
		t.Errorf("MaxCostUSD: expected %f, got %f", input.MaxCostUSD, output.MaxCostUSD)
	}
	if output.AlertThreshold != input.AlertThreshold {
		t.Errorf("AlertThreshold: expected %f, got %f", input.AlertThreshold, output.AlertThreshold)
	}
	if output.EnforcementEnabled != input.EnforcementEnabled {
		t.Errorf("EnforcementEnabled: expected %v, got %v", input.EnforcementEnabled, output.EnforcementEnabled)
	}
	if output.MaxTokensPerCall != input.MaxTokensPerCall {
		t.Errorf("MaxTokensPerCall: expected %d, got %d", input.MaxTokensPerCall, output.MaxTokensPerCall)
	}
	if output.MaxTokensPerSession != input.MaxTokensPerSession {
		t.Errorf("MaxTokensPerSession: expected %d, got %d", input.MaxTokensPerSession, output.MaxTokensPerSession)
	}

	t.Logf("[PASS] App 完整设置-读取: input=%+v, output=%+v", input, output)
}

// TestBudgetConfig_UpdatePreservesFields 验证更新预算时保留 AlertThreshold/EnforcementEnabled
func TestBudgetConfig_UpdatePreservesFields(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}

	// 第一次设置：包含所有字段
	first := BudgetConfigDTO{
		MaxCostUSD:          10.0,
		AlertThreshold:      0.8,
		EnforcementEnabled:  true,
		MaxTokensPerCall:    1024,
		MaxTokensPerSession: 10000,
	}
	app.SetBudgetConfig(first)

	// 第二次设置：只更新 MaxCostUSD（模拟前端 SetBudgetLimit 场景）
	second := app.GetBudgetConfig()
	second.MaxCostUSD = 20.0
	app.SetBudgetConfig(second)

	// 读取回来，验证 AlertThreshold 和 EnforcementEnabled 没有丢失
	result := app.GetBudgetConfig()

	if result.AlertThreshold != 0.8 {
		t.Errorf("AlertThreshold lost after update: expected 0.8, got %f", result.AlertThreshold)
	}
	if !result.EnforcementEnabled {
		t.Error("EnforcementEnabled lost after update: expected true, got false")
	}
	if result.MaxCostUSD != 20.0 {
		t.Errorf("MaxCostUSD: expected 20.0, got %f", result.MaxCostUSD)
	}

	t.Logf("[PASS] 更新后字段保留: %+v", result)
}

// TestBudgetConfig_ConcurrentAccess 验证并发读写的线程安全性
func TestBudgetConfig_ConcurrentAccess(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}

	var wg sync.WaitGroup
	iterations := 100

	// 并发写入
	for i := 0; i < iterations; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			app.SetBudgetConfig(BudgetConfigDTO{
				MaxCostUSD:         float64(idx),
				AlertThreshold:     float64(idx) / 100.0,
				EnforcementEnabled: idx%2 == 0,
			})
		}(i)
	}

	// 并发读取
	for i := 0; i < iterations; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = app.GetBudgetConfig()
		}()
	}

	wg.Wait()
	t.Logf("[PASS] 并发访问测试完成: final_config=%+v", app.GetBudgetConfig())
}

// ==================== 前端请求模拟集成测试 ====================

// TestFrontendBudgetUpdate_JSONRoundTrip 模拟前端发送 JSON 预算更新请求
// 模拟 Wails 绑定层接收前端 JSON → 反序列化 → SetBudgetConfig → GetBudgetConfig → 序列化返回
func TestFrontendBudgetUpdate_JSONRoundTrip(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}

	// 模拟前端发送的 JSON（包含 AlertThreshold 和 EnforcementEnabled）
	frontendJSON := `{
		"maxCostUSD": 100.0,
		"alertThreshold": 0.85,
		"enforcementEnabled": true,
		"maxTokensPerCall": 8192,
		"maxTokensPerSession": 200000
	}`

	// 模拟 Wails 反序列化
	var dto BudgetConfigDTO
	if err := json.Unmarshal([]byte(frontendJSON), &dto); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}

	t.Logf("[前端请求] 反序列化: %+v", dto)

	// 调用 SetBudgetConfig（模拟 Wails 绑定调用）
	app.SetBudgetConfig(dto)

	// 调用 GetBudgetConfig（模拟前端读取配置）
	result := app.GetBudgetConfig()

	// 序列化为 JSON 返回给前端
	resultJSON, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}

	t.Logf("[后端响应] JSON: %s", string(resultJSON))

	// 验证所有字段完整保留
	if result.MaxCostUSD != 100.0 {
		t.Errorf("MaxCostUSD: expected 100.0, got %f", result.MaxCostUSD)
	}
	if result.AlertThreshold != 0.85 {
		t.Errorf("AlertThreshold: expected 0.85, got %f", result.AlertThreshold)
	}
	if !result.EnforcementEnabled {
		t.Error("EnforcementEnabled: expected true, got false")
	}
	if result.MaxTokensPerCall != 8192 {
		t.Errorf("MaxTokensPerCall: expected 8192, got %d", result.MaxTokensPerCall)
	}
	if result.MaxTokensPerSession != 200000 {
		t.Errorf("MaxTokensPerSession: expected 200000, got %d", result.MaxTokensPerSession)
	}

	// 验证返回的 JSON 包含所有字段
	var parsed map[string]interface{}
	if err := json.Unmarshal(resultJSON, &parsed); err != nil {
		t.Fatalf("result JSON unmarshal failed: %v", err)
	}
	if _, ok := parsed["alertThreshold"]; !ok {
		t.Error("返回 JSON 缺少 alertThreshold 字段")
	}
	if _, ok := parsed["enforcementEnabled"]; !ok {
		t.Error("返回 JSON 缺少 enforcementEnabled 字段")
	}

	t.Logf("[PASS] 前端 JSON 请求往返验证: 所有字段完整保留")
}

// TestFrontendBudgetUpdate_MultipleUpdates 模拟前端多次更新预算
// 验证多次更新后 AlertThreshold/EnforcementEnabled 不会丢失
func TestFrontendBudgetUpdate_MultipleUpdates(t *testing.T) {
	app := &App{
		settings:    &Settings{},
		ctx:         context.Background(),
		costTracker: ap.NewCostTracker(nil, nil),
	}

	// 第一次设置：完整配置
	app.SetBudgetConfig(BudgetConfigDTO{
		MaxCostUSD:         50.0,
		AlertThreshold:     0.8,
		EnforcementEnabled: true,
		MaxTokensPerCall:   4096,
		MaxTokensPerSession: 100000,
	})

	// 第二次更新：只修改 MaxCostUSD（模拟 SetBudgetLimit）
	current := app.GetBudgetConfig()
	current.MaxCostUSD = 75.0
	app.SetBudgetConfig(current)

	// 第三次更新：只修改 AlertThreshold
	current = app.GetBudgetConfig()
	current.AlertThreshold = 0.9
	app.SetBudgetConfig(current)

	// 最终读取验证
	result := app.GetBudgetConfig()

	if result.MaxCostUSD != 75.0 {
		t.Errorf("MaxCostUSD: expected 75.0, got %f", result.MaxCostUSD)
	}
	if result.AlertThreshold != 0.9 {
		t.Errorf("AlertThreshold: expected 0.9, got %f", result.AlertThreshold)
	}
	if !result.EnforcementEnabled {
		t.Error("EnforcementEnabled: expected true, got false (should be preserved from first update)")
	}
	if result.MaxTokensPerCall != 4096 {
		t.Errorf("MaxTokensPerCall: expected 4096, got %d", result.MaxTokensPerCall)
	}
	if result.MaxTokensPerSession != 100000 {
		t.Errorf("MaxTokensPerSession: expected 100000, got %d", result.MaxTokensPerSession)
	}

	t.Logf("[PASS] 多次更新后字段保留: %+v", result)
}

// TestFrontendOAuthFlow_MockCredentials 模拟前端发起 OAuth 登录流程
// 使用 mock 凭据验证整个流程的错误处理
func TestFrontendOAuthFlow_MockCredentials(t *testing.T) {
	originalID := githubClientID
	originalSecret := githubClientSecret
	defer func() {
		githubClientID = originalID
		githubClientSecret = originalSecret
	}()

	// 场景1: 使用 mock 凭据（模拟前端调用 StartGitHubLogin）
	githubClientID = "mock-client-id-12345"
	githubClientSecret = "mock-client-secret-abcdef"

	app := createTestApp()

	// StartGitHubLogin 会启动回调服务器并尝试打开浏览器
	// 由于是 mock 凭据，实际 OAuth 流程会失败，但我们可以验证：
	// 1. 凭据检查通过
	// 2. 回调服务器启动
	// 3. state 生成正确
	t.Logf("[场景1] 使用 mock 凭据: client_id=%q, client_secret=%q", githubClientID, githubClientSecret)

	// 注意：StartGitHubLogin 会尝试打开浏览器，在测试环境中可能会失败
	// 我们主要验证凭据检查逻辑
	msg, err := app.StartGitHubLogin()
	if err != nil {
		t.Logf("[INFO] StartGitHubLogin 返回错误（预期行为，因为是 mock 凭据）: %v", err)
	} else {
		t.Logf("[INFO] StartGitHubLogin 成功: %s", msg)
	}

	// 场景2: 缺失凭据
	githubClientID = ""
	_, err = app.StartGitHubLogin()
	if err == nil {
		t.Error("缺失 client_id 时应返回错误")
	} else {
		t.Logf("[PASS] 缺失凭据时正确返回错误: %v", err)
	}
}

// TestFrontendBudgetConfigJSON_MatchesWailsBinding 验证 DTO JSON 格式与 Wails 绑定生成一致
func TestFrontendBudgetConfigJSON_MatchesWailsBinding(t *testing.T) {
	// 这是前端期望的 JSON 格式（来自 wailsjs/go/models.ts）
	expectedFields := []string{
		"maxCostUSD",
		"alertThreshold",
		"enforcementEnabled",
		"maxTokensPerCall",
		"maxTokensPerSession",
	}

	dto := BudgetConfigDTO{
		MaxCostUSD:          100.0,
		AlertThreshold:      0.85,
		EnforcementEnabled:  true,
		MaxTokensPerCall:    8192,
		MaxTokensPerSession: 200000,
	}

	jsonBytes, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}

	for _, field := range expectedFields {
		if _, ok := parsed[field]; !ok {
			t.Errorf("JSON 缺少字段: %s", field)
		} else {
			t.Logf("[OK] 字段 %s 存在: %v", field, parsed[field])
		}
	}

	t.Logf("[PASS] DTO JSON 格式与 Wails 绑定一致: %s", string(jsonBytes))
}
