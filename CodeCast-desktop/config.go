package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
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
	APIKey string `json:"-"`
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

	APIKey      string `json:"api_key"`
	LongContext bool   `json:"long_context"`
	LLMProvider  string `json:"llm_provider"`
	LLMAPIURL    string `json:"llm_api_url"`
	LLMModel     string `json:"llm_model"`

	Personality         string `json:"personality"`
	CustomInstructions  string `json:"custom_instructions"`
	AutoMemory          bool   `json:"auto_memory"`
	ToolMemory          bool   `json:"tool_memory"`
	MessageHistoryLimit int    `json:"message_history_limit"`

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

	MCPServers []MCPServer `json:"mcp_servers"`

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

var migrationNeeded bool

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
	APIKey:           "",
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
	EnvVars:          []EnvVar{},
	SlashCommands:    []SlashCommand{},
	ArchivedSessions: []string{},
}

// initSettings 确定设置文件路径并加载
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
		_ = json.Unmarshal(data, &s)
	}

	if s.MCPServers == nil {
		s.MCPServers = []MCPServer{}
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

	a.ensureBuiltinMCP(&s)

	if a.encryptionKey != nil && s.APIKey != "" {
		decryptedKey, decryptErr := decryptAPIKey(s.APIKey, a.encryptionKey)
		if decryptErr == nil {
			s.APIKey = decryptedKey
			if isEncrypted(s.APIKey) {
				s.APIKey = ""
				fmt.Printf("warning: API key appears to be encrypted but decryption failed, clearing\n")
			}
		} else if !isEncrypted(s.APIKey) {
			migrationNeeded = true
		} else {
			fmt.Printf("warning: failed to decrypt API key: %v\n", decryptErr)
			s.APIKey = ""
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

func (a *App) saveSettingsToFile() error {
	settingsCopy := *a.settings

	if a.encryptionKey != nil && settingsCopy.APIKey != "" {
		encryptedKey, err := encryptAPIKey(settingsCopy.APIKey, a.encryptionKey)
		if err != nil {
			fmt.Printf("warning: failed to encrypt API key: %v\n", err)
		} else {
			settingsCopy.APIKey = encryptedKey
		}
	}

	data, err := json.MarshalIndent(settingsCopy, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(a.settingsPath, data, 0600)
}

func (a *App) syncSettingsToConfig() {
	if a.settings.APIKey != "" {
		a.config.Model.APIKey = a.settings.APIKey
	}
	a.config.Model.BaseURL = "https://api.deepseek.com"
	a.config.Model.Model = "deepseek-v4-flash"

	a.llmConfig.APIKey = a.settings.APIKey
	if a.settings.LLMAPIURL != "" {
		a.llmConfig.APIURL = a.settings.LLMAPIURL
	}
	if a.settings.LLMModel != "" {
		a.llmConfig.Model = a.settings.LLMModel
	}
}

// ==================== Settings Methods (exposed to frontend) ====================

func (a *App) GetSettings() Settings {
	a.mu.Lock()
	defer a.mu.Unlock()
	s := *a.settings
	s.MCPServers = append([]MCPServer{}, a.settings.MCPServers...)
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

	a.settings = &s
	a.syncSettingsToConfig()
	return a.saveSettingsToFile()
}

func (a *App) UpdateSetting(key string, value interface{}) error {
	a.mu.Lock()
	defer a.mu.Unlock()

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
	a.mu.Lock()
	defer a.mu.Unlock()
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
	a.mu.Lock()
	defer a.mu.Unlock()
	copy := make([]EnvVar, len(a.settings.EnvVars))
	for i, v := range a.settings.EnvVars {
		copy[i] = v
	}
	return copy
}

// ==================== Slash Commands ====================

func (a *App) GetSlashCommands() []SlashCommand {
	a.mu.Lock()
	defer a.mu.Unlock()
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
	a.mu.Lock()
	defer a.mu.Unlock()

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
	a.mu.Lock()
	defer a.mu.Unlock()

	a.config.Model.APIKey = key
	a.settings.APIKey = key
	_ = a.saveSettingsToFile()
	return "API Key 已设置"
}

func (a *App) GetConfig() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()

	maskedKey := ""
	if a.config.Model.APIKey != "" {
		key := a.config.Model.APIKey
		if len(key) > 4 {
			maskedKey = "****" + key[len(key)-4:]
		} else {
			maskedKey = "****"
		}
	}

	return map[string]any{
		"model": map[string]any{
			"base_url": a.config.Model.BaseURL,
			"api_key":  maskedKey,
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

func loadEnv(cfg *Config) {
	if v := os.Getenv("DEEPSEEK_API_KEY"); v != "" {
		cfg.Model.APIKey = v
	}
	if v := os.Getenv("DEEPSEEK_BASE_URL"); v != "" {
		cfg.Model.BaseURL = v
	}
}
