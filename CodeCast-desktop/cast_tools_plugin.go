package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

// 插件存储（生产应放 AP SQLiteStore）
var pluginStore *castPersistentStore[map[string]*castPluginInfo]

type castPluginInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Status  string `json:"status"`
	Source  string `json:"source"`
}

func registerPluginTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_plugin_list", "plugin",
			"列出已安装/可用的插件",
			json.RawMessage(`{
					"type": "object",
					"properties": {
						"source": {"type": "string", "enum": ["builtin","marketplace","all"]}
					}
				}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPluginList(ctx, args)
			},
		),
		newCastTool(a, "cast_plugin_install", "plugin",
			"安装插件（builtin/marketplace）",
			json.RawMessage(`{
					"type": "object",
					"properties": {"pluginId": {"type": "string"}},
					"required": ["pluginId"]
				}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPluginInstall(ctx, args)
			},
		),
		newCastTool(a, "cast_plugin_exec", "plugin",
			"调用插件命令",
			json.RawMessage(`{
					"type": "object",
					"properties": {
						"pluginId": {"type": "string"},
						"command":  {"type": "string"},
						"args":     {"type": "object"}
					},
					"required": ["pluginId","command"]
				}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPluginExec(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolPluginList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPluginListArgs
	_ = json.Unmarshal(args, &in)
	filter := orDefault(in.Source, "all")

	out := castPluginListResult{}
	pluginStore.Get(func(m map[string]*castPluginInfo) {
		for _, p := range m {
			if filter != "all" && p.Source != filter {
				continue
			}
			out.Plugins = append(out.Plugins, struct {
				ID      string `json:"id"`
				Name    string `json:"name"`
				Version string `json:"version"`
				Status  string `json:"status"`
			}{p.ID, p.Name, p.Version, p.Status})
		}
	})
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_plugin_list", "plugin", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPluginInstall(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPluginInstallArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	var alreadyInstalled bool
	pluginStore.Mutate(func(m map[string]*castPluginInfo) {
		if _, ok := m[in.PluginID]; ok {
			alreadyInstalled = true
			return
		}
		m[in.PluginID] = &castPluginInfo{
			ID: in.PluginID, Name: in.PluginID, Version: "1.0.0", Status: "active", Source: "marketplace",
		}
	})
	if alreadyInstalled {
		out := castPluginInstallResult{Installed: true, Message: "plugin " + in.PluginID + " already installed"}
		outJSON, _ := json.Marshal(out)
		return a.recordCastInvocation("cast_plugin_install", "plugin", "", args, string(outJSON), false, 0), nil
	}
	out := castPluginInstallResult{Installed: true, Message: "plugin " + in.PluginID + " installed"}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_plugin_install", "plugin", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPluginExec(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPluginExecArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	var ok bool
	pluginStore.Get(func(m map[string]*castPluginInfo) {
		_, ok = m[in.PluginID]
	})
	if !ok {
		return a.recordCastInvocation("cast_plugin_exec", "plugin", "", args,
			"plugin not installed: "+in.PluginID, true, 0), nil
	}
	// 桩实现：根据 pluginId 模拟输出
	output := fmt.Sprintf("[plugin %s] command %q executed with args %v", in.PluginID, in.Command, in.Args)
	out := castPluginExecResult{Output: output}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_plugin_exec", "plugin", "", args, string(outJSON), false, 0), nil
}
