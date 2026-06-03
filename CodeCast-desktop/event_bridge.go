package main

import (
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
}
