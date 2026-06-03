package main

import (
	"fmt"
	"runtime"
	"testing"
)

// ==================== Windows 命令注入漏洞验证测试 ====================

func TestWindowsCommandInjection_VulnerabilityExists(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("此测试仅在 Windows 上运行")
	}

	app := createTestApp()
	app.settings = &Settings{ComputerControl: true}
	tempDir := t.TempDir()
	app.projects = []Project{{Path: tempDir}}

	t.Log("🔍 验证 Issue: 移除 Windows 命令转义增加命令注入风险")

	testCases := []struct {
		name          string
		maliciousCmd  string
		description   string
		expectBlocked bool
	}{
		{
			name:          "管道符注入",
			maliciousCmd:  `echo safe & whoami`,
			description:   "使用 & 连接额外命令",
			expectBlocked: true,
		},
		{
			name:          "OR 运算符注入",
			maliciousCmd:  `echo safe || format C:`,
			description:   "使用 || 在失败时执行危险命令",
			expectBlocked: true,
		},
		{
			name:          "AND 运算符注入",
			maliciousCmd:  `echo safe && del /Q C:\test.txt`,
			description:   "使用 && 成功后执行删除",
			expectBlocked: true,
		},
		{
			name:          "分号命令分隔",
			maliciousCmd:  `echo safe ; shutdown /s /t 0`,
			description:   "使用 ; 分隔多个命令",
			expectBlocked: true,
		},
		{
			name:          "管道重定向",
			maliciousCmd:  `type secret.txt > C:\public\leaked.txt`,
			description:   "使用 > 重定向窃取文件",
			expectBlocked: true,
		},
		{
			name:          "输入重定向",
			maliciousCmd:  `cmd < malicious_input.txt`,
			description:   "使用 < 从恶意文件读取输入",
			expectBlocked: true,
		},
		{
			name:          "反引号命令替换",
			maliciousCmd:  `echo result is ` + "`whoami`",
			description:   "使用反引号执行子命令",
			expectBlocked: true,
		},
		{
			name:          "括号分组攻击",
			maliciousCmd:  `(echo safe & echo hacked)`,
			description:   "使用 () 分组执行多命令",
			expectBlocked: true,
		},
		{
			name:          "百分号环境变量",
			maliciousCmd:  `echo %USERNAME%`,
			description:   "使用 % 读取环境变量（信息泄露）",
			expectBlocked: false, // 环境变量读取可能被允许
		},
	}

	t.Logf("\n📋 测试 %d 种命令注入场景:\n", len(testCases))

	vulnerabilityCount := 0
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := app.ExecuteCommand(tc.maliciousCmd, 5)

			if tc.expectBlocked {
				if err == nil {
					t.Errorf("❌ 安全漏洞! 恶意命令未被拦截:")
					t.Errorf("   命令: %s", tc.maliciousCmd)
					t.Errorf("   描述: %s", tc.description)
					t.Errorf("   输出: %.100s", output)
					vulnerabilityCount++
				} else {
					t.Logf("✅ 已正确拦截: %s", tc.description)
				}
			} else {
				if err != nil {
					t.Logf("⚠️  被拦截 (可接受): %s - %v", tc.description, err)
				} else {
					t.Logf("✅ 允许执行 (预期): %s - 输出: %.50s", tc.description, output)
				}
			}
		})
	}

	if vulnerabilityCount > 0 {
		t.Errorf("\n🚨 发现 %d 个安全漏洞！系统易受 Windows 命令注入攻击！", vulnerabilityCount)
		t.Errorf("\n影响范围:")
		t.Errorf("- 攻击者可通过 AI 对话注入任意命令")
		t.Errorf("- 可导致数据泄露、文件删除、系统破坏")
		t.Errorf("- 子代理工具调用也存在相同风险")
	}
}

func TestChainOperatorsRegex_Coverage(t *testing.T) {
	t.Log("🔍 验证 chainOperators 正则表达式覆盖所有危险字符")

	dangerousChars := []string{
		"&",  // 命令连接
		";",  // 命令分隔
		"|",  // 管道
		"||", // OR 运算符
		"&&", // AND 运算符
		"`",  // 反引号 (cmd.exe)
		"$(", // 命令替换 (bash)
		"<",  // 输入重定向
		">",  // 输出重定向
		">>", // 追加重定向
	}

	unblocked := []string{}

	for _, char := range dangerousChars {
		testCmd := fmt.Sprintf("echo test %s whoami", char)
		if !chainOperators.MatchString(testCmd) {
			unblocked = append(unblocked, fmt.Sprintf("%q → 命令: %s", char, testCmd))
		}
	}

	if len(unblocked) > 0 {
		t.Errorf("⚠️  以下危险字符未被 chainOperators 正则覆盖:")
		for _, u := range unblocked {
			t.Errorf("  - %s", u)
		}
	} else {
		t.Log("✅ 所有危险字符均已被正则表达式覆盖")
		for _, char := range dangerousChars {
			t.Logf("   ✓ %q 已覆盖", char)
		}
	}
}

func TestSanitizeWindowsCommand_Implementation(t *testing.T) {
	t.Log("🛡️ 测试 sanitizeWindowsCommand 函数实现")

	testCases := []struct {
		input    string
		expected string
		desc     string
	}{
		{`echo hello & world`, `echo hello ^& world`, "转义 & 符号"},
		{`echo test | pipe`, `echo test ^| pipe`, "转义 | 符号"},
		{`echo a > b.txt`, `echo a ^> b.txt`, "转义 > 重定向"},
		{`echo a < b.txt`, `echo a ^< b.txt`, "转义 < 重定向"},
		{`echo (grouping)`, `echo ^(grouping^)`, "转义括号"},
		{`echo %VAR%`, `echo %%VAR%%`, "转义环境变量"},
		{`echo normal text`, `echo normal text`, "正常文本不变"},
		{`echo "quoted"`, `echo "quoted"`, "保留引号"},
	}

	for _, tc := range testCases {
		result := sanitizeWindowsCommand(tc.input)
		if result != tc.expected {
			t.Errorf("❌ %s:\n  输入:    %s\n  期望:    %s\n  实际:    %s",
				tc.desc, tc.input, tc.expected, result)
		} else {
			t.Logf("✅ %s: %s → %s", tc.desc, tc.input, result)
		}
	}
}

func TestSecurityDefenseInDepth(t *testing.T) {
	t.Log("🏰 验证纵深防御策略")

	app := createTestApp()
	app.settings = &Settings{ComputerControl: true}
	tempDir := t.TempDir()
	app.projects = []Project{{Path: tempDir}}

	defenseLayers := []struct {
		name     string
		testFunc func() (bool, string)
	}{
		{
			name: "Layer 1: 危险模式检测",
			testFunc: func() (bool, string) {
				_, err := app.ExecuteCommand("rm -rf /", 1)
				return err != nil, "应拦截 rm -rf /"
			},
		},
		{
			name: "Layer 2: 链式操作符检测",
			testFunc: func() (bool, string) {
				_, err := app.ExecuteCommand("echo test & whoami", 1)
				return err != nil, "应拦截 & 操作符"
			},
		},
		{
			name: "Layer 3: Windows 特殊命令检测",
			testFunc: func() (bool, string) {
				_, err := app.ExecuteCommand("format C:", 1)
				return err != nil, "应拦截 format 命令"
			},
		},
			{
				name: "Layer 4: 命令白名单 (子代理)",
				testFunc: func() (bool, string) {
					err := validateCommand("test-agent", AgentModeImplicit, "malware.exe")
					return err != nil, "子代理不应允许未知命令"
				},
			},
	}

	allPassed := true
	for _, layer := range defenseLayers {
		passed, msg := layer.testFunc()
		status := "✅ PASS"
		if !passed {
			status = "❌ FAIL"
			allPassed = false
		}
		t.Logf("%s [%s]: %s", status, layer.name, msg)
	}

	if !allPassed {
		t.Error("🚨 防御层存在缺口，安全策略不完整！")
	}
}

func BenchmarkSanitizeWindowsCommand(b *testing.B) {
	payloads := []string{
		`echo hello & world`,
		`dir | findstr ".go"`,
		`type file.txt > output.txt`,
		`echo test && echo done`,
		`normal command without special chars`,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sanitizeWindowsCommand(payloads[i%len(payloads)])
	}
}
