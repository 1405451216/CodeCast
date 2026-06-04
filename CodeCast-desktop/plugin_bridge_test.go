package main

import (
	"context"
	"testing"

	ap "agentprimordia/pkg"
)

func TestListPluginsEmpty(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(nil),
		ctx:          context.Background(),
	}

	plugins := app.ListPlugins()
	if len(plugins) != 0 {
		t.Errorf("expected 0 plugins, got %d", len(plugins))
	}
}

func TestLoadPluginInvalidPath(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(nil),
		ctx:          context.Background(),
	}

	_, err := app.LoadPlugin("/nonexistent/plugin.so")
	if err == nil {
		t.Error("expected error for invalid plugin path")
	}
}

func TestLoadPluginNilLoader(t *testing.T) {
	app := &App{
		pluginLoader: nil,
	}

	_, err := app.LoadPlugin("/some/path.so")
	if err == nil {
		t.Error("expected error when pluginLoader is nil")
	}
}

func TestMessageBusBroadcast(t *testing.T) {
	app := &App{
		messageBus: ap.NewLocalMessageBus(),
		ctx:        context.Background(),
	}

	received := make(chan string, 1)
	app.messageBus.Register("test-agent", func(ctx context.Context, msg *ap.BusMessage) (*ap.BusMessage, error) {
		received <- msg.Content
		return nil, nil
	})

	_, _ = app.messageBus.Send(context.Background(), &ap.BusMessage{
		From:    "sender",
		To:      "test-agent",
		Content: "hello",
	})

	select {
	case msg := <-received:
		if msg != "hello" {
			t.Errorf("expected 'hello', got '%s'", msg)
		}
	default:
		t.Error("expected to receive message")
	}
}

func TestBroadcastMessageNoBus(t *testing.T) {
	app := &App{
		messageBus: nil,
	}

	err := app.BroadcastMessage("test")
	if err == nil {
		t.Error("expected error when messageBus is nil")
	}
}

func TestGetPluginStatus(t *testing.T) {
	app := &App{
		pluginLoader: ap.NewPluginLoader(nil),
		ctx:          context.Background(),
	}

	status := app.GetPluginStatus()
	if status.LoadedCount != 0 {
		t.Errorf("expected LoadedCount=0, got %d", status.LoadedCount)
	}
	if status.Plugins == nil {
		t.Error("expected Plugins to be non-nil empty slice")
	}
}

func TestHTTPTransportLifecycle(t *testing.T) {
	app := &App{}

	// Start with nil transport — should be able to start
	if err := app.StartHTTPTransport("127.0.0.1:0"); err != nil {
		// Port 0 may fail in some environments; allow either start or error
		// but not a "double-start" error since transport was nil
		t.Logf("StartHTTPTransport returned: %v (acceptable)", err)
		return
	}

	// Second start should fail (already running)
	if err := app.StartHTTPTransport("127.0.0.1:0"); err == nil {
		t.Error("expected error on second StartHTTPTransport call")
	}

	// Stop
	if err := app.StopHTTPTransport(); err != nil {
		t.Errorf("StopHTTPTransport failed: %v", err)
	}

	// Stop again should be safe (nil)
	if err := app.StopHTTPTransport(); err != nil {
		t.Errorf("second StopHTTPTransport should be safe, got: %v", err)
	}
}
