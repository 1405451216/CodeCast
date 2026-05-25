package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ==================== 性能监控系统 ====================
//
// 功能:
// 1. 实时性能指标采集
// 2. Prometheus 兼容的 /metrics 端点
// 3. 自动聚合统计 (P50/P95/P99)
// 4. 历史数据保留
// 5. 告警阈值检测

type MetricType int

const (
	MetricTypeCounter MetricType = iota
	MetricTypeGauge
	MetricTypeHistogram
)

type Metric struct {
	Name      string            `json:"name"`
	Type      MetricType        `json:"type"`
	Help      string            `json:"help"`
	Labels    map[string]string `json:"labels,omitempty"`
	Value     float64           `json:"value"`
	Timestamp time.Time         `json:"timestamp"`
}

// PerformanceMonitor 性能监控器
type PerformanceMonitor struct {
	mu sync.RWMutex

	counters   map[string]*CounterMetric
	gauges     map[string]*GaugeMetric
	histograms map[string]*HistogramMetric

	startTime       time.Time
	collectInterval time.Duration

	alertRules []AlertRule
	alerts     []AlertEvent

	historySize int
	history     []Snapshot
}

// CounterMetric 计数器指标
type CounterMetric struct {
	Name   string
	Value  uint64
	Labels map[string]string
}

func (c *CounterMetric) Inc() {
	atomic.AddUint64(&c.Value, 1)
}

func (c *CounterMetric) Add(delta uint64) {
	atomic.AddUint64(&c.Value, delta)
}

// GaugeMetric 仪表盘指标
type GaugeMetric struct {
	Name   string
	Value  float64
	Labels map[string]string
}

func (g *GaugeMetric) Set(value float64) {
	g.Value = value
}

func (g *GaugeMetric) Inc() {
	g.Value++
}

func (g *GaugeMetric) Dec() {
	g.Value--
}

// HistogramMetric 直方图指标（用于延迟分布）
type HistogramMetric struct {
	Name    string
	Buckets []float64 // 边界值
	Counts  []uint64  // 每个桶的计数
	Sum     float64
	Count   uint64
	Min     float64
	Max     float64
	Labels  map[string]string
}

func NewHistogram(name string, buckets []float64) *HistogramMetric {
	return &HistogramMetric{
		Name:    name,
		Buckets: buckets,
		Counts:  make([]uint64, len(buckets)+1),
	}
}

func (h *HistogramMetric) Observe(value float64) {
	atomic.AddUint64(&h.Count, 1)

	for i, bound := range h.Buckets {
		if value <= bound {
			atomic.AddUint64(&h.Counts[i], 1)
		}
	}
	atomic.AddUint64(&h.Counts[len(h.Buckets)], 1)

	if value < h.Min || h.Count == 1 {
		h.Min = value
	}
	if value > h.Max {
		h.Max = value
	}
}

func (h *HistogramMetric) Percentile(p float64) float64 {
	total := atomic.LoadUint64(&h.Count)
	if total == 0 {
		return 0
	}

	target := uint64(float64(total) * p / 100)
	var cumulative uint64

	for i, count := range h.Counts {
		cumulative += atomic.LoadUint64(&count)
		if cumulative >= target {
			if i == 0 {
				return h.Min
			} else if i > len(h.Buckets) {
				return h.Max
			} else {
				return h.Buckets[i-1]
			}
		}
	}

	return h.Max
}

// AlertRule 告警规则
type AlertRule struct {
	ID         string
	Name       string
	MetricName string
	Condition  string // "gt", "lt", "eq", "gte", "lte"
	Threshold  float64
	Duration   time.Duration // 持续时间
	Severity   string        // "info", "warning", "critical"
	Enabled    bool
	Message    string
}

// AlertEvent 告警事件
type AlertEvent struct {
	RuleID      string
	RuleName    string
	MetricName  string
	Value       float64
	Threshold   float64
	TriggeredAt time.Time
	ResolvedAt  *time.Time
	Severity    string
	Message     string
	Status      string // "firing" or "resolved"
}

// Snapshot 快照（用于历史记录）
type Snapshot struct {
	Timestamp time.Time
	Metrics   []Metric
}

var globalMonitor *PerformanceMonitor
var monitorOnce sync.Once

// InitPerformanceMonitor 初始化性能监控
func InitPerformanceMonitor(collectInterval time.Duration, historySize int) error {
	var initErr error

	monitorOnce.Do(func() {
		globalMonitor = &PerformanceMonitor{
			counters:        make(map[string]*CounterMetric),
			gauges:          make(map[string]*GaugeMetric),
			histograms:      make(map[string]*HistogramMetric),
			startTime:       time.Now(),
			collectInterval: collectInterval,
			historySize:     historySize,
		}

		globalMonitor.registerDefaultMetrics()
		globalMonitor.registerDefaultAlerts()

		initErr = nil
	})

	return initErr
}

// GetPerformanceMonitor 获取全局监控实例
func GetPerformanceMonitor() *PerformanceMonitor {
	if globalMonitor == nil {
		InitPerformanceMonitor(10*time.Second, 100)
	}
	return globalMonitor
}

// registerDefaultMetrics 注册默认指标
func (m *PerformanceMonitor) registerDefaultMetrics() {
	m.RegisterCounter("codecast_requests_total", "总请求数")
	m.RegisterCounter("codecast_commands_executed_total", "命令执行总数")
	m.RegisterCounter("codecast_commands_blocked_total", "被拦截的命令总数")
	m.RegisterCounter("codecast_errors_total", "错误总数")

	m.RegisterGauge("codecast_active_sessions", "当前活跃会话数")
	m.RegisterGauge("codecast_active_agents", "运行中的子代理数")
	m.RegisterGauge("codecast_context_size_bytes", "上下文大小(字节)")
	m.RegisterGauge("codecast_memory_usage_mb", "内存使用量(MB)")

	defaultBuckets := []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000}
	m.RegisterHistogram("codecast_llm_request_duration_ms", "LLM请求耗时(ms)", defaultBuckets)
	m.RegisterHistogram("codecast_command_execution_duration_ms", "命令执行耗时(ms)", defaultBuckets)
	m.RegisterHistogram("codecast_context_assembly_duration_ms", "上下文组装耗时(ms)", defaultBuckets)
	m.RegisterHistogram("codecast_file_operation_duration_ms", "文件操作耗时(ms)", defaultBuckets)
}

// registerDefaultAlerts 注册默认告警规则
func (m *PerformanceMonitor) registerDefaultAlerts() {
	m.alertRules = []AlertRule{
		{
			ID:         "alert_high_error_rate",
			Name:       "高错误率",
			MetricName: "codecast_errors_total",
			Condition:  "gt",
			Threshold:  100,
			Duration:   5 * time.Minute,
			Severity:   "warning",
			Enabled:    true,
			Message:    "错误数超过阈值，请检查系统状态",
		},
		{
			ID:         "alert_slow_llm_response",
			Name:       "LLM响应缓慢",
			MetricName: "codecast_llm_request_duration_ms",
			Condition:  "p99_gt",
			Threshold:  30000,
			Duration:   3 * time.Minute,
			Severity:   "warning",
			Enabled:    true,
			Message:    "LLM P99响应时间超过30秒，可能影响用户体验",
		},
		{
			ID:         "alert_memory_pressure",
			Name:       "内存压力",
			MetricName: "codecast_memory_usage_mb",
			Condition:  "gt",
			Threshold:  1024,
			Duration:   10 * time.Minute,
			Severity:   "critical",
			Enabled:    true,
			Message:    "内存使用超过1GB，建议检查是否有内存泄漏",
		},
	}
}

// RegisterCounter 注册计数器
func (m *PerformanceMonitor) RegisterCounter(name, help string) *CounterMetric {
	m.mu.Lock()
	defer m.mu.Unlock()

	counter := &CounterMetric{
		Name:   name,
		Labels: make(map[string]string),
	}
	m.counters[name] = counter
	return counter
}

// RegisterGauge 注册仪表盘
func (m *PerformanceMonitor) RegisterGauge(name, help string) *GaugeMetric {
	m.mu.Lock()
	defer m.mu.Unlock()

	gauge := &GaugeMetric{
		Name:   name,
		Labels: make(map[string]string),
	}
	m.gauges[name] = gauge
	return gauge
}

// RegisterHistogram 注册直方图
func (m *PerformanceMonitor) RegisterHistogram(name, help string, buckets []float64) *HistogramMetric {
	m.mu.Lock()
	defer m.mu.Unlock()

	hist := NewHistogram(name, buckets)
	hist.Labels = make(map[string]string)
	m.histograms[name] = hist
	return hist
}

// GetCounter 获取计数器
func (m *PerformanceMonitor) GetCounter(name string) (*CounterMetric, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.counters[name]
	return c, ok
}

// GetGauge 获取仪表盘
func (m *PerformanceMonitor) GetGauge(name string) (*GaugeMetric, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	g, ok := m.gauges[name]
	return g, ok
}

// GetHistogram 获取直方图
func (m *PerformanceMonitor) GetHistogram(name string) (*HistogramMetric, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.histograms[name]
	return h, ok
}

// Collect 采集所有指标快照
func (m *PerformanceMonitor) Collect() Snapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var metrics []Metric

	for _, counter := range m.counters {
		metrics = append(metrics, Metric{
			Name:      counter.Name,
			Type:      MetricTypeCounter,
			Value:     float64(atomic.LoadUint64(&counter.Value)),
			Timestamp: time.Now(),
		})
	}

	for _, gauge := range m.gauges {
		metrics = append(metrics, Metric{
			Name:      gauge.Name,
			Type:      MetricTypeGauge,
			Value:     gauge.Value,
			Timestamp: time.Now(),
		})
	}

	for _, hist := range m.histograms {
		metrics = append(metrics, Metric{
			Name:      hist.Name + "_sum",
			Type:      MetricTypeCounter,
			Value:     hist.Sum,
			Timestamp: time.Now(),
		})
		metrics = append(metrics, Metric{
			Name:      hist.Name + "_count",
			Type:      MetricTypeCounter,
			Value:     float64(hist.Count),
			Timestamp: time.Now(),
		})

		for i, bucket := range hist.Buckets {
			metrics = append(metrics, Metric{
				Name:      fmt.Sprintf("%s_bucket{le=\"%.0f\"}", hist.Name, bucket),
				Type:      MetricTypeCounter,
				Value:     float64(hist.Counts[i]),
				Timestamp: time.Now(),
			})
		}
	}

	snapshot := Snapshot{
		Timestamp: time.Now(),
		Metrics:   metrics,
	}

	m.history = append(m.history, snapshot)
	if len(m.history) > m.historySize {
		m.history = m.history[len(m.history)-m.historySize:]
	}

	return snapshot
}

// ExportPrometheus 导出 Prometheus 格式
func (m *PerformanceMonitor) ExportPrometheus() string {
	snapshot := m.Collect()

	var builder strings.Builder

	builder.WriteString("# CodeCast Metrics\n")
	builder.WriteString(fmt.Sprintf("# Generated at %s\n\n", snapshot.Timestamp.Format(time.RFC3339)))

	for _, metric := range snapshot.Metrics {
		switch metric.Type {
		case MetricTypeCounter:
			builder.WriteString(fmt.Sprintf("# TYPE %s counter\n", metric.Name))
			builder.WriteString(fmt.Sprintf("%s %.0f\n", metric.Name, metric.Value))

		case MetricTypeGauge:
			builder.WriteString(fmt.Sprintf("# TYPE %s gauge\n", metric.Name))
			builder.WriteString(fmt.Sprintf("%s %.6f\n", metric.Name, metric.Value))

		case MetricTypeHistogram:
			if strings.HasSuffix(metric.Name, "_bucket") {
				builder.WriteString(fmt.Sprintf("%s %.0f\n", metric.Name, metric.Value))
			}
		}
		builder.WriteString("\n")
	}

	return builder.String()
}

// StartMetricsServer 启动指标 HTTP 服务
func (m *PerformanceMonitor) StartMetricsServer(port int) error {
	http.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Write([]byte(m.ExportPrometheus()))
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	go func() {
		addr := fmt.Sprintf(":%d", port)
		slog.Info("性能监控服务启动", "port", port)
		if err := http.ListenAndServe(addr, nil); err != nil {
			slog.Error("监控服务失败", "error", err)
		}
	}()

	return nil
}

// CheckAlerts 检查告警条件
func (m *PerformanceMonitor) CheckAlerts() []AlertEvent {
	var triggeredEvents []AlertEvent
	now := time.Now()

	for _, rule := range m.alertRules {
		if !rule.Enabled {
			continue
		}

		value, found := m.getMetricValue(rule.MetricName)
		if !found {
			continue
		}

		triggered := false
		switch rule.Condition {
		case "gt":
			triggered = value > rule.Threshold
		case "lt":
			triggered = value < rule.Threshold
		case "gte":
			triggered = value >= rule.Threshold
		case "lte":
			triggered = value <= rule.Threshold
		case "p99_gt":
			if hist, ok := m.histograms[rule.MetricName]; ok {
				p99 := hist.Percentile(99)
				triggered = p99 > rule.Threshold
				value = p99
			}
		}

		if triggered {
			event := AlertEvent{
				RuleID:      rule.ID,
				RuleName:    rule.Name,
				MetricName:  rule.MetricName,
				Value:       value,
				Threshold:   rule.Threshold,
				TriggeredAt: now,
				Severity:    rule.Severity,
				Message:     rule.Message,
				Status:      "firing",
			}
			triggeredEvents = append(triggeredEvents, event)
			m.alerts = append(m.alerts, event)
		}
	}

	return triggeredEvents
}

// getMetricValue 获取指标值
func (m *PerformanceMonitor) getMetricValue(name string) (float64, bool) {
	if counter, ok := m.counters[name]; ok {
		return float64(atomic.LoadUint64(&counter.Value)), true
	}
	if gauge, ok := m.gauges[name]; ok {
		return gauge.Value, true
	}
	return 0, false
}

// GetStatistics 获取统计摘要
func (m *PerformanceMonitor) GetStatistics() *PerformanceStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := &PerformanceStats{
		Uptime:            time.Since(m.startTime),
		TotalRequests:     0,
		TotalCommands:     0,
		BlockedCommands:   0,
		TotalErrors:       0,
		LLMLatencyP50:     0,
		LLMLatencyP95:     0,
		LLMLatencyP99:     0,
		CommandLatencyP50: 0,
		CommandLatencyP95: 0,
		CommandLatencyP99: 0,
		ActiveAlerts:      0,
		GeneratedAt:       time.Now(),
	}

	if counter, ok := m.counters["codecast_requests_total"]; ok {
		stats.TotalRequests = atomic.LoadUint64(&counter.Value)
	}
	if counter, ok := m.counters["codecast_commands_executed_total"]; ok {
		stats.TotalCommands = atomic.LoadUint64(&counter.Value)
	}
	if counter, ok := m.counters["codecast_commands_blocked_total"]; ok {
		stats.BlockedCommands = atomic.LoadUint64(&counter.Value)
	}
	if counter, ok := m.counters["codecast_errors_total"]; ok {
		stats.TotalErrors = atomic.LoadUint64(&counter.Value)
	}

	if hist, ok := m.histograms["codecast_llm_request_duration_ms"]; ok {
		stats.LLMLatencyP50 = hist.Percentile(50)
		stats.LLMLatencyP95 = hist.Percentile(95)
		stats.LLMLatencyP99 = hist.Percentile(99)
	}

	if hist, ok := m.histograms["codecast_command_execution_duration_ms"]; ok {
		stats.CommandLatencyP50 = hist.Percentile(50)
		stats.CommandLatencyP95 = hist.Percentile(95)
		stats.CommandLatencyP99 = hist.Percentile(99)
	}

	for _, alert := range m.alerts {
		if alert.Status == "firing" {
			stats.ActiveAlerts++
		}
	}

	return stats
}

// PerformanceStats 性能统计摘要
type PerformanceStats struct {
	Uptime            time.Duration `json:"uptime"`
	TotalRequests     uint64        `json:"total_requests"`
	TotalCommands     uint64        `json:"total_commands"`
	BlockedCommands   uint64        `json:"blocked_commands"`
	TotalErrors       uint64        `json:"total_errors"`
	LLMLatencyP50     float64       `json:"llm_latency_p50_ms"`
	LLMLatencyP95     float64       `json:"llm_latency_p95_ms"`
	LLMLatencyP99     float64       `json:"llm_latency_p99_ms"`
	CommandLatencyP50 float64       `json:"command_latency_p50_ms"`
	CommandLatencyP95 float64       `json:"command_latency_p95_ms"`
	CommandLatencyP99 float64       `json:"command_latency_p99_ms"`
	ActiveAlerts      int           `json:"active_alerts"`
	GeneratedAt       time.Time     `json:"generated_at"`
}

// RecordCommandExecution 记录命令执行（便捷方法）
func RecordCommandExecution(durationMs int64, success bool) {
	mon := GetPerformanceMonitor()

	if counter, ok := mon.GetCounter("codecast_commands_executed_total"); ok {
		counter.Inc()
	}

	if !success {
		if counter, ok := mon.GetCounter("codecast_errors_total"); ok {
			counter.Inc()
		}
	}

	if hist, ok := mon.GetHistogram("codecast_command_execution_duration_ms"); ok {
		hist.Observe(float64(durationMs))
	}
}

// RecordCommandBlocked 记录被拦截的命令（便捷方法）
func RecordCommandBlocked() {
	mon := GetPerformanceMonitor()
	if counter, ok := mon.GetCounter("codecast_commands_blocked_total"); ok {
		counter.Inc()
	}
}

// RecordLLMRequest 记录 LLM 请求（便捷方法）
func RecordLLMRequest(durationMs int64, success bool) {
	mon := GetPerformanceMonitor()

	if counter, ok := mon.GetCounter("codecast_requests_total"); ok {
		counter.Inc()
	}

	if !success {
		if counter, ok := mon.GetCounter("codecast_errors_total"); ok {
			counter.Inc()
		}
	}

	if hist, ok := mon.GetHistogram("codecast_llm_request_duration_ms"); ok {
		hist.Observe(float64(durationMs))
	}
}

// UpdateActiveSessions 更新活跃会话数（便捷方法）
func UpdateActiveSessions(count int) {
	mon := GetPerformanceMonitor()
	if gauge, ok := mon.GetGauge("codecast_active_sessions"); ok {
		gauge.Set(float64(count))
	}
}

// UpdateMemoryUsage 更新内存使用量（便捷方法）
func UpdateMemoryUsage(mb float64) {
	mon := GetPerformanceMonitor()
	if gauge, ok := mon.GetGauge("codecast_memory_usage_mb"); ok {
		gauge.Set(mb)
	}
}
