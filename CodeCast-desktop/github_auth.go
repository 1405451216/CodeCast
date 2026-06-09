package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ==================== 常量 ====================

const (
	githubCallbackPort = 18789
	githubAuthStateLen = 32
	githubTokenFile    = "github_auth.json"
)

// GitHub OAuth 凭据 — 从环境变量读取作为全局默认值
// 环境变量: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
// 也可以通过 SetGitHubOAuthCredentials 在运行时设置（会覆盖环境变量）
var (
	githubClientID     string
	githubClientSecret string
)

func init() {
	githubClientID = os.Getenv("GITHUB_CLIENT_ID")
	githubClientSecret = os.Getenv("GITHUB_CLIENT_SECRET")

	if githubClientID != "" {
		slog.Info("[OAUTH] GitHub Client ID 已从环境变量加载",
			"env", "GITHUB_CLIENT_ID",
			"length", len(githubClientID),
		)
	} else {
		slog.Warn("[OAUTH] GITHUB_CLIENT_ID 环境变量未设置，GitHub OAuth 功能将不可用")
	}

	if githubClientSecret != "" {
		slog.Info("[OAUTH] GitHub Client Secret 已从环境变量加载",
			"env", "GITHUB_CLIENT_SECRET",
			"length", len(githubClientSecret),
		)
	} else {
		slog.Warn("[OAUTH] GITHUB_CLIENT_SECRET 环境变量未设置，GitHub OAuth 功能将不可用")
	}
}

// ==================== 数据结构 ====================

// GitHubUser 存储的 GitHub 用户信息
type GitHubUser struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	ID        int64  `json:"id"`
}

// githubAuthData 持久化的认证数据
type githubAuthData struct {
	AccessToken string     `json:"access_token"`
	TokenType   string     `json:"token_type"`
	Scope       string     `json:"scope"`
	User        GitHubUser `json:"user"`
	ExpiresAt   time.Time  `json:"expires_at"`
}

// ==================== GitHub Auth 管理器 ====================

type githubAuthMgr struct {
	mu       sync.RWMutex
	data     *githubAuthData
	server   *http.Server
	pending  chan *githubAuthData // OAuth 回调结果通道
	state    string               // 当前 OAuth 流程的 state
	dataPath string               // 认证数据文件路径
}

var ghAuth = &githubAuthMgr{
	pending: make(chan *githubAuthData, 1),
}

// initGitHubAuth 初始化 GitHub 认证管理器，加载已存储的凭据
func (a *App) initGitHubAuth() error {
	dir := filepath.Dir(a.settingsPath)
	ghAuth.dataPath = filepath.Join(dir, githubTokenFile)

	// H18 fix: use loadGitHubAuthWithDecryption to support encrypted tokens.
	// saveGitHubAuth encrypts the access_token with the app encryption key,
	// so we must decrypt it on load — otherwise CallGitHubAPI would use the
	// ciphertext as the token, failing all requests.
	storeData, err := a.loadGitHubAuthWithDecryption()
	if err != nil {
		if os.IsNotExist(err) {
			return nil // 未登录过，正常
		}
		return fmt.Errorf("加载 github auth 失败: %w", err)
	}

	// 检查 token 是否过期
	if !storeData.ExpiresAt.IsZero() && time.Now().After(storeData.ExpiresAt) {
		slog.Info("github access_token 已过期，清除")
		os.Remove(ghAuth.dataPath)
		return nil
	}

	ghAuth.mu.Lock()
	ghAuth.data = storeData
	ghAuth.mu.Unlock()
	slog.Info("github auth 已加载", "user", storeData.User.Login)
	return nil
}

// ==================== 公开方法（Wails 绑定） ====================

// getGitHubOAuthCredentials returns the OAuth credentials from app settings first,
// falling back to environment variables. This allows users to configure OAuth
// through the settings UI (which gets encrypted + persisted) without env vars.
func (a *App) getGitHubOAuthCredentials() (clientID, clientSecret string) {
	a.mu.RLock()
	if a.settings != nil {
		clientID = a.settings.GithubClientID
		clientSecret = a.settings.GithubClientSecret
	}
	a.mu.RUnlock()

	// Decrypt if encrypted (settings store encrypted values)
	if a.encryptionKey != nil {
		if isEncrypted(clientID) {
			if dec, err := decryptAPIKey(clientID, a.encryptionKey); err == nil {
				clientID = dec
			}
		}
		if isEncrypted(clientSecret) {
			if dec, err := decryptAPIKey(clientSecret, a.encryptionKey); err == nil {
				clientSecret = dec
			}
		}
	}

	// Fall back to environment variables
	if clientID == "" {
		clientID = githubClientID
	}
	if clientSecret == "" {
		clientSecret = githubClientSecret
	}

	return
}

// SetGitHubOAuthCredentials persists GitHub OAuth credentials to app settings.
// This is a Wails binding so users can configure OAuth from the settings UI.
func (a *App) SetGitHubOAuthCredentials(clientID, clientSecret string) {
	slog.Info("[OAUTH] GitHub OAuth credentials configured", "client_id_len", len(clientID))

	a.mu.Lock()
	a.settings.GithubClientID = clientID
	a.settings.GithubClientSecret = clientSecret
	err := a.saveSettingsToFile()
	a.mu.Unlock()

	if err != nil {
		slog.Warn("保存 GitHub OAuth 凭据失败", "error", err)
	}

	ghAuth.mu.Lock()
	if clientID != "" {
		githubClientID = clientID
	}
	if clientSecret != "" {
		githubClientSecret = clientSecret
	}
	ghAuth.mu.Unlock()
}

// GetGitHubOAuthStatus returns whether OAuth credentials are configured.
func (a *App) GetGitHubOAuthStatus() map[string]interface{} {
	cid, csec := a.getGitHubOAuthCredentials()
	return map[string]interface{}{
		"client_id_set":     cid != "",
		"client_secret_set": csec != "",
		"client_id_hint":    maskClientID(cid),
		"logged_in":         ghAuth.data != nil,
	}
}

func maskClientID(id string) string {
	if id == "" {
		return ""
	}
	if len(id) <= 8 {
		return id[:2] + "****"
	}
	return id[:4] + "****" + id[len(id)-4:]
}

// StartGitHubLogin 启动 GitHub OAuth 登录流程。
// Credentials are read from app settings first (encrypted on disk), then
// environment variables as fallback. One user configures it in Settings,
// all users on that machine get it.
func (a *App) StartGitHubLogin() (string, error) {
	clientID, clientSecret := a.getGitHubOAuthCredentials()

	slog.Info("[OAUTH] StartGitHubLogin 开始",
		"client_id_set", clientID != "",
		"client_secret_set", clientSecret != "",
	)

	if clientID == "" {
		return "", fmt.Errorf(
			"GitHub OAuth 未配置。\n\n"+
				"请按以下步骤配置：\n"+
				"1. 访问 https://github.com/settings/developers\n"+
				"2. 点击 New OAuth App 创建新应用\n"+
				"3. 设置 Homepage URL: http://localhost:18789\n"+
				"4. 设置 Callback URL: http://localhost:18789/callback\n"+
				"5. 获取 Client ID 和 Client Secret\n"+
				"6. 在 CodeCast 设置中填入凭据，其他用户无需重复配置",
		)
	}

	if clientSecret == "" {
		return "", fmt.Errorf("GitHub Client Secret 未配置，请在 CodeCast 设置中填入")
	}

	if !strings.HasPrefix(clientID, "Iv1.") &&
		!strings.HasPrefix(clientID, "Ov23.") &&
		len(clientID) < 20 {
		slog.Warn("[OAUTH] client_id 格式可能不正确",
			"prefix", clientID[:min(4, len(clientID))],
			"length", len(clientID),
		)
	}

	ghAuth.mu.Lock()
	defer ghAuth.mu.Unlock()

	// 生成随机 state 防 CSRF
	stateBytes := make([]byte, githubAuthStateLen)
	if _, err := rand.Read(stateBytes); err != nil {
		return "", fmt.Errorf("生成 state 失败: %w", err)
	}
	ghAuth.state = hex.EncodeToString(stateBytes)

	// 构建 OAuth 授权 URL
	callbackURL := fmt.Sprintf("http://localhost:%d/callback", githubCallbackPort)
	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
		clientID,
		url.QueryEscape(callbackURL),
		url.QueryEscape("user repo read:org"),
		ghAuth.state,
	)

	slog.Info("[OAUTH] GitHub authorize URL 已构建",
		"callback", callbackURL,
		"client_id_prefix", clientID[:min(4, len(clientID))],
	)

	// 启动本地回调服务器
	if err := a.startCallbackServer(); err != nil {
		return "", fmt.Errorf("启动回调服务器失败: %w", err)
	}

	// 打开浏览器
	if err := openBrowser(authURL); err != nil {
		slog.Warn("无法自动打开浏览器", "error", err)
		// 不返回错误，用户可以手动打开
	}

	return "已在浏览器中打开 GitHub 登录页面", nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetGitHubUser 获取当前登录的 GitHub 用户信息
func (a *App) GetGitHubUser() (*GitHubUser, error) {
	ghAuth.mu.RLock()
	defer ghAuth.mu.RUnlock()

	if ghAuth.data == nil {
		return nil, nil // 未登录
	}
	return &ghAuth.data.User, nil
}

// IsGitHubLoggedIn 检查是否已登录 GitHub
func (a *App) IsGitHubLoggedIn() bool {
	ghAuth.mu.RLock()
	defer ghAuth.mu.RUnlock()
	return ghAuth.data != nil
}

// LogoutGitHub 注销 GitHub 登录
func (a *App) LogoutGitHub() (string, error) {
	ghAuth.mu.Lock()
	defer ghAuth.mu.Unlock()

	ghAuth.data = nil
	ghAuth.state = ""

	if err := os.Remove(ghAuth.dataPath); err != nil && !os.IsNotExist(err) {
		slog.Warn("删除 github auth 文件失败", "error", err)
	}

	// 通过事件通知前端状态变更
	a.emitEvent("auth:logout", map[string]string{"provider": "github"})

	return "已注销 GitHub 登录", nil
}

// CallGitHubAPI 用存储的 token 调用 GitHub REST API
func (a *App) CallGitHubAPI(method, path string) ([]byte, error) {
	ghAuth.mu.RLock()
	token := ""
	if ghAuth.data != nil {
		token = ghAuth.data.AccessToken
	}
	ghAuth.mu.RUnlock()

	if token == "" {
		return nil, fmt.Errorf("未登录 GitHub")
	}

	apiURL := "https://api.github.com" + path
	req, err := http.NewRequestWithContext(context.Background(), method, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "CodeCast")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("GitHub API 错误 (%d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// ==================== 内部方法 ====================

// startCallbackServer 启动本地 HTTP 服务器接收 OAuth 回调
func (a *App) startCallbackServer() error {
	// 先停掉旧的
	if ghAuth.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
		_ = ghAuth.server.Shutdown(ctx)
		cancel()
	}
	// 清空 pending
	select {
	case <-ghAuth.pending:
	default:
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", a.handleOAuthCallback)

	ghAuth.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", githubCallbackPort),
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		slog.Info("github oauth 回调服务器已启动", "port", githubCallbackPort)
		if err := ghAuth.server.ListenAndServe(); err != http.ErrServerClosed {
			slog.Error("github oauth 回调服务器错误", "error", err)
		}
	}()

	return nil
}

// handleOAuthCallback 处理 GitHub OAuth 回调
func (a *App) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	slog.Info("[OAUTH] 收到 OAuth 回调请求", "remote_addr", r.RemoteAddr)

	// 检查错误
	if errMsg := query.Get("error"); errMsg != "" {
		slog.Error("[OAUTH] OAuth 授权失败", "error_desc", query.Get("error_description"), "error", errMsg)
		http.Error(w, fmt.Sprintf("授权失败: %s", errMsg), http.StatusBadRequest)
		return
	}

	code := query.Get("code")
	state := query.Get("state")
	slog.Info("[OAUTH] 回调参数", "code_len", len(code), "state_len", len(state))

	// 校验 state
	ghAuth.mu.Lock()
	expectedState := ghAuth.state
	ghAuth.mu.Unlock()

	if state == "" || state != expectedState {
		slog.Error("[OAUTH] state 校验失败", "got", state, "expected", expectedState)
		http.Error(w, "无效的 state 参数", http.StatusBadRequest)
		return
	}

	// 用 code 换取 access_token
	tokenData, user, err := a.exchangeCodeForToken(code)
	if err != nil {
		slog.Error("交换 code 失败", "error", err)
		http.Error(w, fmt.Sprintf("获取 token 失败: %v", err), http.StatusInternalServerError)
		return
	}

	// 存储认证数据
	data := &githubAuthData{
		AccessToken: tokenData["access_token"].(string),
		TokenType:   tokenData["token_type"].(string),
		Scope:       tokenData["scope"].(string),
		User:        *user,
		ExpiresAt:   time.Now().Add(time.Hour * 8), // GitHub token 通常长期有效，设一个合理的过期时间
	}

	ghAuth.mu.Lock()
	ghAuth.data = data
	ghAuth.mu.Unlock()

	// 持久化
	if err := a.saveGitHubAuth(data); err != nil {
		slog.Warn("持久化 github auth 失败", "error", err)
	}

	// 通知前端
	a.emitEvent("auth:login", map[string]string{
		"provider": "github",
		"login":    user.Login,
	})

	// 返回成功页面 + 自动关闭
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html><head><title>登录成功</title>
<script>setTimeout(function(){window.close()},2000)</script></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#16a34a">
<div>&#10004; CodeCast GitHub 登录成功！此窗口将自动关闭。</div>
</body></html>`)

	// 停止回调服务器
	go func() {
		time.Sleep(time.Second * 2)
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
		_ = ghAuth.server.Shutdown(ctx)
		cancel()
	}()
}

// exchangeCodeForToken 用 authorization code 换取 access token 并获取用户信息
func (a *App) exchangeCodeForToken(code string) (map[string]interface{}, *GitHubUser, error) {
	clientID, clientSecret := a.getGitHubOAuthCredentials()

	slog.Info("[OAUTH] 开始用 code 换取 access_token",
		"client_id_len", len(clientID),
		"client_secret_len", len(clientSecret),
		"code_len", len(code),
	)

	// POST https://github.com/login/oauth/access_token
	tokenURL := "https://github.com/login/oauth/access_token"
	values := url.Values{}
	values.Set("client_id", clientID)
	values.Set("client_secret", clientSecret)
	values.Set("code", code)
	values.Set("accept", "json")

	req, err := http.NewRequestWithContext(context.Background(), "POST", tokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	var tokenData map[string]interface{}
	if err := json.Unmarshal(body, &tokenData); err != nil {
		return nil, nil, fmt.Errorf("解析 token 响应失败: %w", err)
	}

	// 检查错误
	if errMsg, ok := tokenData["error"]; ok {
		return nil, nil, fmt.Errorf("oauth 错误: %v", errMsg)
	}

	accessToken, _ := tokenData["access_token"].(string)
	if accessToken == "" {
		return nil, nil, fmt.Errorf("未收到 access_token")
	}

	// 用 token 获取用户信息
	user, err := a.fetchGitHubUser(accessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("获取用户信息失败: %w", err)
	}

	slog.Info("github 登录成功", "user", user.Login)
	return tokenData, user, nil
}

// fetchGitHubUser 用 access_token 获取当前 GitHub 用户信息
func (a *App) fetchGitHubUser(token string) (*GitHubUser, error) {
	req, err := http.NewRequestWithContext(context.Background(), "GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "CodeCast")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("获取用户信息失败 (%d): %s", resp.StatusCode, string(body))
	}

	var user GitHubUser
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, err
	}

	return &user, nil
}

// saveGitHubAuth 加密保存认证数据到本地文件。
// H19 fix: marshal a copy so the in-memory token is not corrupted by encryption.
func (a *App) saveGitHubAuth(data *githubAuthData) error {
	// 构建一个副本用于持久化，避免加密操作修改内存中的原始 token
	stored := *data
	if a.encryptionKey != nil {
		encrypted, err := encryptAPIKey(data.AccessToken, a.encryptionKey)
		if err == nil {
			stored.AccessToken = encrypted
		} else {
			slog.Warn("加密 github token 失败，将明文存储", "error", err)
		}
	}

	jsonData, err := json.Marshal(stored)
	if err != nil {
		return fmt.Errorf("序列化 github auth 失败: %w", err)
	}

	return os.WriteFile(ghAuth.dataPath, jsonData, 0600)
}

// loadGitHubAuthWithDecryption 从文件加载并解密 token
func (a *App) loadGitHubAuthWithDecryption() (*githubAuthData, error) {
	data, err := os.ReadFile(ghAuth.dataPath)
	if err != nil {
		return nil, err
	}

	var stored githubAuthData
	if err := json.Unmarshal(data, &stored); err != nil {
		return nil, err
	}

	// 解密 token
	if a.encryptionKey != nil && isEncrypted(stored.AccessToken) {
		decrypted, err := decryptAPIKey(stored.AccessToken, a.encryptionKey)
		if err == nil {
			stored.AccessToken = decrypted
		} else {
			slog.Warn("解密 github token 失败", "error", err)
		}
	}

	return &stored, nil
}

// openBrowser 打开默认浏览器访问指定 URL
func openBrowser(urlStr string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", urlStr)
	case "darwin":
		cmd = exec.Command("open", urlStr)
	default:
		cmd = exec.Command("xdg-open", urlStr)
	}
	return cmd.Start()
}
