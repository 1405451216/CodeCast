package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// ==================== 模拟数据构造器 ====================

// buildMockInferenceConfig 构造完整的模拟推理配置数据，覆盖全部 8 个菜单
func buildMockInferenceConfig() InferenceConfig {
	return InferenceConfig{
		Connection: ConnectionConfig{
			GatewayType: "网关",
			CredType:    "Static API key",
			BaseURL:     "http://127.0.0.1:15721/claude-desktop",
			APIKeyEnc:   "sk-ant-encrypted-mock-key-for-testing-only",
			AuthScheme:  "bearer",
			CustomHeaders: map[string]string{
				"x-tenant-id": "tenant_abc123",
				"x-org-id":    "org_xyz789",
			},
			Model: ModelConfigSection{
				DiscoverEnabled: true,
				Models: []string{
					"claude-haiku-4-5",
					"claude-opus-4-8",
					"claude-sonnet-4-6",
					"deepseek-v4-pro",
				},
			},
		},
		Workspace: WorkspaceConfig{
			CoworkEnabled:   true,
			CodeEnabled:     true,
			AllowedHosts:    "*.example.com,api.openai.com,localhost",
			WorkspaceFolder: "~/Documents/codecast-workspace",
			DisabledTools:   []string{"Bash", "Edit"},
			ToolPolicyMode:  "restrictive",
			DisableLogin:    false,
			DisableDeepLink: true,
		},
		Connectors: ConnectorsConfig{
			MCPManagedServers: []MCPServerItem{
				{
					ID:      "mcp-memory",
					Name:    "Memory Server",
					URL:     "http://localhost:3001",
					Type:    "sse",
					Command: "",
					Args:    []string{},
				},
				{
					ID:      "mcp-github",
					Name:    "GitHub MCP",
					URL:     "",
					Type:    "stdio",
					Command: "npx",
					Args:    []string{"-y", "@modelcontextprotocol/server-github"},
				},
			},
			AllowUserMCP:     true,
			AllowDesktopExt:  true,
			RequireSignedExt: true,
		},
		Plugins: PluginsConfig{
			OrgPluginPath: "C:\\Program Files\\Claude\\org-plugins",
			ServerPolicies: []ServerPolicy{
				{
					ID:          "policy-001",
					Name:        "只读策略",
					Description: "限制插件只能读取文件，禁止写入和执行",
					Config:      `{"allow_read":true,"allow_write":false,"allow_execute":false}`,
				},
				{
					ID:          "policy-002",
					Name:        "沙箱策略",
					Description: "在隔离环境中运行所有插件操作",
					Config:      `{"sandbox_enabled":true,"network_access":"whitelist"}`,
				},
			},
		},
		Diagnostics: DiagnosticsConfig{
			LogLevel:          "Debug",
			LogDir:            "~/.codecast/logs",
			TelemetryEnabled:  true,
			TelemetryEndpoint: "https://telemetry.codecast.cloud/v1/events",
			AutoUpdateEnabled: true,
			UpdateChannel:     "Beta",
		},
		Usage: UsageConfig{
			DailyTokenLimit:        1000000,
			DailyTokenUnit:         "M",
			MaxTokensPerRequest:    200000,
			OverLimitAction:        "警告并继续",
			DailyCostCapUSD:        50.00,
			CostAlertThreshold:     80,
			RPMlimit:               60,
			ConcurrentSessionLimit: 5,
		},
		Appearance: AppearanceConfig{
			ThemeMode:      "深色",
			AccentColor:    "#722ed1",
			UIFontSize:     "大",
			CodeFontFamily: "Fira Code",
			CodeFontSize:   14,
			MessageSpacing: "宽松",
			ShowTimestamps: true,
			RenderMarkdown: true,
		},
		Outbound: OutboundConfig{
			HTTPProxy:   "http://proxy.company.com:8080",
			SOCKS5Proxy: "socks5://127.0.0.1:1080",
			NoProxyHosts: []string{
				"localhost", "127.0.0.1", "*.internal",
				"*.company.local", "10.0.0.0/8",
			},
			TLSCACertPath:  "C:\\certs\\company-ca.pem",
			TLSMinVersion:  "1.3",
			CustomDNS:      "8.8.8.8,1.1.1.1",
			ConnectTimeout: 15,
			ReadTimeout:    90,
			AllowedPorts:   []int{443, 80, 8080},
		},
	}
}

// ==================== 测试用例 ====================

func TestInferenceConfig_DefaultValues(t *testing.T) {
	t.Log("=== 测试 1/6: 默认值完整性 ===")

	cfg := DefaultInferenceConfig()

	// 连接
	if cfg.Connection.GatewayType != "网关" {
		t.Errorf("GatewayType: expected '网关', got '%s'", cfg.Connection.GatewayType)
	}
	if cfg.Connection.AuthScheme != "bearer" {
		t.Errorf("AuthScheme: expected 'bearer', got '%s'", cfg.Connection.AuthScheme)
	}
	if len(cfg.Connection.Model.Models) != 3 {
		t.Errorf("Models count: expected 3, got %d", len(cfg.Connection.Model.Models))
	}
	if !cfg.Connection.Model.DiscoverEnabled {
		t.Error("Model DiscoverEnabled should be true by default")
	}

	// 工作区
	if !cfg.Workspace.CoworkEnabled || !cfg.Workspace.CodeEnabled {
		t.Error("Cowork and Code should be enabled by default")
	}
	if cfg.Workspace.AllowedHosts != "*" {
		t.Errorf("AllowedHosts: expected '*', got '%s'", cfg.Workspace.AllowedHosts)
	}

	// 连接器
	if !cfg.Connectors.AllowUserMCP || !cfg.Connectors.AllowDesktopExt {
		t.Error("AllowUserMCP and AllowDesktopExt should be true by default")
	}

	// 诊断
	if cfg.Diagnostics.LogLevel != "Info" {
		t.Errorf("LogLevel: expected 'Info', got '%s'", cfg.Diagnostics.LogLevel)
	}
	if !cfg.Diagnostics.AutoUpdateEnabled {
		t.Error("AutoUpdate should be enabled by default")
	}
	if cfg.Diagnostics.UpdateChannel != "Stable" {
		t.Errorf("UpdateChannel: expected 'Stable', got '%s'", cfg.Diagnostics.UpdateChannel)
	}

	// 使用限制
	if cfg.Usage.OverLimitAction != "警告并继续" {
		t.Errorf("OverLimitAction: expected '警告并继续', got '%s'", cfg.Usage.OverLimitAction)
	}
	if cfg.Usage.CostAlertThreshold != 80 {
		t.Errorf("CostAlertThreshold: expected 80, got %d", cfg.Usage.CostAlertThreshold)
	}

	// 外观
	if cfg.Appearance.ThemeMode != "跟随系统" {
		t.Errorf("ThemeMode: expected '跟随系统', got '%s'", cfg.Appearance.ThemeMode)
	}
	if cfg.Appearance.AccentColor != "#1677ff" {
		t.Errorf("AccentColor: expected '#1677ff', got '%s'", cfg.Appearance.AccentColor)
	}
	if !cfg.Appearance.ShowTimestamps || !cfg.Appearance.RenderMarkdown {
		t.Error("ShowTimestamps and RenderMarkdown should be true by default")
	}

	// 出站
	if cfg.Outbound.TLSMinVersion != "1.2" {
		t.Errorf("TLSMinVersion: expected '1.2', got '%s'", cfg.Outbound.TLSMinVersion)
	}
	if cfg.Outbound.ConnectTimeout != 30 || cfg.Outbound.ReadTimeout != 120 {
		t.Errorf("Timeouts: expected 30/120, got %d/%d", cfg.Outbound.ConnectTimeout, cfg.Outbound.ReadTimeout)
	}
	if len(cfg.Outbound.AllowedPorts) != 2 || cfg.Outbound.AllowedPorts[0] != 443 {
		t.Errorf("AllowedPorts: expected [443,80], got %v", cfg.Outbound.AllowedPorts)
	}

	t.Log("  [PASS] 所有默认值正确")
}

func TestInferenceConfig_SaveAndLoad(t *testing.T) {
	t.Log("=== 测试 2/6: 保存与加载 ===")

	// 创建临时目录用于测试
	tmpDir := t.TempDir()
	testApp := &App{
		config: &Config{App: AppConfig{DataDir: tmpDir}},
	}

	mockCfg := buildMockInferenceConfig()

	// 保存
	err := testApp.SaveInferenceConfig(mockCfg)
	if err != nil {
		t.Fatalf("SaveInferenceConfig failed: %v", err)
	}

	// 验证文件存在
	path := filepath.Join(tmpDir, "inference_config.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatal("inference_config.json was not created")
	}

	// 加载
	loadedCfg, err := testApp.LoadInferenceConfig()
	if err != nil {
		t.Fatalf("LoadInferenceConfig failed: %v", err)
	}

	// 验证每个区域的数据一致性
	sections := []struct {
		name string
		got  interface{}
		want interface{}
	}{
		// 连接
		{"Connection.GatewayType", loadedCfg.Connection.GatewayType, mockCfg.Connection.GatewayType},
		{"Connection.BaseURL", loadedCfg.Connection.BaseURL, mockCfg.Connection.BaseURL},
		{"Connection.AuthScheme", loadedCfg.Connection.AuthScheme, mockCfg.Connection.AuthScheme},
		{"Connection.CustomHeaders", loadedCfg.Connection.CustomHeaders, mockCfg.Connection.CustomHeaders},
		{"Connection.Model.DiscoverEnabled", loadedCfg.Connection.Model.DiscoverEnabled, mockCfg.Connection.Model.DiscoverEnabled},
		{"Connection.Model.Models", loadedCfg.Connection.Model.Models, mockCfg.Connection.Model.Models},

		// 工作区
		{"Workspace.CoworkEnabled", loadedCfg.Workspace.CoworkEnabled, mockCfg.Workspace.CoworkEnabled},
		{"Workspace.CodeEnabled", loadedCfg.Workspace.CodeEnabled, mockCfg.Workspace.CodeEnabled},
		{"Workspace.AllowedHosts", loadedCfg.Workspace.AllowedHosts, mockCfg.Workspace.AllowedHosts},
		{"Workspace.WorkspaceFolder", loadedCfg.Workspace.WorkspaceFolder, mockCfg.Workspace.WorkspaceFolder},
		{"Workspace.DisabledTools", loadedCfg.Workspace.DisabledTools, mockCfg.Workspace.DisabledTools},
		{"Workspace.DisableLogin", loadedCfg.Workspace.DisableLogin, mockCfg.Workspace.DisableLogin},
		{"Workspace.DisableDeepLink", loadedCfg.Workspace.DisableDeepLink, mockCfg.Workspace.DisableDeepLink},

		// 连接器
		{"Connectors.MCPManagedServers len", len(loadedCfg.Connectors.MCPManagedServers), len(mockCfg.Connectors.MCPManagedServers)},
		{"Connectors.AllowUserMCP", loadedCfg.Connectors.AllowUserMCP, mockCfg.Connectors.AllowUserMCP},
		{"Connectors.RequireSignedExt", loadedCfg.Connectors.RequireSignedExt, mockCfg.Connectors.RequireSignedExt},

		// 插件
		{"Plugins.OrgPluginPath", loadedCfg.Plugins.OrgPluginPath, mockCfg.Plugins.OrgPluginPath},
		{"Plugins.ServerPolicies len", len(loadedCfg.Plugins.ServerPolicies), len(mockCfg.Plugins.ServerPolicies)},

		// 诊断
		{"Diagnostics.LogLevel", loadedCfg.Diagnostics.LogLevel, mockCfg.Diagnostics.LogLevel},
		{"Diagnostics.TelemetryEnabled", loadedCfg.Diagnostics.TelemetryEnabled, mockCfg.Diagnostics.TelemetryEnabled},
		{"Diagnostics.TelemetryEndpoint", loadedCfg.Diagnostics.TelemetryEndpoint, mockCfg.Diagnostics.TelemetryEndpoint},
		{"Diagnostics.UpdateChannel", loadedCfg.Diagnostics.UpdateChannel, mockCfg.Diagnostics.UpdateChannel},

		// 使用限制
		{"Usage.DailyTokenLimit", loadedCfg.Usage.DailyTokenLimit, mockCfg.Usage.DailyTokenLimit},
		{"Usage.DailyCostCapUSD", loadedCfg.Usage.DailyCostCapUSD, mockCfg.Usage.DailyCostCapUSD},
		{"Usage.RPMlimit", loadedCfg.Usage.RPMlimit, mockCfg.Usage.RPMlimit},

		// 外观
		{"Appearance.ThemeMode", loadedCfg.Appearance.ThemeMode, mockCfg.Appearance.ThemeMode},
		{"Appearance.AccentColor", loadedCfg.Appearance.AccentColor, mockCfg.Appearance.AccentColor},
		{"Appearance.CodeFontFamily", loadedCfg.Appearance.CodeFontFamily, mockCfg.Appearance.CodeFontFamily},

		// 出站
		{"Outbound.HTTPProxy", loadedCfg.Outbound.HTTPProxy, mockCfg.Outbound.HTTPProxy},
		{"Outbound.SOCKS5Proxy", loadedCfg.Outbound.SOCKS5Proxy, mockCfg.Outbound.SOCKS5Proxy},
		{"Outbound.NoProxyHosts", loadedCfg.Outbound.NoProxyHosts, mockCfg.Outbound.NoProxyHosts},
		{"Outbound.TLSCACertPath", loadedCfg.Outbound.TLSCACertPath, mockCfg.Outbound.TLSCACertPath},
		{"Outbound.CustomDNS", loadedCfg.Outbound.CustomDNS, mockCfg.Outbound.CustomDNS},
		{"Outbound.AllowedPorts", loadedCfg.Outbound.AllowedPorts, mockCfg.Outbound.AllowedPorts},
	}

	failed := 0
	for _, s := range sections {
		// 用 JSON 序列化比较（处理 slice/map 等复杂类型）
		gotJSON, _ := json.Marshal(s.got)
		wantJSON, _ := json.Marshal(s.want)
		if string(gotJSON) != string(wantJSON) {
			t.Errorf("  [FAIL] %s: got %s, want %s", s.name, string(gotJSON), string(wantJSON))
			failed++
		}
	}

	if failed == 0 {
		t.Logf("  [PASS] 全部 %d 个字段保存/加载一致", len(sections))
	} else {
		t.Errorf("  [FAIL] %d 个字段不一致", failed)
	}
}

func TestInferenceConfig_MCPDetail(t *testing.T) {
	t.Log("=== 测试 3/6: MCP 服务器详情验证 ===")

	tmpDir := t.TempDir()
	testApp := &App{config: &Config{App: AppConfig{DataDir: tmpDir}}}
	mockCfg := buildMockInferenceConfig()

	err := testApp.SaveInferenceConfig(mockCfg)
	if err != nil {
		t.Fatal(err)
	}

	loaded, _ := testApp.LoadInferenceConfig()

	// 验证 MCP 服务器列表
	servers := loaded.Connectors.MCPManagedServers
	if len(servers) != 2 {
		t.Fatalf("expected 2 MCP servers, got %d", len(servers))
	}

	// SSE 类型
	if servers[0].ID != "mcp-memory" {
		t.Errorf("server[0].ID: expected 'mcp-memory', got '%s'", servers[0].ID)
	}
	if servers[0].Type != "sse" {
		t.Errorf("server[0].Type: expected 'sse', got '%s'", servers[0].Type)
	}
	if servers[0].URL != "http://localhost:3001" {
		t.Errorf("server[0].URL: expected 'http://localhost:3001', got '%s'", servers[0].URL)
	}

	// stdio 类型
	if servers[1].ID != "mcp-github" {
		t.Errorf("server[1].ID: expected 'mcp-github', got '%s'", servers[1].ID)
	}
	if servers[1].Type != "stdio" {
		t.Errorf("server[1].Type: expected 'stdio', got '%s'", servers[1].Type)
	}
	if servers[1].Command != "npx" {
		t.Errorf("server[1].Command: expected 'npx', got '%s'", servers[1].Command)
	}
	if len(servers[1].Args) != 2 {
		t.Errorf("server[1].Args: expected 2 args, got %d", len(servers[1].Args))
	}

	t.Log("  [PASS] MCP 服务器详情一致")
}

func TestInferenceConfig_CustomHeaders(t *testing.T) {
	t.Log("=== 测试 4/6: 自定义请求头验证 ===")

	tmpDir := t.TempDir()
	testApp := &App{config: &Config{App: AppConfig{DataDir: tmpDir}}}
	mockCfg := buildMockInferenceConfig()

	err := testApp.SaveInferenceConfig(mockCfg)
	if err != nil {
		t.Fatal(err)
	}

	loaded, _ := testApp.LoadInferenceConfig()
	headers := loaded.Connection.CustomHeaders

	if len(headers) != 2 {
		t.Fatalf("expected 2 custom headers, got %d", len(headers))
	}
	if headers["x-tenant-id"] != "tenant_abc123" {
		t.Errorf("x-tenant-id: expected 'tenant_abc123', got '%s'", headers["x-tenant-id"])
	}
	if headers["x-org-id"] != "org_xyz789" {
		t.Errorf("x-org-id: expected 'org_xyz789', got '%s'", headers["x-org-id"])
	}

	t.Log("  [PASS] 自定义请求头一致")
}

func TestInferenceConfig_PartialUpdate(t *testing.T) {
	t.Log("=== 测试 5/6: 部分更新（修改单个区域不影响其他）===")

	tmpDir := t.TempDir()
	testApp := &App{config: &Config{App: AppConfig{DataDir: tmpDir}}}

	// 先保存完整配置
	original := buildMockInferenceConfig()
	if err := testApp.SaveInferenceConfig(original); err != nil {
		t.Fatal(err)
	}

	// 只修改外观配置
	modified := original
	modified.Appearance.ThemeMode = "浅色"
	modified.Appearance.AccentColor = "#52c41a"
	modified.Appearance.UIFontSize = "小"

	if err := testApp.SaveInferenceConfig(modified); err != nil {
		t.Fatal(err)
	}

	// 加载后验证：外观已变，其他不变
	loaded, _ := testApp.LoadInferenceConfig()

	if loaded.Appearance.ThemeMode != "浅色" {
		t.Errorf("ThemeMode should be '浅色', got '%s'", loaded.Appearance.ThemeMode)
	}
	if loaded.Appearance.AccentColor != "#52c41a" {
		t.Errorf("AccentColor should be '#52c41a', got '%s'", loaded.Appearance.AccentColor)
	}

	// 其他区域应保持原样
	if loaded.Connection.BaseURL != original.Connection.BaseURL {
		t.Error("Connection should not change when updating Appearance only")
	}
	if loaded.Usage.DailyTokenLimit != original.Usage.DailyTokenLimit {
		t.Error("Usage should not change when updating Appearance only")
	}
	if len(loaded.Connectors.MCPManagedServers) != len(original.Connectors.MCPManagedServers) {
		t.Error("Connectors should not change when updating Appearance only")
	}

	t.Log("  [PASS] 部分更新正确，其他区域不受影响")
}

func TestInferenceConfig_ResetToDefaults(t *testing.T) {
	t.Log("=== 测试 6/6: 重置为默认值 ===")

	tmpDir := t.TempDir()
	testApp := &App{config: &Config{App: AppConfig{DataDir: tmpDir}}}

	// 保存自定义配置
	custom := buildMockInferenceConfig()
	if err := testApp.SaveInferenceConfig(custom); err != nil {
		t.Fatal(err)
	}

	// 重置
	if err := testApp.ResetInferenceConfig(); err != nil {
		t.Fatal(err)
	}

	// 加载并验证为默认值
	resetCfg, _ := testApp.LoadInferenceConfig()
	defaultCfg := DefaultInferenceConfig()

	// 对比关键字段
	checks := []struct {
		name string
		got  string
		want string
	}{
		{"Connection.GatewayType", resetCfg.Connection.GatewayType, defaultCfg.Connection.GatewayType},
		{"Diagnostics.LogLevel", resetCfg.Diagnostics.LogLevel, defaultCfg.Diagnostics.LogLevel},
		{"Appearance.ThemeMode", resetCfg.Appearance.ThemeMode, defaultCfg.Appearance.ThemeMode},
		{"Appearance.AccentColor", resetCfg.Appearance.AccentColor, defaultCfg.Appearance.AccentColor},
		{"Outbound.TLSMinVersion", resetCfg.Outbound.TLSMinVersion, defaultCfg.Outbound.TLSMinVersion},
	}

	allPassed := true
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("  [FAIL] %s: got '%s', want '%s'", c.name, c.got, c.want)
			allPassed = false
		}
	}

	if allPassed {
		t.Log("  [PASS] 重置后所有字段恢复为默认值")
	}

	// 验证自定义数据已被清除
	if resetCfg.Outbound.HTTPProxy != "" {
		t.Error("HTTPProxy should be empty after reset")
	}
	if resetCfg.Usage.DailyTokenLimit != 0 {
		t.Error("DailyTokenLimit should be 0 after reset")
	}
	if len(resetCfg.Plugins.ServerPolicies) != 0 {
		t.Error("ServerPolicies should be empty after reset")
	}
}
