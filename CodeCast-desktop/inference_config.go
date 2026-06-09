package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ==================== InferenceConfig — 推理配置完整数据模型 ====================
// 覆盖前端 8 个菜单页面的所有配置项

// InferenceConfig 顶层结构，对应"配置第三方推理"页面全部 8 个 Tab
type InferenceConfig struct {
	Connection  ConnectionConfig  `json:"connection"`
	Workspace   WorkspaceConfig   `json:"workspace"`
	Connectors  ConnectorsConfig  `json:"connectors"`
	Plugins     PluginsConfig     `json:"plugins"`
	Diagnostics DiagnosticsConfig `json:"diagnostics"`
	Usage       UsageConfig       `json:"usage"`
	Appearance  AppearanceConfig  `json:"appearance"`
	Outbound    OutboundConfig    `json:"outbound"`
}

// ---------- 1. 连接（Connection）----------
type ConnectionConfig struct {
	GatewayType   string            `json:"gateway_type"`   // "网关" / "直接连接"
	CredType      string            `json:"cred_type"`      // "Static API key" / "OAuth 2.0" / "MCP Bearer Token"
	BaseURL       string            `json:"base_url"`       // Gateway 基础 URL
	APIKeyEnc     string            `json:"api_key_enc"`    // 加密后的 API Key（不存明文）
	AuthScheme    string            `json:"auth_scheme"`    // "bearer" / "basic" / "custom"
	CustomHeaders map[string]string `json:"custom_headers"` // 自定义请求头

	Model ModelConfigSection `json:"model"`
}

type ModelConfigSection struct {
	DiscoverEnabled bool     `json:"discover_enabled"`
	Models          []string `json:"models"` // 模型列表，第一项为默认模型
}

// ---------- 2. 工作区限制（Workspace）----------
type WorkspaceConfig struct {
	// 功能界面
	CoworkEnabled bool `json:"cowork_enabled"`
	CodeEnabled   bool `json:"code_enabled"`

	// 通用限制
	AllowedHosts    string   `json:"allowed_hosts"`     // "*" 或逗号分隔主机列表
	WorkspaceFolder string   `json:"workspace_folder"`  // 允许的工作区文件夹
	DisabledTools   []string `json:"disabled_tools"`    // 禁用的内置工具列表
	ToolPolicyMode  string   `json:"tool_policy_mode"`  // 内置工具策略模式
	DisableLogin    bool     `json:"disable_login"`     // 禁用 Claude.ai 登录
	DisableDeepLink bool     `json:"disable_deep_link"` // 禁用 claude:// 深度链接
}

// ---------- 3. 连接器与扩展（Connectors）----------
type ConnectorsConfig struct {
	MCPManagedServers []MCPServerItem `json:"mcp_managed_servers"` // 托管 MCP 服务器列表
	AllowUserMCP      bool            `json:"allow_user_mcp"`      // 允许用户添加 MCP 服务器
	AllowDesktopExt   bool            `json:"allow_desktop_ext"`   // 允许桌面扩展
	RequireSignedExt  bool            `json:"require_signed_ext"`  // 要求扩展已签名
}

type MCPServerItem struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	URL     string   `json:"url"`
	Command string   `json:"command,omitempty"`
	Args    []string `json:"args,omitempty"`
	Type    string   `json:"type"`
}

// ---------- 4. 插件与技能（Plugins）----------
type PluginsConfig struct {
	OrgPluginPath  string         `json:"org_plugin_path"` // 组织插件目录路径
	ServerPolicies []ServerPolicy `json:"server_policies"` // 服务器策略列表
}

type ServerPolicy struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Config      string `json:"config"` // JSON 字符串，策略具体配置
}

// ---------- 5. 诊断与更新（Diagnostics）----------
type DiagnosticsConfig struct {
	LogLevel string `json:"log_level"` // "Debug" / "Info" / "Warn" / "Error"
	LogDir   string `json:"log_dir"`   // 日志目录路径

	TelemetryEnabled  bool   `json:"telemetry_enabled"`
	TelemetryEndpoint string `json:"telemetry_endpoint"`

	AutoUpdateEnabled bool   `json:"auto_update_enabled"`
	UpdateChannel     string `json:"update_channel"` // "Stable" / "Beta" / "Nightly"
}

// ---------- 6. 使用限制（Usage）----------
type UsageConfig struct {
	// Token 限制
	DailyTokenLimit     int64  `json:"daily_token_limit"` // 0 = 无限制
	DailyTokenUnit      string `json:"daily_token_unit"`  // "tokens" / "K" / "M"
	MaxTokensPerRequest int64  `json:"max_tokens_per_request"`
	OverLimitAction     string `json:"over_limit_action"` // "拒绝" / "警告并继续" / "降级模型"

	// 成本控制
	DailyCostCapUSD    float64 `json:"daily_cost_cap_usd"`   // 0 = 无限制
	CostAlertThreshold int     `json:"cost_alert_threshold"` // 百分比，默认 80

	// 速率限制
	RPMlimit               int `json:"rpm_limit"`                // 每分钟请求数，0 = 无限制
	ConcurrentSessionLimit int `json:"concurrent_session_limit"` // 并发会话数，0 = 无限制
}

// ---------- 7. 外观（Appearance）----------
type AppearanceConfig struct {
	ThemeMode      string `json:"theme_mode"`       // "浅色" / "深色" / "跟随系统"
	AccentColor    string `json:"accent_color"`     // 十六进制颜色值
	UIFontSize     string `json:"ui_font_size"`     // "小" / "中" / "大" / "特大"
	CodeFontFamily string `json:"code_font_family"` // 等宽字体名
	CodeFontSize   int    `json:"code_font_size"`   // px
	MessageSpacing string `json:"message_spacing"`  // "紧凑" / "标准" / "宽松"
	ShowTimestamps bool   `json:"show_timestamps"`
	RenderMarkdown bool   `json:"render_markdown"`
}

// ---------- 8. 出站要求（Outbound）----------
type OutboundConfig struct {
	HTTPProxy    string   `json:"http_proxy"`
	SOCKS5Proxy  string   `json:"socks5_proxy"`
	NoProxyHosts []string `json:"no_proxy_hosts"`

	TLSCACertPath string `json:"tls_ca_cert_path"`
	TLSMinVersion string `json:"tls_min_version"` // "1.2" / "1.3"

	CustomDNS      string `json:"custom_dns"`      // 逗号分隔 DNS 地址
	ConnectTimeout int    `json:"connect_timeout"` // 秒
	ReadTimeout    int    `json:"read_timeout"`    // 秒

	AllowedPorts []int `json:"allowed_ports"` // 空数组 = 允许所有端口
}

// ==================== 默认值 ====================

func DefaultInferenceConfig() InferenceConfig {
	return InferenceConfig{
		Connection: ConnectionConfig{
			GatewayType:   "网关",
			CredType:      "Static API key",
			BaseURL:       "http://127.0.0.1:15721/claude-desktop",
			AuthScheme:    "bearer",
			CustomHeaders: map[string]string{},
			Model: ModelConfigSection{
				DiscoverEnabled: true,
				Models: []string{
					"claude-haiku-4-5",
					"claude-opus-4-8",
					"claude-sonnet-4-6",
				},
			},
		},
		Workspace: WorkspaceConfig{
			CoworkEnabled:   true,
			CodeEnabled:     true,
			AllowedHosts:    "*",
			WorkspaceFolder: "~/Documents/work",
			DisabledTools:   []string{},
			ToolPolicyMode:  "",
			DisableLogin:    true,
			DisableDeepLink: false,
		},
		Connectors: ConnectorsConfig{
			MCPManagedServers: []MCPServerItem{},
			AllowUserMCP:      true,
			AllowDesktopExt:   true,
			RequireSignedExt:  false,
		},
		Plugins: PluginsConfig{
			OrgPluginPath:  "C:\\Program Files\\Claude\\org-plugins",
			ServerPolicies: []ServerPolicy{},
		},
		Diagnostics: DiagnosticsConfig{
			LogLevel:          "Info",
			TelemetryEnabled:  true,
			TelemetryEndpoint: "",
			AutoUpdateEnabled: true,
			UpdateChannel:     "Stable",
		},
		Usage: UsageConfig{
			DailyTokenLimit:        0,
			DailyTokenUnit:         "tokens",
			MaxTokensPerRequest:    200000,
			OverLimitAction:        "警告并继续",
			DailyCostCapUSD:        0,
			CostAlertThreshold:     80,
			RPMlimit:               0,
			ConcurrentSessionLimit: 0,
		},
		Appearance: AppearanceConfig{
			ThemeMode:      "跟随系统",
			AccentColor:    "#1677ff",
			UIFontSize:     "中",
			CodeFontFamily: "JetBrains Mono",
			CodeFontSize:   13,
			MessageSpacing: "标准",
			ShowTimestamps: true,
			RenderMarkdown: true,
		},
		Outbound: OutboundConfig{
			HTTPProxy:      "",
			SOCKS5Proxy:    "",
			NoProxyHosts:   []string{"localhost", "127.0.0.1", "*.internal"},
			TLSMinVersion:  "1.2",
			CustomDNS:      "",
			ConnectTimeout: 30,
			ReadTimeout:    120,
			AllowedPorts:   []int{443, 80},
		},
	}
}

// ==================== 持久化方法 ====================

// inferenceConfigPath 返回推理配置文件的完整路径
func (a *App) inferenceConfigPath() string {
	return filepath.Join(a.config.App.DataDir, "inference_config.json")
}

// SaveInferenceConfig 将推理配置保存到 JSON 文件
func (a *App) SaveInferenceConfig(cfg InferenceConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal inference_config: %w", err)
	}
	path := a.inferenceConfigPath()

	// 确保目录存在
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write inference_config: %w", err)
	}

	fmt.Printf("[InferenceConfig] saved to %s (%d bytes)\n", path, len(data))
	return nil
}

// LoadInferenceConfig 从 JSON 文件加载推理配置，文件不存在则返回默认值
func (a *App) LoadInferenceConfig() (InferenceConfig, error) {
	cfg := DefaultInferenceConfig()
	path := a.inferenceConfigPath()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// 文件不存在，返回默认值
			fmt.Printf("[InferenceConfig] no file at %s, using defaults\n", path)
			return cfg, nil
		}
		return cfg, fmt.Errorf("read inference_config: %w", err)
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("unmarshal inference_config: %w", err)
	}

	fmt.Printf("[InferenceConfig] loaded from %s\n", path)
	return cfg, nil
}

// GetInferenceConfig Wails 绑定：前端获取当前推理配置
func (a *App) GetInferenceConfig() InferenceConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	cfg, _ := a.LoadInferenceConfig()
	return cfg
}

// UpdateInferenceConfig Wails 绑定：前端更新推理配置（全量替换）
func (a *App) UpdateInferenceConfig(cfg InferenceConfig) error {
	return a.SaveInferenceConfig(cfg)
}

// ResetInferenceConfig Wails 绑重置为默认值
func (a *App) ResetInferenceConfig() error {
	return a.SaveInferenceConfig(DefaultInferenceConfig())
}
