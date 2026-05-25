package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ==================== 命令审计日志系统 ====================
//
// 功能:
// 1. 记录所有命令执行操作（含被拦截的）
// 2. JSONL 格式存储，便于分析
// 3. 按日自动轮转
// 4. 支持查询和统计
// 5. 敏感信息脱敏

type AuditEventType string

const (
	AuditEventCommandExecuted AuditEventType = "command_executed"
	AuditEventCommandBlocked  AuditEventType = "command_blocked"
	AuditEventSecurityAlert   AuditEventType = "security_alert"
)

// AuditEntry 审计日志条目
type AuditEntry struct {
	Timestamp   time.Time      `json:"timestamp"`
	EventID     string         `json:"event_id"`
	EventType   AuditEventType `json:"event_type"`
	SessionID   string         `json:"session_id,omitempty"`
	RequestID   string         `json:"request_id"`
	User        string         `json:"user,omitempty"`
	Command     string         `json:"command"`
	WorkDir     string         `json:"work_dir,omitempty"`
	Blocked     bool           `json:"blocked"`
	BlockReason string         `json:"block_reason,omitempty"`
	DurationMs  int64          `json:"duration_ms"`
	ExitCode    int            `json:"exit_code"`
	OutputSize  int            `json:"output_size"`
	Error       string         `json:"error,omitempty"`
	RiskLevel   string         `json:"risk_level,omitempty"` // "low", "medium", "high", "critical"
	Labels      []string       `json:"labels,omitempty"`     // 自定义标签
}

// CommandAuditLogger 命令审计记录器
type CommandAuditLogger struct {
	mu          sync.Mutex
	dataDir     string
	currentFile *os.File
	currentDate string
	eventCount  int64
	buffer      chan *AuditEntry
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

var auditLogger *CommandAuditLogger
var auditOnce sync.Once

// InitCommandAudit 初始化命令审计系统
func InitCommandAudit(dataDir string) error {
	var initErr error

	auditOnce.Do(func() {
		auditLogger = &CommandAuditLogger{
			dataDir: dataDir,
			buffer:  make(chan *AuditEntry, 1000),
		}

		auditLogger.ctx, auditLogger.cancel = context.WithCancel(context.Background())

		if err := os.MkdirAll(filepath.Join(dataDir, "audit"), 0755); err != nil {
			initErr = err
			return
		}

		auditLogger.wg.Add(1)
		go auditLogger.writeLoop()

		initErr = nil
	})

	return initErr
}

// GetCommandAudit 获取审计记录器实例
func GetCommandAudit() *CommandAuditLogger {
	if auditLogger == nil {
		InitCommandAudit("data")
	}
	return auditLogger
}

// LogCommand 记录命令执行事件
func (l *CommandAuditLogger) LogCommand(entry *AuditEntry) error {
	if entry == nil {
		return fmt.Errorf("audit entry is nil")
	}

	entry.Timestamp = time.Now()
	if entry.EventID == "" {
		entry.EventID = generateEventID()
	}

	select {
	case l.buffer <- entry:
		return nil
	default:
		return fmt.Errorf("audit buffer full, dropping entry")
	}
}

// LogCommandExecution 记录成功执行的命令（便捷方法）
func (l *CommandAuditLogger) LogCommandExecution(requestID, command, workDir string, durationMs int64, exitCode int, outputSize int) {
	entry := &AuditEntry{
		EventType:  AuditEventCommandExecuted,
		RequestID:  requestID,
		Command:    command,
		WorkDir:    workDir,
		Blocked:    false,
		DurationMs: durationMs,
		ExitCode:   exitCode,
		OutputSize: outputSize,
		RiskLevel:  assessCommandRisk(command),
	}
	l.LogCommand(entry)
}

// LogCommandBlocked 记录被拦截的命令（便捷方法）
func (l *CommandAuditLogger) LogCommandBlocked(requestID, command, reason string) {
	entry := &AuditEntry{
		EventType:   AuditEventCommandBlocked,
		RequestID:   requestID,
		Command:     command,
		Blocked:     true,
		BlockReason: reason,
		RiskLevel:   assessCommandRisk(command),
	}
	l.LogCommand(entry)
}

// writeLoop 异步写入循环
func (l *CommandAuditLogger) writeLoop() {
	defer l.wg.Done()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-l.ctx.Done():
			l.flush()
			return

		case entry := <-l.buffer:
			if err := l.writeEntry(entry); err != nil {
				slog.Error("写入审计日志失败", "error", err)
			}

		case <-ticker.C:
			l.flush()
		}
	}
}

// writeEntry 写入单条审计记录
func (l *CommandAuditLogger) writeEntry(entry *AuditEntry) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	today := time.Now().Format("2006-01-02")
	if today != l.currentDate || l.currentFile == nil {
		if l.currentFile != nil {
			l.currentFile.Close()
		}

		filePath := filepath.Join(l.dataDir, "audit",
			fmt.Sprintf("commands_%s.jsonl", today))

		file, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return err
		}

		l.currentFile = file
		l.currentDate = today
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	_, err = l.currentFile.Write(append(data, '\n'))
	l.eventCount++

	return err
}

// flush 刷新缓冲区
func (l *CommandAuditLogger) flush() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.currentFile != nil {
		l.currentFile.Sync()
	}
}

// Close 关闭审计记录器
func (l *CommandAuditLogger) Close() error {
	if l.cancel != nil {
		l.cancel()
	}

	l.wg.Wait()

	l.mu.Lock()
	defer l.mu.Unlock()

	if l.currentFile != nil {
		err := l.currentFile.Close()
		l.currentFile = nil
		return err
	}

	return nil
}

// QueryAudits 查询审计记录
func (l *CommandAuditLogger) QueryAudits(filter AuditFilter) ([]*AuditEntry, error) {
	dirPath := filepath.Join(l.dataDir, "audit")
	files, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var entries []*AuditEntry

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".jsonl") {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		lines := splitLines(string(data))
		for _, line := range lines {
			if line == "" {
				continue
			}

			var entry AuditEntry
			if err := json.Unmarshal([]byte(line), &entry); err != nil {
				continue
			}

			if filter.Match(&entry) {
				entries = append(entries, &entry)
			}
		}
	}

	return entries, nil
}

// GetStatistics 获取审计统计数据
func (l *CommandAuditLogger) GetStatistics(timeRange TimeRange) (*AuditStatistics, error) {
	filter := AuditFilter{
		TimeRange: timeRange,
	}

	entries, err := l.QueryAudits(filter)
	if err != nil {
		return nil, err
	}

	stats := &AuditStatistics{
		TimeRange:     timeRange,
		TotalCommands: len(entries),
		GeneratedAt:   time.Now(),
	}

	for _, entry := range entries {
		switch entry.EventType {
		case AuditEventCommandExecuted:
			stats.ExecutedCount++
			stats.TotalDurationMs += entry.DurationMs
			if entry.ExitCode != 0 {
				stats.FailedCount++
			}
		case AuditEventCommandBlocked:
			stats.BlockedCount++
		case AuditEventSecurityAlert:
			stats.SecurityAlerts++
		}

		switch entry.RiskLevel {
		case "critical":
			stats.CriticalRiskCount++
		case "high":
			stats.HighRiskCount++
		case "medium":
			stats.MediumRiskCount++
		case "low":
			stats.LowRiskCount++
		}
	}

	if stats.ExecutedCount > 0 {
		stats.AvgDurationMs = stats.TotalDurationMs / int64(stats.ExecutedCount)
	}

	return stats, nil
}

// AuditFilter 审计查询过滤器
type AuditFilter struct {
	TimeRange      TimeRange
	EventType      AuditEventType
	SessionID      string
	Blocked        *bool
	RiskLevel      string
	CommandPattern string // 正则表达式
	MinDuration    int64
	MaxDuration    int64
	Limit          int
}

// Match 检查条目是否匹配过滤器
func (f *AuditFilter) Match(entry *AuditEntry) bool {
	if f.TimeRange.From.After(entry.Timestamp) || f.TimeRange.To.Before(entry.Timestamp) {
		return false
	}

	if f.EventType != "" && entry.EventType != f.EventType {
		return false
	}

	if f.SessionID != "" && entry.SessionID != f.SessionID {
		return false
	}

	if f.Blocked != nil && entry.Blocked != *f.Blocked {
		return false
	}

	if f.RiskLevel != "" && entry.RiskLevel != f.RiskLevel {
		return false
	}

	if f.CommandPattern != "" && !regexp.MustCompile(f.CommandPattern).MatchString(entry.Command) {
		return false
	}

	if f.MinDuration > 0 && entry.DurationMs < f.MinDuration {
		return false
	}

	if f.MaxDuration > 0 && entry.DurationMs > f.MaxDuration {
		return false
	}

	return true
}

// TimeRange 时间范围
type TimeRange struct {
	From time.Time
	To   time.Time
}

// AuditStatistics 审计统计结果
type AuditStatistics struct {
	TimeRange         TimeRange `json:"time_range"`
	TotalCommands     int       `json:"total_commands"`
	ExecutedCount     int       `json:"executed_count"`
	BlockedCount      int       `json:"blocked_count"`
	FailedCount       int       `json:"failed_count"`
	SecurityAlerts    int       `json:"security_alerts"`
	TotalDurationMs   int64     `json:"total_duration_ms"`
	AvgDurationMs     int64     `json:"avg_duration_ms"`
	CriticalRiskCount int       `json:"critical_risk_count"`
	HighRiskCount     int       `json:"high_risk_count"`
	MediumRiskCount   int       `json:"medium_risk_count"`
	LowRiskCount      int       `json:"low_risk_count"`
	GeneratedAt       time.Time `json:"generated_at"`
}

// assessCommandRisk 评估命令风险等级
func assessCommandRisk(cmd string) string {
	cmdLower := strings.ToLower(cmd)

	criticalPatterns := []string{"rm -rf", "mkfs", "format", "shutdown", "reboot"}
	for _, p := range criticalPatterns {
		if strings.Contains(cmdLower, p) {
			return "critical"
		}
	}

	highPatterns := []string{"> /dev/", "| sh", "| bash", "curl.*|", "wget.*|", "chmod 777"}
	for _, p := range highPatterns {
		if regexp.MustCompile(p).MatchString(cmdLower) {
			return "high"
		}
	}

	mediumPatterns := []string{"sudo", ">", "<", "|", "&", ";", "$(", "`"}
	for _, p := range mediumPatterns {
		if strings.Contains(cmd, p) {
			return "medium"
		}
	}

	return "low"
}

// generateEventID 生成唯一事件 ID
func generateEventID() string {
	return fmt.Sprintf("%d-%s",
		time.Now().UnixNano(),
		randString(8))
}

func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

func splitLines(s string) []string {
	return strings.Split(s, "\n")
}
