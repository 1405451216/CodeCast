package main

// createTestApp creates a test App instance (without Wails).
func createTestApp() *App {
	app := &App{
		sessions:  []*Session{},
		skills:    []*Skill{},
		projects:  []Project{},
		llmConfig: DefaultLLMProviderConfig(),
	}
	return app
}
