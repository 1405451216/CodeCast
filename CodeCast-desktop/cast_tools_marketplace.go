package main

import (
	"context"
	"encoding/json"

	ap "agentprimordia/pkg"
)

type castMarketplaceItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Author      string  `json:"author"`
	Stars       int     `json:"stars"`
	Rating      float64 `json:"rating"`
}

var marketplaceCatalog = []*castMarketplaceItem{
	{ID: "weather-pro", Name: "Weather Pro", Description: "高级天气查询（实时+预报）", Author: "CodeCast Labs", Stars: 128, Rating: 4.8},
	{ID: "github-stats", Name: "GitHub Stats", Description: "GitHub 仓库统计", Author: "Community", Stars: 86, Rating: 4.5},
	{ID: "sql-helper", Name: "SQL Helper", Description: "SQL 查询构造器+优化器", Author: "CodeCast Labs", Stars: 203, Rating: 4.9},
	{ID: "pdf-reader", Name: "PDF Reader", Description: "PDF 内容提取+问答", Author: "Community", Stars: 156, Rating: 4.6},
	{ID: "mermaid-live", Name: "Mermaid Live", Description: "实时 Mermaid 图表预览", Author: "Community", Stars: 92, Rating: 4.4},
}

func registerMarketplaceTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_marketplace_list", "marketplace",
			"列出插件市场条目",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"category": {"type": "string"},
					"query":    {"type": "string"}
				}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolMarketplaceList(ctx, args)
			},
		),
		newCastTool("cast_marketplace_install", "marketplace",
			"从市场安装插件/工具",
			json.RawMessage(`{
				"type": "object",
				"properties": {"itemId": {"type": "string"}},
				"required": ["itemId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolMarketplaceInstall(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolMarketplaceList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castMarketplaceListArgs
	_ = json.Unmarshal(args, &in)
	out := castMarketplaceListResult{}
	for _, it := range marketplaceCatalog {
		if in.Query != "" && !contains(it.Name, in.Query) && !contains(it.Description, in.Query) {
			continue
		}
		out.Items = append(out.Items, struct {
			ID          string  `json:"id"`
			Name        string  `json:"name"`
			Description string  `json:"description"`
			Author      string  `json:"author"`
			Stars       int     `json:"stars"`
			Rating      float64 `json:"rating"`
		}{it.ID, it.Name, it.Description, it.Author, it.Stars, it.Rating})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_marketplace_list", "marketplace", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolMarketplaceInstall(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castMarketplaceInstallArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	found := false
	for _, it := range marketplaceCatalog {
		if it.ID == in.ItemID {
			found = true
			break
		}
	}
	if !found {
		return a.recordCastInvocation("cast_marketplace_install", "marketplace", "", args,
			"item not found: "+in.ItemID, true, 0), nil
	}
	out := castMarketplaceInstallResult{Installed: true, Message: "installed " + in.ItemID}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_marketplace_install", "marketplace", "", args, string(outJSON), false, 0), nil
}

func contains(s, sub string) bool {
	return len(sub) > 0 && len(s) >= len(sub) && (s == sub || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
