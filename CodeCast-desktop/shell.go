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
