package main

import (
	"fmt"
	"runtime"
	"testing"

	ap "agentprimordia/pkg"
)

// ==================== Windows Command Injection Verification Tests ====================

func TestWindowsCommandInjection_VulnerabilityExists(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("This test only runs on Windows")
	}

	app := createTestApp()
	app.settings = &Settings{ComputerControl: true}
	tempDir := t.TempDir()
	app.projects = []Project{{Path: tempDir}}
	app.acl = setupSecurityACL([]string{tempDir})
	app.sandbox = setupSecuritySandbox(app.acl)
	app.setGlobalValidateCommand()

	t.Log("Verifying: removing Windows command escaping increases injection risk")

	testCases := []struct {
		name          string
		maliciousCmd  string
		description   string
		expectBlocked bool
	}{
		{
			name:          "pipe injection",
			maliciousCmd:  `echo safe & whoami`,
			description:   "using & to chain extra command",
			expectBlocked: true,
		},
		{
			name:          "OR operator injection",
			maliciousCmd:  `echo safe || format C:`,
			description:   "using || to execute dangerous command on failure",
			expectBlocked: true,
		},
		{
			name:          "AND operator injection",
			maliciousCmd:  `echo safe && del /Q C:\test.txt`,
			description:   "using && to delete after success",
			expectBlocked: true,
		},
		{
			name:          "semicolon command separator",
			maliciousCmd:  `echo safe ; shutdown /s /t 0`,
			description:   "using ; to separate commands",
			expectBlocked: true,
		},
		{
			name:          "pipe redirect",
			maliciousCmd:  `type secret.txt > C:\public\leaked.txt`,
			description:   "using > redirect to steal file",
			expectBlocked: true,
		},
		{
			name:          "input redirect",
			maliciousCmd:  `cmd < malicious_input.txt`,
			description:   "using < to read from malicious file",
			expectBlocked: true,
		},
		{
			name:          "backtick command substitution",
			maliciousCmd:  `echo result is ` + "`whoami`",
			description:   "using backtick to execute subcommand",
			expectBlocked: true,
		},
		{
			name:          "parentheses grouping attack",
			maliciousCmd:  `(echo safe & echo hacked)`,
			description:   "using () to group multiple commands",
			expectBlocked: true,
		},
		{
			name:          "percent env variable",
			maliciousCmd:  `echo %USERNAME%`,
			description:   "using % to read env variable (info leak)",
			expectBlocked: false, // env variable reads may be allowed
		},
	}

	t.Logf("Testing %d command injection scenarios:", len(testCases))

	vulnerabilityCount := 0
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := app.ExecuteCommand(tc.maliciousCmd, 5)

			if tc.expectBlocked {
				if err == nil {
					t.Errorf("SECURITY VULNERABILITY! Malicious command not blocked:")
					t.Errorf("   Command: %s", tc.maliciousCmd)
					t.Errorf("   Description: %s", tc.description)
					t.Errorf("   Output: %.100s", output)
					vulnerabilityCount++
				} else {
					t.Logf("Correctly blocked: %s", tc.description)
				}
			} else {
				if err != nil {
					t.Logf("Blocked (acceptable): %s - %v", tc.description, err)
				} else {
					t.Logf("Allowed (expected): %s - output: %.50s", tc.description, output)
				}
			}
		})
	}

	if vulnerabilityCount > 0 {
		t.Errorf("Found %d security vulnerabilities! System is vulnerable to Windows command injection!", vulnerabilityCount)
	}
}

func TestChainOperatorsRegex_Coverage(t *testing.T) {
	t.Parallel()
	t.Log("Verify AP Sandbox dangerous character detection covers all shell metacharacters")

	acl := setupSecurityACL([]string{"/tmp/project"})
	sb := setupSecuritySandbox(acl)

	dangerousChars := []string{
		"&",  // command chaining
		";",  // command separator
		"|",  // pipe
		"||", // OR operator
		"&&", // AND operator
		"`",  // backtick (cmd.exe)
		"$(", // command substitution (bash)
		"<",  // input redirect
		">",  // output redirect
		">>", // append redirect
	}

	unblocked := []string{}

	for _, char := range dangerousChars {
		testCmd := fmt.Sprintf("echo test %s whoami", char)
		if err := sb.CanExecute("agent:test", testCmd); err == nil {
			unblocked = append(unblocked, fmt.Sprintf("%q -> command: %s", char, testCmd))
		}
	}

	if len(unblocked) > 0 {
		t.Errorf("The following dangerous characters are NOT blocked by AP Sandbox:")
		for _, u := range unblocked {
			t.Errorf("  - %s", u)
		}
	} else {
		t.Log("All dangerous characters are blocked by AP Sandbox")
		for _, char := range dangerousChars {
			t.Logf("   %q covered", char)
		}
	}
}

func TestSanitizeWindowsCommand_Implementation(t *testing.T) {
	t.Parallel()
	t.Log("Testing sanitizeWindowsCommand implementation (now delegates to PowerShell sanitizer)")

	// M8 fix: sanitizeWindowsCommand now delegates to sanitizePowerShellCommand.
	// PowerShell uses backtick (`) as escape character instead of caret (^).
	// % is NOT a variable delimiter in PowerShell, so it passes through unchanged.
	testCases := []struct {
		input    string
		expected string
		desc     string
	}{
		{`echo hello & world`, "echo hello `& world", "escape & symbol"},
		{"echo test | pipe", "echo test `| pipe", "escape | symbol"},
		{"echo a > b.txt", "echo a `> b.txt", "escape > redirect"},
		{"echo a < b.txt", "echo a `< b.txt", "escape < redirect"},
		{"echo (grouping)", "echo `(grouping`)", "escape parentheses"},
		{`echo %VAR%`, `echo %VAR%`, "% not expanded in PowerShell (M8 fix)"},
		{`echo normal text`, `echo normal text`, "normal text unchanged"},
		{`echo "quoted"`, `echo "quoted"`, "preserve quotes"},
	}

	for _, tc := range testCases {
		result := sanitizeWindowsCommand(tc.input)
		if result != tc.expected {
			t.Errorf("%s:\n  input:    %s\n  expected: %s\n  actual:   %s",
				tc.desc, tc.input, tc.expected, result)
		} else {
			t.Logf("%s: %s -> %s", tc.desc, tc.input, result)
		}
	}
}

func TestSecurityDefenseInDepth(t *testing.T) {
	t.Log("Verifying defense-in-depth strategy")

	app := createTestApp()
	app.settings = &Settings{ComputerControl: true}
	tempDir := t.TempDir()
	app.projects = []Project{{Path: tempDir}}
	app.acl = setupSecurityACL([]string{tempDir})
	app.sandbox = setupSecuritySandbox(app.acl)
	app.setGlobalValidateCommand()

	defenseLayers := []struct {
		name     string
		testFunc func() (bool, string)
	}{
		{
			name: "Layer 1: Dangerous pattern detection (AP Sandbox blocked commands)",
			testFunc: func() (bool, string) {
				err := app.sandbox.CanExecute("codecast:main", "rm -rf /")
				return err != nil, "should block rm -rf /"
			},
		},
		{
			name: "Layer 2: Chain operator detection (AP Sandbox dangerous chars)",
			testFunc: func() (bool, string) {
				err := app.sandbox.CanExecute("codecast:main", "echo test & whoami")
				return err != nil, "should block & operator"
			},
		},
		{
			name: "Layer 3: Dangerous command detection (AP Sandbox blocklist)",
			testFunc: func() (bool, string) {
				err := app.sandbox.CanExecute("codecast:main", "format C:")
				return err != nil, "should block format command"
			},
		},
		{
			name: "Layer 4: Command allowlist (AP Sandbox allowlist)",
			testFunc: func() (bool, string) {
				err := app.sandbox.CanExecute("agent:sub", "malware.exe")
				return err != nil, "sub-agent should not allow unknown commands"
			},
		},
		{
			name: "Layer 5: Path access control (AP ACL)",
			testFunc: func() (bool, string) {
				err := app.sandbox.ValidatePath("codecast", "/etc/shadow", ap.AccessRead)
				return err != nil, "should deny access to /etc/shadow"
			},
		},
	}

	allPassed := true
	for _, layer := range defenseLayers {
		passed, msg := layer.testFunc()
		status := "PASS"
		if !passed {
			status = "FAIL"
			allPassed = false
		}
		t.Logf("%s [%s]: %s", status, layer.name, msg)
	}

	if !allPassed {
		t.Error("Defense layers have gaps, security policy is incomplete!")
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
