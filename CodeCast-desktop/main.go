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

	ap "agentprimordia/pkg"

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
	skills        []*Skill
	projects      []Project
	currentProjectID string
	noProjectMode bool
	activeSessionID string
	memoryCleanupStop chan struct{}
	taskSchedulerStop  chan struct{}
	migrationPending bool
	mu               sync.RWMutex

	// AP 框架核心
	agent            ap.Agent
	pool             *ap.Pool
	memory           *ap.SQLiteStore
	ragStore          *ap.RAGStore
	toolkit           *ap.ToolRegistry
	castReg           *castToolRegistry
	mcpReg            *ap.MCPRegistry
	eventBus          *ap.Bus
	metricsCollector  *ap.AgentMetricsCollector
	guardrail         *ap.GuardrailEngine
	guardrailHook     *ap.GuardrailHook
	hooks             *ap.HookManager
	checkpointStore   ap.CheckpointStore
	lifecycle         *ap.Lifecycle
	sessionAgents     map[string]ap.Agent
	sessionCancels    map[string]context.CancelFunc
	checkpointConfirmations map[string]chan bool

	// CodeCast 应用层（保留）
	llmConfig   LLMProviderConfig  // KEEP: syncSettingsToConfig() 依赖
	// completor 字段已删除（代码补全迁到 ap.CachedProvider）
	// notes 字段已删除（笔记功能迁到 cast_kb_* + ap.memory）
}

func NewApp() *App {
	cfg := DefaultConfig

	app := &App{
		config:    &cfg,
		sessions:  []*Session{},
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

	// 1. AP Memory (SQLite + FTS5)
	memoryPath := filepath.Join(filepath.Dir(a.settingsPath), "memory.db")
	apMemory, err := ap.NewSQLiteStore(memoryPath)
	if err != nil {
		slog.Warn("AP 记忆系统初始化失败", "error", err)
	} else {
		a.memory = apMemory
		slog.Info("AP 记忆系统已启动", "db", memoryPath)
	}

	// 2. AP EventBus (bufferSize=64)
	a.eventBus = ap.NewBus(64)
	slog.Info("AP EventBus 已启动")

	// 3. AP Metrics
	a.metricsCollector = ap.NewMetrics()
	slog.Info("AP Metrics 已启动")

	// 4. AP Guardrail + GuardrailHook
	a.guardrail = ap.NewGuardrailEngine()
	a.guardrailHook = a.setupGuardrails() // checkpoint_hook.go
	slog.Info("AP Guardrails 已启动")

	// 5. AP Toolkit — DefaultToolkit(cfg ToolkitConfig) (*Registry, error)
	projectPath := ""
	a.mu.RLock()
	if cp := a.getCurrentProjectLocked(); cp != nil {
		projectPath = cp.Path
	}
	a.mu.RUnlock()
	var toolkitErr error
	a.toolkit, toolkitErr = ap.DefaultToolkit(ap.ToolkitConfig{
		RootDir:      projectPath,
		EnableFS:     true,
		EnableShell:  true,
		EnableWeb:    true,
		EnableSearch: true,
		EnableUtils:  true,
	})
	if toolkitErr != nil {
		slog.Warn("AP Toolkit 初始化失败", "error", toolkitErr)
	}
	slog.Info("AP Toolkit 已启动", "root", projectPath)

	// 5b. Cast Tools — 所有 Cast 工具注册为 AP Tool（AI 在对话中调用）
	if a.toolkit != nil {
		if err := a.RegisterCastTools(a.toolkit); err != nil {
			slog.Warn("Cast 工具注册失败", "error", err)
		}
	}

	// 6. AP Hooks — register checkpoint + guardrail
	a.hooks = ap.NewHookManager()
	a.hooks.Register(ap.HookBeforeTool, a.checkpointHook)
	// GuardrailHook registers input+output guards with HookManager
	a.guardrailHook.RegisterAll(a.hooks)
	slog.Info("AP Hooks 已注册")

	// 7. AP MCPRegistry
	a.mcpReg = ap.NewMCPRegistry()
	slog.Info("AP MCPRegistry 已启动")

	// 8. AP CheckpointStore
	checkpointPath := filepath.Join(filepath.Dir(a.settingsPath), "checkpoints.db")
	a.checkpointStore, _ = ap.NewSQLiteCheckpointStore(checkpointPath)
	slog.Info("AP CheckpointStore 已启动")

	// 9. AP Lifecycle
	a.lifecycle = ap.NewLifecycle()
	slog.Info("AP Lifecycle 已启动")

	// 10. Provider + RAG (createProvider requires a.mu — safe during startup, no contention)
	a.mu.Lock()
	provider, providerErr := a.createProvider()
	a.mu.Unlock()
	if providerErr != nil {
		slog.Warn("AP Provider 初始化失败", "error", providerErr)
	} else {
		// RAG Store with embedding adapter
		embeddingAdapter := ap.NewEmbeddingAdapter(provider, 1536)
		a.ragStore = ap.NewRAGStore(a.memory, embeddingAdapter)
		slog.Info("AP RAGStore 已启动")

		// 11. Default Agent
		a.agent = ap.NewReActAgent(ap.ReActConfig{
			Name:            "CodeCast",
			SystemPrompt:    a.buildSystemPrompt(nil),
			Model:           provider,
			Toolkit:         a.toolkit,
			Memory:          ap.NewMemoryAdapter(a.memory),
			EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
			Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
			ContextWindow:   ap.NewDefaultStrategy(80),
			Hooks:           a.hooks,
			Lifecycle:       a.lifecycle,
			CheckpointStore: a.checkpointStore,
			MaxTurns:        20,
			RAG: &ap.RAGConfig{
				Provider: ap.NewRAGProviderAdapter(a.ragStore),
				Mode:     ap.RAGModeAuto,
				TopK:     5,
			},
		})
		slog.Info("AP Default Agent 已创建")

		// 12. AP Agent Pool
		a.pool = ap.NewPool(ap.PoolConfig{
			MaxConcurrency: 5,
			Timeout:        5 * time.Minute,
			DefaultAgent: ap.ReActAgentConfig{
				SystemPrompt: "你是一个代码助手子代理",
				MaxTurns:     10,
			},
		})
		a.pool.SetModel(provider)
		slog.Info("AP Agent Pool 已启动", "max_concurrency", 5)
	}

	// 13. Event bridge (AP EventBus → Wails Events)
	a.startEventBridge()
	slog.Info("AP Event Bridge 已启动")

	// 14. Session caches
	a.sessionAgents = make(map[string]ap.Agent)
	a.sessionCancels = make(map[string]context.CancelFunc)
	a.checkpointConfirmations = make(map[string]chan bool)

	// 15. Notes Hook — trigger note recording after each agent run
	// 已迁移到 cast_kb_save（AI 主动调用） + ap.Memory（自动）
	// 16. Notes 系统已迁移到 cast_kb_* + ap.memory（见 cast_tools_kb.go）

	a.taskSchedulerStop = make(chan struct{})
	go a.runScheduleDispatcher(a.taskSchedulerStop)
	slog.Info("AP Pool 调度器已启动（cast_schedule_* Tool 通过此调度）")
	slog.Info("AP 会话管理已启动")

	// 从磁盘恢复持久化的 sessions
	a.loadPersistedSessions()

	// 后台自动检查更新
	go a.autoCheckUpdate()
}

func (a *App) domReady(ctx context.Context) {
}

func (a *App) shutdown(ctx context.Context) {
	// Cancel all active session contexts
	a.mu.Lock()
	for _, cancel := range a.sessionCancels {
		cancel()
	}
	a.mu.Unlock()

	if a.pool != nil {
		a.pool.Close()
		slog.Info("AP Agent Pool 已关闭")
	}
	if a.eventBus != nil {
		a.eventBus.Close()
		slog.Info("AP EventBus 已关闭")
	}
	if a.memory != nil {
		a.memory.Close()
		slog.Info("AP 记忆系统已关闭")
	}
	if a.memoryCleanupStop != nil {
		close(a.memoryCleanupStop)
	}
	if a.taskSchedulerStop != nil {
		close(a.taskSchedulerStop)
	}
	// Notes store has no Close method — cleanup is handled by garbage collection
	// legacy cleanup removed — AP sessionCancels handled in CancelRequest()
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
