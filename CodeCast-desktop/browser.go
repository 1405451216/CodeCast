package main

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Browser Domain Enforcement ====================

func (a *App) IsDomainBlocked(rawURL string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	domain := strings.ToLower(parsedURL.Hostname())

	for _, blocked := range a.settings.BlockedDomains {
		blockedLower := strings.ToLower(blocked)
		if domain == blockedLower || strings.HasSuffix(domain, "."+blockedLower) {
			fmt.Printf("[Domain] 已屏蔽域名: %s\n", domain)
			wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
				"title": "访问被阻止",
				"body":  fmt.Sprintf("域名 %s 在屏蔽列表中", domain),
				"type":  "warning",
			})
			return true
		}
	}

	if len(a.settings.AllowedDomains) > 0 {
		allowed := false
		for _, allowedDomain := range a.settings.AllowedDomains {
			allowedLower := strings.ToLower(allowedDomain)
			if domain == allowedLower || strings.HasSuffix(domain, "."+allowedLower) {
				allowed = true
				break
			}
		}
		if !allowed {
			fmt.Printf("[Domain] 域名不在允许列表中: %s\n", domain)
			wailsRuntime.EventsEmit(a.ctx, "notification", map[string]interface{}{
				"title": "访问被阻止",
				"body":  fmt.Sprintf("域名 %s 不在允许列表中", domain),
				"type":  "warning",
			})
			return true
		}
	}

	return false
}

func (a *App) GetDomainRules() map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	mode := "open"
	if len(a.settings.BlockedDomains) > 0 && len(a.settings.AllowedDomains) == 0 {
		mode = "blocklist"
	} else if len(a.settings.AllowedDomains) > 0 {
		mode = "allowlist"
	}

	return map[string]interface{}{
		"mode":           mode,
		"blockedCount":   len(a.settings.BlockedDomains),
		"allowedCount":   len(a.settings.AllowedDomains),
		"blockedDomains": a.settings.BlockedDomains,
		"allowedDomains": a.settings.AllowedDomains,
	}
}

// ==================== 浏览器域名管理 ====================

func (a *App) AddBlockedDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, d := range a.settings.BlockedDomains {
		if d == domain {
			return fmt.Errorf("域名已存在")
		}
	}
	a.settings.BlockedDomains = append(a.settings.BlockedDomains, domain)
	return a.saveSettingsToFile()
}

func (a *App) RemoveBlockedDomain(domain string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, d := range a.settings.BlockedDomains {
		if d == domain {
			a.settings.BlockedDomains = append(a.settings.BlockedDomains[:i], a.settings.BlockedDomains[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("域名不存在")
}

func (a *App) AddAllowedDomain(domain string) error {
	if domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, d := range a.settings.AllowedDomains {
		if d == domain {
			return fmt.Errorf("域名已存在")
		}
	}
	a.settings.AllowedDomains = append(a.settings.AllowedDomains, domain)
	return a.saveSettingsToFile()
}

func (a *App) RemoveAllowedDomain(domain string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, d := range a.settings.AllowedDomains {
		if d == domain {
			a.settings.AllowedDomains = append(a.settings.AllowedDomains[:i], a.settings.AllowedDomains[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("域名不存在")
}

// ClearBrowserData 清除浏览数据（缓存、Cookie 等）
func (a *App) ClearBrowserData() error {
	var errors []string

	var browserPaths []string

	if runtime.GOOS == "windows" {
		localAppData := os.Getenv("LOCALAPPDATA")
		browserPaths = []string{
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cache"),
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cookies"),
			filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Code Cache"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Cache"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Cookies"),
			filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "Code Cache"),
		}
	} else if runtime.GOOS == "darwin" {
		home, _ := os.UserHomeDir()
		appSupport := filepath.Join(home, "Library", "Application Support")
		browserPaths = []string{
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Cache"),
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Cookies"),
			filepath.Join(appSupport, "Google", "Chrome", "Default", "Code Cache"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Cache"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Cookies"),
			filepath.Join(appSupport, "Microsoft Edge", "Default", "Code Cache"),
		}
	} else {
		home, _ := os.UserHomeDir()
		configDir := filepath.Join(home, ".config")
		browserPaths = []string{
			filepath.Join(configDir, "google-chrome", "Default", "Cache"),
			filepath.Join(configDir, "google-chrome", "Default", "Cookies"),
			filepath.Join(configDir, "microsoft-edge", "Default", "Cache"),
			filepath.Join(configDir, "microsoft-edge", "Default", "Cookies"),
		}
	}

	clearDir := func(path string) {
		if _, err := os.Stat(path); err != nil {
			return
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return
		}
		for _, e := range entries {
			fullPath := filepath.Join(path, e.Name())
			if err := os.RemoveAll(fullPath); err != nil {
				errors = append(errors, fullPath)
			}
		}
	}

	for _, p := range browserPaths {
		clearDir(p)
	}

	if len(errors) > 0 {
		fmt.Printf("[Browser] 部分文件清理失败: %d 个\n", len(errors))
	} else {
		fmt.Println("[浏览器] 浏览数据已清理")
	}
	return nil
}

// CheckSeleniumInstalled 检测本机是否安装了 Selenium 相关组件
func (a *App) CheckSeleniumInstalled() map[string]interface{} {
	details := ""
	var hasSelenium, hasChromeDriver, hasEdgeDriver, hasPython bool

	if path, err := exec.LookPath("chromedriver"); err == nil {
		hasChromeDriver = true
		details += fmt.Sprintf("chromedriver: %s\n", path)
	}
	if path, err := exec.LookPath("msedgedriver"); err == nil {
		hasEdgeDriver = true
		details += fmt.Sprintf("msedgedriver: %s\n", path)
	}
	if _, err := exec.LookPath("python"); err == nil {
		hasPython = true
		if output, err := exec.Command("python", "-c", "import selenium; print(selenium.__version__)").CombinedOutput(); err == nil {
			hasSelenium = true
			details += fmt.Sprintf("selenium: %s", strings.TrimSpace(string(output)))
		} else {
			details += "python 已安装但 selenium 模块未找到\n"
		}
	}
	if _, err := exec.LookPath("python3"); err == nil && !hasPython {
		hasPython = true
		if output, err := exec.Command("python3", "-c", "import selenium; print(selenium.__version__)").CombinedOutput(); err == nil {
			hasSelenium = true
			details += fmt.Sprintf("selenium: %s", strings.TrimSpace(string(output)))
		}
	}

	installed := hasSelenium || hasChromeDriver || hasEdgeDriver

	a.mu.Lock()
	a.settings.SeleniumInstalled = installed
	a.saveSettingsToFile()
	a.mu.Unlock()

	return map[string]interface{}{
		"selenium":     hasSelenium,
		"chromedriver": hasChromeDriver,
		"edgedriver":   hasEdgeDriver,
		"python":       hasPython,
		"details":      details,
		"installed":    installed,
	}
}
