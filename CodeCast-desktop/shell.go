package main

import (
	"context"
	crypto_rand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	ap "agentprimordia/pkg"
)

// globalAPShell 共享的 ap.builtin.Shell 实例（带默认白名单 + 30s 超时）
var globalAPShell = ap.NewShell().WithTimeout(30 * time.Second)

// ==================== Computer Control (Shell Execution) ====================

func (a *App) ExecuteCommand(command string, timeoutSeconds int) (string, error) {
	startTime := time.Now()
	requestID := generateRequestID()

	logEntry := fmt.Sprintf("[Shell][%s] ===== 命令执行请求开始 =====", requestID)
	fmt.Println(logEntry)
	fmt.Printf("[Shell][%s] 参数: command=%.200s timeout=%ds\n", requestID, command, timeoutSeconds)
	fmt.Printf("[Shell][%s] 系统信息: OS=%s PID=%d\n", requestID, runtime.GOOS, os.Getpid())

	a.mu.Lock()
	enabled := a.settings.ComputerControl
	a.mu.Unlock()

	if !enabled {
		fmt.Printf("[Shell][%s] ❌ 拒绝: 计算机控制功能未开启\n", requestID)
		return "", fmt.Errorf("计算机控制功能未开启，请在设置中启用")
	}
	fmt.Printf("[Shell][%s] ✅ 功能检查: 计算机控制已启用\n", requestID)

	var workDir string
	a.mu.Lock()
	if len(a.projects) > 0 {
		workDir = a.projects[0].Path
	}
	noProjectMode := a.noProjectMode
	a.mu.Unlock()

	if workDir == "" && !noProjectMode {
		fmt.Printf("[Shell][%s] ❌ 拒绝: 未选择项目目录 (noProjectMode=%v)\n", requestID, noProjectMode)
		return "", fmt.Errorf("未选择项目目录")
	}
	fmt.Printf("[Shell][%s] 📁 工作目录: %s\n", requestID, workDir)

	// Security validation via AP Sandbox (replaces old dangerousPatterns + chainOperators checks)
	if err := a.validateCommandBridge("codecast:main", AgentModeExplicit, command); err != nil {
		fmt.Printf("[Shell][%s] ❌ 拦截: %v\n", requestID, err)
		return "", err
	}
	fmt.Printf("[Shell][%s] ✅ 安全策略检查: 通过 (AP ACL + Sandbox)\n", requestID)

	originalCommand := command
	command = sanitizeCommandForExecution(command)

	if command != originalCommand {
		fmt.Printf("[Shell][%s] 🔧 命令转义处理:\n", requestID)
		fmt.Printf("[Shell][%s]   原始: %.200s\n", requestID, originalCommand)
		fmt.Printf("[Shell][%s]   转义后: %.200s\n", requestID, command)
	} else {
		fmt.Printf("[Shell][%s] ✅ 命令转义: 无需转义\n", requestID)
	}

	var shell, flag string
	if runtime.GOOS == "windows" {
		// M8 fix: Use PowerShell instead of cmd.exe to avoid %VAR% environment
		// variable expansion. PowerShell uses $env:VAR syntax and does not
		// expand %VAR% patterns, eliminating the information disclosure risk.
		shell = "powershell"
		flag = "-NoProfile -Command"
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
	fmt.Printf("[Shell][%s] 🐚 Shell 配置: shell=%s flag=%s\n", requestID, shell, flag)

	fmt.Printf("[Shell][%s] ⏰ 超时设置: %ds\n", requestID, timeoutSeconds)

	// Use a.ctx as parent so commands are cancelled on app shutdown.
	parentCtx := a.ctx
	if parentCtx == nil {
		parentCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(parentCtx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	// 通过 ap.builtin.Shell.Execute 转发（保留 workDir + env + 超时）
	customEnvVars := a.getCustomEnvVars()

	fmt.Printf("[Shell][%s] ▶️  通过 ap.builtin.Shell 执行...\n", requestID)
	execStartTime := time.Now()

	shellArgs := map[string]any{
		"command":    command,
		"timeout":    timeoutSeconds,
		"workingDir": workDir,
	}
	if len(customEnvVars) > 0 {
		shellArgs["env"] = customEnvVars
		fmt.Printf("[Shell][%s] 🌍 自定义环境变量: %d 个\n", requestID, len(customEnvVars))
	}
	shellArgsJSON, _ := json.Marshal(shellArgs)
	res, err := globalAPShell.Execute(ctx, shellArgsJSON)
	if err != nil {
		return "", fmt.Errorf("ap.builtin.Shell: %w", err)
	}
	result := res.Content

	execDuration := time.Since(execStartTime)
	totalDuration := time.Since(startTime)

	fmt.Printf("[Shell][%s] ⏱️  执行耗时: 命令执行=%.3fms 总耗时=%.3fms\n",
		requestID, execDuration.Seconds()*1000, totalDuration.Seconds()*1000)

	if res.IsError {
		fmt.Printf("[Shell][%s] ❌ ap.Shell 拒绝: %s\n", requestID, truncate(result, 200))
		return result, fmt.Errorf("ap.builtin.Shell refused: %s", result)
	}

	fmt.Printf("[Shell][%s] ✅ 执行成功: exit code=0\n", requestID)
	fmt.Printf("[Shell][%s] 📄 输出大小: %d bytes\n", requestID, len(result))
	// M9 fix: redact potential secrets in logged output. Patterns like API keys,
	// tokens, and passwords are masked before printing to stdout/logs.
	safeResult := redactSensitiveOutput(result)
	if len(safeResult) <= 500 {
		fmt.Printf("[Shell][%s] 📄 完整输出:\n%s\n", requestID, safeResult)
	} else {
		fmt.Printf("[Shell][%s] 📄 输出预览 (前500字符):\n%.500s...\n", requestID, safeResult)
		fmt.Printf("[Shell][%s] ℹ️  完整输出已截断，如需查看完整内容请查看返回值\n", requestID)
	}
	fmt.Printf("[Shell][%s] ===== 命令执行请求结束 (成功) =====\n\n", requestID)

	return result, nil
}

func (a *App) getCustomEnvVars() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	vars := make([]string, 0, len(a.settings.EnvVars))
	for _, ev := range a.settings.EnvVars {
		vars = append(vars, ev.Key+"="+ev.Value)
	}
	return vars
}

func generateRequestID() string {
	b := make([]byte, 8)
	crypto_rand.Read(b)
	return hex.EncodeToString(b)
}

func maskSensitiveValue(envVar string) string {
	parts := strings.SplitN(envVar, "=", 2)
	if len(parts) != 2 {
		return envVar
	}

	key := strings.ToLower(parts[0])
	sensitiveKeys := map[string]bool{
		"password": true, "passwd": true, "secret": true,
		"token": true, "api_key": true, "apikey": true,
		"key": true, "credential": true, "auth": true,
	}

	if sensitiveKeys[key] {
		return fmt.Sprintf("%s=***MASKED***", parts[0])
	}

	value := parts[1]
	if len(value) > 20 {
		return fmt.Sprintf("%s=%s...(%d chars)", parts[0], value[:10], len(value))
	}
	return envVar
}

// redactSensitiveOutput masks patterns that commonly contain secrets in command output.
// M9 fix: prevents API keys, tokens, and passwords from leaking via stdout/logs.
// H16 fix: add defensive bounds checks to prevent slice-out-of-bounds when output
// is modified mid-loop.
func redactSensitiveOutput(output string) string {
	// Redact key=value patterns for sensitive keys
	sensitivePatterns := []string{
		"api_key", "apikey", "API_KEY", "APIKEY",
		"secret", "SECRET", "secret_key", "SECRET_KEY",
		"token", "TOKEN", "access_token", "ACCESS_TOKEN",
		"password", "PASSWORD", "passwd", "PASSWD",
		"Authorization", "authorization",
	}
	for _, key := range sensitivePatterns {
		// Match key=value, key: value, key="value" patterns
		for _, sep := range []string{"=", ": "} {
			prefix := key + sep
			searchFrom := 0
			for searchFrom < len(output) {
				idx := strings.Index(output[searchFrom:], prefix)
				if idx < 0 {
					break
				}
				idx += searchFrom
				// Find end of value (next whitespace or end of string)
				valStart := idx + len(prefix)
				if valStart >= len(output) {
					searchFrom = idx + 1
					continue
				}
				valEnd := valStart
				for valEnd < len(output) && output[valEnd] != ' ' && output[valEnd] != '\n' && output[valEnd] != '\r' && output[valEnd] != '"' {
					valEnd++
				}
				if valEnd > valStart+4 {
					output = output[:valStart] + "***REDACTED***" + output[valEnd:]
					searchFrom = valStart + len("***REDACTED***")
				} else {
					searchFrom = valEnd
				}
			}
		}
	}
	// Redact strings that look like API keys (sk-..., ghp_..., etc.)
	keyPrefixes := []string{"sk-", "ghp_", "gho_", "glpat-", "AKIA"}
	for _, prefix := range keyPrefixes {
		searchFrom := 0
		for searchFrom < len(output) {
			idx := strings.Index(output[searchFrom:], prefix)
			if idx < 0 {
				break
			}
			idx += searchFrom // adjust to absolute position
			end := idx + len(prefix)
			for end < len(output) && end < idx+60 && output[end] != ' ' && output[end] != '\n' && output[end] != '"' && output[end] != '\'' {
				end++
			}
			output = output[:idx] + prefix + "***REDACTED***" + output[end:]
			searchFrom = idx + len(prefix) + len("***REDACTED***")
		}
	}
	return output
}

func extractCommandName(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	if len(cmd) == 0 {
		return ""
	}
	if cmd[0] == '"' || cmd[0] == '\'' {
		end := strings.IndexAny(cmd[1:], `"'`)
		if end == -1 {
			return strings.Trim(cmd, `"'"`)
		}
		return cmd[1 : end+1]
	}
	fields := strings.Fields(cmd)
	if len(fields) == 0 {
		return ""
	}
	base := strings.ToLower(fields[0])
	if idx := strings.LastIndex(base, `\`); idx >= 0 {
		base = base[idx+1:]
	}
	if idx := strings.LastIndex(base, `/`); idx >= 0 {
		base = base[idx+1:]
	}
	base = strings.TrimSuffix(base, ".exe")
	return base
}

const (
	AgentModeImplicit = "implicit"
	AgentModeExplicit = "explicit"
)

type CommandDeniedError struct {
	Reason    string
	Command   string
	Dangerous bool
}

func (e *CommandDeniedError) Error() string {
	return e.Reason
}

// ==================== Command Sanitization ====================

// sanitizePowerShellCommand sanitizes a command for execution under PowerShell.
//
// M8 fix: Replaced sanitizeWindowsCommand (cmd.exe) with this function.
// PowerShell does not expand %VAR% environment variables, eliminating the
// information disclosure risk. Instead, PowerShell uses $env:VAR syntax
// which we explicitly escape to prevent unintended variable expansion.
//
// Key differences from cmd.exe sanitization:
//   - % is NOT an environment variable delimiter (it's the ForEach-Object alias)
//   - $ is the variable prefix ($var, $env:VAR) — must be escaped
//   - Backtick (`) is the escape character — must be escaped
//   - Curly braces {} are script block delimiters — escaped outside quotes
//   - Semicolons ; are statement separators — escaped outside quotes
//   - Pipe | and redirect > < are operators — escaped outside quotes
func sanitizePowerShellCommand(cmd string) string {
	if cmd == "" {
		return cmd
	}

	var result strings.Builder
	result.Grow(len(cmd) + len(cmd)/4) // modest extra capacity for escapes

	inSingleQuote := false
	inDoubleQuote := false

	for i, r := range cmd {
		switch r {
		case '\'':
			inSingleQuote = !inSingleQuote
			result.WriteRune(r)
		case '"':
			if !inSingleQuote {
				inDoubleQuote = !inDoubleQuote
			}
			result.WriteRune(r)
		case '$':
			// Escape $ to prevent PowerShell variable expansion ($var, $env:VAR)
			if !inSingleQuote {
				result.WriteString("`$")
			} else {
				result.WriteRune(r) // single-quoted strings are literal in PowerShell
			}
		case '`':
			// Backtick is PowerShell's escape character; double it to escape
			if !inSingleQuote {
				result.WriteString("``")
			} else {
				result.WriteRune(r)
			}
		case '&':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`&")
			} else {
				result.WriteRune(r)
			}
		case '|':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`|")
			} else {
				result.WriteRune(r)
			}
		case ';':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`;")
			} else {
				result.WriteRune(r)
			}
		case '<':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`<")
			} else {
				result.WriteRune(r)
			}
		case '>':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`>")
			} else {
				result.WriteRune(r)
			}
		case '(':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`(")
			} else {
				result.WriteRune(r)
			}
		case ')':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`)")
			} else {
				result.WriteRune(r)
			}
		case '{':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`{")
			} else {
				result.WriteRune(r)
			}
		case '}':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("`}")
			} else {
				result.WriteRune(r)
			}
		case '\n', '\r':
			result.WriteByte(' ')
		default:
			// % is NOT special in PowerShell (it's the ForEach-Object alias)
			// so we don't need to escape it. This is the key M8 fix.
			result.WriteRune(r)
		}
		_ = i // avoid unused variable warning
	}

	return result.String()
}

// sanitizeWindowsCommand is DEPRECATED. It was used for cmd.exe sanitization
// but had a known vulnerability (M8): %VAR% environment variable expansion
// could not be reliably prevented. Now delegates to sanitizePowerShellCommand.
//
// Deprecated: Use sanitizePowerShellCommand instead.
func sanitizeWindowsCommand(cmd string) string {
	return sanitizePowerShellCommand(cmd)
}

// sanitizeCommandForExecution 根据操作系统选择合适的命令处理策略
func sanitizeCommandForExecution(cmd string) string {
	if runtime.GOOS == "windows" {
		return sanitizePowerShellCommand(cmd)
	}
	return cmd
}
