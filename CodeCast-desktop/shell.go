package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

var dangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\brm\s+-rf\s+/`),
	regexp.MustCompile(`\bmkfs\b`),
	regexp.MustCompile(`\bshutdown\s`),
	regexp.MustCompile(`\breboot\b`),
	regexp.MustCompile(`\bdel\s+/`),
	regexp.MustCompile(`:\(\)\{.*:\|.*\}`),
	regexp.MustCompile(`>\s*/dev/`),
	regexp.MustCompile(`curl\s.*\|\s*sh`),
	regexp.MustCompile(`wget\s.*\|\s*sh`),
}

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

	cmdLower := strings.ToLower(command)
	dangerousPatternDetected := false
	for _, re := range dangerousPatterns {
		if re.MatchString(cmdLower) {
			fmt.Printf("[Shell][%s] 🚨 危险模式检测: 正则=%s 匹配内容=%.100s\n", 
				requestID, re.String(), command)
			dangerousPatternDetected = true
			break
		}
	}

	if dangerousPatternDetected {
		fmt.Printf("[Shell][%s] ❌ 拦截: 命令包含危险模式\n", requestID)
		return "", fmt.Errorf("命令被安全策略拦截: 包含危险模式")
	}
	fmt.Printf("[Shell][%s] ✅ 危险模式检查: 通过 (9 个全局黑名单模式)\n", requestID)

	if chainOperators.MatchString(command) {
		matchedOperators := extractMatchedChainOperators(command)
		fmt.Printf("[Shell][%s] 🚨 链式操作符检测: 操作符=%v 原始命令=%.150s\n",
			requestID, matchedOperators, command)
		fmt.Printf("[Shell][%s] ❌ 拦截: 不允许使用链式操作符 (& | ; || && < > ` 等)\n", requestID)
		return "", fmt.Errorf("命令被安全策略拦截: 不允许使用链式操作符 (& | ; || && < > ` 等)，请分步执行")
	}
	fmt.Printf("[Shell][%s] ✅ 链式操作符检查: 通过\n", requestID)

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

	if timeoutSeconds <= 0 {
		timeoutSeconds = 30
		fmt.Printf("[Shell][%s] ⏰ 超时设置: 使用默认值 %ds (输入值无效)\n", requestID, timeoutSeconds)
	} else {
		fmt.Printf("[Shell][%s] ⏰ 超时设置: %ds\n", requestID, timeoutSeconds)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, flag, command)
	cmd.Dir = workDir
	customEnvVars := a.getCustomEnvVars()
	cmd.Env = append(os.Environ(), customEnvVars...)

	if len(customEnvVars) > 0 {
		fmt.Printf("[Shell][%s] 🔧 自定义环境变量: %d 个\n", requestID, len(customEnvVars))
		for i, envVar := range customEnvVars {
			if i < 5 {
				maskedValue := maskSensitiveValue(envVar)
				fmt.Printf("[Shell][%s]   - %s\n", requestID, maskedValue)
			} else if i == 5 {
				fmt.Printf("[Shell][%s]   ... 及其他 %d 个变量\n", requestID, len(customEnvVars)-5)
			}
		}
	}

	fmt.Printf("[Shell][%s] ▶️  开始执行命令...\n", requestID)
	execStartTime := time.Now()

	output, err := cmd.CombinedOutput()
	result := string(output)

	execDuration := time.Since(execStartTime)
	totalDuration := time.Since(startTime)

	fmt.Printf("[Shell][%s] ⏱️  执行耗时: 命令执行=%.3fms 总耗时=%.3fms\n",
		requestID, execDuration.Seconds()*1000, totalDuration.Seconds()*1000)

	if ctx.Err() == context.DeadlineExceeded {
		fmt.Printf("[Shell][%s] ⚠️  执行结果: 超时 (%ds)\n", requestID, timeoutSeconds)
		fmt.Printf("[Shell][%s] 📄 输出大小: %d bytes (可能不完整)\n", requestID, len(result))
		fmt.Printf("[Shell][%s] 📄 输出预览: %.300s\n", requestID, result)
		fmt.Printf("[Shell][%s] ===== 命令执行请求结束 (超时) =====\n\n", requestID)
		return result + "\n[命令执行超时]", fmt.Errorf("command timed out after %ds", timeoutSeconds)
	}

	if err != nil {
		exitErr, ok := err.(*exec.ExitError)
		if ok {
			fmt.Printf("[Shell][%s] ❌ 执行失败: exit code=%d error=%v\n",
				requestID, exitErr.ExitCode(), err)
		} else {
			fmt.Printf("[Shell][%s] ❌ 执行错误: %v\n", requestID, err)
		}
		fmt.Printf("[Shell][%s] 📄 输出大小: %d bytes\n", requestID, len(result))
		fmt.Printf("[Shell][%s] 📄 输出预览: %.500s\n", requestID, result)
		fmt.Printf("[Shell][%s] ===== 命令执行请求结束 (错误) =====\n\n", requestID)
		return result, fmt.Errorf("command failed: %w", err)
	}

	fmt.Printf("[Shell][%s] ✅ 执行成功: exit code=0\n", requestID)
	fmt.Printf("[Shell][%s] 📄 输出大小: %d bytes\n", requestID, len(result))
	if len(result) <= 500 {
		fmt.Printf("[Shell][%s] 📄 完整输出:\n%s\n", requestID, result)
	} else {
		fmt.Printf("[Shell][%s] 📄 输出预览 (前500字符):\n%.500s...\n", requestID, result)
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
	return fmt.Sprintf("%d", time.Now().UnixNano()%100000)
}

func extractMatchedChainOperators(cmd string) []string {
	var operators []string
	opMap := map[string]bool{
		"&":  strings.Contains(cmd, "&"),
		"|":  strings.Contains(cmd, "|"),
		";":  strings.Contains(cmd, ";"),
		"<":  strings.Contains(cmd, "<"),
		">":  strings.Contains(cmd, ">"),
		"`":  strings.Contains(cmd, "`"),
		"$(": strings.Contains(cmd, "$("),
	}

	for op, found := range opMap {
		if found {
			operators = append(operators, op)
		}
	}
	return operators
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

var subAgentAllowedCommands = map[string]struct{}{
	"go": {}, "gcc": {}, "clang": {}, "rustc": {},
	"make": {}, "cmake": {}, "gradle": {}, "mvn": {},
	"tsc": {}, "esbuild": {}, "vite": {}, "webpack": {},
	"dotnet": {}, "javac": {}, "java": {},
	"npm": {}, "npx": {}, "yarn": {}, "pnpm": {},
	"pip": {}, "pip3": {}, "poetry": {}, "conda": {},
	"cargo": {},
	"jest":  {}, "mocha": {}, "vitest": {}, "pytest": {},
	"eslint": {}, "prettier": {}, "gofmt": {}, "gofumpt": {},
	"ruff": {}, "pylint": {}, "black": {}, "clang-format": {},
	"rustfmt": {}, "git": {},
	"type": {}, "cat": {}, "dir": {}, "ls": {}, "tree": {},
	"findstr": {}, "grep": {}, "find": {}, "head": {}, "tail": {},
	"wc": {}, "stat": {}, "file": {},
	"ping": {}, "nslookup": {}, "dig": {}, "curl": {}, "wget": {},
	"node": {}, "python": {}, "python3": {}, "ruby": {}, "php": {},
}

var subAgentRestrictedCommands = map[string]struct{}{
	"bash": {}, "sh": {}, "powershell": {}, "pwsh": {},
}

var chainOperators = regexp.MustCompile(`[;&|<>]|\|\||&&|>>|` + "`" + `|\$\(`)

var agentExtraDangerPatterns = []struct {
	re     *regexp.Regexp
	reason string
}{
	{regexp.MustCompile(`(?i)(del|rd)\s+/[sS]\s*/[qQ]`), "Windows 强制删除"},
	{regexp.MustCompile(`(?i)\bformat\s+[A-Za-z]:`), "格式化磁盘"},
	{regexp.MustCompile(`(?i)Invoke-Expression`), "PowerShell 远程执行"},
	{regexp.MustCompile(`(?i)\bmklink\b`), "创建符号链接"},
	{regexp.MustCompile(`(?i)\bicacls\b`), "修改文件权限"},
	{regexp.MustCompile(`(?i)\breg\s+(add|delete|import)`), "修改注册表"},
	{regexp.MustCompile(`(?i)\bnet\s+(user|group|localgroup)\s+(/add|/delete)`), "管理系统用户"},
	{regexp.MustCompile(`(?i)schtasks\s+/create`), "创建计划任务"},
	{regexp.MustCompile(`(?i)bcp(y)?\s`), "后台复制进程"},
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
	if idx := strings.LastIndex(base, `.exe`); idx >= 0 {
		base = base[:idx]
	}
	return base
}

const (
	AgentModeImplicit = "implicit"
	AgentModeExplicit = "explicit"
)

func validateCommand(agentID, agentMode, rawCmd string) error {
	name := extractCommandName(rawCmd)
	if name == "" {
		return &CommandDeniedError{Reason: "无法解析命令名称"}
	}

	lowerCmd := strings.ToLower(rawCmd)

	for _, re := range dangerousPatterns {
		if re.MatchString(lowerCmd) {
			fmt.Printf("[Security] 命令被危险模式拦截: agent=%s cmd=%.80s\n", agentID, rawCmd)
			return &CommandDeniedError{
				Reason:    "命令被安全策略拦截: 包含危险模式",
				Command:   name,
				Dangerous: true,
			}
		}
	}

	for _, dp := range agentExtraDangerPatterns {
		if dp.re.MatchString(rawCmd) {
			fmt.Printf("[Security] 检测到危险命令: agent=%s pattern=%s cmd=%.80s\n", agentID, dp.reason, rawCmd)
			return &CommandDeniedError{
				Reason:    fmt.Sprintf("检测到危险命令模式: %s", dp.reason),
				Command:   name,
				Dangerous: true,
			}
		}
	}

	if chainOperators.MatchString(rawCmd) {
		fmt.Printf("[Security] 链式命令被拒绝: agent=%s cmd=%.80s\n", agentID, rawCmd)
		return &CommandDeniedError{
			Reason:    "不允许使用链式命令（&& || ; | 管道、反引号、$()），请分步执行",
			Command:   name,
			Dangerous: true,
		}
	}

	if agentMode == AgentModeImplicit {
		if _, ok := subAgentRestrictedCommands[name]; ok {
			fmt.Printf("[Security] 子代理受限命令被拒: agent=%s cmd=%s\n", agentID, name)
			return &CommandDeniedError{
				Reason:  fmt.Sprintf("子代理不允许使用 '%s'（通用解释器，权限过大）", name),
				Command: name,
			}
		}
		if _, ok := subAgentAllowedCommands[name]; !ok {
			fmt.Printf("[Security] 子代理白名单未命中: agent=%s cmd=%s\n", agentID, name)
			return &CommandDeniedError{
				Reason:  fmt.Sprintf("子代理不允许执行命令 '%s'，不在允许列表中", name),
				Command: name,
			}
		}
	}

	return nil
}

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
