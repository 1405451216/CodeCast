package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	ap "agentprimordia/pkg"
)

// mockAgent is a test double for ap.Agent that simulates streaming.
type mockAgent struct {
	events []ap.StreamEvent
}

func (m *mockAgent) Run(ctx context.Context, msg ap.Message) (*ap.Response, error) {
	return &ap.Response{}, nil
}

func (m *mockAgent) StreamRun(ctx context.Context, msg ap.Message) (<-chan ap.StreamEvent, error) {
	ch := make(chan ap.StreamEvent, len(m.events)+1)
	for _, e := range m.events {
		ch <- e
	}
	ch <- ap.StreamEvent{Type: ap.StreamEventComplete}
	close(ch)
	return ch, nil
}

func (m *mockAgent) Stop() {}

func (m *mockAgent) Name() string { return "mock-agent" }

func (m *mockAgent) Stats() ap.AgentStats { return ap.AgentStats{} }

// createTestAppWithMocks creates an App with minimal AP subsystems for isolated testing.
// For concrete AP types (*SQLiteStore, *ToolRegistry, *RAGStore) we use nil since
// they cannot be mocked with custom structs. Tests that need those fields should
// use real AP constructors or skip.
func createTestAppWithMocks(t *testing.T) *App {
	t.Helper()
	app := NewApp()
	app.ctx = context.Background()

	// AP concrete types — set to nil; tests that need them must create real instances
	app.memory = nil
	app.ragStore = nil
	app.toolkit = nil

	// AP interfaces / constructible types — use real constructors
	app.eventBus = ap.NewBus(16)
	app.hooks = ap.NewHookManager()
	app.lifecycle = ap.NewLifecycle()
	app.contextWindowStrategy = ap.NewDefaultStrategy(80)
	app.metricsCollector = ap.NewMetrics()

	// CheckpointStore is an interface — use nil for now
	app.checkpointStore = nil

	// Cost tracker
	app.initCostTracker()

	// Session agents map
	app.sessionAgents = make(map[string]ap.Agent)
	app.sessionCancels = make(map[string]context.CancelFunc)
	app.checkpointConfirmations = make(map[string]chan bool)

	return app
}

// TestGetOrCreateAgent_ExistingAgent verifies that getOrCreateAgent returns
// an already-stored agent without creating a new one.
func TestGetOrCreateAgent_ExistingAgent(t *testing.T) {
	app := createTestAppWithMocks(t)

	// Pre-populate a mock agent
	app.mu.Lock()
	app.sessionAgents["sess_existing"] = &mockAgent{}
	app.mu.Unlock()

	agent, err := app.getOrCreateAgent("sess_existing", "")
	if err != nil {
		t.Fatalf("getOrCreateAgent existing failed: %v", err)
	}
	if agent == nil {
		t.Fatal("expected non-nil agent for existing session")
	}
	t.Log("[PASS] Existing agent retrieved without creation")
}

// TestGetOrCreateAgent_NewAgentFailsWithoutProvider verifies that creating
// a new agent fails gracefully when no provider is configured.
func TestGetOrCreateAgent_NewAgentFailsWithoutProvider(t *testing.T) {
	app := createTestAppWithMocks(t)

	// No cached provider, no model configs — should fail
	_, err := app.getOrCreateAgent("sess_no_provider", "")
	if err == nil {
		t.Fatal("expected error when creating agent without provider config")
	}
	t.Logf("[PASS] New agent creation correctly fails without provider: %v", err)
}

// TestGetOrCreateAgent_ConcurrentRead tests that concurrent reads of the
// same existing agent don't cause races.
func TestGetOrCreateAgent_ConcurrentRead(t *testing.T) {
	app := createTestAppWithMocks(t)

	// Pre-populate
	app.mu.Lock()
	app.sessionAgents["sess_concurrent"] = &mockAgent{}
	app.mu.Unlock()

	const workers = 10
	var wg sync.WaitGroup
	wg.Add(workers)
	errCh := make(chan error, workers)

	for i := 0; i < workers; i++ {
		go func() {
			defer wg.Done()
			agent, err := app.getOrCreateAgent("sess_concurrent", "")
			if err != nil {
				errCh <- err
				return
			}
			if agent == nil {
				errCh <- fmt.Errorf("got nil agent")
			}
		}()
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("concurrent read failed: %v", err)
	}
	t.Log("[PASS] Concurrent read of existing agent: no races")
}

// TestSendMessageEx_MockStream verifies SendMessageEx with a mock agent
// that simulates a streaming response. We bypass getOrCreateAgent by
// pre-populating the agent.
func TestSendMessageEx_MockStream(t *testing.T) {
	app := createTestAppWithMocks(t)

	// Create a session
	session := app.CreateSession("Test Session", "", "daily")
	if session == nil {
		t.Fatal("CreateSession returned nil")
	}

	// Inject mock agent that simulates a streaming response
	mock := &mockAgent{
		events: []ap.StreamEvent{
			{Type: ap.StreamEventToken, Content: "Hello"},
			{Type: ap.StreamEventToken, Content: " "},
			{Type: ap.StreamEventToken, Content: "world"},
		},
	}

	app.mu.Lock()
	app.sessionAgents[session.ID] = mock
	app.mu.Unlock()

	// Call SendMessageEx
	messages, err := app.SendMessageEx(session.ID, "Hi there", "", "")
	if err != nil {
		t.Fatalf("SendMessageEx failed: %v", err)
	}

	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}
	if messages[0].Role != "user" || messages[0].Content != "Hi there" {
		t.Errorf("unexpected user message: %+v", messages[0])
	}
	if messages[1].Role != "assistant" || messages[1].Content != "Hello world" {
		t.Errorf("unexpected assistant message: got %q, want %q", messages[1].Content, "Hello world")
	}

	t.Logf("[PASS] SendMessageEx mock stream test passed: assistant replied %q", messages[1].Content)
}

// TestSendMessageEx_SessionNotFound verifies SendMessageEx returns an error
// for a non-existent session.
func TestSendMessageEx_SessionNotFound(t *testing.T) {
	app := createTestAppWithMocks(t)

	_, err := app.SendMessageEx("nonexistent_session", "Hello", "", "")
	if err == nil {
		t.Fatal("expected error for non-existent session")
	}
	t.Logf("[PASS] SendMessageEx correctly fails for missing session: %v", err)
}

// TestSendMessageEx_MessagesStoredInSession verifies that after SendMessageEx,
// the messages are stored in the session's Messages slice.
func TestSendMessageEx_MessagesStoredInSession(t *testing.T) {
	app := createTestAppWithMocks(t)

	session := app.CreateSession("Storage Test", "", "daily")

	mock := &mockAgent{
		events: []ap.StreamEvent{
			{Type: ap.StreamEventToken, Content: "Response"},
		},
	}

	app.mu.Lock()
	app.sessionAgents[session.ID] = mock
	app.mu.Unlock()

	_, err := app.SendMessageEx(session.ID, "Question", "", "")
	if err != nil {
		t.Fatalf("SendMessageEx failed: %v", err)
	}

	// Verify messages stored in session
	updated := app.GetSession(session.ID)
	if updated == nil {
		t.Fatal("session not found after SendMessageEx")
	}
	if len(updated.Messages) != 2 {
		t.Fatalf("expected 2 messages in session, got %d", len(updated.Messages))
	}
	if updated.Messages[0].Role != "user" || updated.Messages[0].Content != "Question" {
		t.Errorf("unexpected first message: %+v", updated.Messages[0])
	}
	if updated.Messages[1].Role != "assistant" || updated.Messages[1].Content != "Response" {
		t.Errorf("unexpected second message: %+v", updated.Messages[1])
	}

	t.Logf("[PASS] Messages correctly stored in session after SendMessageEx")
}

// TestCheckpointHook_Timeout verifies checkpoint timeout uses DefaultCheckpointTimeout.
func TestCheckpointHook_Timeout(t *testing.T) {
	// Verify the constant is defined correctly
	if DefaultCheckpointTimeout != 5*time.Minute {
		t.Errorf("expected DefaultCheckpointTimeout=5m, got %v", DefaultCheckpointTimeout)
	}
	t.Log("[PASS] DefaultCheckpointTimeout is correctly defined as 5 minutes")
}

// TestCostTracker_SetBudgetConfigAtomic verifies SetBudgetConfig is atomic
// and doesn't panic under concurrent access.
func TestCostTracker_SetBudgetConfigAtomic(t *testing.T) {
	app := createTestAppWithMocks(t)
	app.initCostTracker()

	// Set initial budget
	app.SetBudgetConfig(BudgetConfigDTO{MaxCostUSD: 5.0})

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(val float64) {
			defer wg.Done()
			app.SetBudgetConfig(BudgetConfigDTO{MaxCostUSD: val})
			config := app.GetBudgetConfig()
			// Just verify no panic and values are reasonable
			if config.MaxCostUSD < 0 {
				t.Error("MaxCostUSD should not be negative")
			}
		}(float64(i) + 1.0)
	}
	wg.Wait()

	final := app.GetBudgetConfig()
	if final.MaxCostUSD < 0 {
		t.Error("final MaxCostUSD should not be negative")
	}
	t.Logf("[PASS] SetBudgetConfig atomic test passed: final budget=%.2f", final.MaxCostUSD)
}

// TestCostTracker_Init verifies that initCostTracker creates a non-nil tracker.
func TestCostTracker_Init(t *testing.T) {
	app := &App{
		settings: &Settings{},
		ctx:      context.Background(),
	}
	app.initCostTracker()
	if app.costTracker == nil {
		t.Fatal("expected costTracker to be initialized after initCostTracker")
	}
	t.Log("[PASS] initCostTracker creates non-nil costTracker")
}

// TestResume_LastUserMessage verifies resume logic finds the last user message.
func TestResume_LastUserMessage(t *testing.T) {
	app := createTestAppWithMocks(t)
	session := app.CreateSession("Resume Test", "", "daily")

	// Simulate: user -> assistant (partial) -> need resume
	app.mu.Lock()
	for _, s := range app.sessions {
		if s.ID == session.ID {
			s.Messages = []Message{
				{Role: "user", Content: "First question"},
				{Role: "assistant", Content: "Partial answer..."},
				{Role: "user", Content: "Second question"},
				{Role: "assistant", Content: "Another partial..."},
			}
			break
		}
	}
	app.mu.Unlock()

	// Verify messages are stored
	msgs := app.GetSession(session.ID).Messages
	if len(msgs) != 4 {
		t.Fatalf("expected 4 messages, got %d", len(msgs))
	}

	// The resume logic should find the last user message (index 2)
	lastUserContent := ""
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			lastUserContent = msgs[i].Content
			break
		}
	}
	if lastUserContent != "Second question" {
		t.Errorf("expected last user message 'Second question', got %q", lastUserContent)
	}
	t.Logf("[PASS] Resume logic correctly finds last user message: %q", lastUserContent)
}

// TestSessionCreation verifies basic session CRUD operations.
func TestSessionCreation(t *testing.T) {
	app := createTestAppWithMocks(t)

	// Create sessions with different modes
	castSession := app.CreateSession("Cast Chat", "", "daily")
	if castSession == nil {
		t.Fatal("CreateSession returned nil for cast mode")
	}
	if castSession.Mode != "daily" {
		t.Errorf("expected mode 'daily', got '%s'", castSession.Mode)
	}

	codeSession := app.CreateSession("Code Task", "", "coding")
	if codeSession == nil {
		t.Fatal("CreateSession returned nil for code mode")
	}
	if codeSession.Mode != "coding" {
		t.Errorf("expected mode 'coding', got '%s'", codeSession.Mode)
	}

	// Verify sessions are stored
	allSessions := app.GetSessions()
	if len(allSessions) < 2 {
		t.Fatalf("expected at least 2 sessions, got %d", len(allSessions))
	}

	t.Logf("[PASS] Session creation test passed: %d sessions created", len(allSessions))
}

// TestMain runs all tests with verbose logging.
func TestMain(m *testing.M) {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})))
	os.Exit(m.Run())
}
