package main

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	ap "agentprimordia/pkg"
)

type castTodoItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Priority  string `json:"priority"`
	DueDate   string `json:"dueDate,omitempty"`
	Recurring string `json:"recurring,omitempty"`
	Done      bool   `json:"done"`
	CreatedAt int64  `json:"createdAt"`
}

type castPomodoroSession struct {
	StartedAt int64 `json:"startedAt"`
	Minutes   int   `json:"minutes"`
	Active    bool  `json:"active"`
}

var (
	todoStore *castPersistentStore[map[string]*castTodoItem]

	pomodoroMu       sync.RWMutex
	currentPomodoro  *castPomodoroSession
	pomodoroCancelCh chan struct{} // closed when a new pomodoro starts, cancelling the previous timer
)

func registerTodoTools(a *App, toolkit *ap.ToolRegistry) error {
	tools := []*castTool{
		newCastTool(a, "cast_todo_create", "todo",
			"创建待办（支持优先级/截止日期/重复）",
			json.RawMessage(`{
				"type": "object",
				"properties": {
					"title":     {"type": "string"},
					"priority":  {"type": "string", "enum": ["low","medium","high","urgent"]},
					"dueDate":   {"type": "string", "description": "ISO 8601"},
					"recurring": {"type": "string", "description": "daily/weekly/monthly"}
				},
				"required": ["title"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolTodoCreate(ctx, args)
			},
		),
		newCastTool(a, "cast_todo_list", "todo",
			"列出待办",
			json.RawMessage(`{"type":"object","properties":{"includeDone":{"type":"boolean"}}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolTodoList(ctx, args)
			},
		),
		newCastTool(a, "cast_todo_done", "todo",
			"标记待办完成",
			json.RawMessage(`{
				"type": "object",
				"properties": {"id": {"type": "string"}},
				"required": ["id"]
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolTodoDone(ctx, args)
			},
		),
		newCastTool(a, "cast_pomodoro_start", "todo",
			"启动番茄钟（默认 25 分钟）",
			json.RawMessage(`{
				"type": "object",
				"properties": {"minutes": {"type": "integer", "description": "默认 25"}}
			}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPomodoroStart(ctx, args)
			},
		),
		newCastTool(a, "cast_pomodoro_status", "todo",
			"查询当前番茄钟状态",
			json.RawMessage(`{"type":"object","properties":{}}`),
			func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
				return a.castToolPomodoroStatus(ctx, args)
			},
		),
	}
	return toolkit.RegisterMultiple(toolToApTools(tools)...)
}

func (a *App) castToolTodoCreate(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castTodoCreateArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	item := &castTodoItem{
		ID:        generateID("todo"),
		Title:     in.Title,
		Priority:  orDefault(in.Priority, "medium"),
		DueDate:   in.DueDate,
		Recurring: in.Recurring,
		Done:      false,
		CreatedAt: time.Now().Unix(),
	}
	todoStore.Mutate(func(m map[string]*castTodoItem) {
		m[item.ID] = item
	})
	out := castTodoCreateResult{ID: item.ID}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_todo_create", "todo", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolTodoList(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		IncludeDone bool `json:"includeDone"`
	}
	_ = json.Unmarshal(args, &in)
	var items []*castTodoItem
	todoStore.Get(func(m map[string]*castTodoItem) {
		items = make([]*castTodoItem, 0, len(m))
		for _, it := range m {
			if !in.IncludeDone && it.Done {
				continue
			}
			items = append(items, it)
		}
	})
	outJSON, _ := json.Marshal(items)
	return a.recordCastInvocation("cast_todo_list", "todo", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolTodoDone(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return &ap.ToolResult{Content: "invalid args: " + err.Error(), IsError: true}, nil
	}
	todoStore.Mutate(func(m map[string]*castTodoItem) {
		if it, ok := m[in.ID]; ok {
			it.Done = true
		}
	})
	out := map[string]any{"id": in.ID, "done": true}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_todo_done", "todo", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPomodoroStart(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	var in castPomodoroStartArgs
	_ = json.Unmarshal(args, &in)
	minutes := in.Minutes
	if minutes <= 0 {
		minutes = 25
	}

	// Cancel any previous pomodoro timer goroutine
	pomodoroMu.Lock()
	if pomodoroCancelCh != nil {
		close(pomodoroCancelCh)
	}
	pomodoroCancelCh = make(chan struct{})
	cancelCh := pomodoroCancelCh

	currentPomodoro = &castPomodoroSession{
		StartedAt: time.Now().Unix(),
		Minutes:   minutes,
		Active:    true,
	}
	pomodoroMu.Unlock()

	// Auto-stop after timer expires; exits early if cancelled by a new start.
	go func() {
		timer := time.NewTimer(time.Duration(minutes) * time.Minute)
		defer timer.Stop()
		select {
		case <-cancelCh:
			// Cancelled by a new pomodoro start
			return
		case <-timer.C:
			pomodoroMu.Lock()
			if currentPomodoro != nil {
				currentPomodoro.Active = false
			}
			pomodoroMu.Unlock()
		}
	}()

	out := castPomodoroStartResult{StartedAt: time.Now().Unix(), Minutes: minutes}
	outJSON, _ := json.Marshal(out)
	return a.recordCastInvocation("cast_pomodoro_start", "todo", "", args, string(outJSON), false, 0), nil
}

func (a *App) castToolPomodoroStatus(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
	pomodoroMu.RLock()
	defer pomodoroMu.RUnlock()
	if currentPomodoro == nil {
		out := map[string]any{"active": false}
		outJSON, _ := json.Marshal(out)
		return a.recordCastInvocation("cast_pomodoro_status", "todo", "", args, string(outJSON), false, 0), nil
	}
	outJSON, _ := json.Marshal(currentPomodoro)
	return a.recordCastInvocation("cast_pomodoro_status", "todo", "", args, string(outJSON), false, 0), nil
}
