package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ==================== 国际化 (i18n) 系统 ====================
//
// 功能:
// 1. 多语言支持 (中文/English)
// 2. 翻译键值管理
// 3. 语言切换
// 4. 插值支持
// 5. 复数形式处理
// 6. 前后端统一接口

type Locale string

const (
	LocaleZhCN Locale = "zh-CN" // 简体中文
	LocaleEnUS Locale = "en-US" // 美式英语
)

var supportedLocales = map[Locale]bool{
	LocaleZhCN: true,
	LocaleEnUS: true,
}

// I18nManager 国际化管理器
type I18nManager struct {
	mu       sync.RWMutex
	current  Locale
	messages map[Locale]map[string]string
	fallback Locale
	loaders  []TranslationLoader
}

type TranslationLoader interface {
	Load(locale Locale) (map[string]string, error)
}

// FileTranslationLoader 文件翻译加载器
type FileTranslationLoader struct {
	basePath string
}

func NewFileTranslationLoader(basePath string) *FileTranslationLoader {
	return &FileTranslationLoader{basePath: basePath}
}

func (l *FileTranslationLoader) Load(locale Locale) (map[string]string, error) {
	filePath := filepath.Join(l.basePath, fmt.Sprintf("messages_%s.json", string(locale)))

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("加载翻译文件失败 %s: %w", filePath, err)
	}

	var messages map[string]string
	if err := json.Unmarshal(data, &messages); err != nil {
		return nil, fmt.Errorf("解析翻译文件失败: %w", err)
	}

	return messages, nil
}

var i18nManager *I18nManager
var i18nOnce sync.Once

// InitI18n 初始化国际化系统
func InitI18n(defaultLocale Locale, fallback Locale, loaders ...TranslationLoader) error {
	var initErr error

	i18nOnce.Do(func() {
		i18nManager = &I18nManager{
			current:  defaultLocale,
			messages: make(map[Locale]map[string]string),
			fallback: fallback,
			loaders:  loaders,
		}

		if len(loaders) == 0 {
			i18nManager.loaders = []TranslationLoader{
				NewFileTranslationLoader("locales"),
			}
		}

		for locale := range supportedLocales {
			messages, loadErr := i18nManager.loadLocale(locale)
			if loadErr != nil {
				slog.Warn("加载语言包失败", "locale", locale, "error", loadErr)
				continue
			}
			i18nManager.messages[locale] = messages
		}

		initErr = nil
	})

	return initErr
}

// GetI18n 获取国际化管理器实例
// Thread-safe: uses i18nOnce to ensure singleton initialization.
func GetI18n() *I18nManager {
	i18nOnce.Do(func() {
		if i18nManager == nil {
			InitI18n(LocaleZhCN, LocaleEnUS)
		}
	})
	return i18nManager
}

// SetLocale 设置当前语言
func (m *I18nManager) SetLocale(locale Locale) error {
	if !supportedLocales[locale] {
		return fmt.Errorf("不支持的语言: %s", locale)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.current = locale
	slog.Info("语言已切换", "locale", locale)

	return nil
}

// GetLocale 获取当前语言
func (m *I18nManager) GetLocale() Locale {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

// T 翻译函数（主要接口）
func T(key string, params ...interface{}) string {
	return GetI18n().Translate(key, params...)
}

// Translate 执行翻译
func (m *I18nManager) Translate(key string, params ...interface{}) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	msg, ok := m.messages[m.current][key]
	if !ok {
		msg, ok = m.messages[m.fallback][key]
		if !ok {
			return key // 返回原始 key 作为降级
		}
	}

	if len(params) > 0 {
		// Recover from fmt.Sprintf panics caused by mismatched format verbs
		// (e.g. template has %d but params contain a string).
		defer func() {
			if r := recover(); r != nil {
				slog.Warn("i18n format error", "key", key, "template", msg, "error", r)
			}
		}()
		return fmt.Sprintf(msg, params...)
	}

	return msg
}

// TranslateWithLocale 使用指定语言翻译
func (m *I18nManager) TranslateWithLocale(locale Locale, key string, params ...interface{}) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	msg, ok := m.messages[locale][key]
	if !ok {
		msg, ok = m.messages[m.fallback][key]
		if !ok {
			return key
		}
	}

	if len(params) > 0 {
		// Recover from fmt.Sprintf panics caused by mismatched format verbs.
		defer func() {
			if r := recover(); r != nil {
				slog.Warn("i18n format error", "key", key, "template", msg, "error", r)
			}
		}()
		return fmt.Sprintf(msg, params...)
	}

	return msg
}

// HasKey 检查翻译键是否存在
func (m *I18nManager) HasKey(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	_, ok := m.messages[m.current][key]
	return ok
}

// GetAvailableLocales 获取所有可用语言
func (m *I18nManager) GetAvailableLocales() []Locale {
	var locales []Locale
	for locale := range supportedLocales {
		if _, exists := m.messages[locale]; exists {
			locales = append(locales, locale)
		}
	}
	return locales
}

// loadLocale 加载指定语言的翻译
func (m *I18nManager) loadLocale(locale Locale) (map[string]string, error) {
	for _, loader := range m.loaders {
		messages, err := loader.Load(locale)
		if err == nil {
			return messages, nil
		}
	}
	return nil, fmt.Errorf("无法加载语言 %s 的翻译", locale)
}

// ==================== 内置翻译消息 ====================
//
// 这些是 CodeCast 的核心翻译，内置到二进制中作为默认值
// 可以通过外部文件覆盖

var builtinTranslations = map[Locale]map[string]string{
	LocaleZhCN: {
		// 通用
		"app.name":        "CodeCast",
		"app.description": "AI 帮你写代码，把想法铸成产物",
		"common.ok":       "确定",
		"common.cancel":   "取消",
		"common.save":     "保存",
		"common.delete":   "删除",
		"common.edit":     "编辑",
		"common.close":    "关闭",
		"common.loading":  "加载中...",
		"common.error":    "错误",
		"common.success":  "成功",
		"common.warning":  "警告",
		"common.confirm":  "确认",
		"common.yes":      "是",
		"common.no":       "否",

		// 错误消息
		"error.network":           "网络错误，请检查连接",
		"error.timeout":           "操作超时，请重试",
		"error.unauthorized":      "未授权，请重新登录",
		"error.forbidden":         "无权限执行此操作",
		"error.not_found":         "资源未找到",
		"error.server":            "服务器内部错误",
		"error.validation":        "输入验证失败",
		"error.file_not_found":    "文件未找到: %s",
		"error.permission_denied": "权限被拒绝",
		"error.disk_full":         "磁盘空间不足",

		// Shell/命令执行
		"shell.executing":            "正在执行命令...",
		"shell.execution_success":    "命令执行成功",
		"shell.execution_failed":     "命令执行失败",
		"shell.execution_timeout":    "命令执行超时 (%d秒)",
		"shell.blocked_dangerous":    "命令被安全策略拦截: 包含危险模式",
		"shell.blocked_chain_ops":    "命令被安全策略拦截: 不允许使用链式操作符 (& | ; || && < > ` 等)",
		"shell.computer_control_off": "计算机控制功能未开启，请在设置中启用",
		"shell.no_project_dir":       "未选择项目目录",

		// 安全相关
		"security.injection_blocked": "已阻止可能的命令注入攻击",
		"security.command_sanitized": "命令已被安全处理",
		"security.audit_logged":      "安全事件已记录",

		// 会话管理
		"session.new":            "新对话",
		"session.rename":         "重命名会话",
		"session.delete_confirm": "确定要删除此会话吗？此操作不可撤销。",
		"session.export_success": "会话导出成功",
		"session.import_success": "会话导入成功",
		"session.clear_confirm":  "确定要清空当前对话吗？",

		// 文件操作
		"file.read_success":     "文件读取成功",
		"file.write_success":    "文件写入成功",
		"file.edit_success":     "文件编辑成功",
		"file.not_in_scope":     "文件不在允许的操作范围内: %s",
		"file.too_large":        "文件过大，建议分块处理",
		"file.permission_error": "文件权限错误",

		// 子代理
		"agent.running":           "子代理运行中...",
		"agent.completed":         "子代理已完成",
		"agent.failed":            "子代理失败",
		"agent.cancelled":         "子代理已取消",
		"agent.queued":            "等待中...",
		"agent.max_turns_reached": "达到最大轮次限制",

		// 上下文管理
		"context.compacted":             "上下文已压缩（早期内容已摘要化）",
		"context.long_mode_enabled":     "长上下文模式已启用",
		"context.token_budget_exceeded": "超出 token 预算",

		// LLM 相关
		"llm.calling":            "正在调用 AI 模型...",
		"llm.response_received":  "收到 AI 响应",
		"llm.tool_call_detected": "检测到工具调用请求",
		"llm.rate_limited":       "API 调用频率受限，请稍后重试",
		"llm.api_error":          "AI API 错误: %s",

		// 更新
		"update.available":         "有新版本可用: v%s",
		"update.downloading":       "正在下载更新...",
		"update.download_complete": "下载完成，准备安装",
		"update.install_restart":   "安装完成，需要重启应用",
		"update.check_failed":      "检查更新失败",
		"update.up_to_date":        "当前已是最新版本",

		// 设置页面
		"settings.general":       "通用设置",
		"settings.model":         "模型配置",
		"settings.security":      "安全设置",
		"settings.advanced":      "高级选项",
		"settings.about":         "关于",
		"settings.saved":         "设置已保存",
		"settings.reset_confirm": "确定要重置所有设置为默认值吗？",

		// UI 组件
		"ui.send":           "发送",
		"ui.stop":           "停止",
		"ui.retry":          "重试",
		"ui.copy":           "复制",
		"ui.paste":          "粘贴",
		"ui.search":         "搜索",
		"ui.filter":         "筛选",
		"ui.sort":           "排序",
		"ui.refresh":        "刷新",
		"ui.more":           "更多",
		"ui.expand":         "展开",
		"ui.collapse":       "收起",
		"ui.drag_to_resize": "拖动调整大小",

		// 提示信息
		"tip.welcome":            "欢迎使用 CodeCast！我可以帮你编写、调试和重构代码。",
		"tip.keyboard_shortcuts": "按 Ctrl+Enter 发送消息，Shift+Enter 换行",
		"tip.context_compaction": "长对话会自动压缩早期内容以节省空间",
		"tip.safety_mode":        "安全模式下部分命令会被限制执行",
	},

	LocaleEnUS: {
		// Common
		"app.name":        "CodeCast",
		"app.description": "AI helps you code, turning ideas into products",
		"common.ok":       "OK",
		"common.cancel":   "Cancel",
		"common.save":     "Save",
		"common.delete":   "Delete",
		"common.edit":     "Edit",
		"common.close":    "Close",
		"common.loading":  "Loading...",
		"common.error":    "Error",
		"common.success":  "Success",
		"common.warning":  "Warning",
		"common.confirm":  "Confirm",
		"common.yes":      "Yes",
		"common.no":       "No",

		// Errors
		"error.network":           "Network error, please check connection",
		"error.timeout":           "Operation timed out, please retry",
		"error.unauthorized":      "Unauthorized, please login again",
		"error.forbidden":         "Permission denied",
		"error.not_found":         "Resource not found",
		"error.server":            "Internal server error",
		"error.validation":        "Validation failed",
		"error.file_not_found":    "File not found: %s",
		"error.permission_denied": "Permission denied",
		"error.disk_full":         "Disk full",

		// Shell
		"shell.executing":            "Executing command...",
		"shell.execution_success":    "Command executed successfully",
		"shell.execution_failed":     "Command execution failed",
		"shell.execution_timeout":    "Command timed out (%d seconds)",
		"shell.blocked_dangerous":    "Command blocked by security policy: dangerous pattern detected",
		"shell.blocked_chain_ops":    "Command blocked by security policy: chain operators not allowed (& | ; || && < > ` etc.)",
		"shell.computer_control_off": "Computer control is disabled, please enable in settings",
		"shell.no_project_dir":       "No project directory selected",

		// Security
		"security.injection_blocked": "Potential command injection blocked",
		"security.command_sanitized": "Command has been sanitized",
		"security.audit_logged":      "Security event logged",

		// Session
		"session.new":            "New Chat",
		"session.rename":         "Rename Session",
		"session.delete_confirm": "Are you sure you want to delete this session? This cannot be undone.",
		"session.export_success": "Session exported successfully",
		"session.import_success": "Session imported successfully",
		"session.clear_confirm":  "Are you sure you want to clear the current conversation?",

		// File Operations
		"file.read_success":     "File read successfully",
		"file.write_success":    "File written successfully",
		"file.edit_success":     "File edited successfully",
		"file.not_in_scope":     "File not in allowed scope: %s",
		"file.too_large":        "File too large, consider processing in chunks",
		"file.permission_error": "File permission error",

		// Agent
		"agent.running":           "Agent running...",
		"agent.completed":         "Agent completed",
		"agent.failed":            "Agent failed",
		"agent.cancelled":         "Agent cancelled",
		"agent.queued":            "Queued...",
		"agent.max_turns_reached": "Maximum turns reached",

		// Context
		"context.compacted":             "Context compacted (early content summarized)",
		"context.long_mode_enabled":     "Long context mode enabled",
		"context.token_budget_exceeded": "Token budget exceeded",

		// LLM
		"llm.calling":            "Calling AI model...",
		"llm.response_received":  "AI response received",
		"llm.tool_call_detected": "Tool call request detected",
		"llm.rate_limited":       "API rate limited, please try again later",
		"llm.api_error":          "AI API error: %s",

		// Update
		"update.available":         "New version available: v%s",
		"update.downloading":       "Downloading update...",
		"update.download_complete": "Download complete, preparing install",
		"update.install_restart":   "Installation complete, restart required",
		"update.check_failed":      "Failed to check for updates",
		"update.up_to_date":        "You're on the latest version",

		// Settings
		"settings.general":       "General",
		"settings.model":         "Model",
		"settings.security":      "Security",
		"settings.advanced":      "Advanced",
		"settings.about":         "About",
		"settings.saved":         "Settings saved",
		"settings.reset_confirm": "Reset all settings to defaults?",

		// UI Components
		"ui.send":           "Send",
		"ui.stop":           "Stop",
		"ui.retry":          "Retry",
		"ui.copy":           "Copy",
		"ui.paste":          "Paste",
		"ui.search":         "Search",
		"ui.filter":         "Filter",
		"ui.sort":           "Sort",
		"ui.refresh":        "Refresh",
		"ui.more":           "More",
		"ui.expand":         "Expand",
		"ui.collapse":       "Collapse",
		"ui.drag_to_resize": "Drag to resize",

		// Tips
		"tip.welcome":            "Welcome to CodeCast! I can help you write, debug and refactor code.",
		"tip.keyboard_shortcuts": "Press Ctrl+Enter to send, Shift+Enter for new line",
		"tip.context_compaction": "Long conversations are automatically compacted to save space",
		"tip.safety_mode":        "Some commands are restricted in safety mode",
	},
}

// LoadBuiltinTranslations 加载内置翻译
func LoadBuiltinTranslations() {
	if i18nManager == nil {
		return
	}

	i18nManager.mu.Lock()
	defer i18nManager.mu.Unlock()

	for locale, translations := range builtinTranslations {
		if _, exists := i18nManager.messages[locale]; !exists {
			i18nManager.messages[locale] = translations
		} else {
			for key, value := range translations {
				if _, keyExists := i18nManager.messages[locale][key]; !keyExists {
					i18nManager.messages[locale][key] = value
				}
			}
		}
	}
}

// GenerateLocaleFiles 生成本地化文件（用于前端）
func GenerateLocaleFiles(outputDir string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	for locale, translations := range builtinTranslations {
		data, err := json.MarshalIndent(translations, "", "  ")
		if err != nil {
			return fmt.Errorf("序列化 %s 失败: %w", locale, err)
		}

		filePath := filepath.Join(outputDir, fmt.Sprintf("messages_%s.json", string(locale)))
		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return fmt.Errorf("写入 %s 失败: %w", filePath, err)
		}

		slog.Info("生成本地化文件", "locale", locale, "path", filePath)
	}

	return nil
}

// DetectLocaleFromSystem 从系统检测语言偏好
func DetectLocaleFromSystem() Locale {
	// Try platform-specific detection first (Windows API / Unix env vars)
	locale := detectSystemLocale()
	if locale != "" {
		return locale
	}

	// Fallback: Unix environment variables
	lang := os.Getenv("LANG")
	if lang == "" {
		lang = os.Getenv("LC_ALL")
	}
	if lang == "" {
		lang = os.Getenv("LANGUAGE")
	}

	return localeFromLangString(lang)
}

// localeFromLangString maps a LANG/LC_ALL string to a Locale.
func localeFromLangString(lang string) Locale {
	langLower := strings.ToLower(lang)
	switch {
	case strings.HasPrefix(langLower, "zh"):
		return LocaleZhCN
	case strings.HasPrefix(langLower, "en"):
		return LocaleEnUS
	default:
		return LocaleZhCN // 默认中文
	}
}

// FormatPlural 处理复数形式
func (m *I18nManager) FormatPlural(key string, count int, params ...interface{}) string {
	singularKey := fmt.Sprintf("%s.one", key)
	pluralKey := fmt.Sprintf("%s.other", key)

	if count == 1 {
		if m.HasKey(singularKey) {
			return m.Translate(singularKey, append([]interface{}{count}, params...)...)
		}
	}

	if m.HasKey(pluralKey) {
		return m.Translate(pluralKey, append([]interface{}{count}, params...)...)
	}

	return m.Translate(key, append([]interface{}{count}, params...)...)
}
