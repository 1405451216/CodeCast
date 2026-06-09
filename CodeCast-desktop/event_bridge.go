package main

import (
	"log/slog"
	"time"

	ap "agentprimordia/pkg"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// startEventBridge starts the event bridge that forwards AP EventBus events to Wails runtime.
// It subscribes to all AP event types and emits them as Wails events for the frontend.
// It also starts background goroutines for periodic state broadcasts (lifecycle, metrics, cost, cache).
func (a *App) startEventBridge() {
	slog.Info("[EVENT_BRIDGE] starting event bridge")

	eventMap := map[ap.EventType]string{
		ap.EventAgentStart:   "agent:start",
		ap.EventAgentStop:    "agent:stop",
		ap.EventAgentError:   "agent:error",
		ap.EventTurnStart:    "agent:turn",
		ap.EventTurnEnd:      "agent:turn_end",
		ap.EventToolCall:     "agent:tool",
		ap.EventToolResult:   "agent:tool_result",
		ap.EventLLMCall:      "llm:call",
		ap.EventLLMResponse:  "llm:response",
		ap.EventPoolDispatch: "pool:dispatch",
		ap.EventPoolComplete: "pool:complete",
	}

	for apEventType, wailsEventName := range eventMap {
		ch, err := a.eventBus.Subscribe(apEventType)
		if err != "" {
			slog.Error("[EVENT_BRIDGE] subscribe failed", "ap_event", apEventType, "wails_event", wailsEventName, "error", err)
			continue
		}
		slog.Debug("[EVENT_BRIDGE] subscribed", "ap_event", apEventType, "wails_event", wailsEventName)
		go func(ch <-chan ap.Event, wailsName string) {
			count := 0
			for evt := range ch {
				count++
				if count <= 3 || count%100 == 0 {
					slog.Debug("[EVENT_BRIDGE] forwarding event", "wails_event", wailsName, "count", count, "source", evt.Source)
				}
				wailsRuntime.EventsEmit(a.ctx, wailsName, evt.Payload)
			}
			slog.Info("[EVENT_BRIDGE] subscriber exited", "wails_event", wailsName, "total_forwarded", count)
		}(ch, wailsEventName)
	}

	// Lifecycle state broadcast (every 5s)
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		slog.Info("[EVENT_BRIDGE] lifecycle broadcaster started")
		for {
			select {
			case <-a.ctx.Done():
				slog.Info("[EVENT_BRIDGE] lifecycle broadcaster stopped")
				return
			case <-ticker.C:
				states := a.GetAgentLifecycleStates()
				wailsRuntime.EventsEmit(a.ctx, "lifecycle:states", states)
			}
		}
	}()

	// AP Metrics snapshot broadcast (every 10s)
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		slog.Info("[EVENT_BRIDGE] metrics broadcaster started")
		for {
			select {
			case <-a.ctx.Done():
				slog.Info("[EVENT_BRIDGE] metrics broadcaster stopped")
				return
			case <-ticker.C:
				if a.metricsCollector != nil {
					snap := a.GetAPMetricsSnapshot()
					wailsRuntime.EventsEmit(a.ctx, "metrics:snapshot", snap)
				}
			}
		}
	}()

	// Cost summary broadcast (every 30s)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		slog.Info("[EVENT_BRIDGE] cost broadcaster started")
		for {
			select {
			case <-a.ctx.Done():
				slog.Info("[EVENT_BRIDGE] cost broadcaster stopped")
				return
			case <-ticker.C:
				if a.costTracker != nil {
					summary := a.costTracker.Summary()
					wailsRuntime.EventsEmit(a.ctx, "cost:summary", summary)
				}
			}
		}
	}()

	// Cache stats broadcast (every 60s)
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		slog.Info("[EVENT_BRIDGE] cache broadcaster started")
		for {
			select {
			case <-a.ctx.Done():
				slog.Info("[EVENT_BRIDGE] cache broadcaster stopped")
				return
			case <-ticker.C:
				if a.cacheManager != nil {
					stats := a.cacheManager.Stats(a.ctx)
					wailsRuntime.EventsEmit(a.ctx, "cache:stats", stats)
				}
			}
		}
	}()

	slog.Info("[EVENT_BRIDGE] all broadcasters started")
}
