package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// ==================== Security Hardening ====================

// SecurityStatus represents the overall security posture
type SecurityStatus struct {
	EncryptionEnabled bool            `json:"encryption_enabled"`
	KeyAge            int             `json:"key_age_days"` // How old the encryption key is
	APIKeysConfigured int             `json:"api_keys_configured"`
	APIKeysEncrypted  int             `json:"api_keys_encrypted"`
	SandboxEnabled    bool            `json:"sandbox_enabled"`
	AntivirusDetected string          `json:"antivirus_detected,omitempty"`
	LastAudit         int64           `json:"last_audit"`
	Issues            []SecurityIssue `json:"issues"`
}

// SecurityIssue represents a detected security concern
type SecurityIssue struct {
	Level       string `json:"level"`       // "high", "medium", "low"
	Category    string `json:"category"`    // "encryption", "access", "logging"
	Description string `json:"description"`
	Suggestion  string `json:"suggestion"`
}

// GetSecurityStatus performs a security audit and returns the status
func (a *App) GetSecurityStatus() *SecurityStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()

	status := &SecurityStatus{
		EncryptionEnabled: a.encryptionKey != nil,
		LastAudit:         time.Now().Unix(),
		Issues:            []SecurityIssue{},
	}

	// Check key age
	if a.encryptionKey != nil {
		keyPath := getKeyPath(a.settingsPath)
		if info, err := os.Stat(keyPath); err == nil {
			age := time.Since(info.ModTime())
			status.KeyAge = int(age.Hours() / 24)

			if status.KeyAge > 180 {
				status.Issues = append(status.Issues, SecurityIssue{
					Level:       "medium",
					Category:    "encryption",
					Description: fmt.Sprintf("加密密钥已使用 %d 天，建议定期轮转", status.KeyAge),
					Suggestion:  "使用密钥轮转功能更新加密密钥",
				})
			}
		}
	} else {
		status.Issues = append(status.Issues, SecurityIssue{
			Level:       "high",
			Category:    "encryption",
			Description: "加密密钥未初始化，API Key 将以明文存储",
			Suggestion:  "重启应用或检查密钥文件权限",
		})
	}

	// Check API key status
	for _, mc := range a.settings.ModelConfigs {
		if mc.APIKey != "" {
			status.APIKeysConfigured++
			// All keys in memory are decrypted; if encryption is enabled they're encrypted on disk
			if a.encryptionKey != nil {
				status.APIKeysEncrypted++
			}
		}
	}

	if status.APIKeysConfigured > 0 && status.APIKeysEncrypted == 0 {
		status.Issues = append(status.Issues, SecurityIssue{
			Level:       "high",
			Category:    "encryption",
			Description: "API Key 未加密存储",
			Suggestion:  "确保加密密钥文件存在且可访问",
		})
	}

	// Check sandbox status
	status.SandboxEnabled = !a.settings.FullAccess
	if a.settings.FullAccess {
		status.Issues = append(status.Issues, SecurityIssue{
			Level:       "low",
			Category:    "access",
			Description: "完全访问模式已开启，无文件系统隔离",
			Suggestion:  "如不需要访问系统目录，建议关闭完全访问模式",
		})
	}

	// Check for antivirus
	status.AntivirusDetected = detectAntivirus()

	return status
}

// RotateEncryptionKey generates a new encryption key and re-encrypts all stored secrets
func (a *App) RotateEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Generate new key
	newKey := make([]byte, 32)
	if _, err := rand.Read(newKey); err != nil {
		return fmt.Errorf("生成新密钥失败: %w", err)
	}

	// Re-encrypt all API keys with the new key
	// (Keys are currently in memory in decrypted form, so we just need to
	//  update the key and re-save the settings file)
	oldKey := a.encryptionKey
	a.encryptionKey = newKey

	// Save the new key to disk
	keyPath := getKeyPath(a.settingsPath)
	keyB64 := base64.StdEncoding.EncodeToString(newKey)
	if err := os.WriteFile(keyPath, []byte(keyB64), 0600); err != nil {
		// Rollback
		a.encryptionKey = oldKey
		return fmt.Errorf("保存新密钥失败: %w", err)
	}

	// Re-save settings (which will encrypt API keys with the new key)
	if err := a.saveSettingsToFile(); err != nil {
		// Rollback key file
		if oldKey != nil {
			oldKeyB64 := base64.StdEncoding.EncodeToString(oldKey)
			os.WriteFile(keyPath, []byte(oldKeyB64), 0600)
		}
		a.encryptionKey = oldKey
		return fmt.Errorf("重新加密设置失败: %w", err)
	}

	slog.Info("加密密钥已轮转", "key_path", keyPath)
	return nil
}

// MaskSensitiveInLog sanitizes a log line by masking any API keys
func MaskSensitiveInLog(logLine string) string {
	// Common API key patterns
	patterns := []string{
		"sk-", "Bearer ", "api_key=", "apikey=", "token=",
	}

	result := logLine
	for _, pattern := range patterns {
		idx := strings.Index(strings.ToLower(result), strings.ToLower(pattern))
		if idx < 0 {
			continue
		}

		start := idx + len(pattern)
		// Find the end of the key (space, quote, comma, or end of string)
		end := start
		for end < len(result) {
			c := result[end]
			if c == ' ' || c == '"' || c == '\'' || c == ',' || c == '}' || c == '\n' {
				break
			}
			end++
		}

		if end-start > 8 {
			masked := result[start:start+3] + "****" + result[end-3:end]
			result = result[:start] + masked + result[end:]
		}
	}

	return result
}

// GetKeyRotationInfo returns information about the current encryption key
func (a *App) GetKeyRotationInfo() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()

	info := map[string]interface{}{
		"has_key":        a.encryptionKey != nil,
		"key_age":        0,
		"needs_rotation": false,
	}

	if a.encryptionKey != nil {
		keyPath := getKeyPath(a.settingsPath)
		if fileInfo, err := os.Stat(keyPath); err == nil {
			age := time.Since(fileInfo.ModTime())
			info["key_age"] = int(age.Hours() / 24)
			info["last_modified"] = fileInfo.ModTime().Format("2006-01-02 15:04:05")
			info["needs_rotation"] = age.Hours()/24 > 180 // Recommend rotation after 6 months
		}
	}

	return info
}

// ─── Antivirus Detection ─────────────────────────────

// detectAntivirus attempts to detect installed antivirus software
// This helps diagnose compatibility issues (e.g., slow file I/O, blocked executables)
func detectAntivirus() string {
	if runtime.GOOS != "windows" {
		return ""
	}

	// Check common Windows antivirus process/path indicators
	avPaths := map[string]string{
		"C:\\Program Files\\Windows Defender":        "Windows Defender",
		"C:\\Program Files (x86)\\360":              "360 安全卫士",
		"C:\\Program Files\\Huorong":                "火绒安全",
		"C:\\Program Files (x86)\\Huorong":          "火绒安全",
		"C:\\Program Files\\Tencent\\QQPCMgr":       "腾讯电脑管家",
		"C:\\Program Files (x86)\\Tencent\\QQPCMgr": "腾讯电脑管家",
		"C:\\Program Files\\Kaspersky Lab":          "卡巴斯基",
		"C:\\Program Files\\Norton Security":        "诺顿",
		"C:\\Program Files\\ESET":                   "ESET NOD32",
	}

	var detected []string
	for path, name := range avPaths {
		if _, err := os.Stat(path); err == nil {
			detected = append(detected, name)
		}
	}

	if len(detected) == 0 {
		return ""
	}
	return strings.Join(detected, ", ")
}

// CheckAntivirusCompatibility checks if the current antivirus might cause issues
func (a *App) CheckAntivirusCompatibility() map[string]interface{} {
	av := detectAntivirus()

	result := map[string]interface{}{
		"detected":    av,
		"has_issues":  false,
		"suggestions": []string{},
	}

	if av == "" {
		return result
	}

	suggestions := []string{}

	// Known compatibility issues
	if strings.Contains(av, "360") || strings.Contains(av, "腾讯电脑管家") {
		result["has_issues"] = true
		suggestions = append(suggestions,
			"建议将 CodeCast 安装目录加入杀软白名单",
			"如遇到文件读写缓慢，请临时关闭实时防护后重试",
		)
	}

	if strings.Contains(av, "火绒") {
		suggestions = append(suggestions,
			"火绒兼容性良好，如有异常请将 CodeCast 加入信任列表",
		)
	}

	// General suggestions for any antivirus
	exePath, _ := os.Executable()
	if exePath != "" {
		suggestions = append(suggestions,
			fmt.Sprintf("将以下路径加入杀软白名单: %s", filepath.Dir(exePath)),
		)
	}

	result["suggestions"] = suggestions
	return result
}
