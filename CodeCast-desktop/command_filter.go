package main

import (
	"fmt"
	"regexp"
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
	"jest": {}, "mocha": {}, "vitest": {}, "pytest": {},
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

var chainOperators = regexp.MustCompile(`[;&|]|\|\||&&|` + "`" + `|\$\(`)

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
