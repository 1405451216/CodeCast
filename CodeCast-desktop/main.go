package main

import (
	"context"
	"embed"
	"fmt"
	"path/filepath"
	"runtime"
	"sync"

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
	activeSessionID string
	memoryCleanupStop chan struct{}
	taskSchedulerStop  chan struct{}
	agentPool     *AgentPool
	llmConfig     LLMProviderConfig
	mu            sync.Mutex
}

func NewApp() *App {
	cfg := DefaultConfig
	loadEnv(&cfg)

	app := &App{
		config:    &cfg,
		sessions:  []*Session{},
		tasks:     []*Task{},
		skills:    []*Skill{},
		projects:  []Project{},
		llmConfig: DefaultLLMProviderConfig(),
	}

	app.initSettings()
	app.initDefaultSkills()

	app.syncSettingsToConfig()

	if migrationNeeded && app.encryptionKey != nil {
		fmt.Println("migrating unencrypted API key to encrypted format...")
		if err := app.saveSettingsToFile(); err != nil {
			fmt.Printf("warning: failed to migrate API key to encrypted storage: %v\n", err)
		} else {
			fmt.Println("API key migration completed successfully")
			migrationNeeded = false
		}
	}

	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	memoryPath := filepath.Join(filepath.Dir(a.settingsPath), "memory.db")
	memoryStore, err := NewMemoryStore(memoryPath)
	if err != nil {
		fmt.Printf("[Warning] 记忆系统初始化失败: %v\n", err)
	} else {
		a.memory = memoryStore
		fmt.Printf("[Startup] 情景记忆系统已启动 (db: %s)\n", memoryPath)

		if deleted, cleanupErr := a.memory.CleanupExpired(); cleanupErr == nil && deleted > 0 {
			fmt.Printf("[Startup] 已清理 %d 条过期记忆\n", deleted)
		}

		a.memoryCleanupStop = make(chan struct{})
		StartAutoCleanup(a.memory, a.memoryCleanupStop)
		fmt.Println("[Startup] 记忆自动清理已启动（每24小时清理超过30天的记录）")
	}

	a.taskSchedulerStop = make(chan struct{})
	a.StartTaskScheduler(a.taskSchedulerStop)
	fmt.Println("[Startup] 任务调度器已启动（每分钟检查一次定时任务）")
	startCleanupGoroutine()
	fmt.Println("[Startup] 活跃连接清理机制已启动")
	a.agentPool = NewAgentPool(a, DefaultMaxConcurrency)
	fmt.Println("[Startup] 子 Agent 并发池已启动 (最大并发: 10)")
	go cleanupOldAgents()
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
		fmt.Println("[Shutdown] 情景记忆系统已关闭")
	}
	if a.agentPool != nil {
		a.agentPool.Shutdown()
		fmt.Println("[Shutdown] 子 Agent 并发池已关闭")
	}
	cleanupOnce.Do(func() { close(cleanupStopCh) })
	a.CancelRequest()
	fmt.Printf("[Shutdown] 已清理所有活跃连接，应用即将关闭\n")
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
