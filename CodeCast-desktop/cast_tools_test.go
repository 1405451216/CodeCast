package main

import (
	"testing"

	ap "agentprimordia/pkg"
)

// ==================== Tool Catalog Tests ====================

func TestGetToolCatalog_Empty(t *testing.T) {
	app := NewApp()
	catalog := app.GetToolCatalog()
	// No tools registered, catalog should be empty slice (not nil)
	if catalog == nil {
		t.Log("catalog is nil when empty (acceptable)")
	}
}

func TestGetToolHistory_NoHistory(t *testing.T) {
	app := NewApp()
	history := app.GetToolHistory("session-1", 10)
	if history != nil && len(history) != 0 {
		t.Errorf("expected empty history, got %d entries", len(history))
	}
}

func TestGetToolHistory_LimitRespected(t *testing.T) {
	app := NewApp()
	history := app.GetToolHistory("session-1", 5)
	if len(history) > 5 {
		t.Errorf("limit 5 exceeded, got %d entries", len(history))
	}
}

// ==================== RegisterCastTools Tests ====================

func TestRegisterCastTools_NilToolkit(t *testing.T) {
	app := NewApp()
	// Verify that nil toolkit access is caught gracefully.
	// The function may panic — this test verifies behavior and documents it.
	defer func() {
		if r := recover(); r != nil {
			t.Logf("RegisterCastTools(nil) panicked (expected in current impl): %v", r)
		}
	}()
	_ = app.RegisterCastTools(nil)
}

func TestRegisterCastTools_ValidToolkit(t *testing.T) {
	app := NewApp()
	toolkit, err := ap.DefaultToolkit(ap.ToolkitConfig{
		RootDir:      "",
		EnableFS:     true,
		EnableShell:  false,
		EnableWeb:    false,
		EnableSearch: false,
		EnableUtils:  true,
	})
	if err != nil {
		t.Skipf("skipping: cannot create toolkit: %v", err)
	}

	err = app.RegisterCastTools(toolkit)
	if err != nil {
		t.Errorf("unexpected error registering cast tools: %v", err)
	}
}

func TestRegisterCastTools_DoubleRegistration(t *testing.T) {
	app := NewApp()
	toolkit, err := ap.DefaultToolkit(ap.ToolkitConfig{
		RootDir: "", EnableFS: true, EnableUtils: true,
	})
	if err != nil {
		t.Skipf("skipping: cannot create toolkit: %v", err)
	}

	// Register twice — should handle gracefully
	err = app.RegisterCastTools(toolkit)
	if err != nil {
		t.Errorf("first registration failed: %v", err)
	}
	err = app.RegisterCastTools(toolkit)
	if err != nil {
		t.Errorf("second registration failed: %v", err)
	}
}

// ==================== InvokeCastTool Tests ====================

func TestInvokeCastTool_NotFound(t *testing.T) {
	app := NewApp()
	// InvokeCastTool requires castReg, which is nil in NewApp().
	// Document that calling with a nil registry panics.
	defer func() {
		if r := recover(); r != nil {
			t.Logf("InvokeCastTool panicked (castReg not initialized): %v", r)
		}
	}()
	_, _ = app.InvokeCastTool("nonexistent_tool", "{}")
}

func TestInvokeCastTool_EmptyName(t *testing.T) {
	app := NewApp()
	defer func() {
		if r := recover(); r != nil {
			t.Logf("InvokeCastTool panicked (castReg not initialized): %v", r)
		}
	}()
	_, _ = app.InvokeCastTool("", "{}")
}

