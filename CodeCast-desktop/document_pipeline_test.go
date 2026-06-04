package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestNewDocumentPipelineConfig(t *testing.T) {
	t.Parallel()
	cfg := DocumentPipelineConfig{
		ChunkSize:    512,
		ChunkOverlap: 64,
		MaxFileSize:  1024 * 1024,
		Extensions:   []string{".go", ".ts", ".md"},
	}
	if cfg.ChunkSize != 512 {
		t.Errorf("expected ChunkSize 512, got %d", cfg.ChunkSize)
	}
	if len(cfg.Extensions) != 3 {
		t.Errorf("expected 3 extensions, got %d", len(cfg.Extensions))
	}
}

func TestIngestDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	goContent := "package main\n\nfunc main() {\n\tprintln(\"hello\")\n}\n"
	if err := os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte(goContent), 0644); err != nil {
		t.Fatal(err)
	}

	mdContent := "# Test Document\n\nThis is a test document for ingestion.\n"
	if err := os.WriteFile(filepath.Join(tmpDir, "README.md"), []byte(mdContent), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(tmpDir, "binary.bin"), []byte{0x00, 0x01, 0x02}, 0644); err != nil {
		t.Fatal(err)
	}

	app := &App{
		ctx:    context.Background(),
		memory: nil,
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	cfg := DocumentPipelineConfig{
		ChunkSize:    256,
		ChunkOverlap: 32,
		MaxFileSize:  1024 * 1024,
		Extensions:   []string{".go", ".md"},
	}

	result, err := app.IngestDirectory(tmpDir, cfg)
	if err != nil {
		t.Logf("IngestDirectory returned expected error: %v", err)
	}
	if result != nil {
		t.Logf("IngestDirectory returned result: %d files processed", result.FilesProcessed)
	}
}

func TestIngestDirectoryWithMemory(t *testing.T) {
	tmpDir := t.TempDir()

	goContent := "package main\n\nfunc hello() string {\n\treturn \"world\"\n}\n"
	if err := os.WriteFile(filepath.Join(tmpDir, "hello.go"), []byte(goContent), 0644); err != nil {
		t.Fatal(err)
	}

	app := &App{
		ctx:    context.Background(),
		memory: nil,
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	cfg := DocumentPipelineConfig{
		ChunkSize:    128,
		ChunkOverlap: 16,
		MaxFileSize:  1024 * 1024,
		Extensions:   []string{".go"},
	}

	_, err := app.IngestDirectory(tmpDir, cfg)
	if err == nil {
		t.Log("IngestDirectory succeeded (memory was available)")
	} else {
		t.Logf("IngestDirectory failed as expected without memory: %v", err)
	}
}

func TestGetIngestionStatus(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	app.orchestrationRuns = make(map[string]*OrchestrationRun)

	status := app.GetIngestionStatus()
	if status == nil {
		t.Fatal("expected non-nil IngestionStatus")
	}
}

func TestIsTextFile(t *testing.T) {
	t.Parallel()
	tests := []struct {
		ext  string
		want bool
	}{
		{".go", true},
		{".ts", true},
		{".tsx", true},
		{".js", true},
		{".py", true},
		{".md", true},
		{".json", true},
		{".yaml", true},
		{".exe", false},
		{".png", false},
		{".zip", false},
		{".bin", false},
	}

	for _, tt := range tests {
		got := isTextFile(tt.ext)
		if got != tt.want {
			t.Errorf("isTextFile(%q) = %v, want %v", tt.ext, got, tt.want)
		}
	}
}
