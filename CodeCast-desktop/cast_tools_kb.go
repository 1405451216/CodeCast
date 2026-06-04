package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	ap "agentprimordia/pkg"
)

func registerKBTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_kb_search", "knowledge",
			"全文搜索知识库（基于 SQLite FTS5）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"query": {"type": "string"},
					"limit": {"type": "integer", "description": "默认 10"}
				},
				"required": ["query"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolKBSearch(ctx, args)
			},
		),
		newCastTool(a, "cast_kb_save", "knowledge",
			"保存笔记到知识库",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"title":   {"type": "string"},
					"content": {"type": "string"},
					"tags":    {"type": "array", "items": {"type": "string"}}
				},
				"required": ["title","content"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolKBSave(ctx, args)
			},
		),
		newCastTool(a, "cast_kb_link", "knowledge",
			"建立两个笔记的双向链接（Obsidian 风格 [[link]]）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"from": {"type": "string", "description": "源笔记标题"},
					"to":   {"type": "string", "description": "目标笔记标题"}
				},
				"required": ["from","to"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolKBLink(ctx, args)
			},
		),
		newCastTool(a, "cast_kb_ingest", "knowledge",
			"将目录中的文档批量导入知识库（自动分块、存储到 RAG）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"directory": {"type": "string", "description": "要导入的目录路径"},
					"chunkSize": {"type": "integer", "description": "分块大小（字符数），默认 512"},
					"chunkOverlap": {"type": "integer", "description": "分块重叠（字符数），默认 64"},
					"extensions": {"type": "array", "items": {"type": "string"}, "description": "文件扩展名过滤，如 ['.go','.md']，空则自动检测文本文件"}
				},
				"required": ["directory"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolKBIngest(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolKBSearch(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castKBSearchArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}

	start := nowMs()
	if a.memory == nil {
		return a.recordCastInvocation("cast_kb_search", "knowledge", "", args, "memory not initialized", true, 0), nil
	}
	episodes, err := a.memory.Search(ctx, in.Query, &ap.SearchOptions{
		Query:     in.Query,
		SessionID: "_kb",
		Limit:     limit,
	})
	if err != nil {
		return a.recordCastInvocation("cast_kb_search", "knowledge", "", args, err.Error(), true, nowMs()-start), nil
	}

	hits := make([]map[string]any, 0, len(episodes))
	for _, ep := range episodes {
		title := ep.Summary
		if title == "" {
			title = truncate(ep.Content, 60)
		}
		hits = append(hits, map[string]any{
			"id":      ep.ID,
			"title":   title,
			"snippet": truncate(ep.Content, 200),
			"score":   ep.Importance,
		})
	}
	out := castKBSearchResult{Hits: make([]struct {
		Title   string  `json:"title"`
		Snippet string  `json:"snippet"`
		Score   float64 `json:"score"`
	}, 0, len(hits))}
	for _, h := range hits {
		title, _ := h["title"].(string)
		snippet, _ := h["snippet"].(string)
		score, _ := h["score"].(float64)
		out.Hits = append(out.Hits, struct {
			Title   string  `json:"title"`
			Snippet string  `json:"snippet"`
			Score   float64 `json:"score"`
		}{Title: title, Snippet: snippet, Score: score})
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_kb_search", "knowledge", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolKBSave(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castKBSaveArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	if a.memory == nil {
		return a.recordCastInvocation("cast_kb_save", "knowledge", "", args, "memory not initialized", true, 0), nil
	}

	start := nowMs()
	ep := &ap.Episode{
		SessionID:  "_kb",
		Role:       string(ap.RoleSystem),
		Content:    in.Content,
		Summary:    in.Title,
		Topics:     joinTags(in.Tags),
		Importance: 0.7,
		Metadata: map[string]string{
			"type": "note",
			"tags": joinTags(in.Tags),
		},
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	if err := a.memory.Add(ctx, ep); err != nil {
		return a.recordCastInvocation("cast_kb_save", "knowledge", "", args, err.Error(), true, nowMs()-start), nil
	}
	out := castKBSaveResult{ID: ep.ID}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_kb_save", "knowledge", "", args, string(outJSON), false, nowMs()-start), nil
}

func (a *App) castToolKBLink(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castKBLinkArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	// 简单实现：在源笔记中追加 [[目标]]
	if a.memory == nil {
		return a.recordCastInvocation("cast_kb_link", "knowledge", "", args, "memory not initialized", true, 0), nil
	}
	linkNote := fmt.Sprintf("\n\nLinked: [[%s]]", in.To)
	ep := &ap.Episode{
		SessionID:  "_kb",
		Role:       string(ap.RoleSystem),
		Content:    linkNote,
		Summary:    in.From,
		Topics:     "link",
		Importance: 0.3,
		Metadata:   map[string]string{"type": "link", "from": in.From, "to": in.To},
		CreatedAt:  time.Now().Format(time.RFC3339),
	}
	if err := a.memory.Add(ctx, ep); err != nil {
		return a.recordCastInvocation("cast_kb_link", "knowledge", "", args, err.Error(), true, 0), nil
	}
	out := map[string]any{"from": in.From, "to": in.To, "linked": true}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_kb_link", "knowledge", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolKBIngest(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		Directory    string   `json:"directory"`
		ChunkSize    int      `json:"chunkSize"`
		ChunkOverlap int      `json:"chunkOverlap"`
		Extensions   []string `json:"extensions"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}

	if in.Directory == "" {
		return a.recordCastInvocation("cast_kb_ingest", "knowledge", "", args, "directory is required", true, 0), nil
	}

	start := nowMs()
	cfg := DocumentPipelineConfig{
		ChunkSize:    in.ChunkSize,
		ChunkOverlap: in.ChunkOverlap,
		MaxFileSize:  1024 * 1024,
		Extensions:   in.Extensions,
	}
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 512
	}
	if cfg.ChunkOverlap < 0 {
		cfg.ChunkOverlap = 64
	}

	result, err := a.IngestDirectory(in.Directory, cfg)
	if err != nil {
		return a.recordCastInvocation("cast_kb_ingest", "knowledge", "", args, err.Error(), true, nowMs()-start), nil
	}

	outJSON, _ := json.Marshal(result)
	return a.recordCastInvocation("cast_kb_ingest", "knowledge", "", args, string(outJSON), false, nowMs()-start), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func joinTags(tags []string) string {
	out := ""
	for i, t := range tags {
		if i > 0 {
			out += ","
		}
		out += t
	}
	return out
}
