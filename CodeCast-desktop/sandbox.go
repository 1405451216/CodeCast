package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ==================== Sandbox / Security Boundary ====================

// SandboxMode defines workspace access levels
type SandboxMode string

const (
	SandboxModeStrict   SandboxMode = "strict"   // Only project directory allowed
	SandboxModeRelaxed  SandboxMode = "relaxed"  // Project + home dir allowed
	SandboxModeFullOpen SandboxMode = "full"     // Full filesystem access
)

// PathPermission defines a single path permission rule
type PathPermission struct {
	Path    string `json:"path"`
	Mode    string `json:"mode"` // "read", "write", "deny"
	Comment string `json:"comment,omitempty"`
}

// SandboxConfig holds the workspace security configuration
type SandboxConfig struct {
	Mode           SandboxMode      `json:"mode"`
	AllowedPaths   []PathPermission `json:"allowed_paths"`
	BlockedPaths   []string         `json:"blocked_paths"`
	ConfirmOnWrite bool             `json:"confirm_on_write"` // Ask before writing outside project
	ConfirmOnExec  bool             `json:"confirm_on_exec"`  // Ask before executing commands
	MaxFileSize    int64            `json:"max_file_size"`    // Max file size for write operations (bytes)
}

// DefaultSandboxConfig returns sensible defaults
func DefaultSandboxConfig() SandboxConfig {
	return SandboxConfig{
		Mode: SandboxModeRelaxed,
		AllowedPaths: []PathPermission{},
		BlockedPaths: []string{
			"C:\\Windows\\System32",
			"/etc/passwd",
			"/etc/shadow",
			"~/.ssh/id_rsa",
			"~/.ssh/id_ed25519",
		},
		ConfirmOnWrite: true,
		ConfirmOnExec:  true,
		MaxFileSize:    10 * 1024 * 1024, // 10MB
	}
}

// ValidatePath checks if a given path is allowed under current sandbox rules.
// Returns nil if allowed, error describing the reason if blocked.
func (a *App) ValidatePath(targetPath, operation string) error {
	a.mu.RLock()
	fullAccess := a.settings.FullAccess
	a.mu.RUnlock()

	if fullAccess {
		return nil // Full access mode bypasses all checks
	}

	// Normalize path
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("无法解析路径: %s", targetPath)
	}

	// Check blocked paths
	for _, blocked := range DefaultSandboxConfig().BlockedPaths {
		expandedBlocked := expandHomePath(blocked)
		if strings.HasPrefix(strings.ToLower(absPath), strings.ToLower(expandedBlocked)) {
			return fmt.Errorf("路径被安全策略阻止: %s (原因: 系统敏感路径)", absPath)
		}
	}

	// In strict mode, validate against project directory
	a.mu.RLock()
	currentProject := a.getCurrentProjectLocked()
	a.mu.RUnlock()

	if currentProject != nil {
		projectPath, _ := filepath.Abs(currentProject.Path)
		if strings.HasPrefix(strings.ToLower(absPath), strings.ToLower(projectPath)) {
			return nil // Within project directory, always allowed
		}
	}

	// For write operations outside project, may require confirmation
	if operation == "write" || operation == "exec" {
		// Return a special sentinel error that the caller can use to prompt user
		return &PermissionRequiredError{
			Path:      absPath,
			Operation: operation,
			Reason:    "操作目标不在当前项目目录内",
		}
	}

	return nil
}

// PermissionRequiredError indicates the operation needs user confirmation
type PermissionRequiredError struct {
	Path      string
	Operation string
	Reason    string
}

func (e *PermissionRequiredError) Error() string {
	return fmt.Sprintf("需要确认: %s 操作 %s (%s)", e.Operation, e.Path, e.Reason)
}

// IsPermissionRequired checks if an error is a permission-required sentinel
func IsPermissionRequired(err error) bool {
	_, ok := err.(*PermissionRequiredError)
	return ok
}

// GetSandboxStatus returns the current sandbox configuration for the frontend
func (a *App) GetSandboxStatus() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()

	projectPath := ""
	if cp := a.getCurrentProjectLocked(); cp != nil {
		projectPath = cp.Path
	}

	return map[string]interface{}{
		"full_access":      a.settings.FullAccess,
		"project_path":     projectPath,
		"confirm_on_write": !a.settings.FullAccess,
		"confirm_on_exec":  !a.settings.FullAccess,
		"blocked_paths":    DefaultSandboxConfig().BlockedPaths,
	}
}

// expandHomePath replaces ~ with the user's home directory
func expandHomePath(path string) string {
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[1:])
	}
	return path
}

// ValidateCommand checks if a command is safe to execute
func (a *App) ValidateCommand(command string) error {
	a.mu.RLock()
	fullAccess := a.settings.FullAccess
	a.mu.RUnlock()

	if fullAccess {
		return nil
	}

	// Block dangerous commands
	dangerous := []string{
		"rm -rf /", "rm -rf /*",
		"format c:", "del /f /s /q c:\\",
		":(){:|:&};:", // fork bomb
		"mkfs.", "dd if=/dev/zero of=/dev/",
		"chmod -R 777 /",
	}

	cmdLower := strings.ToLower(strings.TrimSpace(command))
	for _, d := range dangerous {
		if strings.Contains(cmdLower, strings.ToLower(d)) {
			return fmt.Errorf("命令被安全策略阻止: 检测到危险命令模式 '%s'", d)
		}
	}

	return nil
}
