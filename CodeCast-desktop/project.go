package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"

	ap "agentprimordia/pkg"
)

// ==================== Project ====================
// Project 是用户在 workspace 中注册的工作目录。
// 文件操作（List/Read/Write）已迁移到 ap.builtin.FileSystem + cast_project_* Tool。
// 本文件只管 Project 列表 + 路径白名单。

type Project struct {
	ID                  string `json:"id"`
	Path                string `json:"path"`
	Name                string `json:"name"`
	CreatedAt           int64  `json:"created_at"`
	LastAccessedAt      int64  `json:"last_accessed_at"`
	CustomInstructions  string `json:"custom_instructions,omitempty"`
}

const projectsFileName = "projects.json"

func (a *App) GetProjects() []Project {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make([]Project, len(a.projects))
	copy(result, a.projects)
	return result
}

func (a *App) AddProject(path string) (Project, error) {
	if path == "" {
		return Project{}, fmt.Errorf("path is empty")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return Project{}, fmt.Errorf("invalid path: %w", err)
	}
	if _, err := os.Stat(abs); err != nil {
		return Project{}, fmt.Errorf("path not accessible: %w", err)
	}

	// 基础路径安全检查
	if strings.Contains(filepath.Clean(abs), "..") {
		return Project{}, fmt.Errorf("path contains '..' (potential traversal)")
	}

	a.mu.Lock()
	for _, p := range a.projects {
		if p.Path == abs {
			a.mu.Unlock()
			return p, nil
		}
	}
	project := Project{
		ID:             generateID("proj"),
		Path:           abs,
		Name:           filepath.Base(abs),
		CreatedAt:      time.Now().Unix(),
		LastAccessedAt: time.Now().Unix(),
	}
	a.projects = append(a.projects, project)
	toSave := append([]Project{}, a.projects...)
	a.mu.Unlock()

	a.saveProjectsToDisk(toSave)
	return project, nil
}

func (a *App) RemoveProject(path string) error {
	a.mu.Lock()
	for i, p := range a.projects {
		if p.Path == path {
			a.projects = append(a.projects[:i], a.projects[i+1:]...)
			toSave := append([]Project{}, a.projects...)
			a.mu.Unlock()
			a.saveProjectsToDisk(toSave)
			return nil
		}
	}
	a.mu.Unlock()
	return fmt.Errorf("project not found: %s", path)
}

func (a *App) SetCurrentProject(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, p := range a.projects {
		if p.ID == id {
			a.currentProjectID = id
			a.projects[i].LastAccessedAt = time.Now().Unix()
			toSave := append([]Project{}, a.projects...)
			go a.saveProjectsToDisk(toSave)
			return
		}
	}
}

func (a *App) GetCurrentProject() *Project {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.getCurrentProjectLocked()
}

func (a *App) getCurrentProjectLocked() *Project {
	for i, p := range a.projects {
		if p.ID == a.currentProjectID {
			return &a.projects[i]
		}
	}
	return nil
}

func (a *App) UpdateProjectInstructions(id, instructions string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, p := range a.projects {
		if p.ID == id {
			a.projects[i].CustomInstructions = instructions
			toSave := append([]Project{}, a.projects...)
			go a.saveProjectsToDisk(toSave)
			return nil
		}
	}
	return fmt.Errorf("project not found: %s", id)
}

func (a *App) loadProjectsFromDisk() []Project {
	path := filepath.Join(filepath.Dir(a.settingsPath), projectsFileName)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var projects []Project
	if err := json.Unmarshal(data, &projects); err != nil {
		return nil
	}
	return projects
}

func (a *App) saveProjectsToDisk(projects []Project) error {
	if a.settingsPath == "" {
		return nil
	}
	path := filepath.Join(filepath.Dir(a.settingsPath), projectsFileName)
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (a *App) isPathAllowed(targetPath string) error {
	if targetPath == "" {
		return fmt.Errorf("path is empty")
	}
	cleaned := filepath.Clean(targetPath)
	if strings.Contains(cleaned, "..") {
		return fmt.Errorf("path contains '..' (potential traversal)")
	}

	// 必须在已注册 project 目录内
	a.mu.RLock()
	projectPaths := make([]string, len(a.projects))
	for i, p := range a.projects {
		projectPaths[i] = p.Path
	}
	noProjectMode := a.noProjectMode
	a.mu.RUnlock()

	if len(projectPaths) == 0 && !noProjectMode {
		return fmt.Errorf("no project configured")
	}

	if noProjectMode {
		return nil
	}

	abs, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}
	for _, pp := range projectPaths {
		absPP, err := filepath.Abs(pp)
		if err != nil {
			continue // skip invalid project paths
		}
		if abs == absPP || strings.HasPrefix(abs, absPP+string(filepath.Separator)) {
			return nil
		}
	}
	return fmt.Errorf("path outside registered projects: %s", abs)
}

// ==================== File System Operations via AP ====================
// 以下方法保留 Wails 绑定签名（前端 FilesPanel 依赖），
// 内部实现转发到 ap.builtin.FileSystem Execute。

// fsExecutor 缓存 per-project 的 FileSystem 实例
const maxFSCacheSize = 20

var fsExecutor = struct {
	sync.RWMutex
	cache map[string]ap.Tool
	keys  []string // track insertion order for eviction
}{cache: make(map[string]ap.Tool), keys: make([]string, 0)}

func getFileSystemFor(path string) (ap.Tool, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	fsExecutor.RLock()
	if fs, ok := fsExecutor.cache[abs]; ok {
		fsExecutor.RUnlock()
		return fs, nil
	}
	fsExecutor.RUnlock()
	fs, err := ap.NewFileSystem(abs)
	if err != nil {
		return nil, fmt.Errorf("init filesystem: %w", err)
	}
	fsExecutor.Lock()
	// Evict oldest entry if cache is full
	if len(fsExecutor.cache) >= maxFSCacheSize && fsExecutor.cache[abs] == nil {
		if len(fsExecutor.keys) > 0 {
			oldest := fsExecutor.keys[0]
			fsExecutor.keys = fsExecutor.keys[1:]
			delete(fsExecutor.cache, oldest)
		}
	}
	fsExecutor.cache[abs] = fs
	fsExecutor.keys = append(fsExecutor.keys, abs)
	fsExecutor.Unlock()
	return fs, nil
}

// dispatchFS 通用转发：调 FileSystem.Execute
func dispatchFS(rootPath string, action string, params map[string]any) (*ap.ToolResult, error) {
	fs, err := getFileSystemFor(rootPath)
	if err != nil {
		return &ap.ToolResult{Content: err.Error(), IsError: true}, nil
	}
	params["action"] = action
	argsJSON, _ := json.Marshal(params)
	return fs.Execute(nil, argsJSON)
}

// ListFiles 列出目录文件
func (a *App) ListFiles(path string) ([]string, error) {
	res, err := dispatchFS(path, "list", map[string]any{"path": path})
	if err != nil {
		return nil, err
	}
	if res.IsError {
		return nil, fmt.Errorf("%s", res.Content)
	}
	var list []string
	if err := json.Unmarshal([]byte(res.Content), &list); err != nil {
		return nil, err
	}
	return list, nil
}

// ReadFile 读文件
func (a *App) ReadFile(path string) (string, error) {
	res, err := dispatchFS(path, "read", map[string]any{"path": path})
	if err != nil {
		return "", err
	}
	if res.IsError {
		return "", fmt.Errorf("%s", res.Content)
	}
	return res.Content, nil
}

// WriteFile 写文件
func (a *App) WriteFile(path, content string) error {
	res, err := dispatchFS(path, "write", map[string]any{"path": path, "content": content})
	if err != nil {
		return err
	}
	if res.IsError {
		return fmt.Errorf("%s", res.Content)
	}
	return nil
}

// GetWorkspaceFiles 列出工作区所有文件（顶层）
// 详细元数据请用 cast_project_list_files Tool + ap.builtin.FileSystem
func (a *App) GetWorkspaceFiles(dirPath string) ([]string, error) {
	return a.ListFiles(dirPath)
}

// ReadFileContent 同 ReadFile（保留兼容）
func (a *App) ReadFileContent(filePath string) (string, error) {
	return a.ReadFile(filePath)
}

// SelectFile / SelectMultipleFiles / SelectFolder 用 Wails runtime dialog
func (a *App) SelectFile() (string, error) {
	return wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
	})
}

func (a *App) SelectMultipleFiles() ([]string, error) {
	return wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
	})
}

func (a *App) SelectFolder() (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择目录",
	})
}

// SetNoProjectMode / GetNoProjectMode 在 config.go 已有，删除这里的重复实现
