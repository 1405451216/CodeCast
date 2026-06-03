package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	ap "agentprimordia/pkg"
)

// castTool 是所有 Cast 工具的抽象基类。
// 它实现了 ap.Tool 接口的样板代码（Name/Description/Parameters 来自声明），
// 子类型只需实现 Execute() —— Execute 通过 *App 闭包注入，调用具体方法。
type castTool struct {
	name        string
	category    string
	description string
	parameters  json.RawMessage
	execute     func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error)
}

func (t *castTool) Name() string             { return t.name }
func (t *castTool) Description() string      { return t.description }
func (t *castTool) Parameters() json.RawMessage { return t.parameters }
func (t *castTool) Execute(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	if castApp == nil {
		return &ap.ToolResult{Content: "castApp not initialized", IsError: true}, nil
	}
	return t.execute(ctx, castApp, args)
}

// castApp 全局 Cast App 引用（main.go startup 中设置）。
// 用于 castTool.Execute 把 *App 传给方法实现。
var castApp *App

// SetCastApp 初始化全局 castApp 引用。
func (a *App) SetCastApp() { castApp = a }

// newCastTool 创建 Cast 工具实例。
// parameters 可以为 nil（无参数工具）。
// fn 是 *App 上的方法，签名 func(ctx, *App, args) (*ToolResult, error)。
func newCastTool(name, category, description string, parameters json.RawMessage, fn func(context.Context, *App, json.RawMessage) (*ap.ToolResult, error)) *castTool {
	if parameters == nil {
		parameters = json.RawMessage(`{"type":"object","properties":{}}`)
	}
	return &castTool{
		name:        name,
		category:    category,
		description: description,
		parameters:  parameters,
		execute:     fn,
	}
}

// castToolRegistry 跟踪所有已注册的 Cast 工具及其调用历史。
type castToolRegistry struct {
	mu      sync.RWMutex
	history []CastToolInvocation
}

type CastToolInvocation struct {
	ID         string `json:"id"`
	ToolName   string `json:"toolName"`
	Category   string `json:"category"`
	Args       string `json:"args"`
	Result     string `json:"result"`
	IsError    bool   `json:"isError"`
	SessionID  string `json:"sessionId"`
	DurationMs int64  `json:"durationMs"`
}

// RegisterCastTools 把所有 Cast 工具注册到 AP ToolRegistry。
// 工具集按类别分文件（cast_tools_writing.go / cast_tools_translation.go 等），
// 每个文件暴露一个 registerXxxTools(reg *castToolRegistry, toolkit *ap.ToolRegistry) 函数，
// 本文件统一调度。
func (a *App) RegisterCastTools(toolkit *ap.ToolRegistry) error {
	if a.castReg == nil {
		a.castReg = &castToolRegistry{}
	}

	// 顺序注册所有 Cast 工具
	for _, r := range []func(*ap.ToolRegistry) error{
		// 内容生成类
		registerWritingTools,
		registerTranslationTools,
		registerKBTools,
		registerEmailTools,
		// 日程 / 调度
		registerScheduleTools,
		// 工具箱
		registerTodoTools,
		registerMiscTools,
		// 管理类
		registerPluginTools,
		registerSandboxTools,
		registerMemoryTools,
		registerPerfTools,
		registerLearningTools,
		registerSecurityTools,
		registerChannelTools,
		registerCollabTools,
		registerSoulTools,
		registerMarketplaceTools,
	} {
		if err := r(toolkit); err != nil {
			return err
		}
	}

	slog.Info("Cast 工具注册完成", "count", toolkit.Count())
	return nil
}

// recordInvocation 记录一次工具调用（供 ToolPanel 历史展示）。
func (r *castToolRegistry) recordInvocation(inv CastToolInvocation) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.history = append(r.history, inv)
	if len(r.history) > 200 {
		r.history = r.history[len(r.history)-200:]
	}
}

// castLLM 是 Cast 工具调用 LLM 的统一入口。
// 复用 createProvider() 拿 AP Provider，构造系统+用户 Prompt，单轮 Complete 返回。
// 所有 Cast 内容生成类 Tool 都通过这个函数调 LLM，避免每个 Tool 重复样板代码。
//
// IMPORTANT: 调用方必须已持有 a.mu（因为 createProvider 要求）。
func (a *App) castLLM(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	a.mu.Lock()
	provider, err := a.createProvider()
	a.mu.Unlock()
	if err != nil {
		return "", fmt.Errorf("create provider: %w", err)
	}

	temp := 0.7
	resp, err := provider.Complete(ctx, &ap.CompletionRequest{
		Messages: []ap.ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: &temp,
		MaxTokens:   4096,
	})
	if err != nil {
		return "", fmt.Errorf("llm complete: %w", err)
	}
	return resp.Content, nil
}

// recordCastInvocation 便捷函数：记录一次 Cast 工具调用 + 返回 ToolResult。
func (a *App) recordCastInvocation(toolName, category, sessionID string, args json.RawMessage, result string, isError bool, durationMs int64) *ap.ToolResult {
	if a.castReg != nil {
		a.castReg.recordInvocation(CastToolInvocation{
			ID:         fmt.Sprintf("%s_%d", toolName, time.Now().UnixNano()),
			ToolName:   toolName,
			Category:   category,
			Args:       string(args),
			Result:     result,
			IsError:    isError,
			SessionID:  sessionID,
			DurationMs: durationMs,
		})
	}
	if isError {
		return &ap.ToolResult{Content: result, IsError: true}
	}
	return &ap.ToolResult{Content: result, IsError: false}
}

// toolToApTools 把 castTool 列表转为 ap.Tool 接口列表（RegisterMultiple 需要）。
func toolToApTools(tools []*castTool) []ap.Tool {
	out := make([]ap.Tool, len(tools))
	for i, t := range tools {
		out[i] = t
	}
	return out
}

// orDefault 字符串默认值。
func orDefault(s, d string) string {
	if s == "" {
		return d
	}
	return s
}

// nowMs 当前毫秒时间戳。
func nowMs() int64 {
	return time.Now().UnixMilli()
}

// parseNumberedList 从 LLM 响应中提取有序列表（1. xxx\n2. yyy）。
func parseNumberedList(text string) []string {
	var out []string
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// 匹配 "1. xxx" 或 "1) xxx" 或 "- xxx" 或 "• xxx"
		for _, prefix := range []string{".", ")", "- ", "• "} {
			idx := strings.Index(line, prefix)
			if idx > 0 && isAllDigit(line[:idx]) {
				out = append(out, strings.TrimSpace(line[idx+len(prefix):]))
				break
			}
		}
	}
	return out
}

func isAllDigit(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// GetToolHistory 返回最近的工具调用历史。
func (a *App) GetToolHistory(sessionID string, limit int) []CastToolInvocation {
	if a.castReg == nil {
		return nil
	}
	a.castReg.mu.RLock()
	defer a.castReg.mu.RUnlock()
	var out []CastToolInvocation
	for i := len(a.castReg.history) - 1; i >= 0 && len(out) < limit; i-- {
		inv := a.castReg.history[i]
		if sessionID == "" || inv.SessionID == sessionID {
			out = append(out, inv)
		}
	}
	return out
}
