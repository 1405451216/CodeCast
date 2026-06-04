package main

import (
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	ap "agentprimordia/pkg"
)

// setupSecurityACL creates and configures the AP ACL with CodeCast's security rules.
// The ACL governs path-based access control; command-level validation is handled by Sandbox.
func setupSecurityACL(projectPaths []string) *ap.ACL {
	acl := ap.NewACL()

	// Deny sensitive system paths for all agents.
	// ACL uses filepath.Clean + HasPrefix matching, so denying "/etc" blocks "/etc/passwd" too.
	acl.Deny("*", "/etc/shadow")
	acl.Deny("*", "/etc/sudoers")
	acl.Deny("*", "/etc/ssh")
	acl.Deny("*", "/etc/passwd")
	acl.Deny("*", "/etc/gshadow")
	acl.Deny("*", "/etc/ssl/private")
	acl.Deny("*", "/root")
	acl.Deny("*", "/proc")
	acl.Deny("*", "/sys")
	// Windows system paths
	acl.Deny("*", `C:\Windows\System32\config`)
	acl.Deny("*", `C:\Windows\System32\drivers\etc`)
	acl.Deny("*", `C:\Windows\System32\WindowsPowerShell`)
	acl.Deny("*", `C:\Windows\SysWOW64`)
	acl.Deny("*", `C:\Windows\Temp`)
	// User credential paths
	acl.Deny("*", `.ssh`)
	acl.Deny("*", `.gnupg`)
	acl.Deny("*", `.aws/credentials`)

	// Allow read+write+execute within all project directories for all agents.
	// H7 fix: resolve symlinks so that ACL paths match EvalSymlinks-resolved paths
	// used in isPathAllowedBridge.
	for _, pp := range projectPaths {
		if pp != "" {
			resolved, err := filepath.EvalSymlinks(pp)
			if err != nil {
				resolved = pp // fallback to original if resolution fails
			}
			acl.Allow("*", resolved, ap.AccessAll)
		}
	}

	return acl
}

// setupSecuritySandbox creates and configures the AP Sandbox.
// The Sandbox handles:
//   - Dangerous character detection (; | & $ ` > < \n) — replaces chainOperators regex
//   - Command allowlist/blocklist — replaces subAgentAllowedCommands / subAgentRestrictedCommands
//   - Command name extraction from raw commands — replaces extractCommandName in validateCommand
func setupSecuritySandbox(acl *ap.ACL) *ap.Sandbox {
	sb := ap.NewSandbox(acl)

	// ---- Allow safe development commands (replaces subAgentAllowedCommands) ----
	// Compilers & build tools
	for _, cmd := range []string{
		"go", "gcc", "clang", "rustc",
		"make", "cmake", "gradle", "mvn",
		"tsc", "esbuild", "vite", "webpack",
		"dotnet", "javac", "java",
	} {
		sb.AllowCommand(cmd)
	}
	// Package managers
	for _, cmd := range []string{
		"npm", "npx", "yarn", "pnpm",
		"pip", "pip3", "poetry", "conda",
		"cargo",
	} {
		sb.AllowCommand(cmd)
	}
	// Testing & linting
	for _, cmd := range []string{
		"jest", "mocha", "vitest", "pytest",
		"eslint", "prettier", "gofmt", "gofumpt",
		"ruff", "pylint", "black", "clang-format",
		"rustfmt",
	} {
		sb.AllowCommand(cmd)
	}
	// Version control
	sb.AllowCommand("git")
	// File inspection (read-only or low-risk)
	for _, cmd := range []string{
		"type", "cat", "dir", "ls", "tree",
		"findstr", "grep", "find", "head", "tail",
		"wc", "stat", "file",
	} {
		sb.AllowCommand(cmd)
	}
	// Network diagnostics
	for _, cmd := range []string{
		"ping", "nslookup", "dig", "curl", "wget",
	} {
		sb.AllowCommand(cmd)
	}
	// Interpreters (allowed but shells are blocked below)
	for _, cmd := range []string{
		"node", "python", "python3", "ruby", "php",
	} {
		sb.AllowCommand(cmd)
	}

	// ---- Block dangerous commands (replaces subAgentRestrictedCommands + agentExtraDangerPatterns) ----
	// Shell interpreters — too broad for sub-agents
	for _, cmd := range []string{
		"bash", "sh", "powershell", "pwsh",
	} {
		sb.BlockCommand(cmd)
	}
	// Destructive system commands
	for _, cmd := range []string{
		"rm", "mkfs", "format", "shutdown", "reboot",
		"del", "rd",
		// Windows-specific dangerous commands
		"icacls", "mklink",
		// Registry & scheduling
		"reg", "schtasks",
		// User management
		"net",
		// Background copy / PowerShell Invoke-Expression
		"bcp", "bcpy",
		// PowerShell interpreter
		"powershell", "pwsh",
	} {
		sb.BlockCommand(cmd)
	}

	return sb
}

// validateCommandBridge replaces validateCommand from shell.go.
// It delegates to AP Sandbox.CanExecute which checks:
//   - Shell metacharacters (; | & $ ` > < \n) — replaces chainOperators
//   - Blocked commands — replaces subAgentRestrictedCommands + dangerousPatterns
//   - Allowlist enforcement — replaces subAgentAllowedCommands
func (a *App) validateCommandBridge(agentID, agentMode, rawCmd string) error {
	if a.sandbox == nil {
		// Fail-closed: if sandbox is unavailable, refuse to execute any command.
		// This prevents a startup failure or race condition from silently
		// disabling all command security.
		slog.Error("[Security] Sandbox not initialized, refusing command execution",
			"agentID", agentID, "cmd", rawCmd)
		return &CommandDeniedError{
			Reason:    "安全沙箱未初始化，拒绝执行命令。请重启应用。",
			Command:   extractCommandName(rawCmd),
			Dangerous: true,
		}
	}

	err := a.sandbox.CanExecute(agentID, rawCmd)
	if err != nil {
		name := extractCommandName(rawCmd)
		dangerous := isDangerousCommandError(err)
		slog.Info("[Security] command denied by AP Sandbox",
			"agentID", agentID, "cmd", rawCmd, "reason", err.Error())
		return &CommandDeniedError{
			Reason:    fmt.Sprintf("命令被安全策略拦截: %s", err.Error()),
			Command:   name,
			Dangerous: dangerous,
		}
	}
	return nil
}

// isPathAllowedBridge replaces isPathAllowed from project.go.
// It uses AP Sandbox.ValidatePath which checks:
//   - Path traversal ("..")
//   - ACL rules for path-based access control
//
// Falls back to the original isPathAllowed logic if the sandbox is not initialized.
func (a *App) isPathAllowedBridge(targetPath string) error {
	if targetPath == "" {
		return fmt.Errorf("path is empty")
	}

	// H7 fix: resolve symlinks before validation to prevent symlink-based escapes.
	// For paths that don't yet exist (e.g. write targets), resolve the deepest
	// existing ancestor and append the remaining components.
	resolvedPath := resolvePathForACL(targetPath)

	// noProjectMode allows broader access but still blocks dangerous system paths
	a.mu.RLock()
	noProjectMode := a.noProjectMode
	a.mu.RUnlock()
	if noProjectMode {
		// H6 fix: even in noProjectMode, block known-dangerous system paths
		absPath, absErr := filepath.Abs(resolvedPath)
		if absErr != nil {
			return fmt.Errorf("invalid path: %w", absErr)
		}
		lower := filepath.ToSlash(strings.ToLower(absPath))
		dangerous := []string{
			"/etc/shadow", "/etc/sudoers", "/etc/ssh", "/etc/passwd",
			"/etc/gshadow", "/etc/ssl/private",
			"/root", "/proc", "/sys",
			"c:/windows/system32/config",
			"c:/windows/system32/drivers/etc",
			"c:/windows/system32/windowspowershell",
			"c:/windows/syswow64",
			"c:/windows/temp",
		}
		for _, d := range dangerous {
			if strings.HasPrefix(lower, d) {
				return fmt.Errorf("access denied: %s is a sensitive system path", targetPath)
			}
		}
		return nil
	}

	// Use sandbox for path validation if available.
	// Sandbox.ValidatePath handles ".." traversal and ACL-based access control.
	if a.sandbox != nil {
		absPath, absErr := filepath.Abs(resolvedPath)
		if absErr != nil {
			return fmt.Errorf("invalid path: %w", absErr)
		}
		return a.sandbox.ValidatePath("codecast", absPath, ap.AccessRead)
	}

	// Fallback: delegate to the original isPathAllowed when sandbox is not ready.
	return a.isPathAllowed(targetPath)
}

// resolvePathForACL resolves symlinks in targetPath. If the path doesn't exist,
// it walks up the directory tree to find an existing ancestor, resolves that,
// and appends the remaining path components.
func resolvePathForACL(targetPath string) string {
	resolved, err := filepath.EvalSymlinks(targetPath)
	if err == nil {
		return resolved
	}

	// Path doesn't fully exist — resolve the deepest existing ancestor
	parent := filepath.Dir(targetPath)
	base := filepath.Base(targetPath)
	if parent == targetPath {
		// Already at root
		if abs, absErr := filepath.Abs(targetPath); absErr == nil {
			return abs
		}
		return targetPath
	}
	resolvedParent := resolvePathForACL(parent)
	return filepath.Join(resolvedParent, base)
}

// isDangerousCommandError returns true if the error indicates a blocked or
// inherently dangerous command (as opposed to simply not being allowlisted).
func isDangerousCommandError(err error) bool {
	if err == nil {
		return false
	}
	// Errors containing "blocked" or "metacharacter" are considered dangerous.
	// "not in allowed list" is a policy violation but not inherently dangerous.
	errMsg := err.Error()
	return containsAny(errMsg, "blocked", "metacharacter")
}

// containsAny checks if s contains any of the substrings.
func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
