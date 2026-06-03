package main

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	ap "agentprimordia/pkg"
)

// castScheduleStore 内存中的日程存储。
// 阶段 3 简化实现：用内存 + AP Memory 持久化。
// 未来可迁到 AP SQLiteStore 或独立 SQLite 表。
type castScheduleStore struct {
	mu    sync.RWMutex
	tasks map[string]*castScheduleTask
}

type castScheduleTask struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Schedule    string `json:"schedule"`
	Command     string `json:"command,omitempty"`
	Enabled     bool   `json:"enabled"`
	LastRun     int64  `json:"lastRun"`
	NextRun     int64  `json:"nextRun"`
	CreatedAt   int64  `json:"createdAt"`
}

var globalScheduleStore = &castScheduleStore{tasks: make(map[string]*castScheduleTask)}

func registerScheduleTools(toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool("cast_schedule_create", "schedule",
			"创建定时任务（支持 cron 表达式）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"name":        {"type": "string"},
					"description": {"type": "string"},
					"schedule":    {"type": "string", "description": "cron 表达式或 'every 30m' / 'daily 09:00'"},
					"command":     {"type": "string", "description": "可选，要执行的命令或自然语言任务"}
				},
				"required": ["name","schedule"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolScheduleCreate(ctx, args)
			},
		),
		newCastTool("cast_schedule_list", "schedule",
			"列出所有定时任务",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"limit": {"type": "integer"}
				}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolScheduleList(ctx, args)
			},
		),
		newCastTool("cast_schedule_run_now", "schedule",
			"立即执行指定任务",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"taskId": {"type": "string"}
				},
				"required": ["taskId"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolScheduleRunNow(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolScheduleCreate(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castScheduleCreateArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}

	task := &castScheduleTask{
		ID:          generateID("sched"),
		Name:        in.Name,
		Description: in.Description,
		Schedule:    in.Schedule,
		Command:     in.Command,
		Enabled:     true,
		CreatedAt:   time.Now().Unix(),
		NextRun:     parseNextRun(in.Schedule, 0).Unix(),
	}
	globalScheduleStore.mu.Lock()
	globalScheduleStore.tasks[task.ID] = task
	globalScheduleStore.mu.Unlock()

	out := castScheduleCreateResult{ID: task.ID}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_schedule_create", "schedule", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolScheduleList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castScheduleListArgs
	_ = json.Unmarshal(args, &in)
	limit := in.Limit
	if limit <= 0 {
		limit = 50
	}

	globalScheduleStore.mu.RLock()
	defer globalScheduleStore.mu.RUnlock()

	out := castScheduleListResult{}
	for _, t := range globalScheduleStore.tasks {
		out.Tasks = append(out.Tasks, struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Schedule    string `json:"schedule"`
			LastRun     int64  `json:"lastRun"`
			NextRun     int64  `json:"nextRun"`
			Enabled     bool   `json:"enabled"`
		}{t.ID, t.Name, t.Schedule, t.LastRun, t.NextRun, t.Enabled})
		if len(out.Tasks) >= limit {
			break
		}
	}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_schedule_list", "schedule", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolScheduleRunNow(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castScheduleRunNowArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	globalScheduleStore.mu.Lock()
	task, ok := globalScheduleStore.tasks[in.TaskID]
	if !ok {
		globalScheduleStore.mu.Unlock()
		return a.recordCastInvocation("cast_schedule_run_now", "schedule", "", args,
			"task not found: "+in.TaskID, true, 0), nil
	}
	task.LastRun = time.Now().Unix()
	task.NextRun = parseNextRun(task.Schedule, task.LastRun).Unix()
	globalScheduleStore.mu.Unlock()

	// 异步执行（避免阻塞）
	go func() {
		if task.Command == "" {
			return
		}
		// 用 AP Pool 提交一个 TaskConfig
		_, _ = a.pool.Dispatch(context.Background(), []ap.TaskConfig{
			{Title: task.Name, Prompt: task.Description, MaxTurns: 5},
		})
	}()

	out := castScheduleRunNowResult{Started: true, Message: "task " + task.Name + " dispatched to AP Pool"}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_schedule_run_now", "schedule", "", args, string(outJSON), false, 0), nil
}

func generateID(prefix string) string {
	return prefix + "_" + time.Now().Format("20060102150405") + "_" + randomHex(4)
}

// runScheduleDispatcher 后台轮询：每分钟检查一次，到点任务通过 AP Pool.Dispatch 执行。
// 替代原 task.go 的 StartTaskScheduler。
func (a *App) runScheduleDispatcher(stop <-chan struct{}) {
	t := time.NewTicker(1 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case now := <-t.C:
			a.dispatchDueTasks(now)
		}
	}
}

func (a *App) dispatchDueTasks(now time.Time) {
	nowUnix := now.Unix()
	globalScheduleStore.mu.Lock()
	defer globalScheduleStore.mu.Unlock()
	for _, task := range globalScheduleStore.tasks {
		if !task.Enabled || task.NextRun == 0 || task.NextRun > nowUnix {
			continue
		}
		// 到点了：异步 Dispatch 到 AP Pool
		func(task *castScheduleTask) {
			if a.pool == nil || task.Command == "" {
				return
			}
			_, _ = a.pool.Dispatch(context.Background(), []ap.TaskConfig{
				{Title: task.Name, Prompt: task.Description, MaxTurns: 5},
			})
		}(task)
		// 更新 lastRun / nextRun
		task.LastRun = nowUnix
		task.NextRun = parseNextRun(task.Schedule, nowUnix).Unix()
	}
}

func randomHex(n int) string {
	const hex = "0123456789abcdef"
	b := make([]byte, n)
	for i := range b {
		b[i] = hex[time.Now().UnixNano()%16]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

func parseNextRun(schedule string, lastRun int64) time.Time {
	// 简化的 cron 解析：支持 "every Nm/Nh/Nd" 和 "daily HH:MM"
	now := time.Now()
	if lastRun == 0 {
		lastRun = now.Unix()
	}

	if len(schedule) > 6 && schedule[:6] == "every " {
		interval := schedule[6:]
		var d time.Duration
		switch {
		case interval[len(interval)-1] == 'm':
			mins := parseInt(interval[:len(interval)-1])
			d = time.Duration(mins) * time.Minute
		case interval[len(interval)-1] == 'h':
			hrs := parseInt(interval[:len(interval)-1])
			d = time.Duration(hrs) * time.Hour
		case interval[len(interval)-1] == 'd':
			days := parseInt(interval[:len(interval)-1])
			d = time.Duration(days) * 24 * time.Hour
		default:
			d = time.Hour
		}
		return time.Unix(lastRun, 0).Add(d)
	}

	if len(schedule) > 6 && schedule[:6] == "daily " {
		t, err := time.Parse("15:04", schedule[6:])
		if err != nil {
			return now.Add(24 * time.Hour)
		}
		next := time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, now.Location())
		if next.Before(now) {
			next = next.Add(24 * time.Hour)
		}
		return next
	}

	// TODO: 完整 cron 解析（阶段 7+ 优化）
	return now.Add(time.Hour)
}

func parseInt(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 1
		}
		n = n*10 + int(c-'0')
	}
	return n
}
