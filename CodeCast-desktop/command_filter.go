package main

import (
	"fmt"
	"regexp"
	"runtime"
	"strings"
)

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

func validateCommand(agent *SubAgent, rawCmd string) error {
	name := extractCommandName(rawCmd)
	if name == "" {
		return &CommandDeniedError{Reason: "无法解析命令名称"}
	}

	lowerCmd := strings.ToLower(rawCmd)

	for _, re := range dangerousPatterns {
		if re.MatchString(lowerCmd) {
			fmt.Printf("[Security] 命令被危险模式拦截: agent=%s cmd=%.80s\n", agent.ID, rawCmd)
			return &CommandDeniedError{
				Reason:    "命令被安全策略拦截: 包含危险模式",
				Command:   name,
				Dangerous: true,
			}
		}
	}

	for _, dp := range agentExtraDangerPatterns {
		if dp.re.MatchString(rawCmd) {
			fmt.Printf("[Security] 检测到危险命令: agent=%s pattern=%s cmd=%.80s\n", agent.ID, dp.reason, rawCmd)
			return &CommandDeniedError{
				Reason:    fmt.Sprintf("检测到危险命令模式: %s", dp.reason),
				Command:   name,
				Dangerous: true,
			}
		}
	}

	if chainOperators.MatchString(rawCmd) {
		fmt.Printf("[Security] 链式命令被拒绝: agent=%s cmd=%.80s\n", agent.ID, rawCmd)
		return &CommandDeniedError{
			Reason:    "不允许使用链式命令（&& || ; | 管道、反引号、$()），请分步执行",
			Command:   name,
			Dangerous: true,
		}
	}

	if agent.Mode == AgentModeImplicit {
		if _, ok := subAgentRestrictedCommands[name]; ok {
			fmt.Printf("[Security] 子代理受限命令被拒: agent=%s cmd=%s\n", agent.ID, name)
			return &CommandDeniedError{
				Reason:  fmt.Sprintf("子代理不允许使用 '%s'（通用解释器，权限过大）", name),
				Command: name,
			}
		}
		if _, ok := subAgentAllowedCommands[name]; !ok {
			fmt.Printf("[Security] 子代理白名单未命中: agent=%s cmd=%s\n", agent.ID, name)
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
