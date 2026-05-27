package main

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed frontend/dist
var assets embed.FS

// ==================== App ====================

type App struct {
	ctx           context.Context
	config        *Config
	settings      *Settings
	settingsPath  string
	encryptionKey []byte
	sessions      []*Session
	tasks         []*Task
	skills        []*Skill
	projects      []Project
	currentProjectID string
	noProjectMode bool
	memory        *MemoryStore
	notes         *NotesStore
	activeSessionID string
	memoryCleanupStop chan struct{}
	taskSchedulerStop  chan struct{}
	agentPool        *AgentPool
	llmConfig        LLMProviderConfig
	migrationPending bool
	completor       *CodeCompletor
	mu               sync.RWMutex
}

func NewApp() *App {
	cfg := DefaultConfig

	app := &App{
		config:    &cfg,
		sessions:  []*Session{},
		tasks:     []*Task{},
		skills:    []*Skill{},
		projects:  []Project{},
		llmConfig: DefaultLLMProviderConfig(),
	}

	app.initSettings()
	app.initProjects()
	app.initDefaultSkills()

	app.syncSettingsToConfig()

	if app.migrationPending && app.encryptionKey != nil {
		fmt.Println("migrating unencrypted API key to encrypted format...")
		if err := app.saveSettingsToFile(); err != nil {
			fmt.Printf("warning: failed to migrate API key to encrypted storage: %v\n", err)
		} else {
			fmt.Println("API key migration completed successfully")
			app.migrationPending = false
		}
	}

	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	memoryPath := filepath.Join(filepath.Dir(a.settingsPath), "memory.db")
	memoryStore, err := NewMemoryStore(memoryPath)
	if err != nil {
		slog.Warn("记忆系统初始化失败", "error", err)
	} else {
		a.memory = memoryStore
		slog.Info("情景记忆系统已启动", "db", memoryPath)

		if deleted, cleanupErr := a.memory.CleanupExpired(); cleanupErr == nil && deleted > 0 {
			slog.Info("已清理过期记忆", "count", deleted)
		}

		a.memoryCleanupStop = make(chan struct{})
		StartAutoCleanup(a.memory, a.memoryCleanupStop)
		slog.Info("记忆自动清理已启动", "interval", "24h")

		notesDir := filepath.Join(filepath.Dir(a.settingsPath))
		notesStore, notesErr := NewNotesStore(notesDir)
		if notesErr != nil {
			slog.Warn("笔记系统初始化失败", "error", notesErr)
		} else {
			a.notes = notesStore
			slog.Info("结构化笔记系统已启动", "dir", notesDir)
			go func() {
				time.Sleep(5 * time.Minute)
				if deleted, cleanupErr := a.notes.CleanupOld(30); cleanupErr == nil && deleted > 0 {
					slog.Info("已清理过期笔记", "count", deleted)
				}
			}()
		}
	}

	a.taskSchedulerStop = make(chan struct{})
	a.StartTaskScheduler(a.taskSchedulerStop)
	slog.Info("任务调度器已启动", "interval", "1m")
	startCleanupGoroutine()
	slog.Info("活跃连接清理机制已启动")
	a.agentPool = NewAgentPool(a, DefaultMaxConcurrency)
	slog.Info("子 Agent 并发池已启动", "max_concurrency", DefaultMaxConcurrency)
	go cleanupOldAgents()

	// 从磁盘恢复持久化的 sessions
	a.loadPersistedSessions()

	// 后台自动检查更新
	go a.autoCheckUpdate()
}

func (a *App) domReady(ctx context.Context) {
}

func (a *App) shutdown(ctx context.Context) {
	if a.memoryCleanupStop != nil {
		close(a.memoryCleanupStop)
	}
	if a.taskSchedulerStop != nil {
		close(a.taskSchedulerStop)
	}
	if a.memory != nil {
		a.memory.Close()
		slog.Info("情景记忆系统已关闭")
	}
	if a.agentPool != nil {
		a.agentPool.Shutdown()
		slog.Info("子 Agent 并发池已关闭")
	}
	cleanupOnce.Do(func() { close(cleanupStopCh) })
	a.CancelRequest()
	slog.Info("应用即将关闭", "action", "cleaned_all_active_connections")
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "CodeCast",
		Width:            1400,
		Height:           900,
		MinWidth:         1024,
		MinHeight:        600,
		Frameless:        runtime.GOOS != "darwin",
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:       app.startup,
		OnDomReady:      app.domReady,
		OnShutdown:      app.shutdown,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   "CodeCast",
				Message: "AI 帮你写代码，把想法铸成产物",
			},
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		Linux: &linux.Options{
			WindowIsTranslucent: false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
