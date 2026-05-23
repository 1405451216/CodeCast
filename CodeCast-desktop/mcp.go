package main

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

// ==================== MCP Server Management ====================

func (a *App) AddMCPServer(name, url string) (*MCPServer, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	server := MCPServer{
		ID:      fmt.Sprintf("mcp_%d", time.Now().UnixNano()),
		Name:    name,
		URL:     url,
		Type:    "websocket",
		Enabled: true,
	}

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	return &a.settings.MCPServers[len(a.settings.MCPServers)-1], nil
}

func (a *App) AddMCPServerStdio(name, command string, args []string) (*MCPServer, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if args == nil {
		args = []string{}
	}

	server := MCPServer{
		ID:      fmt.Sprintf("mcp_%d", time.Now().UnixNano()),
		Name:    name,
		Command: command,
		Args:    args,
		Type:    "stdio",
		Enabled: true,
	}

	a.settings.MCPServers = append(a.settings.MCPServers, server)
	if err := a.saveSettingsToFile(); err != nil {
		return nil, err
	}
	return &a.settings.MCPServers[len(a.settings.MCPServers)-1], nil
}

func (a *App) RemoveMCPServer(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			if s.Builtin {
				return fmt.Errorf("内置 MCP 服务器不可删除")
			}
			a.settings.MCPServers = append(a.settings.MCPServers[:i], a.settings.MCPServers[i+1:]...)
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("MCP server not found: %s", id)
}

func (a *App) ToggleMCPServer(id string, enabled bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, s := range a.settings.MCPServers {
		if s.ID == id {
			a.settings.MCPServers[i].Enabled = enabled
			return a.saveSettingsToFile()
		}
	}
	return fmt.Errorf("MCP server not found: %s", id)
}

func (a *App) TestMCPServerConnection(id string) map[string]interface{} {
	result := map[string]interface{}{
		"connected": false,
		"latency":   0,
		"error":     "",
	}

	a.mu.Lock()
	var targetServer *MCPServer
	for _, s := range a.settings.MCPServers {
		if s.ID == id {
			targetServer = &s
			break
		}
	}
	a.mu.Unlock()

	if targetServer == nil {
		result["error"] = "MCP server not found"
		return result
	}

	startTime := time.Now()

	switch targetServer.Type {
	case "websocket":
		wsURL := targetServer.URL
		if !strings.HasPrefix(wsURL, "ws://") && !strings.HasPrefix(wsURL, "wss://") {
			result["error"] = "无效的 WebSocket URL"
			return result
		}
		httpURL := strings.Replace(wsURL, "ws://", "http://", 1)
		httpURL = strings.Replace(httpURL, "wss://", "https://", 1)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, "GET", httpURL, nil)
		if err != nil {
			result["error"] = fmt.Sprintf("构建请求失败: %v", err)
			return result
		}
		req.Header.Set("Connection", "Upgrade")
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Sec-WebSocket-Version", "13")
		req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")

		resp, err := httpClient.Do(req)
		if err != nil {
			result["error"] = fmt.Sprintf("连接失败: %v", err)
			return result
		}
		defer resp.Body.Close()

		if resp.StatusCode == 101 {
			result["connected"] = true
		} else if resp.StatusCode == 404 || resp.StatusCode == 403 || resp.StatusCode == 401 {
			result["connected"] = true
			result["error"] = fmt.Sprintf("服务器可达但返回 %d (非 WebSocket 升级，可能是 HTTP 端点)", resp.StatusCode)
		} else {
			result["error"] = fmt.Sprintf("服务器返回异常状态码: %d", resp.StatusCode)
		}

	case "stdio":
		if targetServer.Command == "" {
			result["error"] = "未配置命令"
			return result
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, targetServer.Command, targetServer.Args...)
		cmd.Stdin = &bytes.Buffer{}
		cmd.Stdout = &bytes.Buffer{}
		cmd.Stderr = &bytes.Buffer{}

		err := cmd.Start()
		if err != nil {
			result["error"] = fmt.Sprintf("启动进程失败: %v", err)
			return result
		}

		processDone := make(chan error, 1)
		go func() {
			processDone <- cmd.Wait()
		}()

		select {
		case <-processDone:
			result["connected"] = true
			result["error"] = "进程启动后立即退出，可能参数有误"
		case <-ctx.Done():
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
			result["connected"] = true
			result["error"] = ""
		}

	default:
		result["error"] = fmt.Sprintf("不支持的 MCP 类型: %s", targetServer.Type)
		return result
	}

	result["latency"] = time.Since(startTime).Milliseconds()
	fmt.Printf("[MCP] %s 连接测试完成 (延迟: %dms)\n", targetServer.Name, result["latency"])
	return result
}

func (a *App) GetMCPStatus() []map[string]interface{} {
	a.mu.Lock()
	defer a.mu.Unlock()

	var results []map[string]interface{}
	for _, s := range a.settings.MCPServers {
		status := map[string]interface{}{
			"id":      s.ID,
			"name":    s.Name,
			"type":    s.Type,
			"enabled": s.Enabled,
			"builtin": s.Builtin,
		}
		switch s.Type {
		case "websocket":
			status["endpoint"] = s.URL
		case "stdio":
			status["command"] = s.Command + " " + strings.Join(s.Args, " ")
		}
		results = append(results, status)
	}
	return results
}
