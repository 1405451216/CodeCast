package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	ap "agentprimordia/pkg"
)

// castTool 是所有 Cast 工具的抽象基类。
// 它实现了 ap.Tool 接口的样板代码（Name/Description/Parameters 来自声明），
// 子类型只需实现 Execute()。
type castTool struct {
	name        string
	category    string
	description string
	parameters  json.RawMessage
	execute     func(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error)
}

func (t *castTool) Name() string             { return t.name }
func (t *castTool) Description() string      { return t.description }
func (t *castTool) Parameters() json.RawMessage { return t.parameters }
func (t *castTool) Execute(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	return t.execute(ctx, args)
}

// newCastTool 创建 Cast 工具实例。
// parameters 可以为 nil（无参数工具）。
func newCastTool(name, category, description string, parameters json.RawMessage, fn func(context.Context, json.RawMessage) (*ap.ToolResult, error)) *castTool {
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
