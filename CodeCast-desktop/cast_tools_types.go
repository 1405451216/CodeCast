package main

// 写作类
type castWritingGenerateArgs struct {
	DocType string `json:"docType"` // weekly, plan, copy, summary, email, ppt, resume, blog, custom
	Topic   string `json:"topic"`
	Style   string `json:"style,omitempty"` // formal, casual, academic, marketing, technical, creative
	Length  string `json:"length,omitempty"` // short, medium, long
	Outline string `json:"outline,omitempty"`
}
type castWritingGenerateResult struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type castWritingPolishArgs struct {
	Text   string `json:"text"`
	Style  string `json:"style,omitempty"`
	Action string `json:"action"` // polish, expand, shorten, rewrite
}
type castWritingPolishResult struct {
	Content string `json:"content"`
}

type castWritingOutlineArgs struct {
	Topic    string `json:"topic"`
	Sections int    `json:"sections,omitempty"`
}
type castWritingOutlineResult struct {
	Outline []string `json:"outline"`
}

// 翻译类
type castTranslateTextArgs struct {
	Text   string `json:"text"`
	Target string `json:"target"` // 语言代码
	Style  string `json:"style,omitempty"`
}
type castTranslateTextResult struct {
	Original string `json:"original"`
	Target   string `json:"target"`
	Content  string `json:"content"`
}

type castTranslateGlossaryArgs struct {
	Term  string `json:"term"`
	Trans string `json:"trans"`
}

// 知识库类
type castKBSearchArgs struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}
type castKBSearchResult struct {
	Hits []struct {
		Title   string  `json:"title"`
		Snippet string  `json:"snippet"`
		Score   float64 `json:"score"`
	} `json:"hits"`
}

type castKBSaveArgs struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Tags    []string `json:"tags,omitempty"`
}
type castKBSaveResult struct {
	ID string `json:"id"`
}

type castKBLinkArgs struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// 邮件类
type castEmailDraftArgs struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
	Tone    string `json:"tone,omitempty"`
}
type castEmailDraftResult struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type castEmailSendArgs struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// 日程 / 调度
type castScheduleCreateArgs struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Schedule    string `json:"schedule"` // cron 表达式
	Command     string `json:"command,omitempty"`
}
type castScheduleCreateResult struct {
	ID string `json:"id"`
}

type castScheduleListArgs struct {
	Limit int `json:"limit,omitempty"`
}
type castScheduleListResult struct {
	Tasks []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Schedule    string `json:"schedule"`
		LastRun     int64  `json:"lastRun"`
		NextRun     int64  `json:"nextRun"`
		Enabled     bool   `json:"enabled"`
	} `json:"tasks"`
}

type castScheduleRunNowArgs struct {
	TaskID string `json:"taskId"`
}
type castScheduleRunNowResult struct {
	Started bool   `json:"started"`
	Message string `json:"message"`
}

// 工具箱
type castTodoCreateArgs struct {
	Title     string `json:"title"`
	Priority  string `json:"priority,omitempty"` // low, medium, high, urgent
	DueDate   string `json:"dueDate,omitempty"`
	Recurring string `json:"recurring,omitempty"`
}
type castTodoCreateResult struct {
	ID string `json:"id"`
}

type castBrainstormArgs struct {
	Topic  string `json:"topic"`
	Count  int    `json:"count,omitempty"`
}
type castBrainstormResult struct {
	Ideas []string `json:"ideas"`
}

type castMeetingMinutesArgs struct {
	Transcript string `json:"transcript"`
}
type castMeetingMinutesResult struct {
	Summary  string   `json:"summary"`
	ActionItems []string `json:"actionItems"`
	Decisions  []string `json:"decisions"`
}

type castPomodoroStartArgs struct {
	Minutes int `json:"minutes,omitempty"`
}
type castPomodoroStartResult struct {
	StartedAt int64 `json:"startedAt"`
	Minutes   int  `json:"minutes"`
}

type castOCRArgs struct {
	ImagePath  string `json:"imagePath"`            // 本地文件路径 或 base64 data URL
	Prompt     string `json:"prompt,omitempty"`     // 提取指令，默认"提取所有文字"
	Lang       string `json:"lang,omitempty"`       // 期望语言，如 "zh"/"en"/"ja"，留空自动检测
	Model      string `json:"model,omitempty"`      // 覆盖默认 vision 模型
	MaxTokens  int    `json:"maxTokens,omitempty"`  // 覆盖 max_tokens
}
type castOCRResult struct {
	Text     string  `json:"text"`
	Lang     string  `json:"lang"`
	Model    string  `json:"model"`
	Usage    struct {
		InputTokens  int `json:"inputTokens"`
		OutputTokens int `json:"outputTokens"`
	} `json:"usage"`
}

type castPasswordGenArgs struct {
	Length  int  `json:"length,omitempty"`
	Symbols bool `json:"symbols,omitempty"`
}
type castPasswordGenResult struct {
	Password string `json:"password"`
}

type castChartGenArgs struct {
	Description string `json:"description"`
	Format      string `json:"format,omitempty"` // mermaid, plantuml
}
type castChartGenResult struct {
	Code string `json:"code"`
}

type castFormatConvertArgs struct {
	From   string `json:"from"` // json, yaml, xml, csv
	To     string `json:"to"`
	Input  string `json:"input"`
}
type castFormatConvertResult struct {
	Output string `json:"output"`
}

// 插件
type castPluginListArgs struct {
	Source string `json:"source,omitempty"` // builtin, marketplace, all
}
type castPluginListResult struct {
	Plugins []struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Version string `json:"version"`
		Status  string `json:"status"`
	} `json:"plugins"`
}

type castPluginInstallArgs struct {
	PluginID string `json:"pluginId"`
}
type castPluginInstallResult struct {
	Installed bool   `json:"installed"`
	Message   string `json:"message"`
}

type castPluginExecArgs struct {
	PluginID string                 `json:"pluginId"`
	Command  string                 `json:"command"`
	Args     map[string]interface{} `json:"args,omitempty"`
}
type castPluginExecResult struct {
	Output string `json:"output"`
}

// Sandbox
type castSandboxRunArgs struct {
	Lang  string `json:"lang"` // js, python, sql
	Code  string `json:"code"`
	Stdin string `json:"stdin,omitempty"`
}
type castSandboxRunResult struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
	Duration int64  `json:"durationMs"`
}

// Memory
type castMemorySearchArgs struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}
type castMemorySearchResult struct {
	Episodes []struct {
		ID        string `json:"id"`
		SessionID string `json:"sessionId"`
		Role      string `json:"role"`
		Content   string `json:"content"`
		Timestamp int64  `json:"timestamp"`
		Score     float64 `json:"score"`
	} `json:"episodes"`
}

type castMemoryStatsArgs struct{}
type castMemoryStatsResult struct {
	TotalEpisodes   int    `json:"totalEpisodes"`
	TotalSessions   int    `json:"totalSessions"`
	StorageBytes    int64  `json:"storageBytes"`
	OldestTimestamp  int64  `json:"oldestTimestamp"`
	NewestTimestamp  int64  `json:"newestTimestamp"`
}

// Performance
type castPerfGetMetricsArgs struct{}
type castPerfGetMetricsResult struct {
	FPS         float64 `json:"fps"`
	MemoryMB    float64 `json:"memoryMB"`
	RenderTimeMs float64 `json:"renderTimeMs"`
	CacheHitRate float64 `json:"cacheHitRate"`
}

type castPerfClearCacheArgs struct {
	Cache string `json:"cache,omitempty"` // completion, rag, all
}
type castPerfClearCacheResult struct {
	Cleared int `json:"cleared"`
}

// Learning
type castLearningGetPatternsArgs struct {
	Limit int `json:"limit,omitempty"`
}
type castLearningGetPatternsResult struct {
	Patterns []struct {
		Pattern   string `json:"pattern"`
		Count     int    `json:"count"`
		LastUsed  int64  `json:"lastUsed"`
	} `json:"patterns"`
}

type castLearningClearArgs struct{}

// Security
type castSecurityAuditArgs struct {
	Range string `json:"range,omitempty"` // 1h, 24h, 7d
}
type castSecurityAuditResult struct {
	ThreatsBlocked int `json:"threatsBlocked"`
	ThreatsAllowed int `json:"threatsAllowed"`
	TopPatterns    []struct {
		Pattern string `json:"pattern"`
		Count   int    `json:"count"`
	} `json:"topPatterns"`
}

type castSecurityBlockedHistoryArgs struct {
	Limit int `json:"limit,omitempty"`
}
type castSecurityBlockedHistoryResult struct {
	Events []struct {
		Timestamp int64  `json:"timestamp"`
		Command   string `json:"command"`
		Reason    string `json:"reason"`
	} `json:"events"`
}

// Channel
type castChannelSendArgs struct {
	Channel string                 `json:"channel"` // webhook, email, feishu, slack, dingtalk
	Target  string                 `json:"target"`
	Title   string                 `json:"title"`
	Content string                 `json:"content"`
	Extra   map[string]interface{} `json:"extra,omitempty"`
}
type castChannelSendResult struct {
	Sent    bool   `json:"sent"`
	Message string `json:"message"`
}

type castChannelTestArgs struct {
	Channel string `json:"channel"`
	Target  string `json:"target"`
}
type castChannelTestResult struct {
	OK bool `json:"ok"`
}

// Collab
type castCollabShareArgs struct {
	SessionID string `json:"sessionId"`
	Peer      string `json:"peer"` // email
	Mode      string `json:"mode,omitempty"` // read, write
}
type castCollabShareResult struct {
	Link string `json:"link"`
}

type castCollabInviteArgs struct {
	Email   string `json:"email"`
	Message string `json:"message,omitempty"`
}

// Soul
type castSoulSetArgs struct {
	Persona string `json:"persona"` // friendly, professional, concise, detailed
}
type castSoulSetResult struct {
	Active string `json:"active"`
}

type castSoulListArgs struct{}
type castSoulListResult struct {
	Personas []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		IsActive    bool   `json:"isActive"`
	} `json:"personas"`
}

// Marketplace
type castMarketplaceListArgs struct {
	Category string `json:"category,omitempty"`
	Query    string `json:"query,omitempty"`
}
type castMarketplaceListResult struct {
	Items []struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Author      string  `json:"author"`
		Stars       int     `json:"stars"`
		Rating      float64 `json:"rating"`
	} `json:"items"`
}

type castMarketplaceInstallArgs struct {
	ItemID string `json:"itemId"`
}
type castMarketplaceInstallResult struct {
	Installed bool   `json:"installed"`
	Message   string `json:"message"`
}
