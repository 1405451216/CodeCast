package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ==================== Project ====================

type Project struct {
	ID               string `json:"id"`
	Path             string `json:"path"`
	Name             string `json:"name"`
	CreatedAt        int64  `json:"created_at"`
	LastAccessedAt   int64  `json:"last_accessed_at"`
	CustomInstructions string `json:"custom_instructions,omitempty"`
}

func (a *App) GetProjects() []Project {
	a.mu.RLock()
	defer a.mu.RUnlock()

	result := make([]Project, len(a.projects))
	copy(result, a.projects)
	return result
}

func (a *App) AddProject(path string) (Project, error) {
	if path == "" {
		return Project{}, fmt.Errorf("路径不能为空")
	}

	path = filepath.Clean(path)

	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return Project{}, fmt.Errorf("无效的文件夹路径")
	}

	name := filepath.Base(path)
	now := time.Now().Unix()
	project := Project{
		ID:                 fmt.Sprintf("proj_%d", time.Now().UnixNano()),
		Path:               path,
		Name:               name,
		CreatedAt:          now,
		LastAccessedAt:     now,
		CustomInstructions: "",
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	for _, p := range a.projects {
		if p.Path == path {
			return p, nil
		}
	}

	a.projects = append(a.projects, project)
	if err := a.saveProjectsToDisk(a.projects); err != nil {
		fmt.Printf("warning: save projects failed: %v\n", err)
	}
	return project, nil
}

func (a *App) RemoveProject(path string) error {
	path = filepath.Clean(path)

	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.projects {
		if p.Path == path {
			a.projects = append(a.projects[:i], a.projects[i+1:]...)
			if err := a.saveProjectsToDisk(a.projects); err != nil {
				fmt.Printf("warning: save projects failed: %v\n", err)
			}
			return nil
		}
	}
	return fmt.Errorf("项目不存在")
}

func (a *App) loadProjectsFromDisk() []Project {
	projectsPath := filepath.Join(filepath.Dir(a.settingsPath), "projects.json")
	data, err := os.ReadFile(projectsPath)
	if err != nil {
		return []Project{}
	}
	var projects []Project
	if err := json.Unmarshal(data, &projects); err != nil {
		return []Project{}
	}
	for i := range projects {
		projects[i].Path = filepath.Clean(projects[i].Path)
		if projects[i].ID == "" {
			projects[i].ID = fmt.Sprintf("proj_%d_%d", time.Now().UnixNano(), i)
		}
		// 兼容旧版 projects.json：缺少时间戳字段时跳过，避免前端显示 1970 年
		if projects[i].CreatedAt == 0 {
			projects[i].CreatedAt = projects[i].LastAccessedAt
		}
	}
	return projects
}

func (a *App) saveProjectsToDisk(projects []Project) error {
	projectsPath := filepath.Join(filepath.Dir(a.settingsPath), "projects.json")
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal projects failed: %v", err)
	}
	if err := os.WriteFile(projectsPath, data, 0600); err != nil {
		return fmt.Errorf("write projects file failed: %v", err)
	}
	return nil
}

// ==================== Path Sandbox ====================

func (a *App) isPathAllowed(targetPath string) error {
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("无法解析路径: %v", err)
	}
	absPath = filepath.Clean(absPath)

	if a.noProjectMode {
		tmpDir, err := os.UserCacheDir()
		if err != nil {
			tmpDir = os.TempDir()
		}
		codecastDir := filepath.Join(tmpDir, "codecast-workspace")
		os.MkdirAll(codecastDir, 0700)
		return nil
	}

	if len(a.projects) == 0 {
		return fmt.Errorf("没有可访问的项目目录，请先选择一个项目")
	}

	for _, p := range a.projects {
		dir := filepath.Clean(p.Path)
		if absPath == dir || strings.HasPrefix(absPath, dir+string(filepath.Separator)) {
			return nil
		}
	}

	return fmt.Errorf("路径 %s 不在允许的项目目录内", absPath)
}

// ==================== File Operations ====================

func (a *App) ListFiles(path string) ([]string, error) {
	if path == "" {
		path = "."
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() {
			name += "/"
		}
		files = append(files, name)
	}
	return files, nil
}

func (a *App) ReadFile(path string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return "", err
	}

	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.Size() > MaxReadFileSize {
		return "", fmt.Errorf("文件过大 (%s)，读取操作上限为 %s",
			formatFileSize(info.Size()), formatFileSize(MaxReadFileSize))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	// AP EventBus replaces recordToolIfEnabled
	a.emitToolEvent("ReadFile", fmt.Sprintf("读取了 %s (%s)", path, formatFileSize(info.Size())))

	return string(data), nil
}

func (a *App) WriteFile(path, content string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.isPathAllowed(path); err != nil {
		return err
	}

	dir := filepath.Dir(path)
	if err := a.isPathAllowed(dir); err != nil {
		return fmt.Errorf("目标目录不在允许范围内: %v", err)
	}

	contentSize := int64(len(content))
	if contentSize > MaxWriteFileSize {
		return fmt.Errorf("写入内容过大 (%s)，写入操作上限为 %s",
			formatFileSize(contentSize), formatFileSize(MaxWriteFileSize))
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %v", err)
	}

	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return err
	}

	// AP EventBus replaces recordToolIfEnabled
	a.emitToolEvent("WriteFile", fmt.Sprintf("写入了 %s (%s)", path, formatFileSize(contentSize)))

	if a.settings.AutoCommit {
		go a.gitAutoCommit(path)
	}

	return nil
}

// ==================== File Dialog ====================

func (a *App) SelectFile() (string, error) {
	result, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "所有文件", Pattern: "*.*"},
			{DisplayName: "图片", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp"},
			{DisplayName: "文档", Pattern: "*.txt;*.md;*.pdf;*.doc;*.docx"},
			{DisplayName: "代码", Pattern: "*.go;*.js;*.ts;*.py;*.java;*.c;*.cpp;*.h"},
		},
	})
	if err != nil {
		return "", err
	}
	return result, nil
}

func (a *App) SelectMultipleFiles() ([]string, error) {
	results, err := wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "所有文件", Pattern: "*.*"},
		},
	})
	if err != nil {
		return nil, err
	}
	return results, nil
}

func (a *App) SelectFolder() (string, error) {
	result, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择项目文件夹",
	})
	if err != nil {
		return "", err
	}
	return result, nil
}

// ==================== Workspace Files Panel ====================

type FileEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

func (a *App) GetWorkspaceFiles(dirPath string) ([]FileEntry, error) {
	a.mu.Lock()
	if dirPath == "" {
		if len(a.projects) > 0 {
			dirPath = a.projects[0].Path
		}
		if dirPath == "" {
			a.mu.Unlock()
			return nil, fmt.Errorf("no workspace directory")
		}
	}

	if err := a.isPathAllowed(dirPath); err != nil {
		a.mu.Unlock()
		return nil, err
	}
	a.mu.Unlock()

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	result := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		result = append(result, FileEntry{
			Name:    e.Name(),
			Path:    filepath.Join(dirPath, e.Name()),
			IsDir:   e.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02 15:04"),
		})
	}
	return result, nil
}

func (a *App) ReadFileContent(filePath string) (string, error) {
	a.mu.Lock()
	if err := a.isPathAllowed(filePath); err != nil {
		a.mu.Unlock()
		return "", err
	}
	a.mu.Unlock()

	info, err := os.Stat(filePath)
	if err != nil {
		return "", fmt.Errorf("文件未找到: %w", err)
	}
	if info.Size() > MaxPreviewFileSize {
		return "", fmt.Errorf("文件过大 (%s)，预览操作上限为 %s",
			formatFileSize(info.Size()), formatFileSize(MaxPreviewFileSize))
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	return string(data), nil
}

// ==================== Current Project ====================

func (a *App) SetCurrentProject(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.currentProjectID = id
	// 更新最后访问时间
	for i, p := range a.projects {
		if p.ID == id {
			a.projects[i].LastAccessedAt = time.Now().Unix()
			break
		}
	}
}

func (a *App) GetCurrentProject() *Project {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.getCurrentProjectLocked()
}

// UpdateProjectInstructions 更新项目的自定义指令
func (a *App) UpdateProjectInstructions(id, instructions string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.projects {
		if p.ID == id {
			a.projects[i].CustomInstructions = instructions
			return a.saveProjectsToDisk(a.projects)
		}
	}
	return fmt.Errorf("项目不存在: %s", id)
}

// getCurrentProjectLocked does the same as GetCurrentProject but assumes caller holds a.mu.
func (a *App) getCurrentProjectLocked() *Project {
	if a.currentProjectID == "" {
		return nil
	}
	for _, p := range a.projects {
		if p.ID == a.currentProjectID {
			return &p
		}
	}
	return nil
}
