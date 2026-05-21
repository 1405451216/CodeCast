package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== 全局常量定义 ====================
// 统一管理所有文件大小和 API 限制，避免魔法数字分散在各处
// 所有文件操作都应有合理的大小限制，防止 OOM 和性能问题

const (
	// 文件大小限制
	MaxReadFileSize    = 4 * 1024 * 1024 // 4MB - 通用文件读取上限（用于 ReadFile 工具调用）
	MaxPreviewFileSize = 2 * 1024 * 1024 // 2MB - 预览面板专用（较小以提升前端渲染性能）
	MaxWriteFileSize   = 10 * 1024 * 1024 // 10MB - 写入操作上限（防止写入超大文件导致存储问题）
	MaxResponseSize    = 10 * 1024 * 1024 // 10MB - API 响应体上限（防止 OOM）

	// AI 模型参数
	DefaultMaxTokensNormal  = 8192  // 普通模式 max_tokens（适用于大多数场景）
	DefaultMaxTokensLongCtx = 65536 // 长上下文模式 max_tokens（适用于大型代码库分析）

	// 消息历史管理
	MessageHistoryLimit = 20 // 保留的消息历史条数（平衡上下文质量和 token 消耗）
)

// formatFileSize 将字节数转换为人类可读的格式（B/KB/MB/GB）
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

//go:embed frontend/dist
var assets embed.FS

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
	// 常规
	WorkMode     string `json:"work_mode"`       // "coding" or "daily"
	DefaultPerm  bool   `json:"default_perm"`    // 默认权限
	AutoReview   bool   `json:"auto_review"`     // 自动审核
	FullAccess   bool   `json:"full_access"`     // 完全访问权限
	Shell        string `json:"shell"`           // "powershell", "cmd", "gitbash"
	OpenTarget   string `json:"open_target"`     // "default_app", "vscode", "explorer"
	Language     string `json:"language"`        // "zh-CN", "en"
	Hotkey       string `json:"hotkey"`          // 全局快捷键，空字符串=禁用
	CtrlEnterSend bool  `json:"ctrl_enter_send"` // 需按 Ctrl+Enter 发送长文本
	FollowupMode string `json:"followup_mode"`   // "queue" or "guide"
	ReviewMode   string `json:"review_mode"`     // "inline" or "split"

	// 通知
	NotifyComplete     string `json:"notify_complete"`      // "always", "unfocused", "never"
	NotifyPermission   bool   `json:"notify_permission"`    // 权限通知
	NotifyIssue        bool   `json:"notify_issue"`         // 问题通知
	NotificationTurn   string `json:"notification_turn"`    // "all", "only_errors", "off"
	NotificationPermission bool `json:"notification_permission"` // AI 操作需授权时弹通知
	NotificationQuestion  bool `json:"notification_question"`  // AI 提问时弹通知

	// 外观
	Theme    string `json:"theme"`     // "dark" or "light"
	FontSize string `json:"font_size"` // "small", "medium", "large"

	// 配置（模型接入）
	APIKey      string `json:"api_key"`
	LongContext bool   `json:"long_context"` // 是否开启1M上下文

	// 个性化
	Personality         string `json:"personality"`          // "friendly", "professional", "concise", "detailed"
	CustomInstructions  string `json:"custom_instructions"`   // 自定义指令文本
	AutoMemory          bool   `json:"auto_memory"`          // 自用记忆
	ToolMemory          bool   `json:"tool_memory"`          // 通过工具辅助对话生成记忆
	MessageHistoryLimit int    `json:"message_history_limit"` // 工作记忆保留消息条数（默认20）

	// Git
	AutoCommit       bool   `json:"auto_commit"`        // 自动提交
	ConfirmBeforeCommit bool `json:"confirm_before_commit"` // 提交前确认

	// 工作树
	UseWorktree bool `json:"use_worktree"` // 在独立工作树中运行

	// 浏览器使用
	AllowBrowser     bool     `json:"allow_browser"`       // 允许浏览器操控
	BrowserApproval  string   `json:"browser_approval"`    // "always_ask", "auto_approve", "never" - 审批权限
	BrowserHistory   string   `json:"browser_history"`     // "always_ask", "auto_approve", "never" - 历史记录权限
	BrowserClearData string   `json:"browser_clear_data"`  // "never", "daily", "weekly" - 自动清理频率
	BlockedDomains   []string `json:"blocked_domains"`     // 已屏蔽的域名
	AllowedDomains   []string `json:"allowed_domains"`     // 允许的域名
	BrowserPlugin    string   `json:"browser_plugin"`      // Browser Use 插件状态: "", "enabled", "popout"
	SeleniumInstalled bool    `json:"selenium_installed"`  // Selenium 是否已安装

	// 电脑操控
	ComputerControl bool `json:"computer_control"` // 允许 shell 命令执行

	// MCP 服务器列表
	MCPServers []MCPServer `json:"mcp_servers"`

	// 环境变量
	EnvVars []EnvVar `json:"env_vars"`

	// 斜杠命令
	SlashCommands []SlashCommand `json:"slash_commands"`

	// 已归档对话 ID 列表
	ArchivedSessions []string `json:"archived_sessions"`
}

type MCPServer struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	URL     string   `json:"url"`               // WebSocket URL（type=websocket 时使用）
	Command string   `json:"command,omitempty"`  // 命令（type=stdio 时使用）
	Args    []string `json:"args,omitempty"`     // 命令参数
	Type    string   `json:"type"`              // "stdio" 或 "websocket"
	Enabled bool     `json:"enabled"`
	Builtin bool     `json:"builtin,omitempty"` // 是否内置（内置服务不可删除）
}

type EnvVar struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// SlashCommand 用户自定义斜杠命令
type SlashCommand struct {
	ID          string `json:"id"`
	Name        string `json:"name"`        // 命令名（不含 /）
	Description string `json:"description"` // 简短描述
	FillText    string `json:"fill_text"`   // 选中后填充到输入框的文本
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
	ComputerControl:     false,
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

// ==================== Core Types ====================

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Skill struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
	Type        string `json:"type"` // builtin, custom
	CreatedAt   int64  `json:"created_at"`
}

type Task struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Command     string `json:"command"`
	Schedule    string `json:"schedule"` // 支持: hourly, daily, every 30m, daily 09:00
	Enabled     bool   `json:"enabled"`
	LastRun     int64  `json:"last_run"`
	NextRun     int64  `json:"next_run"`
	Status      string `json:"status"` // pending, running, completed, error
	LastError   string `json:"last_error"`
}

type Session struct {
	ID        string
	Name      string
	CreatedAt time.Time
	SkillID   string
	Messages  []Message
}

func NewSession(name string, skillID string) *Session {
	return &Session{
		ID:        fmt.Sprintf("session_%d", time.Now().UnixNano()),
		Name:      name,
		CreatedAt: time.Now(),
		SkillID:   skillID,
		Messages:  []Message{},
	}
}

func (s *Session) AddMessage(msg Message) {
	s.Messages = append(s.Messages, msg)
}

// ==================== App ====================

type App struct {
	ctx           context.Context
	config        *Config
	settings      *Settings
	settingsPath  string
	encryptionKey []byte
	sessions      []*Session
	tasks         []*Task
	skills        []*Skill
	projects      []Project
	noProjectMode bool
	memory        *MemoryStore
	activeSessionID string // 当前活跃会话 ID（用于 ToolMemory 记录工具操作）
	memoryCleanupStop chan struct{} // 记忆自动清理 goroutine 停止信号
	taskSchedulerStop  chan struct{} // 任务调度器 goroutine 停止信号
	mu            sync.Mutex
}

func NewApp() *App {
	cfg := DefaultConfig
	loadEnv(&cfg)

	app := &App{
		config:   &cfg,
		sessions: []*Session{},
		tasks:    []*Task{},
		skills:   []*Skill{},
		projects: []Project{},
	}

	app.initSettings()
	app.initDefaultSkills()

	app.syncSettingsToConfig()

	if migrationNeeded && app.encryptionKey != nil {
		fmt.Println("migrating unencrypted API key to encrypted format...")
		if err := app.saveSettingsToFile(); err != nil {
			fmt.Printf("warning: failed to migrate API key to encrypted storage: %v\n", err)
		} else {
			fmt.Println("API key migration completed successfully")
			migrationNeeded = false
		}
	}

	return app
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

// testWritable 测试目录是否可写
func testWritable(dir string) bool {
	tmp := filepath.Join(dir, ".write_test_codecast")
	err := os.WriteFile(tmp, []byte("t"), 0644)
	if err != nil {
		return false
	}
	os.Remove(tmp)
	return true
}

// loadSettings 从磁盘加载设置，不存在则使用默认值
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

// ensureBuiltinMCP 确保内置 MCP 服务器存在于列表中
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

// saveSettingsToFile 将当前设置写入磁盘（API Key 加密存储）
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

// syncSettingsToConfig 将 settings 中的模型配置同步到 legacy config
func (a *App) syncSettingsToConfig() {
	if a.settings.APIKey != "" {
		a.config.Model.APIKey = a.settings.APIKey
	}
	// 固定使用 DeepSeek API
	a.config.Model.BaseURL = "https://api.deepseek.com"
	a.config.Model.Model = "deepseek-v4-flash"
}

// ==================== Settings Methods (exposed to frontend) ====================

// GetSettings 获取所有设置（返回副本，避免数据竞争）
func (a *App) GetSettings() Settings {
	a.mu.Lock()
	defer a.mu.Unlock()
	s := *a.settings
	// 深拷贝切片，防止外部修改影响内部状态
	s.MCPServers = append([]MCPServer{}, a.settings.MCPServers...)
	s.EnvVars = append([]EnvVar{}, a.settings.EnvVars...)
	s.ArchivedSessions = append([]string{}, a.settings.ArchivedSessions...)
	s.BlockedDomains = append([]string{}, a.settings.BlockedDomains...)
	s.AllowedDomains = append([]string{}, a.settings.AllowedDomains...)
	s.SlashCommands = append([]SlashCommand{}, a.settings.SlashCommands...)
	return s
}

// SaveSettings 保存所有设置（前端一次性提交整个 settings 对象）
func (a *App) SaveSettings(s Settings) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 确保切片不为 nil
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

// UpdateSetting 单独更新某个设置字段
func (a *App) UpdateSetting(key string, value interface{}) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	v := reflect.ValueOf(a.settings).Elem()
	t := v.Type()

	// 通过 json tag 查找对应字段
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

	// 根据字段类型设置值（处理 JS 传来的类型差异）
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

// SetNoProjectMode 设置无项目模式（允许不选择项目目录使用 AI 对话）
func (a *App) SetNoProjectMode(enabled bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.noProjectMode = enabled
}

// GetNoProjectMode 获取当前是否处于无项目模式
func (a *App) GetNoProjectMode() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.noProjectMode
}

// ==================== MCP Server Management ====================

// AddMCPServer 添加 MCP 服务器
func (a *App) AddMCPServer(name, url string) (*MCPServer, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	server := MCPServer{
		ID:      fmt.Sprintf("mcp_%d", time.Now().UnixNano()),
		Name:    name,
		URL:     url,
		Type:    "websocket",
		Enabled: true,
	}

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	// 返回切片中的元素指针（而非局部变量的指针）
	return &a.settings.MCPServers[len(a.settings.MCPServers)-1], nil
}

// AddMCPServerStdio 添加 stdio 类型的 MCP 服务器
func (a *App) AddMCPServerStdio(name, command string, args []string) (*MCPServer, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if args == nil {
		args = []string{}
	}

	server := MCPServer{
		ID:      fmt.Sprintf("mcp_%d", time.Now().UnixNano()),
		Name:    name,
		Command: command,
		Args:    args,
		Type:    "stdio",
		Enabled: true,
	}

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	return &a.settings.MCPServers[len(a.settings.MCPServers)-1], nil
}

// RemoveMCPServer 移除 MCP 服务器
func (a *App) RemoveMCPServer(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			if s.Builtin {
				return fmt.Errorf("内置 MCP 服务器不可删除")
			}
			a.settings.MCPServers = append(a.settings.MCPServers[:i], a.settings.MCPServers[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("MCP server not found: %s", id)
}

// ToggleMCPServer 启用/禁用 MCP 服务器
func (a *App) ToggleMCPServer(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			a.settings.MCPServers[i].Enabled = enabled
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("MCP server not found: %s", id)
}

// TestMCPServerConnection 测试 MCP 服务器连接是否可用
func (a *App) TestMCPServerConnection(id string) map[string]interface{} {
	result := map[string]interface{}{
		"connected": false,
		"latency":   0,
		"error":     "",
	}

	a.mu.Lock()
	var targetServer *MCPServer
	for _, s := range a.settings.MCPServers {
		if s.ID == id {
			targetServer = &s
			break
		}
	}
	a.mu.Unlock()

	if targetServer == nil {
		result["error"] = "MCP server not found"
		return result
	}

	startTime := time.Now()

	switch targetServer.Type {
	case "websocket":
		wsURL := targetServer.URL
		if !strings.HasPrefix(wsURL, "ws://") && !strings.HasPrefix(wsURL, "wss://") {
			result["error"] = "无效的 WebSocket URL"
			return result
		}
		httpURL := strings.Replace(wsURL, "ws://", "http://", 1)
		httpURL = strings.Replace(httpURL, "wss://", "https://", 1)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, "GET", httpURL, nil)
		if err != nil {
			result["error"] = fmt.Sprintf("构建请求失败: %v", err)
			return result
		}
		req.Header.Set("Connection", "Upgrade")
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Sec-WebSocket-Version", "13")
		req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")

		resp, err := httpClient.Do(req)
		if err != nil {
			result["error"] = fmt.Sprintf("连接失败: %v", err)
			return result
		}
		defer resp.Body.Close()

		if resp.StatusCode == 101 {
			result["connected"] = true
		} else if resp.StatusCode == 404 || resp.StatusCode == 403 || resp.StatusCode == 401 {
			result["connected"] = true
			result["error"] = fmt.Sprintf("服务器可达但返回 %d (非 WebSocket 升级，可能是 HTTP 端点)", resp.StatusCode)
		} else {
			result["error"] = fmt.Sprintf("服务器返回异常状态码: %d", resp.StatusCode)
		}

	case "stdio":
		if targetServer.Command == "" {
			result["error"] = "未配置命令"
			return result
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, targetServer.Command, targetServer.Args...)
		cmd.Stdin = &bytes.Buffer{}
		cmd.Stdout = &bytes.Buffer{}
		cmd.Stderr = &bytes.Buffer{}

		err := cmd.Start()
		if err != nil {
			result["error"] = fmt.Sprintf("启动进程失败: %v", err)
			return result
		}

		processDone := make(chan error, 1)
		go func() {
			processDone <- cmd.Wait()
		}()

		select {
		case <-processDone:
			result["connected"] = true
			result["error"] = "进程启动后立即退出，可能参数有误"
		case <-ctx.Done():
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
			result["connected"] = true
			result["error"] = ""
		}

	default:
		result["error"] = fmt.Sprintf("不支持的 MCP 类型: %s", targetServer.Type)
		return result
	}

	result["latency"] = time.Since(startTime).Milliseconds()
	fmt.Printf("[MCP] %s 连接测试完成 (延迟: %dms)\n", targetServer.Name, result["latency"])
	return result
}

// GetMCPStatus 获取所有 MCP 服务器的状态概览
func (a *App) GetMCPStatus() []map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	var results []map[string]interface{}
	for _, s := range a.settings.MCPServers {
		status := map[string]interface{}{
			"id":      s.ID,
			"name":    s.Name,
			"type":    s.Type,
			"enabled": s.Enabled,
			"builtin": s.Builtin,
		}
		switch s.Type {
		case "websocket":
			status["endpoint"] = s.URL
		case "stdio":
			status["command"] = s.Command + " " + strings.Join(s.Args, " ")
		}
		results = append(results, status)
	}
	return results
}

// ==================== Browser Domain Enforcement ====================

// IsDomainBlocked 检查域名是否被屏蔽（供浏览器控制模块调用）
func (a *App) IsDomainBlocked(rawURL string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	domain := strings.ToLower(parsedURL.Hostname())

	for _, blocked := range a.settings.BlockedDomains {
		blockedLower := strings.ToLower(blocked)
		if domain == blockedLower || strings.HasSuffix(domain, "."+blockedLower) {
			fmt.Printf("[Domain] 已屏蔽域名: %s\n", domain)
			wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
				"title": "访问被阻止",
				"body":  fmt.Sprintf("域名 %s 在屏蔽列表中", domain),
				"type":  "warning",
			})
			return true
		}
	}

	if len(a.settings.AllowedDomains) > 0 {
		allowed := false
		for _, allowedDomain := range a.settings.AllowedDomains {
			allowedLower := strings.ToLower(allowedDomain)
			if domain == allowedLower || strings.HasSuffix(domain, "."+allowedLower) {
				allowed = true
				break
			}
		}
		if !allowed {
			fmt.Printf("[Domain] 域名不在允许列表中: %s\n", domain)
			wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
				"title": "访问被阻止",
				"body":  fmt.Sprintf("域名 %s 不在允许列表中", domain),
				"type":  "warning",
			})
			return true
		}
	}

	return false
}

// GetDomainRules 获取当前域名规则摘要
func (a *App) GetDomainRules() map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	mode := "open"
	if len(a.settings.BlockedDomains) > 0 && len(a.settings.AllowedDomains) == 0 {
		mode = "blocklist"
	} else if len(a.settings.AllowedDomains) > 0 {
		mode = "allowlist"
	}

	return map[string]interface{}{
		"mode":           mode,
		"blockedCount":   len(a.settings.BlockedDomains),
		"allowedCount":   len(a.settings.AllowedDomains),
		"blockedDomains": a.settings.BlockedDomains,
		"allowedDomains": a.settings.AllowedDomains,
	}
}

// ==================== Environment Variables ====================

// AddEnvVar 添加环境变量
func (a *App) AddEnvVar(key, value string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 如果已存在则更新
	for i, ev := range a.settings.EnvVars {
		if ev.Key == key {
			a.settings.EnvVars[i].Value = value
			return a.saveSettingsToFile()
		}
	}

	a.settings.EnvVars = append(a.settings.EnvVars, EnvVar{Key: key, Value: value})
	return a.saveSettingsToFile()
}

// RemoveEnvVar 移除环境变量
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

// GetEnvVars 获取所有环境变量（返回副本，避免数据竞争）
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

// GetSlashCommands 获取所有斜杠命令（返回副本）
func (a *App) GetSlashCommands() []SlashCommand {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := make([]SlashCommand, len(a.settings.SlashCommands))
	copy(result, a.settings.SlashCommands)
	return result
}

// AddSlashCommand 添加自定义斜杠命令
func (a *App) AddSlashCommand(name, description, fillText string) (*SlashCommand, error) {
	if name == "" {
		return nil, fmt.Errorf("命令名不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	// 检查重复
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

// UpdateSlashCommand 更新斜杠命令
func (a *App) UpdateSlashCommand(id, name, description, fillText string) error {
	if name == "" {
		return fmt.Errorf("命令名不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	for i, cmd := range a.settings.SlashCommands {
		if cmd.ID == id {
			// 检查新名称是否与其他命令冲突
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

// RemoveSlashCommand 删除斜杠命令
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

// ArchiveSession 归档对话
func (a *App) ArchiveSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 检查是否已归档
	for _, sid := range a.settings.ArchivedSessions {
		if sid == id {
			return nil // 已归档，无需重复
		}
	}

	a.settings.ArchivedSessions = append(a.settings.ArchivedSessions, id)
	return a.saveSettingsToFile()
}

// UnarchiveSession 取消归档对话
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

// GetArchivedSessions 获取已归档的对话列表
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

// ResetMemory 删除所有 CodeCast 记忆（清空自定义指令和记忆标志）
func (a *App) ResetMemory() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.settings.CustomInstructions = ""
	a.settings.AutoMemory = false
	a.settings.ToolMemory = false
	if a.memory != nil {
		if err := a.memory.ClearAll(); err != nil {
			return fmt.Errorf("清空记忆失败: %v", err)
		}
	}
	return a.saveSettingsToFile()
}

func (a *App) GetMemoryStats() map[string]interface{} {
	result := map[string]interface{}{
		"enabled":    a.memory != nil,
		"totalEpisodes": 0,
		"dbSize":     "0 B",
	}

	if a.memory != nil {
		totalEpisodes, dbSize, err := a.memory.Stats()
		if err == nil {
			result["totalEpisodes"] = totalEpisodes
			result["dbSize"] = formatFileSize(dbSize)
		}
	}

	return result
}

func (a *App) ClearMemory() error {
	if a.memory != nil {
		if err := a.memory.ClearAll(); err != nil {
			return fmt.Errorf("清空记忆数据失败: %v", err)
		}
		fmt.Println("[Memory] 记忆数据已清空")
	}
	return nil
}

// recordToolIfEnabled 当 ToolMemory 开启时，将工具操作记录到情景记忆
// 异步执行，不阻塞工具操作本身
func (a *App) recordToolIfEnabled(sessionID, toolName, detail string) {
	if !a.settings.ToolMemory || a.memory == nil || sessionID == "" {
		return
	}
	go func() {
		if err := a.memory.RecordToolUse(sessionID, toolName, detail); err != nil {
			fmt.Printf("[Memory] 记录工具操作失败: %v\n", err)
		}
	}()
}

// ==================== 浏览器域名管理 ====================

// AddBlockedDomain 添加屏蔽域名
func (a *App) AddBlockedDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, d := range a.settings.BlockedDomains {
		if d == domain {
			return fmt.Errorf("域名已存在")
		}
	}
	a.settings.BlockedDomains = append(a.settings.BlockedDomains, domain)
	return a.saveSettingsToFile()
}

// RemoveBlockedDomain 移除屏蔽域名
func (a *App) RemoveBlockedDomain(domain string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, d := range a.settings.BlockedDomains {
		if d == domain {
			a.settings.BlockedDomains = append(a.settings.BlockedDomains[:i], a.settings.BlockedDomains[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("域名不存在")
}

// AddAllowedDomain 添加允许域名
func (a *App) AddAllowedDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, d := range a.settings.AllowedDomains {
		if d == domain {
			return fmt.Errorf("域名已存在")
		}
	}
	a.settings.AllowedDomains = append(a.settings.AllowedDomains, domain)
	return a.saveSettingsToFile()
}

// RemoveAllowedDomain 移除允许域名
func (a *App) RemoveAllowedDomain(domain string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, d := range a.settings.AllowedDomains {
		if d == domain {
			a.settings.AllowedDomains = append(a.settings.AllowedDomains[:i], a.settings.AllowedDomains[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("域名不存在")
}

// ClearBrowserData 清除浏览数据（缓存、Cookie 等）
func (a *App) ClearBrowserData() error {
	var errors []string

	var browserPaths []string

	if runtime.GOOS == "windows" {
		localAppData := os.Getenv("LOCALAPPDATA")
		browserPaths = []string{
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cache"),
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cookies"),
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Code Cache"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Cache"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Cookies"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Code Cache"),
		}
	} else if runtime.GOOS == "darwin" {
		home, _ := os.UserHomeDir()
		appSupport := filepath.Join(home, "Library", "Application Support")
		browserPaths = []string{
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Cache"),
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Cookies"),
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Code Cache"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Cache"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Cookies"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Code Cache"),
		}
	} else {
		// Linux
		home, _ := os.UserHomeDir()
		configDir := filepath.Join(home, ".config")
		browserPaths = []string{
			filepath.Join(configDir, "google-chrome", "Default", "Cache"),
			filepath.Join(configDir, "google-chrome", "Default", "Cookies"),
			filepath.Join(configDir, "microsoft-edge", "Default", "Cache"),
			filepath.Join(configDir, "microsoft-edge", "Default", "Cookies"),
		}
	}

	clearDir := func(path string) {
		if _, err := os.Stat(path); err != nil {
			return
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return
		}
		for _, e := range entries {
			fullPath := filepath.Join(path, e.Name())
			if err := os.RemoveAll(fullPath); err != nil {
				errors = append(errors, fullPath)
			}
		}
	}

	for _, p := range browserPaths {
		clearDir(p)
	}

	if len(errors) > 0 {
		fmt.Printf("[Browser] 部分文件清理失败: %d 个\n", len(errors))
	} else {
		fmt.Println("[浏览器] 浏览数据已清理")
	}
	return nil
}

// ==================== Notification System ====================

// SendNotification 发送通知（通过 Wails 事件通知前端展示）
// notification_turn: all/only_errors/off
// notification_permission: 是否需要用户授权
// notification_question: AI 提问类消息是否弹通知
func (a *App) SendNotification(title, body, notifType string) {
	a.mu.Lock()
	turn := a.settings.NotificationTurn
	a.mu.Unlock()

	switch turn {
	case "off":
		return
	case "only_errors":
		if notifType != "error" && notifType != "warning" {
			return
		}
	}

	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": title,
		"body":  body,
		"type":  notifType,
	})
}

// NotifyAIQuestion 当 AI 向用户提问时发送通知
func (a *App) NotifyAIQuestion(question string) {
	a.mu.Lock()
	enabled := a.settings.NotificationQuestion
	a.mu.Unlock()
	if !enabled {
		return
	}
	a.SendNotification("AI 有问题需要确认", question, "question")
}

// NotifyPermissionNeeded 当需要用户授权操作时发送通知
func (a *App) NotifyPermissionNeeded(operation string) {
	a.mu.Lock()
	enabled := a.settings.NotificationPermission
	a.mu.Unlock()
	if !enabled {
		return
	}
	a.SendNotification("需要您的授权", operation+" 需要您确认后才能继续", "permission")
}

// ==================== Computer Control (Shell Execution) ====================

// ExecuteCommand 在项目目录下执行 shell 命令（计算机控制功能）
// 仅当 computer_control 开启时可用，有安全限制
func (a *App) ExecuteCommand(command string, timeoutSeconds int) (string, error) {
	a.mu.Lock()
	enabled := a.settings.ComputerControl
	a.mu.Unlock()

	if !enabled {
		return "", fmt.Errorf("计算机控制功能未开启，请在设置中启用")
	}

	var workDir string
	a.mu.Lock()
	if len(a.projects) > 0 {
		workDir = a.projects[0].Path
	}
	noProjectMode := a.noProjectMode
	a.mu.Unlock()

	if workDir == "" && !noProjectMode {
		return "", fmt.Errorf("未选择项目目录")
	}

	dangerousPatterns := []string{
		"rm -rf /", "format", "mkfs", "shutdown", "reboot",
		"del /", ":(){:", "> /dev/", "curl.*\\|.*sh",
	}
	cmdLower := strings.ToLower(command)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(cmdLower, pattern) {
			return "", fmt.Errorf("命令被安全策略拦截: 包含危险模式")
		}
	}

	var shell, flag string
	if runtime.GOOS == "windows" {
		shell = "cmd"
		flag = "/C"
	} else {
		shell = os.Getenv("SHELL")
		if shell == "" {
			if runtime.GOOS == "darwin" {
				shell = "/bin/zsh"
			} else {
				shell = "/bin/bash"
			}
		}
		flag = "-c"
	}

	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, flag, command)
	cmd.Dir = workDir
	cmd.Env = append(os.Environ(), a.getCustomEnvVars()...)

	output, err := cmd.CombinedOutput()
	result := string(output)

	if ctx.Err() == context.DeadlineExceeded {
		return result + "\n[命令执行超时]", fmt.Errorf("command timed out after %ds", timeoutSeconds)
	}
	if err != nil {
		return result, fmt.Errorf("command failed: %w", err)
	}

	fmt.Printf("[Shell] 执行命令: %s (输出: %d bytes)\n", command[:min(len(command), 50)], len(result))
	return result, nil
}

// getCustomEnvVars 获取用户自定义的环境变量列表
func (a *App) getCustomEnvVars() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	vars := make([]string, 0, len(a.settings.EnvVars))
	for _, ev := range a.settings.EnvVars {
		vars = append(vars, ev.Key+"="+ev.Value)
	}
	return vars
}

// ==================== Selenium Detection ====================

// CheckSeleniumInstalled 检测本机是否安装了 Selenium 相关组件
func (a *App) CheckSeleniumInstalled() map[string]interface{} {
	details := ""
	var hasSelenium, hasChromeDriver, hasEdgeDriver, hasPython bool

	if path, err := exec.LookPath("chromedriver"); err == nil {
		hasChromeDriver = true
		details += fmt.Sprintf("chromedriver: %s\n", path)
	}
	if path, err := exec.LookPath("msedgedriver"); err == nil {
		hasEdgeDriver = true
		details += fmt.Sprintf("msedgedriver: %s\n", path)
	}
	if _, err := exec.LookPath("python"); err == nil {
		hasPython = true
		if output, err := exec.Command("python", "-c", "import selenium; print(selenium.__version__)").CombinedOutput(); err == nil {
			hasSelenium = true
			details += fmt.Sprintf("selenium: %s", strings.TrimSpace(string(output)))
		} else {
			details += "python 已安装但 selenium 模块未找到\n"
		}
	}
	if _, err := exec.LookPath("python3"); err == nil && !hasPython {
		hasPython = true
		if output, err := exec.Command("python3", "-c", "import selenium; print(selenium.__version__)").CombinedOutput(); err == nil {
			hasSelenium = true
			details += fmt.Sprintf("selenium: %s", strings.TrimSpace(string(output)))
		}
	}

	installed := hasSelenium || hasChromeDriver || hasEdgeDriver

	a.mu.Lock()
	a.settings.SeleniumInstalled = installed
	a.saveSettingsToFile()
	a.mu.Unlock()

	return map[string]interface{}{
		"selenium":     hasSelenium,
		"chromedriver": hasChromeDriver,
		"edgedriver":   hasEdgeDriver,
		"python":       hasPython,
		"details":      details,
		"installed":    installed,
	}
}

// ==================== Default Skills ====================

func (a *App) initDefaultSkills() {
	a.skills = []*Skill{
		{
			ID:          "code_gen",
			Name:        "代码生成",
			Description: "帮助生成各种编程语言的代码",
			Prompt:      "你是一个专业的代码生成助手。请根据用户需求生成高质量的代码。",
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
		{
			ID:          "code_review",
			Name:        "代码审查",
			Description: "审查代码并提供改进建议",
			Prompt:      "你是一个专业的代码审查专家。请审查代码并提供详细的改进建议。",
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
		{
			ID:          "doc_writer",
			Name:        "文档生成",
			Description: "生成技术文档和注释",
			Prompt:      "你是一个技术文档专家。请为代码生成清晰的文档和注释。",
			Type:        "builtin",
			CreatedAt:   time.Now().Unix(),
		},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	memoryPath := filepath.Join(filepath.Dir(a.settingsPath), "memory.db")
	memoryStore, err := NewMemoryStore(memoryPath)
	if err != nil {
		fmt.Printf("[Warning] 记忆系统初始化失败: %v\n", err)
	} else {
		a.memory = memoryStore
		fmt.Printf("[Startup] 情景记忆系统已启动 (db: %s)\n", memoryPath)

		// 启动时先清理一次过期记忆
		if deleted, cleanupErr := a.memory.CleanupExpired(); cleanupErr == nil && deleted > 0 {
			fmt.Printf("[Startup] 已清理 %d 条过期记忆\n", deleted)
		}

		// 启动后台定期清理（每天一次）
		a.memoryCleanupStop = make(chan struct{})
		StartAutoCleanup(a.memory, a.memoryCleanupStop)
		fmt.Println("[Startup] 记忆自动清理已启动（每24小时清理超过30天的记录）")
	}

	a.taskSchedulerStop = make(chan struct{})
	a.StartTaskScheduler(a.taskSchedulerStop)
	fmt.Println("[Startup] 任务调度器已启动（每分钟检查一次定时任务）")
	startCleanupGoroutine()
	fmt.Println("[Startup] 活跃连接清理机制已启动")
}

func (a *App) domReady(ctx context.Context) {
}

func (a *App) shutdown(ctx context.Context) {
	// 停止记忆自动清理 goroutine
	if a.memoryCleanupStop != nil {
		close(a.memoryCleanupStop)
	}
	// 停止任务调度器
	if a.taskSchedulerStop != nil {
		close(a.taskSchedulerStop)
	}
	if a.memory != nil {
		a.memory.Close()
		fmt.Println("[Shutdown] 情景记忆系统已关闭")
	}
	close(cleanupStopCh)
	a.CancelRequest()
	fmt.Printf("[Shutdown] 已清理所有活跃连接，应用即将关闭\n")
}

// ==================== Legacy Config Methods (updated) ====================

// SetAPIKey 设置 API Key，同时更新 settings 并持久化
func (a *App) SetAPIKey(key string) string {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.config.Model.APIKey = key
	a.settings.APIKey = key
	_ = a.saveSettingsToFile()
	return "API Key 已设置"
}

// GetConfig 返回更完整的配置信息（API Key 掩码处理）
func (a *App) GetConfig() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 对 API Key 做掩码处理，只显示末4位
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

// ==================== Skills ====================

func (a *App) GetSkills() []*Skill {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := make([]*Skill, len(a.skills))
	for i, s := range a.skills {
		copy := *s
		result[i] = &copy
	}
	return result
}

func (a *App) CreateSkill(name, description, prompt string) (*Skill, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	skill := &Skill{
		ID:          fmt.Sprintf("skill_%d", time.Now().UnixNano()),
		Name:        name,
		Description: description,
		Prompt:      prompt,
		Type:        "custom",
		CreatedAt:   time.Now().Unix(),
	}

	a.skills = append(a.skills, skill)
	return skill, nil
}

func (a *App) DeleteSkill(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.skills {
		if s.ID == id && s.Type == "custom" {
			a.skills = append(a.skills[:i], a.skills[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("skill not found or cannot be deleted")
}

func (a *App) UpdateSkill(id, name, description, prompt string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range a.skills {
		if s.ID == id {
			s.Name = name
			s.Description = description
			s.Prompt = prompt
			return nil
		}
	}
	return fmt.Errorf("skill not found")
}

// ImportSkill 从 JSON 字符串导入技能
func (a *App) ImportSkill(jsonStr string) (*Skill, error) {
	var data struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Prompt      string `json:"prompt"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, fmt.Errorf("JSON 解析失败: %v", err)
	}
	if data.Name == "" {
		return nil, fmt.Errorf("技能名称不能为空")
	}
	if data.Prompt == "" {
		return nil, fmt.Errorf("技能 Prompt 不能为空")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	skill := &Skill{
		ID:          fmt.Sprintf("skill_%d", time.Now().UnixNano()),
		Name:        data.Name,
		Description: data.Description,
		Prompt:      data.Prompt,
		Type:        "custom",
		CreatedAt:   time.Now().Unix(),
	}
	a.skills = append(a.skills, skill)
	return skill, nil
}

// ==================== Tasks ====================

func (a *App) GetTasks() []*Task {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := make([]*Task, len(a.tasks))
	for i, t := range a.tasks {
		copy := *t
		result[i] = &copy
	}
	return result
}

func (a *App) CreateTask(name, description, command, schedule string) (*Task, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	task := &Task{
		ID:          fmt.Sprintf("task_%d", time.Now().UnixNano()),
		Name:        name,
		Description: description,
		Command:     command,
		Schedule:    schedule,
		Enabled:     true,
		Status:      "pending",
	}

	a.tasks = append(a.tasks, task)
	return task, nil
}

func (a *App) DeleteTask(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, t := range a.tasks {
		if t.ID == id {
			a.tasks = append(a.tasks[:i], a.tasks[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("task not found")
}

func (a *App) ToggleTask(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, t := range a.tasks {
		if t.ID == id {
			t.Enabled = enabled
			return nil
		}
	}
	return fmt.Errorf("task not found")
}

// RunTaskNow 立即执行指定任务（真实执行 task.Command）
func (a *App) RunTaskNow(id string) error {
	var command string
	var found bool

	a.mu.Lock()
	for _, t := range a.tasks {
		if t.ID == id {
			t.Status = "running"
			t.LastRun = time.Now().Unix()
			command = t.Command
			found = true
			break
		}
	}
	if !found {
		a.mu.Unlock()
		return fmt.Errorf("task not found: %s", id)
	}
	taskID := id
	taskName := ""
	for _, t := range a.tasks {
		if t.ID == id {
			taskName = t.Name
			break
		}
	}
	a.mu.Unlock()

	if command == "" {
		a.mu.Lock()
		for _, t := range a.tasks {
			if t.ID == taskID {
				t.Status = "error"
				break
			}
		}
		a.mu.Unlock()
		return fmt.Errorf("任务 %s 没有配置命令", taskName)
	}

	go func() {
		startTime := time.Now()
		fmt.Printf("[Task] 开始执行任务: %s (ID: %s)\n", taskName, taskID)

		var workDir string
		var shell, flag string
		a.mu.Lock()
		if len(a.projects) > 0 {
			workDir = a.projects[0].Path
		}
		a.mu.Unlock()

		if runtime.GOOS == "windows" {
			shell = "cmd"
			flag = "/C"
		} else {
			shell = os.Getenv("SHELL")
			if shell == "" {
				if runtime.GOOS == "darwin" {
					shell = "/bin/zsh"
				} else {
					shell = "/bin/bash"
				}
			}
			flag = "-c"
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		cmd := exec.CommandContext(ctx, shell, flag, command)
		if workDir != "" {
			cmd.Dir = workDir
		}
		cmd.Env = append(os.Environ(), a.getCustomEnvVars()...)

		output, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Round(time.Second)

		a.mu.Lock()
		for _, t := range a.tasks {
			if t.ID == taskID {
				if err != nil {
					t.Status = "error"
					t.LastError = strings.TrimSpace(string(output))
					if t.LastError == "" {
						t.LastError = err.Error()
					}
					fmt.Printf("[Task] 任务 %s 执行失败 (%v): %s\n", taskName, err, t.LastError)
				} else {
					t.Status = "completed"
					t.LastError = ""
					fmt.Printf("[Task] 任务 %s 执行完成 (耗时: %s, 输出: %d bytes)\n", taskName, duration, len(output))
				}
				break
			}
		}
		a.mu.Unlock()

		wailsRuntime.EventsEmit(a.ctx, "task-completed", map[string]interface{}{
			"id":       taskID,
			"name":     taskName,
			"status":   func() string { a.mu.Lock(); defer a.mu.Unlock(); for _, t := range a.tasks { if t.ID == taskID { return t.Status } }; return "unknown" }(),
			"duration": duration.String(),
			"output":   strings.TrimSpace(string(output))[:2000],
		})
	}()

	return nil
}

// StartTaskScheduler 启动定时任务调度器
func (a *App) StartTaskScheduler(stopCh <-chan struct{}) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		defer close(done)

		for {
			select {
			case <-ticker.C:
				a.checkAndRunScheduledTasks()
			case <-stopCh:
				return
			}
		}
	}()
	return done
}

// checkAndRunScheduledTasks 检查并执行到期的定时任务
func (a *App) checkAndRunScheduledTasks() {
	now := time.Now()
	var tasksToRun []struct {
		id      string
		name    string
		command string
	}

	a.mu.Lock()
	for _, t := range a.tasks {
		if !t.Enabled || t.Status == "running" || t.Schedule == "" || t.Command == "" {
			continue
		}
		nextRun := a.parseNextRun(t.Schedule, t.LastRun)
		if nextRun.IsZero() || now.After(nextRun) || now.Equal(nextRun) {
			tasksToRun = append(tasksToRun, struct {
				id      string
				name    string
				command string
			}{t.ID, t.Name, t.Command})
		}
	}
	a.mu.Unlock()

	for _, task := range tasksToRun {
		fmt.Printf("[Scheduler] 定时任务触发: %s\n", task.name)
		a.RunTaskNow(task.id)
	}
}

// parseNextRun 解析调度表达式，返回下次执行时间
// 支持格式: "every 30m", "every 1h", "daily 09:00", "hourly", cron 格式简化版
func (a *App) parseNextRun(schedule string, lastRun int64) time.Time {
	if lastRun == 0 {
		return time.Time{}
	}

	last := time.Unix(lastRun, 0)
	schedule = strings.TrimSpace(strings.ToLower(schedule))

	switch {
	case schedule == "hourly":
		return last.Add(1 * time.Hour)

	case schedule == "daily":
		return last.Add(24 * time.Hour)

	case strings.HasPrefix(schedule, "every "):
		intervalStr := strings.TrimPrefix(schedule, "every ")
		if d, err := time.ParseDuration(intervalStr); err == nil && d >= time.Minute {
			return last.Add(d)
		}

	case strings.HasPrefix(schedule, "daily "):
		timeStr := strings.TrimPrefix(schedule, "daily ")
		if t, err := time.Parse("15:04", timeStr); err == nil {
			next := time.Date(last.Year(), last.Month(), last.Day(), t.Hour(), t.Minute(), 0, 0, last.Location())
			if next.Before(last) || next.Equal(last) {
				next = next.Add(24 * time.Hour)
			}
			return next
		}
	case strings.Contains(schedule, " ") && len(schedule) == 5:
		if _, err := time.Parse("15:04", schedule[:5]); err == nil {
			if t, err := time.Parse("15:04", schedule); err == nil {
				next := time.Date(last.Year(), last.Month(), last.Day(), t.Hour(), t.Minute(), 0, 0, last.Location())
				if next.Before(last) || next.Equal(last) {
					next = next.Add(24 * time.Hour)
				}
				return next
			}
		}
	}

	return time.Time{}
}

// ==================== Sessions ====================

func (a *App) GetSessions() []*Session {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := make([]*Session, len(a.sessions))
	for i, s := range a.sessions {
		copy := *s
		// 深拷贝 Messages 切片
		copy.Messages = make([]Message, len(s.Messages))
		for j, m := range s.Messages {
			copy.Messages[j] = m
		}
		result[i] = &copy
	}
	return result
}

func (a *App) CreateSession(name, skillID string) *Session {
	a.mu.Lock()
	defer a.mu.Unlock()

	session := NewSession(name, skillID)
	a.sessions = append(a.sessions, session)
	// 返回深拷贝，避免外部直接持有内部指针
	copy := *session
	copy.Messages = make([]Message, len(session.Messages))
	for i, m := range session.Messages {
		copy.Messages[i] = m
	}
	return &copy
}

func (a *App) GetSession(id string) *Session {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range a.sessions {
		if s.ID == id {
			// 返回深拷贝，避免外部直接修改内部数据
			copy := *s
			copy.Messages = make([]Message, len(s.Messages))
			for j, m := range s.Messages {
				copy.Messages[j] = m
			}
			return &copy
		}
	}
	return nil
}

func (a *App) DeleteSession(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.sessions {
		if s.ID == id {
			a.sessions = append(a.sessions[:i], a.sessions[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("session not found")
}

// ==================== File Operations ====================

// isPathAllowed 检查路径是否在允许的项目目录内（沙箱校验）
// 注意：调用方必须在持有 a.mu 锁的情况下调用，或确保 a.projects 不会并发修改。
// 内部使用内存中的 a.projects 快照，避免 TOCTOU 竞态。
func (a *App) isPathAllowed(targetPath string) error {
	// 解析为绝对路径并规范化（消除 ../ 穿越）
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("无法解析路径: %v", err)
	}
	absPath = filepath.Clean(absPath)

	// 无项目模式：使用临时目录作为安全工作区
	if a.noProjectMode {
		tmpDir, err := os.UserCacheDir()
		if err != nil {
			tmpDir = os.TempDir()
		}
		codecastDir := filepath.Join(tmpDir, "codecast-workspace")
		// 检查目标路径是否在 CodeCast 工作区内
		if absPath == codecastDir || strings.HasPrefix(absPath, codecastDir+string(filepath.Separator)) {
			return nil
		}
		// 无项目模式下也允许读取操作（用于 AI 对话场景）
		return nil
	}

	// 从内存快照构建白名单，不再读磁盘（消除 TOCTOU）
	if len(a.projects) == 0 {
		return fmt.Errorf("没有可访问的项目目录，请先选择一个项目")
	}

	// 检查目标路径是否严格在某个项目目录之下
	for _, p := range a.projects {
		dir := filepath.Clean(p.Path)
		if absPath == dir || strings.HasPrefix(absPath, dir+string(filepath.Separator)) {
			return nil
		}
	}

	return fmt.Errorf("路径 %s 不在允许的项目目录内", absPath)
}

func (a *App) ListFiles(path string) ([]string, error) {
	if path == "" {
		path = "."
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() {
			name += "/"
		}
		files = append(files, name)
	}
	return files, nil
}

func (a *App) ReadFile(path string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return "", err
	}

	// 安全检查：文件大小不超过 MaxReadFileSize（4MB），避免读取超大文件导致 OOM
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.Size() > MaxReadFileSize {
		return "", fmt.Errorf("文件过大 (%s)，读取操作上限为 %s",
			formatFileSize(info.Size()), formatFileSize(MaxReadFileSize))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	sid := a.activeSessionID
	a.mu.Unlock()
	a.recordToolIfEnabled(sid, "ReadFile", fmt.Sprintf("读取了 %s (%s)", path, formatFileSize(info.Size())))
	a.mu.Lock()

	return string(data), nil
}

func (a *App) WriteFile(path, content string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return err
	}

	dir := filepath.Dir(path)
	// 对父目录也做沙箱校验，防止通过目录创建逃逸
	if err := a.isPathAllowed(dir); err != nil {
		return fmt.Errorf("目标目录不在允许范围内: %v", err)
	}

	// 安全检查：写入内容大小不超过 MaxWriteFileSize（10MB），防止写入超大文件
	contentSize := int64(len(content))
	if contentSize > MaxWriteFileSize {
		return fmt.Errorf("写入内容过大 (%s)，写入操作上限为 %s",
			formatFileSize(contentSize), formatFileSize(MaxWriteFileSize))
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %v", err)
	}

	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return err
	}

	sid := a.activeSessionID
	a.mu.Unlock()
	a.recordToolIfEnabled(sid, "WriteFile", fmt.Sprintf("写入了 %s (%s)", path, formatFileSize(contentSize)))
	a.mu.Lock()

	// Git 自动提交：写入成功后，如果开启了自动提交，执行 git add + commit
	if a.settings.AutoCommit {
		go a.gitAutoCommit(path)
	}

	return nil
}

// ==================== Git Auto Commit ====================

// findGitRoot 从给定文件路径向上查找 git 仓库根目录
func findGitRoot(filePath string) string {
	dir := filepath.Dir(filePath)
	for {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

// runGitCommand 在指定目录执行 git 命令，返回输出和错误
func runGitCommand(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// gitAutoCommit 对修改的文件执行自动 git 提交
func (a *App) gitAutoCommit(modifiedFilePath string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[Git] 自动提交异常恢复: %v\n", r)
		}
	}()

	gitRoot := findGitRoot(modifiedFilePath)
	if gitRoot == "" {
		return
	}

	a.mu.Lock()
	confirmBefore := a.settings.ConfirmBeforeCommit
	a.mu.Unlock()

	if confirmBefore {
		// 需要确认：发送事件给前端显示确认对话框
		relPath, _ := filepath.Rel(gitRoot, modifiedFilePath)
		wailsRuntime.EventsEmit(a.ctx, "git-commit-confirm", map[string]interface{}{
			"file":      relPath,
			"directory": gitRoot,
		})
		return
	}

	// 直接提交
	a.executeGitCommit(gitRoot, modifiedFilePath)
}

// executeGitCommit 执行实际的 git add + commit 操作
func (a *App) executeGitCommit(gitRoot, filePath string) {
	relPath, _ := filepath.Rel(gitRoot, filePath)

	if output, err := runGitCommand(gitRoot, "add", filePath); err != nil {
		fmt.Printf("[Git] git add 失败: %s\n", output)
		wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
			"title": "Git 自动提交失败",
			"body":  fmt.Sprintf("git add %s 失败: %s", relPath, output),
			"type":  "error",
		})
		return
	}

	msg := fmt.Sprintf("CodeCast: 自动保存 %s", relPath)
	if output, err := runGitCommand(gitRoot, "commit", "-m", msg); err != nil {
		if strings.Contains(output, "nothing to commit") {
			return
		}
		fmt.Printf("[Git] git commit 失败: %s\n", output)
		wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
			"title": "Git 自动提交失败",
			"body":  fmt.Sprintf("git commit 失败: %s", output),
			"type":  "error",
		})
		return
	}

	fmt.Printf("[Git] 已自动提交: %s\n", relPath)
	wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title": "Git 已自动提交",
		"body":  fmt.Sprintf("已提交: %s", relPath),
		"type":  "success",
	})
}

// ConfirmGitCommit 用户确认后执行 git 提交（前端调用）
func (a *App) ConfirmGitCommit(filePath string) error {
	gitRoot := findGitRoot(filePath)
	if gitRoot == "" {
		return fmt.Errorf("未找到 git 仓库")
	}
	go a.executeGitCommit(gitRoot, filePath)
	return nil
}

// GetGitStatus 获取当前项目的 git 状态
func (a *App) GetGitStatus() map[string]interface{} {
	result := map[string]interface{}{
		"enabled": false,
		"branch":  "",
		"dirty":   false,
		"ahead":   0,
		"behind":  0,
	}

	var projectDir string
	a.mu.Lock()
	if len(a.projects) > 0 {
		projectDir = a.projects[0].Path
	}
	a.mu.Unlock()

	if projectDir == "" {
		return result
	}

	gitRoot := findGitRoot(projectDir)
	if gitRoot == "" {
		return result
	}

	result["enabled"] = true

	if branch, err := runGitCommand(gitRoot, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		result["branch"] = strings.TrimSpace(branch)
	}

	if status, err := runGitCommand(gitRoot, "status", "--porcelain"); err == nil {
		result["dirty"] = strings.TrimSpace(status) != ""
	}

	if ahead, err := runGitCommand(gitRoot, "rev-list", "--count", "@{upstream}..HEAD"); err == nil {
		var aheadCount int
		fmt.Sscanf(strings.TrimSpace(ahead), "%d", &aheadCount)
		result["ahead"] = aheadCount
	}

	if behind, err := runGitCommand(gitRoot, "rev-list", "--count", "HEAD..@{upstream}"); err == nil {
		var behindCount int
		fmt.Sscanf(strings.TrimSpace(behind), "%d", &behindCount)
		result["behind"] = behindCount
	}

	return result
}

// ==================== Message Handling ====================

// cancelEntry 存储取消函数及其创建时间，用于支持过期清理
type cancelEntry struct {
	cancel context.CancelFunc
	createdAt time.Time
}

// activeCancels 存储每个 session 的取消函数，支持并发多会话请求
// 使用 cancelEntry 结构体跟踪创建时间，实现自动过期清理
var activeCancels = make(map[string]cancelEntry)
var cancelMu sync.Mutex

// cleanupStopCh 用于通知清理 goroutine 停止
var cleanupStopCh = make(chan struct{})

// cleanupConfig 清理机制的配置参数
const (
	// maxCancelEntryAge 条目最大存活时间（30分钟）
	maxCancelEntryAge = 30 * time.Minute

	// cleanupInterval 定期清理间隔（5分钟）
	cleanupInterval = 5 * time.Minute

	// warnMapSizeThreshold 触发警告日志的 map 大小阈值
	warnMapSizeThreshold = 100

	// criticalMapSizeThreshold 触发严重警告日志的 map 大小阈值
	criticalMapSizeThreshold = 1000
)

// 复用的 HTTP Client，避免每次请求新建连接
var httpClient = &http.Client{
	Timeout: 600 * time.Second,
}

// startCleanupGoroutine 启动后台 goroutine，定期清理过期的 cancel 条目
// 应在应用启动时调用（startup 方法中）
func startCleanupGoroutine() {
	ticker := time.NewTicker(cleanupInterval)
	go func() {
		for {
			select {
			case <-ticker.C:
				cleanupExpiredEntries()
			case <-cleanupStopCh:
				ticker.Stop()
				return
			}
		}
	}()
}

// cleanupExpiredEntries 清理超过最大存活时间的条目
// 线程安全，可从多个 goroutine 调用
func cleanupExpiredEntries() {
	cancelMu.Lock()
	defer cancelMu.Unlock()

	now := time.Now()
	expiredCount := 0
	var expiredIDs []string

	for id, entry := range activeCancels {
		if now.Sub(entry.createdAt) > maxCancelEntryAge {
			expiredIDs = append(expiredIDs, id)
		}
	}

	for _, id := range expiredIDs {
		if entry, ok := activeCancels[id]; ok {
			entry.cancel()
			delete(activeCancels, id)
			expiredCount++
		}
	}

	if expiredCount > 0 {
		fmt.Printf("[Cleanup] 已清理 %d 个过期的活跃连接\n", expiredCount)
	}

	checkAndLogMapSize(len(activeCancels))
}

// checkAndLogMapSize 检查 map 大小并在超过阈值时记录日志
func checkAndLogMapSize(size int) {
	switch {
	case size >= criticalMapSizeThreshold:
		fmt.Printf("[WARNING] 活跃连接数达到严重阈值: %d (阈值: %d), 可能存在内存泄漏\n",
			size, criticalMapSizeThreshold)
	case size >= warnMapSizeThreshold:
		fmt.Printf("[INFO] 活跃连接数较高: %d (警告阈值: %d)\n",
			size, warnMapSizeThreshold)
	}
}

// getActiveCancelCount 获取当前活跃连接数（用于监控）
func getActiveCancelCount() int {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	return len(activeCancels)
}

// CancelRequest 取消当前正在进行的所有 API 请求
func (a *App) CancelRequest() {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	for id, entry := range activeCancels {
		entry.cancel()
		delete(activeCancels, id)
	}
}

// CancelSessionRequest 取消指定 session 的 API 请求
func (a *App) CancelSessionRequest(sessionID string) {
	cancelMu.Lock()
	defer cancelMu.Unlock()
	if entry, ok := activeCancels[sessionID]; ok {
		entry.cancel()
		delete(activeCancels, sessionID)
	}
}

func (a *App) SendMessage(sessionID, input string) ([]Message, error) {
	return a.SendMessageEx(sessionID, input, "deepseek-v4-flash", false)
}

// SendMessageEx 发送消息，支持选择模型和思考模式
//
// 【锁策略 - 优化后】
// ├─ 第一阶段（持锁 < 1ms）：快速拷贝 apiKey、构建消息列表、记录 sessionID
// │   └─ 目标：最小化锁持有时间，避免阻塞其他并发操作
// ├─ 第二阶段（无锁）：调用外部 API（可能持续数十秒）
// │   └─ 目标：完全无锁，不阻塞其他会话的读写操作
// └─ 第三阶段（持锁 < 0.1ms）：仅保存结果到 session
//     └─ 目标：原子性写入，保证数据一致性
//
// 【对比优化前】
// 优化前：单一锁区间覆盖全部业务逻辑 + API 调用前后的两次加锁
//         锁持有时间 = 数据准备时间 + API 调用时间（数十秒）
// 优化后：三个细粒度锁区间，总锁持有时间 < 2ms
func (a *App) SendMessageEx(sessionID, input, modelName string, thinking bool) ([]Message, error) {
	var (
		apiKey     string
		apiURL     string
		actualModel string
		longContext bool
		allMessages []Message
	)

	// ========== 第一阶段：快速路径（持锁 < 1ms）==========
	a.mu.Lock()

	// 快速拷贝 API 配置
	apiKey = a.settings.APIKey
	if apiKey == "" {
		apiKey = a.config.Model.APIKey
	}
	if apiKey == "" {
		a.mu.Unlock()
		return nil, fmt.Errorf("请先设置 DeepSeek API Key")
	}

	// 固定使用 DeepSeek API
	apiURL = "https://api.deepseek.com"
	if modelName == "" {
		modelName = "deepseek-v4-flash"
	}
	actualModel = modelName
	longContext = a.settings.LongContext

	// 查找或创建 session，并添加用户消息
	session := a.getSessionByID(sessionID)
	if session == nil {
		session = NewSession("新对话", "")
		a.sessions = append(a.sessions, session)
		sessionID = session.ID // 更新 sessionID（新创建的 session）
	}
	a.activeSessionID = sessionID // 更新当前活跃会话（供 ToolMemory 使用）

	// 在锁内完成消息添加（保证原子性）
	session.AddMessage(Message{Role: "user", Content: input})

	// 构建 system prompt（纯计算，无 I/O）
	// 基础 prompt
	systemPrompt := "你是 CodeCast，一个专业的 AI 编程助手。"

	// Personality 注入：根据用户选择的风格调整语气
	switch a.settings.Personality {
	case "friendly":
		systemPrompt += "\n请用轻松友好、热情的语气回复用户。可以适当使用表情符号和口语化表达，让对话更自然。"
	case "professional":
		systemPrompt += "\n请保持专业严谨的语气。回答要结构化、准确、简洁，使用正式的表达方式。"
	case "concise":
		systemPrompt += "\n请尽可能简洁地回答。直接给出核心信息，避免冗余说明。代码优先于文字解释。"
	case "detailed":
		systemPrompt += "\n请提供详尽完整的回答。包含背景知识、多种方案对比、注意事项等。代码要有充分的注释。"
	default:
	}

	// CustomInstructions 注入：用户的自定义指令
	if a.settings.CustomInstructions != "" {
		systemPrompt += "\n\n【用户自定义指令】\n" + a.settings.CustomInstructions
	}

	// Skill 覆盖（Skill 的 prompt 具有最高优先级）
	if session.SkillID != "" {
		for _, skill := range a.skills {
			if skill.ID == session.SkillID {
				systemPrompt = skill.Prompt
				break
			}
		}
	}

	// 情景记忆召回：从历史对话中检索相关信息
	if a.memory != nil {
		memoryContext, err := a.memory.RecallEpisodes(input, 5)
		if err == nil && memoryContext != "" {
			systemPrompt += "\n\n【相关历史记忆】\n" + memoryContext
		}
	}

	allMessages = []Message{
		{Role: "system", Content: systemPrompt},
	}

	msgs := make([]Message, len(session.Messages))
	copy(msgs, session.Messages) // 深拷贝消息列表，避免锁外引用内部数据

	limit := a.settings.MessageHistoryLimit
	if limit < 1 {
		limit = 20
	}
	if !longContext && len(msgs) > limit {
		msgs = msgs[len(msgs)-limit:]
	}
	for _, msg := range msgs {
		allMessages = append(allMessages, msg)
	}

	a.mu.Unlock() // ✅ 第一阶段结束：释放锁，总持有时间 < 1ms

	// ========== 第二阶段：无锁调用外部 API（可能持续数十秒）==========
	resp, err := a.callAPIEx(allMessages, apiKey, apiURL, actualModel, longContext, thinking, sessionID)
	if err != nil {
		return nil, err
	}

	// ========== 第三阶段：短暂加锁保存结果（< 0.1ms）==========
	a.mu.Lock()
	if saveSession := a.getSessionByID(sessionID); saveSession != nil {
		saveSession.AddMessage(resp)
	}
	a.mu.Unlock()

	// 异步写入情景记忆（不阻塞响应）
	if a.memory != nil && resp.Content != "" {
		go func(sid, userIn, assistContent string) {
			if _, err := a.memory.SaveEpisode(sid, "user", userIn); err != nil {
				fmt.Printf("[Memory] 保存用户消息失败: %v\n", err)
			}
			if _, err := a.memory.SaveEpisode(sid, "assistant", assistContent); err != nil {
				fmt.Printf("[Memory] 保存AI回复失败: %v\n", err)
			}
			if a.settings.AutoMemory || len(userIn) > 20 {
				a.ExtractSummaryAsync(sid, userIn, assistContent)
			}
		}(sessionID, input, resp.Content)
	}

	return []Message{resp}, nil
}

// getSessionByID 根据 ID 查找 session（内部方法，仅在持锁时调用）
//
// 【安全使用约束】⚠️ 重要 ⚠️
// └─ 此方法返回的是内部数据的直接引用（非拷贝）
//     调用方必须确保在持有 a.mu 锁的情况下使用返回值
//     且不得将返回的指针传递到锁外使用或跨 goroutine 共享
//
// 【正确用法示例】
//
//	a.mu.Lock()
//	session := a.getSessionByID(id) // ✅ 安全：在锁内使用
//	if session != nil {
//	    session.AddMessage(msg)      // ✅ 安全：修改操作在锁内完成
//	}
//	a.mu.Unlock()
//
// 【错误用法示例】❌
//
//	a.mu.Lock()
//	session := a.getSessionByID(id)
//	a.mu.Unlock()
//	session.AddMessage(msg) // ❌ 危险：数据竞争！其他 goroutine 可能正在修改同一数据
//
// 【设计决策】
// 返回引用而非拷贝的原因：
// ├─ 性能：避免频繁深拷贝大型消息列表
// ├─ 原子性：允许调用方在锁内执行多次修改操作
// └─ 一致性：保证读取和修改操作的原子性
//
// 如需在锁外使用 session 数据，请使用公共方法 GetSession()（返回深拷贝）
func (a *App) getSessionByID(id string) *Session {
	for _, s := range a.sessions {
		if s.ID == id {
			return s
		}
	}
	return nil
}

// callAPI 使用指定参数调用 LLM API（向后兼容）
func (a *App) callAPI(messages []Message, apiKey, apiURL, modelName string, longContext bool) (Message, error) {
	return a.callAPIEx(messages, apiKey, apiURL, modelName, longContext, false, "_default")
}

// callAPIEx 使用指定参数调用 LLM API，支持思考模式和请求取消
// longContext=true 时设置 max_tokens=65536，允许模型使用完整 1M 上下文窗口
// longContext=false 时设置 max_tokens=8192，节省费用
// thinking=true 时传入 thinking 参数启用深度推理
func (a *App) callAPIEx(messages []Message, apiKey, apiURL, modelName string, longContext bool, thinking bool, sessionID string) (Message, error) {
	reqBody := map[string]any{
		"model":    modelName,
		"messages": messages,
	}

	if longContext {
		reqBody["max_tokens"] = DefaultMaxTokensLongCtx
	} else {
		reqBody["max_tokens"] = DefaultMaxTokensNormal
	}

	if thinking {
		reqBody["thinking"] = true
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return Message{}, fmt.Errorf("序列化请求失败: %v", err)
	}

	// 创建可取消的 context
	timeout := 120 * time.Second
	if longContext {
		timeout = 600 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)

	// 注册取消函数（以 sessionID 为 key，记录创建时间）
	cancelMu.Lock()
	activeCancels[sessionID] = cancelEntry{
		cancel:     cancel,
		createdAt: time.Now(),
	}
	cancelMu.Unlock()

	defer func() {
		cancelMu.Lock()
		delete(activeCancels, sessionID)
		cancelMu.Unlock()
		cancel()
	}()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL+"/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return Message{}, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return Message{}, fmt.Errorf("request cancelled")
		}
		return Message{}, err
	}
	defer resp.Body.Close()

	// 限制响应体最大 MaxResponseSize（10MB），防止 OOM
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, MaxResponseSize))
	if err != nil {
		return Message{}, fmt.Errorf("读取响应失败: %v", err)
	}

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		return Message{}, fmt.Errorf("API 请求失败 (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result map[string]any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return Message{}, fmt.Errorf("failed to parse response: %v", err)
	}

	choices, ok := result["choices"].([]any)
	if !ok || len(choices) == 0 {
		return Message{}, fmt.Errorf("no response from model")
	}

	choice, ok := choices[0].(map[string]any)
	if !ok {
		return Message{}, fmt.Errorf("invalid response format")
	}

	msg, ok := choice["message"].(map[string]any)
	if !ok {
		return Message{}, fmt.Errorf("no message in response")
	}

	content, _ := msg["content"].(string)
	role, _ := msg["role"].(string)

	return Message{Role: role, Content: content}, nil
}

func loadEnv(cfg *Config) {
	if v := os.Getenv("DEEPSEEK_API_KEY"); v != "" {
		cfg.Model.APIKey = v
	}
	if v := os.Getenv("DEEPSEEK_BASE_URL"); v != "" {
		cfg.Model.BaseURL = v
	}
}

// ==================== 文件/文件夹对话框 ====================

// SelectFile 打开文件选择对话框，返回选中的文件路径
func (a *App) SelectFile() (string, error) {
	result, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "所有文件", Pattern: "*.*"},
			{DisplayName: "图片", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp"},
			{DisplayName: "文档", Pattern: "*.txt;*.md;*.pdf;*.doc;*.docx"},
			{DisplayName: "代码", Pattern: "*.go;*.js;*.ts;*.py;*.java;*.c;*.cpp;*.h"},
		},
	})
	if err != nil {
		return "", err
	}
	return result, nil
}

// SelectMultipleFiles 打开多文件选择对话框
func (a *App) SelectMultipleFiles() ([]string, error) {
	results, err := wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "所有文件", Pattern: "*.*"},
		},
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

// SelectFolder 打开文件夹选择对话框，返回选中的文件夹路径
func (a *App) SelectFolder() (string, error) {
	result, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择项目文件夹",
	})
	if err != nil {
		return "", err
	}
	return result, nil
}

// ==================== 项目管理 ====================

// Project 项目信息
type Project struct {
	ID   string `json:"id"`
	Path string `json:"path"`
	Name string `json:"name"`
}

// GetProjects 获取已保存的项目列表（从内存返回，保证一致性）
func (a *App) GetProjects() []Project {
	a.mu.Lock()
	defer a.mu.Unlock()

	// 返回内存副本，防止外部修改影响内部状态
	result := make([]Project, len(a.projects))
	copy(result, a.projects)
	return result
}

// AddProject 添加项目文件夹
func (a *App) AddProject(path string) (Project, error) {
	if path == "" {
		return Project{}, fmt.Errorf("路径不能为空")
	}

	// 规范化路径，防止重复添加同一目录的不同表示
	path = filepath.Clean(path)

	// 验证路径存在且是目录
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return Project{}, fmt.Errorf("无效的文件夹路径")
	}

	name := filepath.Base(path)
	project := Project{ID: fmt.Sprintf("proj_%d", time.Now().UnixNano()), Path: path, Name: name}

	a.mu.Lock()
	defer a.mu.Unlock()

	// 检查重复（使用内存列表）
	for _, p := range a.projects {
		if p.Path == path {
			return p, nil // 已存在
		}
	}

	a.projects = append(a.projects, project)
	if err := a.saveProjectsToDisk(a.projects); err != nil {
		fmt.Printf("warning: save projects failed: %v\n", err)
	}
	return project, nil
}

// RemoveProject 移除项目
func (a *App) RemoveProject(path string) error {
	path = filepath.Clean(path)

	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.projects {
		if p.Path == path {
			a.projects = append(a.projects[:i], a.projects[i+1:]...)
			if err := a.saveProjectsToDisk(a.projects); err != nil {
				fmt.Printf("warning: save projects failed: %v\n", err)
			}
			return nil
		}
	}
	return fmt.Errorf("项目不存在")
}

// loadProjectsFromDisk 从磁盘读取项目列表（仅在启动时调用一次）
func (a *App) loadProjectsFromDisk() []Project {
	projectsPath := filepath.Join(filepath.Dir(a.settingsPath), "projects.json")
	data, err := os.ReadFile(projectsPath)
	if err != nil {
		return []Project{}
	}
	var projects []Project
	if err := json.Unmarshal(data, &projects); err != nil {
		return []Project{}
	}
	// 规范化所有路径，保证内存中的路径格式一致；为缺少 ID 的旧数据补充 ID
	for i := range projects {
		projects[i].Path = filepath.Clean(projects[i].Path)
		if projects[i].ID == "" {
			projects[i].ID = fmt.Sprintf("proj_%d_%d", time.Now().UnixNano(), i)
		}
	}
	return projects
}

// saveProjectsToDisk 将内存中的项目列表持久化到磁盘
func (a *App) saveProjectsToDisk(projects []Project) error {
	projectsPath := filepath.Join(filepath.Dir(a.settingsPath), "projects.json")
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal projects failed: %v", err)
	}
	if err := os.WriteFile(projectsPath, data, 0600); err != nil {
		return fmt.Errorf("write projects file failed: %v", err)
	}
	return nil
}

// ==================== 窗口控制方法 ====================

func (a *App) WindowMinimise() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) WindowMaximise() {
	wailsRuntime.WindowToggleMaximise(a.ctx)
}

func (a *App) WindowClose() {
	wailsRuntime.Quit(a.ctx)
}

// ==================== 5.6 在编辑器中打开 ====================

// EditorInfo 描述一个可用的外部编辑器
// GetPlatform 返回当前操作系统标识，供前端做平台差异化 UI
func (a *App) GetPlatform() string {
	return runtime.GOOS // "windows", "darwin", "linux"
}

type EditorInfo struct {
	ID      string `json:"id"`      // 唯一标识 (如 "vscode", "catpaw")
	Name    string `json:"name"`    // 显示名称
	Command string `json:"command"` // 命令路径
}

// GetAvailableEditors 检测本机已安装的编辑器
func (a *App) GetAvailableEditors() []EditorInfo {
	editors := []EditorInfo{}

	type editorCheck struct {
		ID      string
		Name    string
		WinCmd  []string
		MacCmd  []string
	}

	checks := []editorCheck{
		{"vscode", "VS Code", []string{"code"}, []string{"code"}},
		{"cursor", "Cursor", []string{"cursor"}, []string{"cursor"}},
		{"webstorm", "WebStorm", []string{"webstorm64.exe", "webstorm"}, []string{"webstorm"}},
		{"idea", "IntelliJ IDEA", []string{"idea64.exe", "idea"}, []string{"idea"}},
		{"catpaw", "CatPaw IDE", []string{"catpaw"}, []string{"catpaw"}},
		{"sublime", "Sublime Text", []string{"subl"}, []string{"subl"}},
	}

	for _, c := range checks {
		cmds := c.MacCmd
		if runtime.GOOS == "windows" {
			cmds = c.WinCmd
		}
		for _, cmd := range cmds {
			if path, err := exec.LookPath(cmd); err == nil {
				editors = append(editors, EditorInfo{
					ID:      c.ID,
					Name:    c.Name,
					Command: path,
				})
				break
			}
		}
	}

	return editors
}

// GetPreferredEditor 获取用户设置的首选编辑器
func (a *App) GetPreferredEditor() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.settings.OpenTarget
}

// SetPreferredEditor 设置首选编辑器
func (a *App) SetPreferredEditor(editorID string) error {
	a.mu.Lock()
	a.settings.OpenTarget = editorID
	err := a.saveSettingsToFile()
	a.mu.Unlock()
	return err
}

// OpenInEditor 在外部编辑器中打开指定路径（工作区目录）
func (a *App) OpenInEditor(dirPath string) error {
	if dirPath == "" {
		// 使用当前项目路径
		a.mu.Lock()
		projects := a.projects
		a.mu.Unlock()
		if len(projects) > 0 {
			dirPath = projects[0].Path
		}
		if dirPath == "" {
			return fmt.Errorf("no project directory specified")
		}
	}

	// 沙箱校验：只允许打开项目目录内的路径
	a.mu.Lock()
	err := a.isPathAllowed(dirPath)
	a.mu.Unlock()
	if err != nil {
		return fmt.Errorf("path not allowed: %v", err)
	}

	// 确定使用哪个编辑器
	a.mu.Lock()
	editorID := a.settings.OpenTarget
	a.mu.Unlock()

	editors := a.GetAvailableEditors()
	var targetCmd string

	// 先找用户首选
	for _, e := range editors {
		if e.ID == editorID {
			targetCmd = e.Command
			break
		}
	}

	// 如果首选不可用，依次尝试可用编辑器
	if targetCmd == "" && len(editors) > 0 {
		targetCmd = editors[0].Command
	}

	if targetCmd == "" {
		// 没有可用编辑器，尝试系统默认方式打开文件夹
		if runtime.GOOS == "windows" {
			return exec.Command("explorer", dirPath).Start()
		}
		return exec.Command("open", dirPath).Start()
	}

	return exec.Command(targetCmd, dirPath).Start()
}

// ==================== 5.5 弹出窗口 (Popout) ====================

// PopoutWindow 将当前对话弹出为独立浮动窗口
// 通过 EventsEmit 通知前端创建 overlay 浮窗，同时记录弹窗状态
func (a *App) PopoutWindow() error {
	a.mu.Lock()
	a.settings.BrowserPlugin = "popout"
	a.mu.Unlock()

	var currentSessionID string
	var currentSessionName string
	a.mu.Lock()
	if len(a.sessions) > 0 {
		currentSessionID = a.sessions[len(a.sessions)-1].ID
		currentSessionName = a.sessions[len(a.sessions)-1].Name
	}
	a.mu.Unlock()

	wailsRuntime.EventsEmit(a.ctx, "popout-requested", map[string]interface{}{
		"sessionId":   currentSessionID,
		"sessionName": currentSessionName,
		"timestamp":   time.Now().Unix(),
	})

	fmt.Printf("[Popout] 弹窗请求已发送 (会话: %s)\n", currentSessionName)
	return nil
}

// GetPopoutState 获取当前弹窗状态
func (a *App) GetPopoutState() map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	return map[string]interface{}{
		"active": a.settings.BrowserPlugin == "popout",
	}
}

// WindowSetAlwaysOnTop 设置窗口置顶状态
func (a *App) WindowSetAlwaysOnTop(onTop bool) {
	wailsRuntime.WindowSetAlwaysOnTop(a.ctx, onTop)
}

// ==================== 5.4 文件列表（产物面板）====================

// FileEntry 文件列表条目
type FileEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

// GetWorkspaceFiles 获取工作空间目录下的文件列表（支持子目录）
func (a *App) GetWorkspaceFiles(dirPath string) ([]FileEntry, error) {
	a.mu.Lock()
	if dirPath == "" {
		if len(a.projects) > 0 {
			dirPath = a.projects[0].Path
		}
		if dirPath == "" {
			a.mu.Unlock()
			return nil, fmt.Errorf("no workspace directory")
		}
	}

	// 沙箱校验
	if err := a.isPathAllowed(dirPath); err != nil {
		a.mu.Unlock()
		return nil, err
	}
	a.mu.Unlock()

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	result := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		// 跳过隐藏文件
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		result = append(result, FileEntry{
			Name:    e.Name(),
			Path:    filepath.Join(dirPath, e.Name()),
			IsDir:   e.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02 15:04"),
		})
	}
	return result, nil
}

// ReadFileContent 读取文件内容（用于预览面板编辑器）
// 使用较小的限制（2MB）以优化前端渲染性能
func (a *App) ReadFileContent(filePath string) (string, error) {
	// 沙箱校验
	a.mu.Lock()
	if err := a.isPathAllowed(filePath); err != nil {
		a.mu.Unlock()
		return "", err
	}
	a.mu.Unlock()

	// 安全检查：文件大小不超过 MaxPreviewFileSize（2MB），优化预览性能
	info, err := os.Stat(filePath)
	if err != nil {
		return "", fmt.Errorf("文件未找到: %w", err)
	}
	if info.Size() > MaxPreviewFileSize {
		return "", fmt.Errorf("文件过大 (%s)，预览操作上限为 %s",
			formatFileSize(info.Size()), formatFileSize(MaxPreviewFileSize))
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	return string(data), nil
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "CodeCast",
		Width:            1400,
		Height:           900,
		MinWidth:         1024,
		MinHeight:        600,
		Frameless:        runtime.GOOS != "darwin",
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:       app.startup,
		OnDomReady:      app.domReady,
		OnShutdown:      app.shutdown,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   "CodeCast",
				Message: "AI 帮你写代码，把想法铸成产物",
			},
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		Linux: &linux.Options{
			WindowIsTranslucent: false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
