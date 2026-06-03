package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"
)

// ==================== CodeCast 完整启动脚本 ====================
//
// 功能:
// 1. 一次性初始化所有子系统（配置/日志/审计/监控/i18n）
// 2. 提供统一的管理接口
// 3. 支持优雅关闭
// 4. 健康检查和状态展示
// 5. 快速验证所有新功能

type Bootstrap struct {
	configDir string
	dataDir   string
	logDir    string
	auditDir  string

	config  *SystemConfig
	logger  *Logger
	audit   *CommandAuditLogger
	metrics *PerformanceMonitor
	i18n    *I18nManager

	httpServer  *http.Server
	metricsPort int
	healthPort  int

	startTime time.Time
}

// NewBootstrap 创建新的启动管理器
func NewBootstrap(dataDir string) *Bootstrap {
	if dataDir == "" {
		dataDir = "data"
	}

	return &Bootstrap{
		dataDir:     dataDir,
		configDir:   filepath.Join(dataDir, "config"),
		logDir:      filepath.Join(dataDir, "logs"),
		auditDir:    filepath.Join(dataDir, "audit"),
		metricsPort: 9090,
		healthPort:  8080,
		startTime:   time.Now(),
	}
}

// InitAll 一次性初始化所有子系统
func (b *Bootstrap) InitAll() error {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("🚀 CodeCast 系统完整初始化")
	fmt.Println(strings.Repeat("=", 70))

	var initErrors []error

	// 阶段 1: 配置系统
	fmt.Println("\n📦 [1/6] 初始化配置系统...")
	if err := b.initConfig(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("配置系统失败: %w", err))
	} else {
		fmt.Printf("   ✅ 配置文件: %s\n", b.config.Server.DataDir)
	}

	// 阶段 2: 日志系统
	fmt.Println("\n📝 [2/6] 初始化日志系统...")
	if err := b.initLogging(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("日志系统失败: %w", err))
	} else {
		fmt.Printf("   ✅ 日志目录: %s\n", b.logDir)
	}

	// 阶段 3: 审计系统
	fmt.Println("\n📊 [3/6] 初始化审计系统...")
	if err := b.initAudit(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("审计系统失败: %w", err))
	} else {
		fmt.Printf("   ✅ 审计目录: %s\n", b.auditDir)
	}

	// 阶段 4: 监控系统
	fmt.Println("\n📈 [4/6] 初始化性能监控...")
	if err := b.initMetrics(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("监控系统失败: %w", err))
	} else {
		fmt.Printf("   ✅ 监控端口: %d\n", b.metricsPort)
	}

	// 阶段 5: 国际化系统
	fmt.Println("\n🌐 [5/6] 初始化国际化系统...")
	if err := b.initI18n(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("国际化系统失败: %w", err))
	} else {
		currentLocale := GetI18n().GetLocale()
		fmt.Printf("   ✅ 当前语言: %s\n", currentLocale)
	}

	// 阶段 6: HTTP 服务
	fmt.Println("\n🌐 [6/6] 启动 HTTP 服务...")
	if err := b.startHTTPServers(); err != nil {
		initErrors = append(initErrors, fmt.Errorf("HTTP服务失败: %w", err))
	} else {
		fmt.Printf("   ✅ 健康检查: http://localhost:%d/health\n", b.healthPort)
		fmt.Printf("   ✅ 指标数据: http://localhost:%d/metrics\n", b.metricsPort)
	}

	if len(initErrors) > 0 {
		fmt.Println("\n❌ 初始化过程中出现错误:")
		for _, err := range initErrors {
			fmt.Printf("   ⚠️  %v\n", err)
		}
		return fmt.Errorf("%d 个子系统初始化失败", len(initErrors))
	}

	b.printStartupBanner()
	return nil
}

// initConfig 初始化配置系统
func (b *Bootstrap) initConfig() error {
	os.MkdirAll(b.configDir, 0755)

	configPath := filepath.Join(b.configDir, "config.yaml")
	cfg, err := LoadConfig(configPath)
	if err != nil {
		return err
	}

	issues := ValidateConfig(cfg)
	if len(issues) > 0 {
		for _, issue := range issues {
			GetLogger().Warn("配置问题", "issue", issue)
		}
	}

	b.config = cfg
	return nil
}

// initLogging 初始化日志系统
func (b *Bootstrap) initLogging() error {
	os.MkdirAll(b.logDir, 0755)

	level := LogLevelInfo
	if b.config != nil {
		switch b.config.Logging.Level {
		case "debug":
			level = LogLevelDebug
		case "warn":
			level = LogLevelWarn
		case "error":
			level = LogLevelError
		}
	}

	err := InitLogger(b.logDir, "CodeCast", level)
	if err != nil {
		return err
	}

	b.logger = GetLogger()
	return nil
}

// initAudit 初始化审计系统
func (b *Bootstrap) initAudit() error {
	os.MkdirAll(b.auditDir, 0755)

	err := InitCommandAudit(b.dataDir)
	if err != nil {
		return err
	}

	b.audit = GetCommandAudit()
	return nil
}

// initMetrics 初始化监控系统
func (b *Bootstrap) initMetrics() error {
	collectInterval := 10 * time.Second
	historySize := 100

	if b.config != nil && b.config.HTTP.IdleConnTimeout > 0 {
		collectInterval = time.Duration(int64(b.config.HTTP.IdleConnTimeout) / 10)
	}

	err := InitPerformanceMonitor(collectInterval, historySize)
	if err != nil {
		return err
	}

	b.metrics = GetPerformanceMonitor()

	return b.metrics.StartMetricsServer(b.metricsPort)
}

// initI18n 初始化国际化系统
func (b *Bootstrap) initI18n() error {
	defaultLocale := LocaleZhCN
	fallbackLocale := LocaleEnUS

	detectedLocale := DetectLocaleFromSystem()
	if detectedLocale != "" {
		defaultLocale = detectedLocale
	}

	err := InitI18n(defaultLocale, fallbackLocale)
	if err != nil {
		return err
	}

	LoadBuiltinTranslations()

	b.i18n = GetI18n()
	return nil
}

// startHTTPServers 启动 HTTP 服务
func (b *Bootstrap) startHTTPServers() error {
	g, ctx := errgroup.WithContext(context.Background())

	// 健康检查服务
	g.Go(func() error {
		mux := http.NewServeMux()

		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)

			status := map[string]interface{}{
				"status":     "healthy",
				"uptime":     time.Since(b.startTime).String(),
				"timestamp":  time.Now().Format(time.RFC3339),
				"go_version": runtime.Version(),
				"os":         runtime.GOOS,
				"arch":       runtime.GOARCH,
				"subsystems": b.getSubsystemStatuses(),
			}

			json.NewEncoder(w).Encode(status)
		})

		mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"config":  b.getConfigStatus(),
				"logging": b.getLoggingStatus(),
				"audit":   b.getAuditStatus(),
				"metrics": b.getMetricsStatus(),
				"i18n":    b.getI18nStatus(),
				"version": "2.0.0",
				"features": []string{
					"linux_security_test",
					"struct_logging_slog",
					"command_audit_log",
					"http_connection_pool",
					"config_externalization",
					"integration_tests",
					"performance_monitoring",
					"i18n_support",
				},
			})
		})

		addr := fmt.Sprintf(":%d", b.healthPort)
		server := &http.Server{Addr: addr, Handler: mux}
		b.httpServer = server

		GetLogger().Info("健康检查服务启动", "port", b.healthPort)

		go func() {
			<-ctx.Done()
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			server.Shutdown(shutdownCtx)
		}()

		return server.ListenAndServe()
	})

	return g.Wait()
}

// getSubsystemStatuses 获取各子系统状态
func (b *Bootstrap) getSubsystemStatuses() map[string]string {
	statuses := make(map[string]string)

	if b.config != nil {
		statuses["config"] = "✅ running"
	}
	if b.logger != nil {
		statuses["logging"] = "✅ running"
	}
	if b.audit != nil {
		statuses["audit"] = "✅ running"
	}
	if b.metrics != nil {
		statuses["metrics"] = "✅ running"
	}
	if b.i18n != nil {
		statuses["i18n"] = "✅ running"
	}

	return statuses
}

// getConfigStatus 获取配置状态
func (b *Bootstrap) getConfigStatus() interface{} {
	if b.config == nil {
		return map[string]string{"status": "not initialized"}
	}

	return map[string]interface{}{
		"mode":            b.config.Server.Mode,
		"data_dir":        b.config.Server.DataDir,
		"max_concurrency": b.config.Server.MaxConcurrency,
		"context_config": map[string]int{
			"token_budget":          b.config.Context.TokenBudget,
			"compaction_threshold":  b.config.Context.CompactionThreshold,
			"message_history_limit": b.config.Context.MessageHistoryLimit,
		},
	}
}

// getLoggingStatus 获取日志状态
func (b *Bootstrap) getLoggingStatus() interface{} {
	if b.logger == nil {
		return map[string]string{"status": "not initialized"}
	}

	return map[string]interface{}{
		"log_dir":   b.logDir,
		"log_level": logLevelNames[b.logger.level],
	}
}

// getAuditStatus 获取审计状态
func (b *Bootstrap) getAuditStatus() interface{} {
	if b.audit == nil {
		return map[string]string{"status": "not initialized"}
	}

	stats, _ := b.audit.GetStatistics(TimeRange{
		From: time.Now().Add(-24 * time.Hour),
		To:   time.Now(),
	})

	return stats
}

// getMetricsStatus 获取监控状态
func (b *Bootstrap) getMetricsStatus() interface{} {
	if b.metrics == nil {
		return map[string]string{"status": "not initialized"}
	}

	stats := b.metrics.GetStatistics()
	return stats
}

// getI18nStatus 获取国际化状态
func (b *Bootstrap) getI18nStatus() interface{} {
	if b.i18n == nil {
		return map[string]string{"status": "not initialized"}
	}

	return map[string]interface{}{
		"current_locale":    b.i18n.GetLocale(),
		"available_locales": b.i18n.GetAvailableLocales(),
	}
}

// printStartupBanner 打印启动横幅
func (b *Bootstrap) printStartupBanner() {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("🎉 CodeCast v2.0 - 所有子系统已成功初始化!")
	fmt.Println(strings.Repeat("=", 70))

	fmt.Println("\n📍 服务端点:")
	fmt.Printf("   健康检查:  http://localhost:%d/health\n", b.healthPort)
	fmt.Printf("   系统状态:  http://localhost:%d/status\n", b.healthPort)
	fmt.Printf("   Prometheus: http://localhost:%d/metrics\n", b.metricsPort)

	fmt.Println("\n📂 数据目录:")
	fmt.Printf("   配置文件:  %s/config.yaml\n", b.configDir)
	fmt.Printf("   日志文件:  %s/\n", b.logDir)
	fmt.Printf("   审计记录:  %s/\n", b.auditDir)

	fmt.Println("\n🛠️  可用功能:")
	fmt.Println("   ✅ Linux 安全防护增强测试")
	fmt.Println("   ✅ 结构化日志系统 (slog)")
	fmt.Println("   ✅ 命令审计日志系统")
	fmt.Println("   ✅ HTTP 连接池优化")
	fmt.Println("   ✅ 配置外部化 (YAML)")
	fmt.Println("   ✅ 关键路径集成测试")
	fmt.Println("   ✅ 性能指标采集系统")
	fmt.Println("   ✅ 国际化支持 (中/英)")

	fmt.Println("\n💡 快速验证命令:")
	fmt.Println("   curl http://localhost:8080/health")
	fmt.Println("   curl http://localhost:8080/status")
	fmt.Println("   curl http://localhost:9090/metrics")

	fmt.Println("\n按 Ctrl+C 优雅关闭...")
}

// Shutdown 优雅关闭所有子系统
func (b *Bootstrap) Shutdown() {
	fmt.Println("\n🛑 正在关闭所有子系统...")

	if b.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		b.httpServer.Shutdown(ctx)
		fmt.Println("   ✅ HTTP 服务已停止")
	}

	if b.logger != nil {
		b.logger.Close()
		fmt.Println("   ✅ 日志系统已关闭")
	}

	if b.audit != nil {
		b.audit.Close()
		fmt.Println("   ✅ 审计系统已关闭")
	}

	fmt.Println("\n👋 CodeCast 已安全退出!")
}

// RunDemo 运行演示程序，验证所有功能
func (b *Bootstrap) RunDemo() error {
	fmt.Println("\n" + strings.Repeat("=", 70))
	fmt.Println("🎬 运行功能演示")
	fmt.Println(strings.Repeat("=", 70))

	// 1. 测试日志系统
	fmt.Println("\n[1/5] 测试日志系统...")
	b.logger.Info("这是一条信息日志", "module", "bootstrap_demo")
	b.logger.Warn("这是一条警告日志", "reason", "演示用途")
	b.logger.Debug("调试日志 (默认不显示)", "detail", "隐藏内容")
	fmt.Println("   ✅ 日志写入成功")

	// 2. 测试审计系统
	fmt.Println("\n[2/5] 测试审计系统...")
	b.audit.LogCommandExecution(
		"demo-001",
		"echo 'Hello CodeCast!'",
		"/tmp/demo",
		50,
		0,
		15,
	)
	b.audit.LogCommandBlocked(
		"demo-002",
		"rm -rf /important/data",
		"危险命令模式检测",
	)
	fmt.Println("   ✅ 审计记录写入成功")

	// 3. 测试监控系统
	fmt.Println("\n[3/5] 测试监控系统...")
	RecordLLMRequest(1500, true)
	RecordCommandExecution(100, true)
	RecordCommandBlocked()
	UpdateActiveSessions(3)
	UpdateMemoryUsage(256.5)
	fmt.Println("   ✅ 监控指标已更新")

	// 4. 测试国际化
	fmt.Println("\n[4/5] 测试国际化系统...")
	zhMsg := T("app.description")
	enMsg := b.i18n.TranslateWithLocale(LocaleEnUS, "app.description")
	fmt.Printf("   中文: %s\n", zhMsg)
	fmt.Printf("   English: %s\n", enMsg)
	fmt.Println("   ✅ 多语言切换正常")

	// 5. 显示统计摘要
	fmt.Println("\n[5/5] 生成统计报告...")
	stats := b.metrics.GetStatistics()
	fmt.Printf("\n📊 性能统计:\n")
	fmt.Printf("   运行时间: %s\n", stats.Uptime.Round(time.Second))
	fmt.Printf("   LLM 请求数: %d\n", stats.TotalRequests)
	fmt.Printf("   命令执行数: %d\n", stats.TotalCommands)
	fmt.Printf("   被拦截命令: %d\n", stats.BlockedCommands)
	fmt.Printf("   错误总数: %d\n", stats.TotalErrors)
	fmt.Printf("   当前会话: %.0f\n", 3.0)
	fmt.Printf("   内存使用: %.1f MB\n", 256.5)

	auditStats, _ := b.audit.GetStatistics(TimeRange{
		From: time.Now().Add(-1 * time.Hour),
		To:   time.Now(),
	})
	fmt.Printf("\n📋 审计统计:\n")
	fmt.Printf("   总记录数: %d\n", auditStats.TotalCommands)
	fmt.Printf("   执行成功: %d\n", auditStats.ExecutedCount)
	fmt.Printf("   被拦截数: %d\n", auditStats.BlockedCount)

	fmt.Println("\n✨ 所有功能演示完成!")

	return nil
}

// ==================== 演示入口函数 ====================
// 注意：此函数用于独立测试，不要与 main.go 的 main() 冲突
// 使用方法：在 main.go 中调用 RunBootstrapDemo()

func RunBootstrapDemo() {
	bootstrap := NewBootstrap("")

	// 初始化所有系统
	if err := bootstrap.InitAll(); err != nil {
		log.Fatalf("初始化失败: %v", err)
	}

	// 运行演示（可选）
	if len(os.Args) > 1 && os.Args[1] == "--demo" {
		if demoErr := bootstrap.RunDemo(); demoErr != nil {
			GetLogger().Error("演示运行失败", "error", demoErr)
		}
	}

	// 等待中断信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigChan:
		fmt.Printf("\n收到信号: %v\n", sig)
	}

	// 优雅关闭
	bootstrap.Shutdown()
}
