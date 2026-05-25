package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Auto-Update System ====================

// AppVersion 当前应用版本，构建时通过 ldflags 注入
var AppVersion = "3.0.0"

// 仓库信息
const (
	GiteeOwner = "nicepkg"
	GiteeRepo  = "CodeCast"
	GitHubRepo = "nicepkg/CodeCast"

	// Gitee API（国内优先）
	GiteeAPIBase  = "https://gitee.com/api/v5"
	// GitHub API（备用）
	GitHubAPIBase = "https://api.github.com"
)

// UpdateInfo 更新信息
type UpdateInfo struct {
	HasUpdate      bool   `json:"has_update"`
	CurrentVersion string `json:"current_version"`
	LatestVersion  string `json:"latest_version"`
	ReleaseNotes   string `json:"release_notes"`
	DownloadURL    string `json:"download_url"`
	PublishedAt    string `json:"published_at"`
	FileSize       int64  `json:"file_size"`
}

// UpdateProgress 下载进度
type UpdateProgress struct {
	Phase      string  `json:"phase"` // checking, downloading, installing, done, error
	Percent    float64 `json:"percent"`
	Message    string  `json:"message"`
	DownloadURL string `json:"download_url,omitempty"`
}

// githubRelease GitHub Release API 响应
type githubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Body        string        `json:"body"`
	PublishedAt string        `json:"published_at"`
	Assets      []githubAsset `json:"assets"`
}

// githubAsset Release 附件
type githubAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// ─── 公共 API（前端可调用）─────────────────────────────────

// GetCurrentVersion 获取当前版本
func (a *App) GetCurrentVersion() string {
	return AppVersion
}

// CheckForUpdate 检查是否有新版本
func (a *App) CheckForUpdate() (*UpdateInfo, error) {
	a.emitUpdateProgress("checking", 0, "正在检查更新...")

	release, err := a.fetchLatestRelease()
	if err != nil {
		a.emitUpdateProgress("error", 0, "检查更新失败: "+err.Error())
		return nil, fmt.Errorf("检查更新失败: %w", err)
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	hasUpdate := compareVersions(latestVersion, AppVersion) > 0

	info := &UpdateInfo{
		HasUpdate:      hasUpdate,
		CurrentVersion: AppVersion,
		LatestVersion:  latestVersion,
		ReleaseNotes:   release.Body,
		PublishedAt:    release.PublishedAt,
	}

	// 查找当前平台对应的下载资源
	assetName := a.getPlatformAssetPattern()
	for _, asset := range release.Assets {
		if strings.Contains(strings.ToLower(asset.Name), strings.ToLower(assetName)) {
			info.DownloadURL = asset.BrowserDownloadURL
			info.FileSize = asset.Size
			break
		}
	}

	if hasUpdate {
		a.emitUpdateProgress("done", 100, fmt.Sprintf("发现新版本 v%s", latestVersion))
	} else {
		a.emitUpdateProgress("done", 100, "当前已是最新版本")
	}

	return info, nil
}

// DownloadUpdate 下载更新文件到临时目录，返回下载路径
func (a *App) DownloadUpdate(downloadURL string) (string, error) {
	if downloadURL == "" {
		return "", fmt.Errorf("下载地址为空")
	}

	a.emitUpdateProgress("downloading", 0, "开始下载更新...")

	// 创建临时目录
	tmpDir := filepath.Join(os.TempDir(), "codecast-update")
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return "", fmt.Errorf("创建临时目录失败: %w", err)
	}

	// 确定文件名
	fileName := filepath.Base(downloadURL)
	destPath := filepath.Join(tmpDir, fileName)

	// 下载文件
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(downloadURL)
	if err != nil {
		a.emitUpdateProgress("error", 0, "下载失败: "+err.Error())
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		a.emitUpdateProgress("error", 0, fmt.Sprintf("下载失败: HTTP %d", resp.StatusCode))
		return "", fmt.Errorf("下载失败: HTTP %d", resp.StatusCode)
	}

	// 创建目标文件
	out, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer out.Close()

	// 带进度的下载
	totalSize := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				a.emitUpdateProgress("error", 0, "写入文件失败")
				return "", fmt.Errorf("写入文件失败: %w", writeErr)
			}
			downloaded += int64(n)

			if totalSize > 0 {
				percent := float64(downloaded) / float64(totalSize) * 100
				a.emitUpdateProgress("downloading", percent,
					fmt.Sprintf("下载中... %.1f MB / %.1f MB", float64(downloaded)/1048576, float64(totalSize)/1048576))
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			a.emitUpdateProgress("error", 0, "下载中断")
			return "", fmt.Errorf("下载中断: %w", readErr)
		}
	}

	a.emitUpdateProgress("downloading", 100, "下载完成")
	slog.Info("更新下载完成", "path", destPath, "size", downloaded)

	return destPath, nil
}

// OpenDownloadedFile 打开下载的文件所在目录（让用户手动安装）
func (a *App) OpenDownloadedFile(filePath string) error {
	if filePath == "" {
		return fmt.Errorf("文件路径为空")
	}

	dir := filepath.Dir(filePath)
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
		args = []string{"/select,", filePath}
	case "darwin":
		cmd = "open"
		args = []string{"-R", filePath}
	default:
		cmd = "xdg-open"
		args = []string{dir}
	}

	return execCommand(cmd, args...)
}

// OpenReleasePage 打开 Release 页面（优先 Gitee）
func (a *App) OpenReleasePage() {
	url := fmt.Sprintf("https://gitee.com/%s/%s/releases", GiteeOwner, GiteeRepo)
	wailsRuntime.BrowserOpenURL(a.ctx, url)
}

// ─── 内部方法 ─────────────────────────────────────────

// fetchLatestRelease 优先从 Gitee 获取最新 Release，失败时回退到 GitHub
func (a *App) fetchLatestRelease() (*githubRelease, error) {
	// 优先尝试 Gitee（国内访问快）
	release, err := a.fetchFromGitee()
	if err == nil {
		return release, nil
	}
	slog.Debug("Gitee 检查更新失败，尝试 GitHub", "error", err)

	// 回退到 GitHub
	release, err = a.fetchFromGitHub()
	if err != nil {
		return nil, fmt.Errorf("检查更新失败（Gitee 和 GitHub 均不可用）: %w", err)
	}
	return release, nil
}

// fetchFromGitee 从 Gitee API 获取最新 Release
func (a *App) fetchFromGitee() (*githubRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases/latest", GiteeAPIBase, GiteeOwner, GiteeRepo)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "CodeCast/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Gitee 网络请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gitee API 返回 %d", resp.StatusCode)
	}

	// Gitee Release API 响应格式
	var giteeResp struct {
		TagName string `json:"tag_name"`
		Name    string `json:"name"`
		Body    string `json:"body"`
		CreatedAt string `json:"created_at"`
		Assets  []struct {
			Name               string `json:"name"`
			Size               int64  `json:"size"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&giteeResp); err != nil {
		return nil, fmt.Errorf("解析 Gitee 响应失败: %w", err)
	}

	// 转换为统一格式
	release := &githubRelease{
		TagName:     giteeResp.TagName,
		Name:        giteeResp.Name,
		Body:        giteeResp.Body,
		PublishedAt: giteeResp.CreatedAt,
	}
	for _, asset := range giteeResp.Assets {
		release.Assets = append(release.Assets, githubAsset{
			Name:               asset.Name,
			Size:               asset.Size,
			BrowserDownloadURL: asset.BrowserDownloadURL,
		})
	}

	return release, nil
}

// fetchFromGitHub 从 GitHub API 获取最新 Release（备用）
func (a *App) fetchFromGitHub() (*githubRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/releases/latest", GitHubAPIBase, GitHubRepo)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "CodeCast/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GitHub 网络请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("未找到发布版本")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("解析 GitHub 响应失败: %w", err)
	}

	return &release, nil
}

// getPlatformAssetPattern 获取当前平台对应的资源文件名模式
func (a *App) getPlatformAssetPattern() string {
	switch runtime.GOOS {
	case "windows":
		return "Windows"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return "Apple-Silicon"
		}
		return "Intel"
	default:
		return "Linux"
	}
}

// emitUpdateProgress 发送更新进度到前端
func (a *App) emitUpdateProgress(phase string, percent float64, message string) {
	wailsRuntime.EventsEmit(a.ctx, "update-progress", UpdateProgress{
		Phase:   phase,
		Percent: percent,
		Message: message,
	})
}

// autoCheckUpdate 启动时后台检查更新
func (a *App) autoCheckUpdate() {
	// 延迟 10 秒检查，避免影响启动速度
	time.Sleep(10 * time.Second)

	info, err := a.CheckForUpdate()
	if err != nil {
		slog.Debug("自动检查更新失败", "error", err)
		return
	}

	if info.HasUpdate {
		slog.Info("发现新版本", "current", info.CurrentVersion, "latest", info.LatestVersion)
		a.SendNotification(
			"发现新版本",
			fmt.Sprintf("CodeCast v%s 已发布，当前版本 v%s", info.LatestVersion, info.CurrentVersion),
			"info",
		)
	}
}

// ─── 版本比较工具 ─────────────────────────────────────────

// compareVersions 比较两个语义化版本号
// 返回: 1 (a > b), -1 (a < b), 0 (a == b)
func compareVersions(a, b string) int {
	aParts := parseVersionParts(a)
	bParts := parseVersionParts(b)

	for i := 0; i < 3; i++ {
		av, bv := 0, 0
		if i < len(aParts) {
			av = aParts[i]
		}
		if i < len(bParts) {
			bv = bParts[i]
		}
		if av > bv {
			return 1
		}
		if av < bv {
			return -1
		}
	}
	return 0
}

// parseVersionParts 将版本字符串解析为数字数组
func parseVersionParts(version string) []int {
	version = strings.TrimPrefix(version, "v")
	parts := strings.Split(version, ".")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		n := 0
		for _, c := range p {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			} else {
				break
			}
		}
		result = append(result, n)
	}
	return result
}

// execCommand 执行系统命令（用于打开文件管理器）
func execCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	return cmd.Start()
}

// ─── 增强更新系统：结构体 ─────────────────────────────────────────

// Changelog 结构化的更新日志
type Changelog struct {
	Version     string           `json:"version"`
	PublishedAt string           `json:"published_at"`
	Sections    []ChangelogSection `json:"sections"`
	RawBody     string           `json:"raw_body"`
}

// ChangelogSection 更新日志中的一个分类段落
type ChangelogSection struct {
	Title string   `json:"title"`
	Items []string `json:"items"`
}

// UpdateRecord 一次更新记录
type UpdateRecord struct {
	FromVersion string `json:"from_version"`
	ToVersion   string `json:"to_version"`
	UpdatedAt   string `json:"updated_at"`
	Success     bool   `json:"success"`
	Notes       string `json:"notes,omitempty"`
}

// ─── 增强更新系统：公共 API ─────────────────────────────────────────

// GetChangelog 解析 Release Notes 为结构化的更新日志
func (a *App) GetChangelog(releaseNotes string, version string, publishedAt string) *Changelog {
	changelog := &Changelog{
		Version:     version,
		PublishedAt: publishedAt,
		RawBody:     releaseNotes,
		Sections:    make([]ChangelogSection, 0),
	}

	if releaseNotes == "" {
		return changelog
	}

	lines := strings.Split(releaseNotes, "\n")
	var currentSection *ChangelogSection

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		// 检测标题行（## 或 ### 开头）
		if strings.HasPrefix(trimmed, "## ") || strings.HasPrefix(trimmed, "### ") {
			// 保存上一个 section
			if currentSection != nil && len(currentSection.Items) > 0 {
				changelog.Sections = append(changelog.Sections, *currentSection)
			}
			title := strings.TrimLeft(trimmed, "# ")
			currentSection = &ChangelogSection{
				Title: title,
				Items: make([]string, 0),
			}
			continue
		}

		// 检测列表项（- 或 * 开头）
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			item := strings.TrimPrefix(trimmed, "- ")
			item = strings.TrimPrefix(item, "* ")
			if currentSection != nil {
				currentSection.Items = append(currentSection.Items, item)
			} else {
				// 没有标题的列表项归入默认 section
				currentSection = &ChangelogSection{
					Title: "更新内容",
					Items: []string{item},
				}
			}
			continue
		}

		// 普通文本行视为列表项
		if currentSection != nil {
			currentSection.Items = append(currentSection.Items, trimmed)
		} else {
			currentSection = &ChangelogSection{
				Title: "更新内容",
				Items: []string{trimmed},
			}
		}
	}

	// 追加最后一个 section
	if currentSection != nil && len(currentSection.Items) > 0 {
		changelog.Sections = append(changelog.Sections, *currentSection)
	}

	return changelog
}

// GetUpdateHistory 获取更新历史记录
func (a *App) GetUpdateHistory() ([]UpdateRecord, error) {
	historyPath := a.getUpdateHistoryPath()

	data, err := os.ReadFile(historyPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []UpdateRecord{}, nil
		}
		return nil, fmt.Errorf("读取更新历史失败: %w", err)
	}

	var records []UpdateRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("解析更新历史失败: %w", err)
	}

	return records, nil
}

// SaveUpdateRecord 保存一条更新记录
func (a *App) SaveUpdateRecord(fromVersion, toVersion string, success bool, notes string) error {
	records, err := a.GetUpdateHistory()
	if err != nil {
		// 如果读取失败，从空列表开始
		records = []UpdateRecord{}
	}

	record := UpdateRecord{
		FromVersion: fromVersion,
		ToVersion:   toVersion,
		UpdatedAt:   time.Now().Format(time.RFC3339),
		Success:     success,
		Notes:       notes,
	}

	records = append(records, record)

	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化更新记录失败: %w", err)
	}

	historyPath := a.getUpdateHistoryPath()
	if err := os.MkdirAll(filepath.Dir(historyPath), 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	if err := os.WriteFile(historyPath, data, 0644); err != nil {
		return fmt.Errorf("写入更新历史失败: %w", err)
	}

	slog.Info("更新记录已保存", "from", fromVersion, "to", toVersion, "success", success)
	return nil
}

// GetAllReleases 获取最近的所有发布版本（用于回滚选择）
func (a *App) GetAllReleases(limit int) ([]UpdateInfo, error) {
	if limit <= 0 {
		limit = 10
	}

	releases, err := a.fetchAllReleases(limit)
	if err != nil {
		return nil, fmt.Errorf("获取版本列表失败: %w", err)
	}

	result := make([]UpdateInfo, 0, len(releases))
	assetPattern := a.getPlatformAssetPattern()

	for _, release := range releases {
		version := strings.TrimPrefix(release.TagName, "v")
		info := UpdateInfo{
			HasUpdate:      compareVersions(version, AppVersion) != 0,
			CurrentVersion: AppVersion,
			LatestVersion:  version,
			ReleaseNotes:   release.Body,
			PublishedAt:    release.PublishedAt,
		}

		for _, asset := range release.Assets {
			if strings.Contains(strings.ToLower(asset.Name), strings.ToLower(assetPattern)) {
				info.DownloadURL = asset.BrowserDownloadURL
				info.FileSize = asset.Size
				break
			}
		}

		result = append(result, info)
	}

	return result, nil
}

// SilentDownload 后台静默下载更新文件，不阻塞 UI，通过事件通知完成
func (a *App) SilentDownload(downloadURL string) {
	go func() {
		if downloadURL == "" {
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   "下载地址为空",
				"path":    "",
			})
			return
		}

		slog.Info("开始静默下载更新", "url", downloadURL)

		// 创建临时目录
		tmpDir := filepath.Join(os.TempDir(), "codecast-update")
		if err := os.MkdirAll(tmpDir, 0755); err != nil {
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   "创建临时目录失败: " + err.Error(),
				"path":    "",
			})
			return
		}

		fileName := filepath.Base(downloadURL)
		destPath := filepath.Join(tmpDir, fileName)

		// 如果文件已存在，直接返回成功（避免重复下载）
		if stat, err := os.Stat(destPath); err == nil && stat.Size() > 0 {
			slog.Info("更新文件已存在，跳过下载", "path", destPath)
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": true,
				"error":   "",
				"path":    destPath,
			})
			return
		}

		// 执行下载
		client := &http.Client{Timeout: 15 * time.Minute}
		resp, err := client.Get(downloadURL)
		if err != nil {
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   "下载失败: " + err.Error(),
				"path":    "",
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("下载失败: HTTP %d", resp.StatusCode),
				"path":    "",
			})
			return
		}

		// 写入临时文件（先写 .tmp 再重命名，确保原子性）
		tmpPath := destPath + ".tmp"
		out, err := os.Create(tmpPath)
		if err != nil {
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   "创建文件失败: " + err.Error(),
				"path":    "",
			})
			return
		}

		totalSize := resp.ContentLength
		var downloaded int64
		buf := make([]byte, 64*1024)

		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				if _, writeErr := out.Write(buf[:n]); writeErr != nil {
					out.Close()
					os.Remove(tmpPath)
					wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
						"success": false,
						"error":   "写入文件失败: " + writeErr.Error(),
						"path":    "",
					})
					return
				}
				downloaded += int64(n)

				// 定期发送下载进度（每 5% 通知一次）
				if totalSize > 0 {
					percent := float64(downloaded) / float64(totalSize) * 100
					if int(percent)%5 == 0 {
						wailsRuntime.EventsEmit(a.ctx, "silent-download-progress", map[string]interface{}{
							"percent":    percent,
							"downloaded": downloaded,
							"total":      totalSize,
						})
					}
				}
			}
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				out.Close()
				os.Remove(tmpPath)
				wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
					"success": false,
					"error":   "下载中断: " + readErr.Error(),
					"path":    "",
				})
				return
			}
		}
		out.Close()

		// 原子性重命名
		if err := os.Rename(tmpPath, destPath); err != nil {
			os.Remove(tmpPath)
			wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
				"success": false,
				"error":   "重命名文件失败: " + err.Error(),
				"path":    "",
			})
			return
		}

		slog.Info("静默下载完成", "path", destPath, "size", downloaded)
		wailsRuntime.EventsEmit(a.ctx, "silent-download-complete", map[string]interface{}{
			"success": true,
			"error":   "",
			"path":    destPath,
		})
	}()
}

// ─── 增强更新系统：内部方法 ─────────────────────────────────────────

// getUpdateHistoryPath 获取更新历史文件路径（与 settingsPath 同目录）
func (a *App) getUpdateHistoryPath() string {
	dir := filepath.Dir(a.settingsPath)
	return filepath.Join(dir, "update-history.json")
}

// fetchAllReleases 获取所有发布版本列表（Gitee 优先，GitHub 备用）
func (a *App) fetchAllReleases(limit int) ([]githubRelease, error) {
	// 优先尝试 Gitee
	releases, err := a.fetchAllReleasesFromGitee(limit)
	if err == nil {
		return releases, nil
	}
	slog.Debug("Gitee 获取版本列表失败，尝试 GitHub", "error", err)

	// 回退到 GitHub
	releases, err = a.fetchAllReleasesFromGitHub(limit)
	if err != nil {
		return nil, fmt.Errorf("获取版本列表失败（Gitee 和 GitHub 均不可用）: %w", err)
	}
	return releases, nil
}

// fetchAllReleasesFromGitee 从 Gitee 获取版本列表
func (a *App) fetchAllReleasesFromGitee(limit int) ([]githubRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases?page=1&per_page=%d", GiteeAPIBase, GiteeOwner, GiteeRepo, limit)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "CodeCast/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Gitee 网络请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gitee API 返回 %d", resp.StatusCode)
	}

	var giteeReleases []struct {
		TagName   string `json:"tag_name"`
		Name      string `json:"name"`
		Body      string `json:"body"`
		CreatedAt string `json:"created_at"`
		Assets    []struct {
			Name               string `json:"name"`
			Size               int64  `json:"size"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&giteeReleases); err != nil {
		return nil, fmt.Errorf("解析 Gitee 响应失败: %w", err)
	}

	releases := make([]githubRelease, 0, len(giteeReleases))
	for _, gr := range giteeReleases {
		release := githubRelease{
			TagName:     gr.TagName,
			Name:        gr.Name,
			Body:        gr.Body,
			PublishedAt: gr.CreatedAt,
		}
		for _, asset := range gr.Assets {
			release.Assets = append(release.Assets, githubAsset{
				Name:               asset.Name,
				Size:               asset.Size,
				BrowserDownloadURL: asset.BrowserDownloadURL,
			})
		}
		releases = append(releases, release)
	}

	return releases, nil
}

// fetchAllReleasesFromGitHub 从 GitHub 获取版本列表
func (a *App) fetchAllReleasesFromGitHub(limit int) ([]githubRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/releases?per_page=%d", GitHubAPIBase, GitHubRepo, limit)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "CodeCast/"+AppVersion)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GitHub 网络请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回 %d", resp.StatusCode)
	}

	var releases []githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("解析 GitHub 响应失败: %w", err)
	}

	return releases, nil
}
