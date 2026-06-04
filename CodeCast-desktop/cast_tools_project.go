package main

import (
	"context"
	"encoding/json"
	"fmt"

	ap "agentprimordia/pkg"
)

// registerProjectTools 把项目文件操作注册为 AP Tool（让 AI 能直接调）
// 实际实现转发到 ap.builtin.FileSystem（agentprimordia 框架提供的安全文件系统）
func registerProjectTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_project_list_files", "project",
			"列出项目目录的文件/子目录",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"path":  {"type": "string", "description": "项目根目录绝对路径"},
					"recursive": {"type": "boolean", "description": "是否递归，默认 false"}
				},
				"required": ["path"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolProjectListFiles(ctx, args)
			},
		),
		newCastTool(a, "cast_project_read_file", "project",
			"读取项目中的文本文件",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"path":     {"type": "string", "description": "项目根目录"},
					"filePath": {"type": "string", "description": "文件相对路径"}
				},
				"required": ["path","filePath"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolProjectReadFile(ctx, args)
			},
		),
		newCastTool(a, "cast_project_write_file", "project",
			"写文本文件到项目（会触发 Checkpoint 高危拦截）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"path":     {"type": "string"},
					"filePath": {"type": "string"},
					"content":  {"type": "string"}
				},
				"required": ["path","filePath","content"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolProjectWriteFile(ctx, args)
			},
		),
		newCastTool(a, "cast_project_search", "project",
			"在项目目录中按模式搜索文件（路径匹配）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"path":    {"type": "string"},
					"pattern": {"type": "string", "description": "文件名前缀或扩展名，如 .go 或 main"}
				},
				"required": ["path","pattern"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolProjectSearch(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolProjectListFiles(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		Path      string `json:"path"`
		Recursive bool   `json:"recursive"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	action := "list"
	if in.Recursive {
		action = "list_recursive"
	}
	res, err := dispatchFS(in.Path, action, map[string]any{"path": in.Path})
	if err != nil {
		return a.recordCastInvocation("cast_project_list_files", "project", "", args, err.Error(), true, 0), nil
	}
	return a.recordCastInvocation("cast_project_list_files", "project", "", args, res.Content, res.IsError, 0), nil
}

func (a *App) castToolProjectReadFile(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		Path     string `json:"path"`
		FilePath string `json:"filePath"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	// Validate that the file path is within an allowed project directory
	if err := a.isPathAllowedBridge(in.FilePath); err != nil {
		return a.recordCastInvocation("cast_project_read_file", "project", "", args,
			"path not allowed: "+err.Error(), true, 0), nil
	}
	start := nowMs()
	content, err := a.ReadFile(in.FilePath)
	if err != nil {
		return a.recordCastInvocation("cast_project_read_file", "project", "", args, err.Error(), true, nowMs()-start), nil
	}
	return a.recordCastInvocation("cast_project_read_file", "project", "", args, content, false, nowMs()-start), nil
}

func (a *App) castToolProjectWriteFile(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		Path     string `json:"path"`
		FilePath string `json:"filePath"`
		Content  string `json:"content"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}

	// H14 fix: validate the target file path before writing to prevent unauthorized writes
	if err := a.isPathAllowedBridge(in.FilePath); err != nil {
		return a.recordCastInvocation("cast_project_write_file", "project", "", args,
			"path not allowed: "+err.Error(), true, 0), nil
	}

	// Acquire file lock before writing to prevent concurrent agent conflicts
	if a.fileLockMgr != nil {
		if !a.fileLockMgr.TryAcquire(in.FilePath) {
			return &ap.ToolResult{Content: fmt.Sprintf("file locked by another agent: %s", in.FilePath), IsError: true}, nil
		}
		defer a.fileLockMgr.Release(in.FilePath)
	}

	start := nowMs()
	if err := a.WriteFile(in.FilePath, in.Content); err != nil {
		return a.recordCastInvocation("cast_project_write_file", "project", "", args, err.Error(), true, nowMs()-start), nil
	}
	return a.recordCastInvocation("cast_project_write_file", "project", "", args, "written "+in.FilePath, false, nowMs()-start), nil
}

func (a *App) castToolProjectSearch(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		Path    string `json:"path"`
		Pattern string `json:"pattern"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	res, err := dispatchFS(in.Path, "search", map[string]any{"path": in.Path, "pattern": in.Pattern})
	if err != nil {
		return a.recordCastInvocation("cast_project_search", "project", "", args, err.Error(), true, 0), nil
	}
	return a.recordCastInvocation("cast_project_search", "project", "", args, res.Content, res.IsError, 0), nil
}
