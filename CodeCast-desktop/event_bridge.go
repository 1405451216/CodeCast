package main

import (
	"time"

	ap "agentprimordia/pkg"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startEventBridge() {
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
		ch, _ := a.eventBus.Subscribe(apEventType)
		go func(ch <-chan ap.Event, wailsName string) {
			for evt := range ch {
				wailsRuntime.EventsEmit(a.ctx, wailsName, evt.Payload)
			}
		}(ch, wailsEventName)
	}

	// Lifecycle state broadcast (every 5s)
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-a.ctx.Done():
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
		for {
			select {
			case <-a.ctx.Done():
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
		for {
			select {
			case <-a.ctx.Done():
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
		for {
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
				if a.cacheManager != nil {
					stats := a.cacheManager.Stats(a.ctx)
					wailsRuntime.EventsEmit(a.ctx, "cache:stats", stats)
				}
			}
		}
	}()
}
