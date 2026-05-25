package main

import (
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

// ==================== HTTP 客户端配置 ====================
//
// 优化目标:
// 1. 提升并发性能（连接复用、连接池）
// 2. 支持代理配置
// 3. TLS 优化
// 4. 超时精细化控制

type HTTPConfig struct {
	MaxIdleConns          int           `yaml:"max_idle_conns"`          // 最大空闲连接数 (默认: 100)
	MaxIdleConnsPerHost   int           `yaml:"max_idle_conns_per_host"` // 每主机最大空闲连接 (默认: 30)
	MaxConnsPerHost       int           `yaml:"max_conns_per_host"`      // 每主机最大连接数 (默认: 30)
	IdleConnTimeout       time.Duration `yaml:"idle_conn_timeout"`       // 空闲连接超时 (默认: 120s)
	TLSHandshakeTimeout   time.Duration `yaml:"tls_handshake_timeout"`   // TLS 握手超时 (默认: 10s)
	ResponseHeaderTimeout time.Duration `yaml:"response_header_timeout"` // 响应头超时 (默认: 30s)
	ExpectContinueTimeout time.Duration `yaml:"expect_continue_timeout"` // 100-continue 超时 (默认: 2s)
	ForceAttemptHTTP2     bool          `yaml:"force_attempt_http2"`     // 强制 HTTP/2 (默认: true)
	KeepAlive             bool          `yaml:"keep_alive"`              // 长连接 (默认: true)
	ProxyURL              string        `yaml:"proxy_url,omitempty"`     // 代理地址 (可选)
	InsecureSkipVerify    bool          `yaml:"insecure_skip_verify"`    // 跳过 TLS 验证 (不推荐，仅测试用)
}

// DefaultHTTPConfig 返回默认的 HTTP 配置
func DefaultHTTPConfig() *HTTPConfig {
	return &HTTPConfig{
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   30,
		MaxConnsPerHost:       30,
		IdleConnTimeout:       120 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 2 * time.Second,
		ForceAttemptHTTP2:     true,
		KeepAlive:             true,
	}
}

// NewOptimizedHTTPClient 创建优化的 HTTP 客户端
func NewOptimizedHTTPClient(config *HTTPConfig) *http.Client {
	if config == nil {
		config = DefaultHTTPConfig()
	}

	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          config.MaxIdleConns,
		MaxIdleConnsPerHost:   config.MaxIdleConnsPerHost,
		MaxConnsPerHost:       config.MaxConnsPerHost,
		IdleConnTimeout:       config.IdleConnTimeout,
		TLSHandshakeTimeout:   config.TLSHandshakeTimeout,
		ResponseHeaderTimeout: config.ResponseHeaderTimeout,
		ExpectContinueTimeout: config.ExpectContinueTimeout,
		ForceAttemptHTTP2:     config.ForceAttemptHTTP2,
		DisableKeepAlives:     !config.KeepAlive,
		TLSClientConfig: &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: config.InsecureSkipVerify,
		},
	}

	client := &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("stopped after 10 redirects")
			}
			return nil
		},
	}

	return client
}

// ==================== 应用配置外部化 ====================
//
// 配置文件格式: YAML
// 位置: <dataDir>/config.yaml 或环境变量覆盖

type SystemConfig struct {
	Server   ServerConfig   `yaml:"server"`
	LLM      LLMConfig      `yaml:"llm"`
	Security SecurityConfig `yaml:"security"`
	Context  ContextConfig  `yaml:"context"`
	Logging  LoggingConfig  `yaml:"logging"`
	Audit    AuditConfig    `yaml:"audit"`
	HTTP     HTTPConfig     `yaml:"http"`
}

type ServerConfig struct {
	Port              int    `yaml:"port"`
	Host              string `yaml:"host"`
	Mode              string `yaml:"mode"` // "production" or "development"
	DataDir           string `yaml:"data_dir"`
	MaxConcurrency    int    `yaml:"max_concurrency"`
	RequestTimeoutSec int    `yaml:"request_timeout_sec"`
}

type LLMConfig struct {
	DefaultProvider string                    `yaml:"default_provider"`
	DefaultModel    string                    `yaml:"default_model"`
	Providers       map[string]ProviderConfig `yaml:"providers"`
	RetryPolicy     RetryPolicyConfig         `yaml:"retry_policy"`
}

type ProviderConfig struct {
	APIURL      string  `yaml:"api_url"`
	APIKey      string  `yaml:"api_key"` // 可使用 ${ENV_VAR} 引用环境变量
	Model       string  `yaml:"model"`
	MaxTokens   int     `yaml:"max_tokens"`
	Temperature float64 `yaml:"temperature"`
}

type RetryPolicyConfig struct {
	MaxRetries      int           `yaml:"max_retries"`
	InitialDelay    time.Duration `yaml:"initial_delay"`
	MaxDelay        time.Duration `yaml:"max_delay"`
	Multiplier      float64       `yaml:"multiplier"`
	RetryableErrors []string      `yaml:"retryable_errors"`
}

type SecurityConfig struct {
	CommandFilterEnabled  bool     `yaml:"command_filter_enabled"`
	DangerousPatterns     []string `yaml:"dangerous_patterns"`
	ChainOperatorsBlocked bool     `yaml:"chain_operators_blocked"`
	AllowedEnvVars        []string `yaml:"allowed_env_vars"`
	BlockedEnvVars        []string `yaml:"blocked_env_vars"`
	SandboxEnabled        bool     `yaml:"sandbox_enabled"`
	MaxCommandLength      int      `yaml:"max_command_length"`
	CommandTimeoutSec     int      `yaml:"command_timeout_sec"`
}

type ContextConfig struct {
	TokenBudget          int  `yaml:"token_budget"`
	CompactionThreshold  int  `yaml:"compaction_threshold"`
	CompactionKeepRecent int  `yaml:"compaction_keep_recent"`
	MessageHistoryLimit  int  `yaml:"message_history_limit"`
	LongContextEnabled   bool `yaml:"long_context_enabled"`
	MemoryRecallEpisodes int  `yaml:"memory_recall_episodes"`
}

type LoggingConfig struct {
	Level      string `yaml:"level"`  // "debug", "info", "warn", "error"
	Output     string `yaml:"output"` // "stdout", "file", "both"
	LogDir     string `yaml:"log_dir"`
	MaxSizeMB  int    `yaml:"max_size_mb"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAgeDays int    `yaml:"max_age_days"`
	Compress   bool   `yaml:"compress"`
	JSONFormat bool   `yaml:"json_format"`
}

type AuditConfig struct {
	Enabled       bool   `yaml:"enabled"`
	LogDir        string `yaml:"log_dir"`
	RetainDays    int    `yaml:"retain_days"`
	SensitiveMask bool   `yaml:"sensitive_mask"`
}

var globalConfig *SystemConfig
var configOnce sync.Once

// LoadConfig 加载应用配置
func LoadConfig(configPath string) (*SystemConfig, error) {
	var err error

	configOnce.Do(func() {
		globalConfig = &SystemConfig{}

		data, readErr := os.ReadFile(configPath)
		if readErr != nil {
			if os.IsNotExist(readErr) {
				globalConfig = defaultConfig()
				err = saveDefaultConfig(configPath, globalConfig)
				return
			}
			err = readErr
			return
		}

		envExpanded := expandEnvVars(string(data))
		if yamlErr := yaml.Unmarshal([]byte(envExpanded), globalConfig); yamlErr != nil {
			err = fmt.Errorf("解析配置文件失败: %w", yamlErr)
			return
		}

		applyEnvOverrides(globalConfig)
	})

	if err != nil {
		return nil, err
	}

	return globalConfig, nil
}

// GetConfig 获取全局配置（懒加载）
func GetConfig() *SystemConfig {
	if globalConfig == nil {
		configPath := filepath.Join("data", "config.yaml")
		cfg, _ := LoadConfig(configPath)
		if cfg == nil {
			cfg = defaultConfig()
		}
		globalConfig = cfg
	}
	return globalConfig
}

// defaultConfig 创建默认配置
func defaultConfig() *SystemConfig {
	return &SystemConfig{
		Server: ServerConfig{
			Port:              0,
			Host:              "localhost",
			Mode:              "development",
			DataDir:           "data",
			MaxConcurrency:    10,
			RequestTimeoutSec: 120,
		},
		LLM: LLMConfig{
			DefaultProvider: "openai",
			DefaultModel:    "gpt-4o-mini",
			RetryPolicy: RetryPolicyConfig{
				MaxRetries:      3,
				InitialDelay:    1 * time.Second,
				MaxDelay:        30 * time.Second,
				Multiplier:      2.0,
				RetryableErrors: []string{"429", "500", "502", "503", "504"},
			},
		},
		Security: SecurityConfig{
			CommandFilterEnabled:  true,
			ChainOperatorsBlocked: true,
			SandboxEnabled:        true,
			MaxCommandLength:      10000,
			CommandTimeoutSec:     60,
		},
		Context: ContextConfig{
			TokenBudget:          120000,
			CompactionThreshold:  30,
			CompactionKeepRecent: 8,
			MessageHistoryLimit:  20,
			MemoryRecallEpisodes: 5,
		},
		Logging: LoggingConfig{
			Level:      "info",
			Output:     "both",
			LogDir:     "logs",
			MaxSizeMB:  100,
			MaxBackups: 7,
			MaxAgeDays: 30,
			Compress:   true,
			JSONFormat: false,
		},
		Audit: AuditConfig{
			Enabled:       true,
			LogDir:        "audit",
			RetainDays:    90,
			SensitiveMask: true,
		},
		HTTP: *DefaultHTTPConfig(),
	}
}

// saveDefaultConfig 保存默认配置到文件
func saveDefaultConfig(path string, cfg *SystemConfig) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	commentedYaml := addYAMLComments(data)
	return os.WriteFile(path, commentedYaml, 0644)
}

// expandEnvVars 展开配置中的环境变量引用 (${VAR} 或 $VAR)
func expandEnvVars(s string) string {
	return os.Expand(s, func(key string) string {
		val := os.Getenv(key)
		if val == "" {
			return "${" + key + "}"
		}
		return val
	})
}

// applyEnvOverrides 使用环境变量覆盖配置
func applyEnvOverrides(cfg *SystemConfig) {
	if port := os.Getenv("CODECAST_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &cfg.Server.Port)
	}
	if mode := os.Getenv("CODECAST_MODE"); mode != "" {
		cfg.Server.Mode = mode
	}
	if logLevel := os.Getenv("CODECAST_LOG_LEVEL"); logLevel != "" {
		cfg.Logging.Level = logLevel
	}
	if dataDir := os.Getenv("CODECAST_DATA_DIR"); dataDir != "" {
		cfg.Server.DataDir = dataDir
	}
}

// addYAMLComments 为 YAML 添加注释
func addYAMLComments(data []byte) []byte {
	header := `# CodeCast Configuration File
# Generated automatically - feel free to customize

# Server settings
`
	return append([]byte(header), data...)
}

// ReloadConfig 热重载配置（无需重启）
func ReloadConfig() error {
	configPath := filepath.Join(GetConfig().Server.DataDir, "config.yaml")
	newCfg, err := LoadConfig(configPath)
	if err != nil {
		return err
	}

	globalConfig = newCfg
	slog.Info("配置已重载", "path", configPath)

	return nil
}

// ValidateConfig 验证配置有效性
func ValidateConfig(cfg *SystemConfig) []string {
	var issues []string

	if cfg.Server.MaxConcurrency < 1 || cfg.Server.MaxConcurrency > 100 {
		issues = append(issues, "Server.MaxConcurrency 应在 1-100 范围内")
	}

	if cfg.Context.TokenBudget < 1000 {
		issues = append(issues, "Context.TokenBudget 至少为 1000")
	}

	if cfg.Security.CommandTimeoutSec < 1 || cfg.Security.CommandTimeoutSec > 600 {
		issues = append(issues, "Security.CommandTimeoutSec 应在 1-600 秒范围内")
	}

	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if !validLevels[cfg.Logging.Level] {
		issues = append(issues, fmt.Sprintf("Logging.Level 无效值: %s (应为 debug/info/warn/error)", cfg.Logging.Level))
	}

	return issues
}
