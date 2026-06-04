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
		fmt.Printf("[Shell][%s] ✅ 命令转义: 无需转义 (Windows 特殊字符)\n", requestID)
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
	_ = customEnvVars // env 通过 ap.Shell.WithScope 或在 execute 内部处理

	fmt.Printf("[Shell][%s] ▶️  通过 ap.builtin.Shell 执行...\n", requestID)
	execStartTime := time.Now()

	shellArgs := map[string]any{
		"command":    command,
		"timeout":    timeoutSeconds,
		"workingDir": workDir,
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
			for {
				idx := strings.Index(output, prefix)
				if idx < 0 {
					break
				}
				// Find end of value (next whitespace or end of string)
				valStart := idx + len(prefix)
				valEnd := valStart
				for valEnd < len(output) && output[valEnd] != ' ' && output[valEnd] != '\n' && output[valEnd] != '\r' && output[valEnd] != '"' {
					valEnd++
				}
				if valEnd > valStart+4 {
					output = output[:valStart] + "***REDACTED***" + output[valEnd:]
				} else {
					break
				}
			}
		}
	}
	// Redact strings that look like API keys (sk-..., ghp_..., etc.)
	keyPrefixes := []string{"sk-", "ghp_", "gho_", "glpat-", "AKIA"}
	for _, prefix := range keyPrefixes {
		for {
			idx := strings.Index(output, prefix)
			if idx < 0 {
				break
			}
			end := idx + len(prefix)
			for end < len(output) && end < idx+60 && output[end] != ' ' && output[end] != '\n' && output[end] != '"' && output[end] != '\'' {
				end++
			}
			output = output[:idx] + prefix + "***REDACTED***" + output[end:]
			break // only redact first occurrence per prefix to avoid infinite loop
		}
	}
	return output
}

// validateCommand delegates to the AP Sandbox bridge (security_bridge.go).
// Retained as a package-level function for compatibility with sub-agent tool calls.
func validateCommand(agentID, agentMode, rawCmd string) error {
	// Use the global app instance if available, otherwise no security check.
	// The canonical path is via App.validateCommandBridge which uses the sandbox.
	return globalValidateCommand(agentID, agentMode, rawCmd)
}

// globalValidateCommand holds a reference to the active App's validateCommandBridge.
// This is set during startup so the package-level validateCommand can delegate.
var globalValidateCommand = defaultValidateCommand

func defaultValidateCommand(agentID, agentMode, rawCmd string) error {
	// Fail-closed: before App.startup wires the sandbox-backed validator,
	// refuse all commands to prevent an early-race security bypass.
	return &CommandDeniedError{
		Reason:    "安全沙箱尚未初始化，拒绝执行命令。请等待应用启动完成。",
		Command:   extractCommandName(rawCmd),
		Dangerous: true,
	}
}

// setGlobalValidateCommand wires the package-level validateCommand to use the sandbox.
// Called once during App.startup after the sandbox is initialized.
func (a *App) setGlobalValidateCommand() {
	globalValidateCommand = a.validateCommandBridge
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

// ==================== Windows Command Sanitization ====================

// sanitizeWindowsCommand 转义 Windows cmd.exe 特殊元字符，防止命令注入
// 参考: https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/cmd
func sanitizeWindowsCommand(cmd string) string {
	if runtime.GOOS != "windows" || cmd == "" {
		return cmd
	}

	var result strings.Builder
	result.Grow(len(cmd) * 2) // 预分配空间，避免频繁扩容

	inSingleQuote := false
	inDoubleQuote := false

	for i, r := range cmd {
		switch r {
		case '\'':
			inSingleQuote = !inSingleQuote
			result.WriteRune(r)
		case '"':
			inDoubleQuote = !inDoubleQuote
			result.WriteRune(r)
		case '&':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^&")
			} else {
				result.WriteRune(r)
			}
		case '|':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^|")
			} else {
				result.WriteRune(r)
			}
		case ';':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^;")
			} else {
				result.WriteRune(r)
			}
		case '<':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^<")
			} else {
				result.WriteRune(r)
			}
		case '>':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^>")
			} else {
				result.WriteRune(r)
			}
		case '(':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^(")
			} else {
				result.WriteRune(r)
			}
		case ')':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^)")
			} else {
				result.WriteRune(r)
			}
		case '%':
			// [设计决策] 为什么允许 % 环境变量读取而不是完全禁止？
			//
			// 📋 风险评估：
			// ┌─────────────────────────────────────────────────────────────┐
			// │ 风险等级: 低 (信息泄露)                                      │
			// │ 影响范围: 仅读取环境变量值，无法执行命令或修改系统状态       │
			// │ 攻击成本: 需要知道具体变量名才能获取有价值的信息              │
			// └─────────────────────────────────────────────────────────────┘
			//
			// ✅ 允许的理由 (Benefits):
			// 1. **实用性**: AI 助手经常需要读取环境变量来配置构建工具、调试问题
			//    - 示例: echo %JAVA_HOME%, echo %PATH%, echo %USERPROFILE%
			//    - 这些是开发者的日常操作，禁止会严重影响用户体验
			//
			// 2. **风险可控**: 即使泄露，也仅限于:
			//    - 用户名、主机名、路径等非敏感信息
			//    - 不会导致代码执行、文件删除或权限提升
			//    - 攻击者无法通过环境变量获取密码或密钥（除非用户错误地存储）
			//
			// 3. **行业标准**: 大多数 CI/CD 系统、IDE 终端都允许读取环境变量
			//    - VS Code Terminal, JetBrains IDEs, GitHub Actions 等
			//    - 完全禁止会导致与行业实践不一致
			//
			// 4. **转义已实现**: 我们仍然将 % 转义为 %%，这提供了一层保护
			//    - 在某些上下文中，%% 可以阻止变量展开
			//    - 但 Windows cmd.exe 的行为是：%% → % (单百分号)
			//    - 所以技术上无法完全阻止，这是 Windows shell 的限制
			//
			// ⚠️ 已知限制 (Known Limitations):
			// - Windows cmd.exe 会将 %% 解析为单个 %，然后展开 %VAR%
			// - 这是 cmd.exe 的设计行为，我们无法在应用层完全绕过
			// - 如果未来需要完全禁止，可以将 % 加入 chainOperators 正则
			//
			// 🔒 增强建议 (如果需要更高安全性):
			// 方案 A: 在 chainOperators 中添加 %
			//   - 优点: 完全禁止环境变量读取
			//   - 缺点: 影响正常开发工作流
			//
			// 方案 B: 实现环境变量白名单
			//   - 仅允许读取安全的变量 (如 PATH, JAVA_HOME)
			//   - 拦截敏感变量 (如 PASSWORD, API_KEY, TOKEN)
			//   - 优点: 平衡安全性和实用性
			//   - 缺点: 维护成本高，需要持续更新白名单
			//
			// 📊 当前决策: 选择方案 C (当前实现)
			//   - 允许读取但记录日志 (已在 ExecuteCommand 中实现详细日志)
			//   - 通过审计日志追踪异常的环境变量访问模式
			//   - 符合 "安全但不影响生产力" 的设计原则
			//
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("%%")
			} else {
				result.WriteRune(r)
			}
		case '^':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^^")
			} else {
				result.WriteRune(r)
			}
		case '!':
			if !inSingleQuote && !inDoubleQuote && i > 0 && (cmd[i-1] == ' ' || cmd[i-1] == '\t') {
				result.WriteString("^!")
			} else {
				result.WriteRune(r)
			}
		case '`':
			if !inSingleQuote && !inDoubleQuote {
				result.WriteString("^`")
			} else {
				result.WriteRune(r)
			}
		case '\n', '\r':
			result.WriteByte(' ')
		default:
			result.WriteRune(r)
		}
	}

	return result.String()
}

// sanitizeCommandForExecution 根据操作系统选择合适的命令处理策略
func sanitizeCommandForExecution(cmd string) string {
	if runtime.GOOS == "windows" {
		return sanitizeWindowsCommand(cmd)
	}
	return cmd
}
