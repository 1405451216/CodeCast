package main

import (
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	ap "agentprimordia/pkg"
)

// DocumentPipelineConfig configures the document ingestion pipeline.
type DocumentPipelineConfig struct {
	ChunkSize    int      `json:"chunkSize"`
	ChunkOverlap int      `json:"chunkOverlap"`
	MaxFileSize  int64    `json:"maxFileSize"`
	Extensions   []string `json:"extensions"`
}

// DefaultDocumentPipelineConfig returns sensible defaults.
func DefaultDocumentPipelineConfig() DocumentPipelineConfig {
	return DocumentPipelineConfig{
		ChunkSize:    512,
		ChunkOverlap: 64,
		MaxFileSize:  1024 * 1024,
		Extensions:   []string{},
	}
}

// IngestionResult reports the outcome of a directory ingestion run.
type IngestionResult struct {
	FilesProcessed int      `json:"filesProcessed"`
	ChunksCreated  int      `json:"chunksCreated"`
	FilesSkipped   int      `json:"filesSkipped"`
	SkippedReasons []string `json:"skippedReasons,omitempty"`
	TotalBytes     int64    `json:"totalBytes"`
	DurationMs     int64    `json:"durationMs"`
	Directory      string   `json:"directory"`
}

// IngestionStatus returns the current state of document ingestion.
type IngestionStatus struct {
	LastIngestionDir string `json:"lastIngestionDir,omitempty"`
	LastIngestionAt  string `json:"lastIngestionAt,omitempty"`
	TotalDocuments   int    `json:"totalDocuments"`
	TotalChunks      int    `json:"totalChunks"`
	IsRunning        bool   `json:"isRunning"`
}

// IngestDirectory loads all text files from a directory, splits them into chunks,
// and stores them in the AP memory store for retrieval-augmented generation.
func (a *App) IngestDirectory(dirPath string, cfg DocumentPipelineConfig) (*IngestionResult, error) {
	start := time.Now()

	if a.memory == nil {
		return nil, fmt.Errorf("memory store not initialized — cannot ingest documents")
	}

	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("directory not accessible: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", dirPath)
	}

	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 512
	}
	if cfg.ChunkOverlap < 0 {
		cfg.ChunkOverlap = 0
	}
	if cfg.MaxFileSize <= 0 {
		cfg.MaxFileSize = 1024 * 1024
	}

	// Create AP DocumentPipeline — NewTextFileLoader() takes NO args
	splitter := ap.NewRecursiveSplitter(cfg.ChunkSize, cfg.ChunkOverlap)
	loader := ap.NewTextFileLoader()
	pipeline := ap.NewDocumentPipeline(loader, splitter)

	result := &IngestionResult{
		Directory: dirPath,
	}

	err = filepath.WalkDir(dirPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			name := d.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "vendor" || name == "__pycache__" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if len(cfg.Extensions) > 0 {
			found := false
			for _, allowed := range cfg.Extensions {
				if ext == strings.ToLower(allowed) {
					found = true
					break
				}
			}
			if !found {
				result.FilesSkipped++
				return nil
			}
		}

		if len(cfg.Extensions) == 0 && !isTextFile(ext) {
			result.FilesSkipped++
			return nil
		}

		fileInfo, statErr := d.Info()
		if statErr != nil {
			result.FilesSkipped++
			result.SkippedReasons = append(result.SkippedReasons, fmt.Sprintf("%s: stat error: %v", path, statErr))
			return nil
		}
		if fileInfo.Size() > cfg.MaxFileSize {
			result.FilesSkipped++
			result.SkippedReasons = append(result.SkippedReasons, fmt.Sprintf("%s: too large (%d bytes)", path, fileInfo.Size()))
			return nil
		}

		// Use AP DocumentPipeline.Process() to load and split the file
		relPath, _ := filepath.Rel(dirPath, path)
		chunks, splitErr := pipeline.Process(a.ctx, path)
		if splitErr != nil {
			result.FilesSkipped++
			result.SkippedReasons = append(result.SkippedReasons, fmt.Sprintf("%s: process error: %v", path, splitErr))
			return nil
		}

		if len(chunks) == 0 {
			result.FilesSkipped++
			return nil
		}

		// Store each chunk as a memory episode
		for i, chunk := range chunks {
			ep := &ap.Episode{
				SessionID:  "_ingest",
				Role:       "system",
				Content:    chunk.Content,
				Summary:    fmt.Sprintf("%s [chunk %d/%d]", relPath, i+1, len(chunks)),
				Topics:     ext,
				Importance: 0.5,
				Metadata: map[string]string{
					"type":     "ingested",
					"source":   relPath,
					"chunk":    fmt.Sprintf("%d/%d", i+1, len(chunks)),
					"ext":      ext,
					"ingested": time.Now().Format(time.RFC3339),
				},
				CreatedAt: time.Now().Format(time.RFC3339),
			}
			if addErr := a.memory.Add(a.ctx, ep); addErr != nil {
				slog.Warn("Failed to store ingested chunk", "file", relPath, "chunk", i, "error", addErr)
			} else {
				result.ChunksCreated++
			}
		}

		result.FilesProcessed++
		result.TotalBytes += fileInfo.Size()
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("directory walk failed: %w", err)
	}

	result.DurationMs = time.Since(start).Milliseconds()

	a.ingestionStatus = &IngestionStatus{
		LastIngestionDir: dirPath,
		LastIngestionAt:  time.Now().Format(time.RFC3339),
		TotalDocuments:   result.FilesProcessed,
		TotalChunks:      result.ChunksCreated,
		IsRunning:        false,
	}

	slog.Info("Document ingestion completed",
		"dir", dirPath,
		"files", result.FilesProcessed,
		"chunks", result.ChunksCreated,
		"skipped", result.FilesSkipped,
		"duration_ms", result.DurationMs,
	)

	return result, nil
}

// GetIngestionStatus returns the current document ingestion status.
func (a *App) GetIngestionStatus() *IngestionStatus {
	if a.ingestionStatus == nil {
		return &IngestionStatus{IsRunning: false}
	}
	return a.ingestionStatus
}

// isTextFile returns true if the file extension suggests a text/code file.
func isTextFile(ext string) bool {
	textExts := map[string]bool{
		".go": true, ".ts": true, ".tsx": true, ".js": true, ".jsx": true,
		".py": true, ".rs": true, ".java": true, ".kt": true, ".swift": true,
		".c": true, ".cpp": true, ".h": true, ".hpp": true, ".cs": true,
		".rb": true, ".php": true, ".scala": true, ".r": true, ".R": true,
		".lua": true, ".pl": true, ".sh": true, ".bash": true, ".zsh": true,
		".ps1": true, ".bat": true, ".cmd": true,
		".html": true, ".htm": true, ".css": true, ".scss": true, ".less": true,
		".vue": true, ".svelte": true,
		".json": true, ".yaml": true, ".yml": true, ".toml": true,
		".xml": true, ".csv": true, ".ini": true, ".cfg": true,
		".env": true, ".properties": true, ".conf": true,
		".md": true, ".txt": true, ".rst": true, ".adoc": true,
		".org": true, ".tex": true, ".wiki": true,
		".makefile": true, ".dockerfile": true, ".cmake": true,
		".gradle": true, ".mvn": true,
		".sql": true, ".graphql": true, ".proto": true, ".thrift": true,
		".dart": true, ".ex": true, ".exs": true, ".erl": true,
		".hs": true, ".ml": true, ".fs": true, ".clj": true,
		".vim": true, ".el": true, ".lisp": true,
	}
	return textExts[ext]
}
