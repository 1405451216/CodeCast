package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"time"
)

// ==================== 全局常量定义 ====================
// 统一管理所有文件大小和 API 限制，避免魔法数字分散在各处
// 所有文件操作都应有合理的大小限制，防止 OOM 和性能问题

const (
	MaxReadFileSize    = 4 * 1024 * 1024 // 4MB - 通用文件读取上限（用于 ReadFile 工具调用）
	MaxPreviewFileSize = 2 * 1024 * 1024 // 2MB - 预览面板专用（较小以提升前端渲染性能）
	MaxWriteFileSize   = 10 * 1024 * 1024 // 10MB - 写入操作上限（防止写入超大文件导致存储问题）
	MaxResponseSize    = 10 * 1024 * 1024 // 10MB - API 响应体上限（防止 OOM）

	DefaultMaxTokensNormal  = 8192  // 普通模式 max_tokens（适用于大多数场景）
	DefaultMaxTokensLongCtx = 65536 // 长上下文模式 max_tokens（适用于大型代码库分析）

	MessageHistoryLimit = 20 // 保留的消息历史条数（平衡上下文质量和 token 消耗）
)

func formatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGT"[exp])
}

// ==================== Config (legacy) ====================

type Config struct {
	App   AppConfig
	Model ModelConfig
}

type AppConfig struct {
	Name    string
	Version string
	DataDir string
}

type ModelConfig struct {
	Provider string
	APIKey   string
	BaseURL  string
	Model    string
}

type LLMProviderConfig struct {
	APIURL string `json:"api_url"`
	Model  string `json:"model"`
	APIKey string `json:"-"` // intentionally excluded from JSON serialization for security
}

// ProviderPreset 定义一个模型提供商的预设信息
type ProviderPreset struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	APIURL       string   `json:"api_url"`
	DefaultModel string   `json:"default_model"`
	Models       []string `json:"models"`
}

// BuiltinProviders 内置支持的模型提供商列表
var BuiltinProviders = []ProviderPreset{
	{
		ID:           "deepseek",
		Name:         "DeepSeek",
		APIURL:       "https://api.deepseek.com",
		DefaultModel: "deepseek-v4-flash",
		Models:       []string{"deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"},
	},
	{
		ID:           "kimi",
		Name:         "Kimi (Moonshot)",
		APIURL:       "https://api.moonshot.cn/v1",
		DefaultModel: "kimi-k2.6",
		Models:       []string{"kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking", "kimi-k2-thinking-turbo", "kimi-k2-turbo-preview"},
	},
	{
		ID:           "glm",
		Name:         "GLM (智谱清言)",
		APIURL:       "https://open.bigmodel.cn/api/paas/v4",
		DefaultModel: "glm-5",
		Models:       []string{"glm-5.1", "glm-5", "glm-5-turbo", "glm-4-plus", "glm-4-air-250414", "glm-4-flashx-250414", "glm-4-flash-250414"},
	},
	{
		ID:           "mimo",
		Name:         "MiMo (小米)",
		APIURL:       "https://api.xiaomimimo.com/v1",
		DefaultModel: "mimo-v2.5-pro",
		Models:       []string{"mimo-v2.5-pro", "mimo-v2.5", "mimo-v2.5-turbo", "mimo-v2.5-thinking", "mimo-v2.5-thinking-turbo", "mimo-v2-pro", "mimo-v2-flash", "mimo-v2-omni"},
	},
}

// GetProviderPreset 根据 provider ID 返回预设配置，找不到时返回 nil
func GetProviderPreset(providerID string) *ProviderPreset {
	for i := range BuiltinProviders {
		if BuiltinProviders[i].ID == providerID {
			return &BuiltinProviders[i]
		}
	}
	return nil
}

func DefaultLLMProviderConfig() LLMProviderConfig {
	return LLMProviderConfig{
		APIURL: "https://api.deepseek.com",
		Model:  "deepseek-v4-flash",
	}
}

var DefaultConfig = Config{
	App: AppConfig{
		Name:    "CodeCast",
		Version: "0.1.0",
		DataDir: "~/.codecast",
	},
	Model: ModelConfig{
		Provider: "deepseek",
		APIKey:   "",
		BaseURL:  "https://api.deepseek.com/v1",
		Model:    "deepseek-chat",
	},
}

// ==================== Model Config Items ====================

// ModelConfigItem 代表用户添加的单个模型配置
type ModelConfigItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`       // 用户自定义名称（可选，如"我的DeepSeek"）
	Provider   string `json:"provider"`   // deepseek / kimi / glm
	Model      string `json:"model"`      // 具体模型如 deepseek-chat
	APIKey     string `json:"api_key"`    // 该配置的 API Key
	APIURL     string `json:"api_url"`    // 自定义 API URL（空则用 provider 默认值）
	Enabled    bool   `json:"enabled"`    // 是否启用
	MaxContext int    `json:"max_context"` // 上下文窗口大小（0=默认）
	ToolRounds int    `json:"tool_rounds"` // 工具调用最大轮数（0=默认）
	Multimodal bool   `json:"multimodal"` // 是否支持多模态
}

// ==================== Settings ====================

type Settings struct {
	WorkMode     string `json:"work_mode"`
	DefaultPerm  bool   `json:"default_perm"`
	AutoReview   bool   `json:"auto_review"`
	FullAccess   bool   `json:"full_access"`
	Shell        string `json:"shell"`
	OpenTarget   string `json:"open_target"`
	Language     string `json:"language"`
	Hotkey       string `json:"hotkey"`
	CtrlEnterSend bool  `json:"ctrl_enter_send"`
	FollowupMode string `json:"followup_mode"`
	ReviewMode   string `json:"review_mode"`

	NotifyComplete      string `json:"notify_complete"`
	NotifyPermission    bool   `json:"notify_permission"`
	NotifyIssue         bool   `json:"notify_issue"`
	NotificationTurn    string `json:"notification_turn"`
	NotificationPermission bool `json:"notification_permission"`
	NotificationQuestion  bool `json:"notification_question"`

	Theme    string `json:"theme"`
	FontSize string `json:"font_size"`

	LongContext bool   `json:"long_context"`
	LLMProvider  string `json:"llm_provider"`
	LLMAPIURL    string `json:"llm_api_url"`
	LLMModel     string `json:"llm_model"`

	Personality         string `json:"personality"`
	CustomInstructions  string `json:"custom_instructions"`
	AutoMemory          bool   `json:"auto_memory"`
	ToolMemory          bool   `json:"tool_memory"`
	MessageHistoryLimit int    `json:"message_history_limit"`

	// SMTP 邮件发送（cast_email_send 工具用）
	SMTPHost string `json:"smtp_host"`
	SMTPPort int    `json:"smtp_port"`
	SMTPUser string `json:"smtp_user"`
	SMTPPass string `json:"smtp_pass"`

	AutoCommit        bool `json:"auto_commit"`
	ConfirmBeforeCommit bool `json:"confirm_before_commit"`

	UseWorktree bool `json:"use_worktree"`

	AllowBrowser     bool     `json:"allow_browser"`
	BrowserApproval  string   `json:"browser_approval"`
	BrowserHistory   string   `json:"browser_history"`
	BrowserClearData string   `json:"browser_clear_data"`
	BlockedDomains   []string `json:"blocked_domains"`
	AllowedDomains   []string `json:"allowed_domains"`
	BrowserPlugin    string   `json:"browser_plugin"`
	SeleniumInstalled bool    `json:"selenium_installed"`

	ComputerControl bool `json:"computer_control"`

	TelemetryEnabled  bool   `json:"telemetry_enabled"`
	TelemetryEndpoint string `json:"telemetry_endpoint"`

	SanitizerEnabled  bool     `json:"sanitizer_enabled"`
	SanitizerStrategy string   `json:"sanitizer_strategy"`
	TopicConstraints  []string `json:"topic_constraints"`

	MCPServers []MCPServer `json:"mcp_servers"`

	ModelConfigs []ModelConfigItem `json:"model_configs"`

	EnvVars []EnvVar `json:"env_vars"`

	SlashCommands []SlashCommand `json:"slash_commands"`

	ArchivedSessions []string `json:"archived_sessions"`
}

type MCPServer struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	URL     string   `json:"url"`
	Command string   `json:"command,omitempty"`
	Args    []string `json:"args,omitempty"`
	Type    string   `json:"type"`
	Enabled bool     `json:"enabled"`
	Builtin bool     `json:"builtin,omitempty"`
}

type EnvVar struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type SlashCommand struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	FillText    string `json:"fill_text"`
}

// migrationNeeded removed — now stored as App.migrationPending field for thread safety

func defaultShell() string {
	if runtime.GOOS == "darwin" {
		return "zsh"
	} else if runtime.GOOS == "linux" {
		return "bash"
	}
	return "powershell"
}

var DefaultSettings = Settings{
	WorkMode:         "daily",
	DefaultPerm:      true,
	AutoReview:       false,
	FullAccess:       false,
	Shell:            defaultShell(),
	OpenTarget:       "default_app",
	Language:         "zh-CN",
	Hotkey:           "",
	CtrlEnterSend:   false,
	FollowupMode:    "guide",
	ReviewMode:      "inline",
	NotifyComplete:          "unfocused",
	NotifyPermission:        true,
	NotifyIssue:             true,
	NotificationTurn:        "all",
	NotificationPermission:  true,
	NotificationQuestion:    true,
	Theme:            "dark",
	FontSize:         "medium",
	LongContext:      false,
	LLMProvider:      "deepseek",
	LLMAPIURL:        "",
	LLMModel:         "",
	Personality:        "friendly",
	CustomInstructions: "",
	AutoMemory:         false,
	ToolMemory:         false,
	MessageHistoryLimit: 20,
	ConfirmBeforeCommit: true,
	AutoCommit:          false,
	UseWorktree:         false,
	AllowBrowser:        false,
	BrowserApproval:     "always_ask",
	BrowserHistory:      "always_ask",
	BrowserClearData:    "never",
	BlockedDomains:      []string{},
	AllowedDomains:      []string{},
	BrowserPlugin:       "",
	SeleniumInstalled:   false,
	ComputerControl:     true,
	TelemetryEnabled:    false,
	TelemetryEndpoint:   "http://localhost:4318",
	SanitizerEnabled:    false,
	SanitizerStrategy:   "Mask",
	TopicConstraints:    []string{},
	MCPServers: []MCPServer{
		{
			ID:      "builtin_chrome_devtools_mcp",
			Name:    "Chrome DevTools MCP",
			Command: "npx",
			Args:    []string{"-y", "chrome-devtools-mcp@latest"},
			Type:    "stdio",
			Enabled: true,
			Builtin: true,
		},
	},
	ModelConfigs:     []ModelConfigItem{},
	EnvVars:          []EnvVar{},
	SlashCommands:    []SlashCommand{},
	ArchivedSessions: []string{},
}

// initSettings 确定设置文件路径、初始化加密密钥并加载设置
func (a *App) initSettings() {
	exePath, err := os.Executable()
	if err == nil {
		candidate := filepath.Join(filepath.Dir(exePath), "settings.json")
		if testWritable(filepath.Dir(exePath)) {
			a.settingsPath = candidate
		}
	}

	if a.settingsPath == "" {
		userConfigDir, err := os.UserConfigDir()
		if err != nil {
			userConfigDir, _ = os.UserHomeDir()
		}
		appDir := filepath.Join(userConfigDir, "CodeCast")
		_ = os.MkdirAll(appDir, 0700)
		a.settingsPath = filepath.Join(appDir, "settings.json")
	}

	keyPath := getKeyPath(a.settingsPath)
	a.encryptionKey, err = loadOrCreateKey(keyPath)
	if err != nil {
		fmt.Printf("warning: failed to load/create encryption key: %v\n", err)
		a.encryptionKey = nil
	}

	a.loadSettings()
}

// initProjects 从磁盘恢复项目列表（独立于设置加载，职责分离）
func (a *App) initProjects() {
	a.projects = a.loadProjectsFromDisk()
}

func testWritable(dir string) bool {
	tmp := filepath.Join(dir, ".write_test_codecast")
	err := os.WriteFile(tmp, []byte("t"), 0644)
	if err != nil {
		return false
	}
	os.Remove(tmp)
	return true
}

func (a *App) loadSettings() {
	s := DefaultSettings

	data, err := os.ReadFile(a.settingsPath)
	if err == nil {
		if unmarshalErr := json.Unmarshal(data, &s); unmarshalErr != nil {
			fmt.Printf("warning: failed to parse settings.json: %v\n", unmarshalErr)
		}
	}

	if s.MCPServers == nil {
		s.MCPServers = []MCPServer{}
	}
	if s.ModelConfigs == nil {
		s.ModelConfigs = []ModelConfigItem{}
	}
	if s.EnvVars == nil {
		s.EnvVars = []EnvVar{}
	}
	if s.SlashCommands == nil {
		s.SlashCommands = []SlashCommand{}
	}
	if s.ArchivedSessions == nil {
		s.ArchivedSessions = []string{}
	}
	if s.BlockedDomains == nil {
		s.BlockedDomains = []string{}
	}
	if s.AllowedDomains == nil {
		s.AllowedDomains = []string{}
	}
	if s.TopicConstraints == nil {
		s.TopicConstraints = []string{}
	}

	a.ensureBuiltinMCP(&s)

	// 对 ModelConfigs 中每个配置项的 APIKey 解密
	if a.encryptionKey != nil {
		for i := range s.ModelConfigs {
			if s.ModelConfigs[i].APIKey == "" {
				continue
			}
			wasEncrypted := isEncrypted(s.ModelConfigs[i].APIKey)
			decryptedKey, decryptErr := decryptAPIKey(s.ModelConfigs[i].APIKey, a.encryptionKey)
			if decryptErr == nil {
				s.ModelConfigs[i].APIKey = decryptedKey
				if isEncrypted(s.ModelConfigs[i].APIKey) {
					s.ModelConfigs[i].APIKey = ""
					fmt.Printf("warning: model config %s API key appears invalid after decryption, clearing\n", s.ModelConfigs[i].ID)
				} else if !wasEncrypted {
					a.migrationPending = true
				}
			} else if !isEncrypted(s.ModelConfigs[i].APIKey) {
				a.migrationPending = true
			} else {
				fmt.Printf("warning: failed to decrypt API key for model config %s: %v\n", s.ModelConfigs[i].ID, decryptErr)
				s.ModelConfigs[i].APIKey = ""
			}
		}
	}

	// H5 fix: decrypt SMTP password if encrypted (same pattern as ModelConfigs API keys)
	if a.encryptionKey != nil && s.SMTPPass != "" {
		decryptedPass, decryptErr := decryptAPIKey(s.SMTPPass, a.encryptionKey)
		if decryptErr == nil {
			s.SMTPPass = decryptedPass
			// If the decrypted value still looks encrypted, it's corrupted — clear it
			if isEncrypted(s.SMTPPass) {
				s.SMTPPass = ""
				fmt.Printf("warning: SMTP password appears invalid after decryption, clearing\n")
			}
		} else if !isEncrypted(s.SMTPPass) {
			// Unencrypted legacy value — will be encrypted on next save via migrationPending
			a.migrationPending = true
		} else {
			fmt.Printf("warning: failed to decrypt SMTP password: %v\n", decryptErr)
			s.SMTPPass = ""
		}
	}

	a.settings = &s
}

func (a *App) ensureBuiltinMCP(s *Settings) {
	for _, builtin := range DefaultSettings.MCPServers {
		if !builtin.Builtin {
			continue
		}
		found := false
		for _, existing := range s.MCPServers {
			if existing.ID == builtin.ID {
				found = true
				break
			}
		}
		if !found {
			s.MCPServers = append([]MCPServer{builtin}, s.MCPServers...)
		}
	}
}

// saveSettingsToFile persists the current settings to disk.
// NOTE: This performs file I/O while the caller holds a.mu. This is a known trade-off:
// releasing the lock before I/O would require copying all settings data and risk TOCTOU
// races if another goroutine modifies settings between unlock and write. The current
// approach is simpler and correct for a desktop app where lock contention is low.
func (a *App) saveSettingsToFile() error {
	settingsCopy := *a.settings

	// 对 ModelConfigs 中每个配置项的 APIKey 加密
	if a.encryptionKey != nil {
		mcCopy := make([]ModelConfigItem, len(settingsCopy.ModelConfigs))
		copy(mcCopy, settingsCopy.ModelConfigs)
		for i := range mcCopy {
			if mcCopy[i].APIKey != "" {
				encryptedKey, err := encryptAPIKey(mcCopy[i].APIKey, a.encryptionKey)
				if err != nil {
					fmt.Printf("warning: failed to encrypt API key for model config %s: %v\n", mcCopy[i].ID, err)
				} else {
					mcCopy[i].APIKey = encryptedKey
				}
			}
		}
		settingsCopy.ModelConfigs = mcCopy
	}

	// H5 fix: encrypt SMTP password before writing to disk
	if a.encryptionKey != nil && settingsCopy.SMTPPass != "" {
		encryptedPass, err := encryptAPIKey(settingsCopy.SMTPPass, a.encryptionKey)
		if err != nil {
			fmt.Printf("warning: failed to encrypt SMTP password: %v\n", err)
		} else {
			settingsCopy.SMTPPass = encryptedPass
		}
	}

	data, err := json.MarshalIndent(settingsCopy, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(a.settingsPath, data, 0600)
}

func (a *App) syncSettingsToConfig() {
	// 根据 provider 预设设置 API URL 和 Model
	provider := a.settings.LLMProvider
	if provider == "" {
		provider = "deepseek"
	}

	preset := GetProviderPreset(provider)
	if preset != nil {
		a.config.Model.BaseURL = preset.APIURL
		a.config.Model.Model = preset.DefaultModel
		a.llmConfig.APIURL = preset.APIURL
		a.llmConfig.Model = preset.DefaultModel
	} else {
		// 未知 provider，使用 deepseek 默认值
		a.config.Model.BaseURL = "https://api.deepseek.com"
		a.config.Model.Model = "deepseek-v4-flash"
		a.llmConfig.APIURL = "https://api.deepseek.com"
		a.llmConfig.Model = "deepseek-v4-flash"
	}

	// 用户自定义 API URL 和 Model 优先级最高
	if a.settings.LLMAPIURL != "" {
		a.llmConfig.APIURL = a.settings.LLMAPIURL
	}
	if a.settings.LLMModel != "" {
		a.llmConfig.Model = a.settings.LLMModel
	}
}

// ==================== Provider Methods (exposed to frontend) ====================

// GetProviders 返回所有内置的模型提供商列表
func (a *App) GetProviders() []ProviderPreset {
	return BuiltinProviders
}

// GetProviderModels 根据 provider ID 返回该 provider 支持的模型列表
func (a *App) GetProviderModels(providerID string) []string {
	preset := GetProviderPreset(providerID)
	if preset == nil {
		return []string{}
	}
	return preset.Models
}

// ==================== Settings Methods (exposed to frontend) ====================

// GetSettings returns a copy of the current settings.
// NOTE: The slice copies are shallow — but this is safe because all element types
// (MCPServer, ModelConfigItem, EnvVar, SlashCommand, string) are value types with
// no pointer fields, so shallow and deep copies are equivalent.
func (a *App) GetSettings() Settings {
	a.mu.RLock()
	defer a.mu.RUnlock()
	s := *a.settings
	s.MCPServers = append([]MCPServer{}, a.settings.MCPServers...)
	s.ModelConfigs = append([]ModelConfigItem{}, a.settings.ModelConfigs...)
	s.EnvVars = append([]EnvVar{}, a.settings.EnvVars...)
	s.ArchivedSessions = append([]string{}, a.settings.ArchivedSessions...)
	s.BlockedDomains = append([]string{}, a.settings.BlockedDomains...)
	s.AllowedDomains = append([]string{}, a.settings.AllowedDomains...)
	s.SlashCommands = append([]SlashCommand{}, a.settings.SlashCommands...)
	return s
}

func (a *App) SaveSettings(s Settings) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if s.MCPServers == nil {
		s.MCPServers = []MCPServer{}
	}
	if s.ModelConfigs == nil {
		s.ModelConfigs = []ModelConfigItem{}
	}
	if s.EnvVars == nil {
		s.EnvVars = []EnvVar{}
	}
	if s.SlashCommands == nil {
		s.SlashCommands = []SlashCommand{}
	}
	if s.ArchivedSessions == nil {
		s.ArchivedSessions = []string{}
	}
	if s.BlockedDomains == nil {
		s.BlockedDomains = []string{}
	}
	if s.AllowedDomains == nil {
		s.AllowedDomains = []string{}
	}
	if s.TopicConstraints == nil {
		s.TopicConstraints = []string{}
	}

	a.settings = &s
	a.syncSettingsToConfig()
	return a.saveSettingsToFile()
}

// allowedSettingKeys defines the whitelist of settings that can be modified via UpdateSetting.
// This prevents arbitrary field modification through reflection.
var allowedSettingKeys = map[string]bool{
	"work_mode": true, "default_perm": true, "auto_review": true,
	"full_access": true, "shell": true, "open_target": true,
	"language": true, "hotkey": true, "ctrl_enter_send": true,
	"followup_mode": true, "review_mode": true,
	"notify_complete": true, "notify_permission": true, "notify_issue": true,
	"notification_turn": true, "notification_permission": true, "notification_question": true,
	"theme": true, "font_size": true,
	"long_context": true, "llm_provider": true, "llm_api_url": true, "llm_model": true,
	"personality": true, "custom_instructions": true,
	"auto_memory": true, "tool_memory": true, "message_history_limit": true,
	"smtp_host": true, "smtp_port": true, "smtp_user": true, "smtp_pass": true,
	"auto_commit": true, "confirm_before_commit": true,
	"use_worktree": true,
	"allow_browser": true, "browser_approval": true, "browser_history": true,
	"browser_clear_data": true, "browser_plugin": true,
	"computer_control": true,
	"telemetry_enabled": true, "telemetry_endpoint": true,
	"sanitizer_enabled": true, "sanitizer_strategy": true,
}

func (a *App) UpdateSetting(key string, value interface{}) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !allowedSettingKeys[key] {
		fmt.Printf("[Settings] ⚠️ 未知或禁止修改的设置 key: \"%s\"\n", key)
		return fmt.Errorf("unknown or disallowed setting key: %s", key)
	}

	v := reflect.ValueOf(a.settings).Elem()
	t := v.Type()

	var field reflect.Value
	found := false
	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag.Get("json")
		if tag == key {
			field = v.Field(i)
			found = true
			break
		}
	}

	if !found {
		fmt.Printf("[Settings] ⚠️ 未知设置 key: \"%s\" (前端可能使用了错误的字段名，请检查 settingsKeys.ts)\n", key)
		return fmt.Errorf("unknown setting key: %s", key)
	}

	switch field.Kind() {
	case reflect.String:
		switch v := value.(type) {
		case string:
			field.SetString(v)
		case float64:
			field.SetString(fmt.Sprintf("%v", v))
		default:
			return fmt.Errorf("expected string for key %s, got %T", key, value)
		}
	case reflect.Bool:
		switch v := value.(type) {
		case bool:
			field.SetBool(v)
		case float64:
			field.SetBool(v != 0)
		default:
			return fmt.Errorf("expected bool for key %s, got %T", key, value)
		}
	case reflect.Int, reflect.Int64:
		switch v := value.(type) {
		case float64:
			field.SetInt(int64(v))
		case string:
			var n int64
			fmt.Sscanf(v, "%d", &n)
			field.SetInt(n)
		default:
			return fmt.Errorf("expected number for key %s, got %T", key, value)
		}
	default:
		return fmt.Errorf("unsupported field type for key %s", key)
	}

	a.syncSettingsToConfig()
	return a.saveSettingsToFile()
}

// ==================== No Project Mode ====================

func (a *App) SetNoProjectMode(enabled bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.noProjectMode = enabled
}

func (a *App) GetNoProjectMode() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.noProjectMode
}

// ==================== Environment Variables ====================

func (a *App) AddEnvVar(key, value string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, ev := range a.settings.EnvVars {
		if ev.Key == key {
			a.settings.EnvVars[i].Value = value
			return a.saveSettingsToFile()
		}
	}

	a.settings.EnvVars = append(a.settings.EnvVars, EnvVar{Key: key, Value: value})
	return a.saveSettingsToFile()
}

func (a *App) RemoveEnvVar(key string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, ev := range a.settings.EnvVars {
		if ev.Key == key {
			a.settings.EnvVars = append(a.settings.EnvVars[:i], a.settings.EnvVars[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("env var not found: %s", key)
}

func (a *App) GetEnvVars() []EnvVar {
	a.mu.RLock()
	defer a.mu.RUnlock()
	copy := make([]EnvVar, len(a.settings.EnvVars))
	for i, v := range a.settings.EnvVars {
		copy[i] = v
	}
	return copy
}

// ==================== Slash Commands ====================

func (a *App) GetSlashCommands() []SlashCommand {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]SlashCommand, len(a.settings.SlashCommands))
	copy(result, a.settings.SlashCommands)
	return result
}

func (a *App) AddSlashCommand(name, description, fillText string) (*SlashCommand, error) {
	if name == "" {
		return nil, fmt.Errorf("命令名不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	for _, cmd := range a.settings.SlashCommands {
		if cmd.Name == name {
			return nil, fmt.Errorf("命令 /%s 已存在", name)
		}
	}

	cmd := SlashCommand{
		ID:          fmt.Sprintf("cmd_%d", time.Now().UnixNano()),
		Name:        name,
		Description: description,
		FillText:    fillText,
	}

	a.settings.SlashCommands = append(a.settings.SlashCommands, cmd)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	return &a.settings.SlashCommands[len(a.settings.SlashCommands)-1], nil
}

func (a *App) UpdateSlashCommand(id, name, description, fillText string) error {
	if name == "" {
		return fmt.Errorf("命令名不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	for i, cmd := range a.settings.SlashCommands {
		if cmd.ID == id {
			for j, other := range a.settings.SlashCommands {
				if j != i && other.Name == name {
					return fmt.Errorf("命令 /%s 已存在", name)
				}
			}
			a.settings.SlashCommands[i].Name = name
			a.settings.SlashCommands[i].Description = description
			a.settings.SlashCommands[i].FillText = fillText
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("命令不存在: %s", id)
}

func (a *App) RemoveSlashCommand(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, cmd := range a.settings.SlashCommands {
		if cmd.ID == id {
			a.settings.SlashCommands = append(a.settings.SlashCommands[:i], a.settings.SlashCommands[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("命令不存在: %s", id)
}

// ==================== Archived Sessions ====================

func (a *App) ArchiveSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, sid := range a.settings.ArchivedSessions {
		if sid == id {
			return nil
		}
	}

	a.settings.ArchivedSessions = append(a.settings.ArchivedSessions, id)
	return a.saveSettingsToFile()
}

func (a *App) UnarchiveSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, sid := range a.settings.ArchivedSessions {
		if sid == id {
			a.settings.ArchivedSessions = append(a.settings.ArchivedSessions[:i], a.settings.ArchivedSessions[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("session not in archive: %s", id)
}

func (a *App) GetArchivedSessions() []*Session {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var result []*Session
	for _, aid := range a.settings.ArchivedSessions {
		for _, s := range a.sessions {
			if s.ID == aid {
				copy := *s
				copy.Messages = make([]Message, len(s.Messages))
				for j, m := range s.Messages {
					copy.Messages[j] = m
				}
				result = append(result, &copy)
				break
			}
		}
	}
	return result
}

// ==================== Legacy Config Methods ====================

func (a *App) SetAPIKey(key string) string {
	return "请前往 设置 → 配置 → 模型管理 添加模型"
}

func (a *App) GetConfig() map[string]any {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return map[string]any{
		"model": map[string]any{
			"base_url": a.config.Model.BaseURL,
			"model":    a.config.Model.Model,
			"provider": a.config.Model.Provider,
		},
		"app": a.config.App,
		"settings": map[string]any{
			"work_mode":           a.settings.WorkMode,
			"theme":               a.settings.Theme,
			"font_size":           a.settings.FontSize,
			"shell":               a.settings.Shell,
			"personality":         a.settings.Personality,
			"custom_instructions": a.settings.CustomInstructions,
			"auto_memory":         a.settings.AutoMemory,
			"tool_memory":         a.settings.ToolMemory,
			"message_history_limit": a.settings.MessageHistoryLimit,
			"full_access":         a.settings.FullAccess,
		},
		"settings_path": a.settingsPath,
	}
}

// ==================== Model Config CRUD ====================

// FindModelConfigByModel 根据模型名称在已启用的 ModelConfigs 中查找对应的配置项。
// 调用方需自行持有 a.mu 锁。
func (a *App) findModelConfigLocked(modelName string) *ModelConfigItem {
	for i, mc := range a.settings.ModelConfigs {
		if mc.Enabled && mc.Model == modelName {
			return &a.settings.ModelConfigs[i]
		}
	}
	return nil
}

// resolveProviderURL 根据 provider ID 返回该 provider 的默认 API URL
func resolveProviderURL(providerID string) string {
	p := GetProviderPreset(providerID)
	if p != nil {
		return p.APIURL
	}
	return ""
}

// APICredentials 封装调用 LLM 所需的凭据信息
type APICredentials struct {
	APIKey  string
	APIURL  string
	Model   string
}

// resolveCredentialsLocked 根据模型名称解析出调用凭据。
// 如果 modelName 为空，使用默认模型。调用方需持有 a.mu 锁。
func (a *App) resolveCredentialsLocked(modelName string) (APICredentials, error) {
	if modelName == "" {
		modelName = a.llmConfig.Model
	}

	// 优先从 ModelConfigs 中查找
	if mc := a.findModelConfigLocked(modelName); mc != nil {
		apiURL := mc.APIURL
		if apiURL == "" {
			apiURL = resolveProviderURL(mc.Provider)
		}
		if mc.APIKey == "" {
			return APICredentials{}, fmt.Errorf("模型 %s 的 API Key 未配置，请在设置-模型管理中添加", modelName)
		}
		return APICredentials{
			APIKey: mc.APIKey,
			APIURL: apiURL,
			Model:  mc.Model,
		}, nil
	}

	// 回退：从 ModelConfigs 中找同 provider 的第一个有 key 的配置
	for _, mc := range a.settings.ModelConfigs {
		if mc.Enabled && mc.APIKey != "" {
			// 检查这个模型是否属于该 provider
			preset := GetProviderPreset(mc.Provider)
			if preset != nil {
				for _, m := range preset.Models {
					if m == modelName {
						apiURL := mc.APIURL
						if apiURL == "" {
							apiURL = preset.APIURL
						}
						return APICredentials{
							APIKey: mc.APIKey,
							APIURL: apiURL,
							Model:  modelName,
						}, nil
					}
				}
			}
		}
	}


	return APICredentials{}, fmt.Errorf("未找到模型 %s 的配置，请在设置-模型管理中添加", modelName)
}

// guessProviderForModel 通过模型名前缀猜测其所属 provider
func (a *App) guessProviderForModel(modelName string) string {
	for _, p := range BuiltinProviders {
		for _, m := range p.Models {
			if m == modelName {
				return p.ID
			}
		}
	}
	// 简单前缀匹配
	if strings.HasPrefix(modelName, "deepseek") {
		return "deepseek"
	}
	if strings.HasPrefix(modelName, "kimi") {
		return "kimi"
	}
	if strings.HasPrefix(modelName, "glm") {
		return "glm"
	}
	return ""
}


// maskAPIKey 对 API Key 进行脱敏，保留前3后4位
func maskAPIKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:3] + "****" + key[len(key)-4:]
}

// GetModelConfigs 返回所有模型配置（API Key 脱敏）
func (a *App) GetModelConfigs() []ModelConfigItem {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]ModelConfigItem, len(a.settings.ModelConfigs))
	copy(result, a.settings.ModelConfigs)
	// 脱敏 API Key，前端只需知道是否已设置
	for i := range result {
		result[i].APIKey = maskAPIKey(result[i].APIKey)
	}
	return result
}

// AddModelConfig 添加一个新的模型配置
func (a *App) AddModelConfig(name, provider, model, apiKey, apiURL string, maxContext, toolRounds int, multimodal bool) (*ModelConfigItem, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	randBytes := make([]byte, 8)
	if n, err := rand.Read(randBytes); err != nil || n != 8 {
		return nil, fmt.Errorf("failed to generate ID: %w", err)
	}
	item := ModelConfigItem{
		ID:         fmt.Sprintf("mc_%s", hex.EncodeToString(randBytes)),
		Name:       name,
		Provider:   provider,
		Model:      model,
		APIKey:     apiKey,
		APIURL:     apiURL,
		Enabled:    true,
		MaxContext: maxContext,
		ToolRounds: toolRounds,
		Multimodal: multimodal,
	}

	a.settings.ModelConfigs = append(a.settings.ModelConfigs, item)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	a.syncSettingsToConfig()
	return &a.settings.ModelConfigs[len(a.settings.ModelConfigs)-1], nil
}

// UpdateModelConfig 更新已有模型配置
// 当 apiKey 为空字符串时保留原有 API Key（前端传入的是脱敏值或空值）
func (a *App) UpdateModelConfig(id, name, provider, model, apiKey, apiURL string, maxContext, toolRounds int, multimodal bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, mc := range a.settings.ModelConfigs {
		if mc.ID == id {
			a.settings.ModelConfigs[i].Name = name
			a.settings.ModelConfigs[i].Provider = provider
			a.settings.ModelConfigs[i].Model = model
						// CONVENTION: maskAPIKey() replaces the middle of keys with "****".
						// When the frontend sends back a value containing "****", it means the user
						// did not change the key, so we skip the update to preserve the real value.
						// An empty string means "clear the key", while a new value without "****"
						// means "update to this new key".
			if apiKey != "" && !strings.Contains(apiKey, "****") {
				a.settings.ModelConfigs[i].APIKey = apiKey
			}
			a.settings.ModelConfigs[i].APIURL = apiURL
			a.settings.ModelConfigs[i].MaxContext = maxContext
			a.settings.ModelConfigs[i].ToolRounds = toolRounds
			a.settings.ModelConfigs[i].Multimodal = multimodal
			a.syncSettingsToConfig()
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("model config not found: %s", id)
}

// RemoveModelConfig 删除模型配置
func (a *App) RemoveModelConfig(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, mc := range a.settings.ModelConfigs {
		if mc.ID == id {
			a.settings.ModelConfigs = append(a.settings.ModelConfigs[:i], a.settings.ModelConfigs[i+1:]...)
			a.syncSettingsToConfig()
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("model config not found: %s", id)
}

// ToggleModelConfig 切换模型配置的启用/禁用状态
func (a *App) ToggleModelConfig(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, mc := range a.settings.ModelConfigs {
		if mc.ID == id {
			a.settings.ModelConfigs[i].Enabled = enabled
			a.syncSettingsToConfig()
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("model config not found: %s", id)
}

