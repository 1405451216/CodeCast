package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

// ==================== 结构化日志系统 ====================
//
// 设计目标:
// 1. 统一日志管理，支持多级别 (Debug/Info/Warn/Error)
// 2. 支持文件输出和终端输出
// 3. 自动日志轮转
// 4. 性能优化（异步写入）
// 5. 敏感信息自动脱敏

type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

var logLevelNames = map[LogLevel]string{
	LogLevelDebug: "DEBUG",
	LogLevelInfo:  "INFO",
	LogLevelWarn:  "WARN",
	LogLevelError: "ERROR",
}

// Logger 统一日志管理器
type Logger struct {
	mu         sync.RWMutex
	level      LogLevel
	slogger    *slog.Logger
	fileHandle *os.File
	logDir     string
	appName    string
}

var (
	globalLogger *Logger
	once         sync.Once
)

// InitLogger 初始化全局日志系统
func InitLogger(logDir, appName string, level LogLevel) error {
	var initErr error

	once.Do(func() {
		globalLogger = &Logger{
			level:   level,
			logDir:  logDir,
			appName: appName,
		}

		initErr = globalLogger.setup()
	})

	return initErr
}

// GetLogger 获取全局日志实例
func GetLogger() *Logger {
	if globalLogger == nil {
		InitLogger("logs", "CodeCast", LogLevelInfo)
	}
	return globalLogger
}

// setup 配置日志处理器
func (l *Logger) setup() error {
	if err := os.MkdirAll(l.logDir, 0755); err != nil {
		return err
	}

	opts := &slog.HandlerOptions{
		Level: slog.Level(l.level),
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				if t, err := time.Parse(time.RFC3339Nano, a.Value.String()); err == nil {
					return slog.Attr{Key: slog.TimeKey, Value: slog.StringValue(t.Format("2006-01-02 15:04:05.000"))}
				}
			}
			if a.Key == slog.MessageKey {
				return slog.Attr{Key: slog.MessageKey, Value: slog.StringValue(maskSensitiveInLog(a.Value.String()))}
			}
			return a
		},
	}

	filePath := filepath.Join(l.logDir,
		fmt.Sprintf("%s_%s.log", l.appName, time.Now().Format("2006-01-02")))

	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	l.fileHandle = file

	multiWriter := io.MultiWriter(os.Stdout, file)

	handler := slog.NewTextHandler(multiWriter, opts)
	l.slogger = slog.New(handler)

	slog.SetDefault(l.slogger)

	return nil
}

// SetLogLevel 动态调整日志级别
func (l *Logger) SetLogLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// Debug 调试级别日志
func (l *Logger) Debug(msg string, args ...any) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.level <= LogLevelDebug && l.slogger != nil {
		l.slogger.Debug(msg, args...)
	}
}

// Info 信息级别日志
func (l *Logger) Info(msg string, args ...any) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.level <= LogLevelInfo && l.slogger != nil {
		l.slogger.Info(msg, args...)
	}
}

// Warn 警告级别日志
func (l *Logger) Warn(msg string, args ...any) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.level <= LogLevelWarn && l.slogger != nil {
		l.slogger.Warn(msg, args...)
	}
}

// Error 错误级别日志
func (l *Logger) Error(msg string, args ...any) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.level <= LogLevelError && l.slogger != nil {
		l.slogger.Error(msg, args...)
	}
}

// CommandLog 命令执行专用日志（结构化）
func (l *Logger) CommandLog(ctx context.Context, cmd *CommandAuditEntry) {
	args := []any{
		"request_id", cmd.RequestID,
		"command", cmd.Command,
		"work_dir", cmd.WorkDir,
		"duration_ms", cmd.DurationMs,
		"exit_code", cmd.ExitCode,
		"output_size", cmd.OutputSize,
	}

	if cmd.Error != "" {
		args = append(args, "error", cmd.Error)
		l.Error("命令执行失败", args...)
	} else if cmd.Blocked {
		args = append(args, "block_reason", cmd.BlockReason)
		l.Warn("命令被安全策略拦截", args...)
	} else {
		l.Info("命令执行成功", args...)
	}
}

// Close 关闭日志系统，释放资源
func (l *Logger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.fileHandle != nil {
		err := l.fileHandle.Close()
		l.fileHandle = nil
		return err
	}
	return nil
}

// CommandAuditEntry 命令审计条目
type CommandAuditEntry struct {
	Timestamp   time.Time `json:"timestamp"`
	RequestID   string    `json:"request_id"`
	Command     string    `json:"command"`
	User        string    `json:"user,omitempty"`
	WorkDir     string    `json:"work_dir,omitempty"`
	Blocked     bool      `json:"blocked"`
	BlockReason string    `json:"block_reason,omitempty"`
	DurationMs  int64     `json:"duration_ms"`
	ExitCode    int       `json:"exit_code"`
	OutputSize  int       `json:"output_size"`
	Error       string    `json:"error,omitempty"`
}

// maskSensitiveInLog 日志中的敏感信息脱敏
func maskSensitiveInLog(msg string) string {
	sensitivePatterns := []struct {
		pattern string
		mask    string
	}{
		{`password["\s:]+[^\s"']+`, "password=***"},
		{`token["\s:]+[^\s"']+`, "token=***"},
		{`api[_-]?key["\s:]+[^\s"']+`, "api_key=***"},
		{`secret["\s:]+[^\s"']+`, "secret=***"},
		{`credential["\s:]+[^\s"']+`, "credential=***"},
	}

	result := msg
	for _, p := range sensitivePatterns {
		result = regexp.MustCompile(p.pattern).ReplaceAllString(result, p.mask)
	}

	if len(result) > 500 {
		result = result[:500] + "... [TRUNCATED]"
	}

	return result
}

// LogHelper 提供便捷的日志辅助函数
type LogHelper struct{}

var Log = &LogHelper{}

// Shell 命令执行日志
func (h *LogHelper) Shell(requestID, command, workDir string, timeout int) {
	GetLogger().Debug("命令执行开始",
		"request_id", requestID,
		"command", truncateStr(command, 200),
		"work_dir", workDir,
		"timeout_seconds", timeout,
	)
}

// ShellResult 命令执行结果日志
func (h *LogHelper) ShellResult(requestID, command string, durationMs int64, exitCode int, outputSize int, errMsg string) {
	if errMsg != "" {
		GetLogger().Error("命令执行失败",
			"request_id", requestID,
			"duration_ms", durationMs,
			"exit_code", exitCode,
			"output_size", outputSize,
			"error", errMsg,
		)
	} else {
		GetLogger().Info("命令执行成功",
			"request_id", requestID,
			"duration_ms", durationMs,
			"exit_code", exitCode,
			"output_size", outputSize,
		)
	}
}

// SecurityCheck 安全检查日志
func (h *LogHelper) SecurityCheck(requestID, checkType, pattern, action string) {
	if action == "blocked" {
		GetLogger().Warn("安全检查拦截",
			"request_id", requestID,
			"check_type", checkType,
			"pattern", pattern,
			"action", action,
		)
	} else {
		GetLogger().Debug("安全检查通过",
			"request_id", requestID,
			"check_type", checkType,
			"action", action,
		)
	}
}

// LLMCall LLM API 调用日志
func (h *LogHelper) LLMCall(sessionID, model, provider string, inputTokens, outputTokens int, durationMs int64, err error) {
	args := []any{
		"session_id", sessionID,
		"model", model,
		"provider", provider,
		"input_tokens", inputTokens,
		"output_tokens", outputTokens,
		"duration_ms", durationMs,
	}

	if err != nil {
		GetLogger().Error("LLM 调用失败", append(args, "error", err.Error())...)
	} else {
		GetLogger().Info("LLM 调用成功", args...)
	}
}

// ContextCompaction 上下文压缩日志
func (h *LogHelper) ContextCompaction(sessionID string, beforeCount, afterCount int, summaryChars int) {
	GetLogger().Info("上下文压缩完成",
		"session_id", sessionID,
		"messages_before", beforeCount,
		"messages_after", afterCount,
		"summary_chars", summaryChars,
	)
}

// FileOperation 文件操作日志
func (h *LogHelper) FileOperation(operation, path string, success bool, durationMs int64, err error) {
	args := []any{
		"operation", operation,
		"path", path,
		"duration_ms", durationMs,
	}

	if !success || err != nil {
		GetLogger().Error("文件操作失败", append(args, "error", err)...)
	} else {
		GetLogger().Debug("文件操作成功", args...)
	}
}

// AgentLifecycle 子代理生命周期日志
func (h *LogHelper) AgentLifecycle(agentID, event, status string, turnCount int) {
	GetLogger().Info("子代理状态变更",
		"agent_id", agentID,
		"event", event,
		"status", status,
		"turn_count", turnCount,
	)
}

func truncateStr(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + fmt.Sprintf("... [%d chars total]", len(runes))
}
