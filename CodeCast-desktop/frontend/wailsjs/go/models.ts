export namespace main {
	
	export class AgentInfo {
	    id: string;
	    sessionId: string;
	    title: string;
	    status: string;
	    turn: number;
	    maxTurns: number;
	    result?: string;
	    error?: string;
	    lastToolName?: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.turn = source["turn"];
	        this.maxTurns = source["maxTurns"];
	        this.result = source["result"];
	        this.error = source["error"];
	        this.lastToolName = source["lastToolName"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class CastToolInvocation {
	    id: string;
	    toolName: string;
	    category: string;
	    args: string;
	    result: string;
	    isError: boolean;
	    sessionId: string;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new CastToolInvocation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.toolName = source["toolName"];
	        this.category = source["category"];
	        this.args = source["args"];
	        this.result = source["result"];
	        this.isError = source["isError"];
	        this.sessionId = source["sessionId"];
	        this.durationMs = source["durationMs"];
	    }
	}
	export class ChangelogSection {
	    title: string;
	    items: string[];
	
	    static createFrom(source: any = {}) {
	        return new ChangelogSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.items = source["items"];
	    }
	}
	export class Changelog {
	    version: string;
	    published_at: string;
	    sections: ChangelogSection[];
	    raw_body: string;
	
	    static createFrom(source: any = {}) {
	        return new Changelog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.published_at = source["published_at"];
	        this.sections = this.convertValues(source["sections"], ChangelogSection);
	        this.raw_body = source["raw_body"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class EditorInfo {
	    id: string;
	    name: string;
	    command: string;
	
	    static createFrom(source: any = {}) {
	        return new EditorInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.command = source["command"];
	    }
	}
	export class EnvCheckResult {
	    name: string;
	    status: string;
	    version?: string;
	    message: string;
	    fix_command?: string;
	    fix_url?: string;
	    required: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EnvCheckResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.status = source["status"];
	        this.version = source["version"];
	        this.message = source["message"];
	        this.fix_command = source["fix_command"];
	        this.fix_url = source["fix_url"];
	        this.required = source["required"];
	    }
	}
	export class EnvCheckReport {
	    timestamp: number;
	    os: string;
	    arch: string;
	    checks: EnvCheckResult[];
	    overall_ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EnvCheckReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = source["timestamp"];
	        this.os = source["os"];
	        this.arch = source["arch"];
	        this.checks = this.convertValues(source["checks"], EnvCheckResult);
	        this.overall_ok = source["overall_ok"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class EnvVar {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new EnvVar(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class FileEntry {
	    name: string;
	    path: string;
	    is_dir: boolean;
	    size: number;
	    mod_time: string;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.is_dir = source["is_dir"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	    }
	}
	export class MCPServer {
	    id: string;
	    name: string;
	    url: string;
	    command?: string;
	    args?: string[];
	    type: string;
	    enabled: boolean;
	    builtin?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MCPServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.type = source["type"];
	        this.enabled = source["enabled"];
	        this.builtin = source["builtin"];
	    }
	}
	export class ToolCall {
	    id: string;
	    name: string;
	    args: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolCall(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.args = source["args"];
	    }
	}
	export class Message {
	    role: string;
	    content: string;
	    reasoning?: string;
	    tool_calls?: ToolCall[];
	    tool_call_id?: string;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	        this.reasoning = source["reasoning"];
	        this.tool_calls = this.convertValues(source["tool_calls"], ToolCall);
	        this.tool_call_id = source["tool_call_id"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ModelConfigItem {
	    id: string;
	    name: string;
	    provider: string;
	    model: string;
	    api_key: string;
	    api_url: string;
	    enabled: boolean;
	    max_context: number;
	    tool_rounds: number;
	    multimodal: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ModelConfigItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.provider = source["provider"];
	        this.model = source["model"];
	        this.api_key = source["api_key"];
	        this.api_url = source["api_url"];
	        this.enabled = source["enabled"];
	        this.max_context = source["max_context"];
	        this.tool_rounds = source["tool_rounds"];
	        this.multimodal = source["multimodal"];
	    }
	}
	export class Project {
	    id: string;
	    path: string;
	    name: string;
	    created_at: number;
	    last_accessed_at: number;
	    custom_instructions?: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.created_at = source["created_at"];
	        this.last_accessed_at = source["last_accessed_at"];
	        this.custom_instructions = source["custom_instructions"];
	    }
	}
	export class ProviderPreset {
	    id: string;
	    name: string;
	    api_url: string;
	    default_model: string;
	    models: string[];
	
	    static createFrom(source: any = {}) {
	        return new ProviderPreset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.api_url = source["api_url"];
	        this.default_model = source["default_model"];
	        this.models = source["models"];
	    }
	}
	export class SecurityIssue {
	    level: string;
	    category: string;
	    description: string;
	    suggestion: string;
	
	    static createFrom(source: any = {}) {
	        return new SecurityIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.suggestion = source["suggestion"];
	    }
	}
	export class SecurityStatus {
	    encryption_enabled: boolean;
	    key_age_days: number;
	    api_keys_configured: number;
	    api_keys_encrypted: number;
	    sandbox_enabled: boolean;
	    antivirus_detected?: string;
	    last_audit: number;
	    issues: SecurityIssue[];
	
	    static createFrom(source: any = {}) {
	        return new SecurityStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.encryption_enabled = source["encryption_enabled"];
	        this.key_age_days = source["key_age_days"];
	        this.api_keys_configured = source["api_keys_configured"];
	        this.api_keys_encrypted = source["api_keys_encrypted"];
	        this.sandbox_enabled = source["sandbox_enabled"];
	        this.antivirus_detected = source["antivirus_detected"];
	        this.last_audit = source["last_audit"];
	        this.issues = this.convertValues(source["issues"], SecurityIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Session {
	    ID: string;
	    Name: string;
	    // Go type: time
	    CreatedAt: any;
	    SkillID: string;
	    Mode: string;
	    Messages: Message[];
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Name = source["Name"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], null);
	        this.SkillID = source["SkillID"];
	        this.Mode = source["Mode"];
	        this.Messages = this.convertValues(source["Messages"], Message);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SlashCommand {
	    id: string;
	    name: string;
	    description: string;
	    fill_text: string;
	
	    static createFrom(source: any = {}) {
	        return new SlashCommand(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.fill_text = source["fill_text"];
	    }
	}
	export class Settings {
	    work_mode: string;
	    default_perm: boolean;
	    auto_review: boolean;
	    full_access: boolean;
	    shell: string;
	    open_target: string;
	    language: string;
	    hotkey: string;
	    ctrl_enter_send: boolean;
	    followup_mode: string;
	    review_mode: string;
	    notify_complete: string;
	    notify_permission: boolean;
	    notify_issue: boolean;
	    notification_turn: string;
	    notification_permission: boolean;
	    notification_question: boolean;
	    theme: string;
	    font_size: string;
	    long_context: boolean;
	    llm_provider: string;
	    llm_api_url: string;
	    llm_model: string;
	    personality: string;
	    custom_instructions: string;
	    auto_memory: boolean;
	    tool_memory: boolean;
	    message_history_limit: number;
	    smtp_host: string;
	    smtp_port: number;
	    smtp_user: string;
	    smtp_pass: string;
	    auto_commit: boolean;
	    confirm_before_commit: boolean;
	    use_worktree: boolean;
	    allow_browser: boolean;
	    browser_approval: string;
	    browser_history: string;
	    browser_clear_data: string;
	    blocked_domains: string[];
	    allowed_domains: string[];
	    browser_plugin: string;
	    selenium_installed: boolean;
	    computer_control: boolean;
	    mcp_servers: MCPServer[];
	    model_configs: ModelConfigItem[];
	    env_vars: EnvVar[];
	    slash_commands: SlashCommand[];
	    archived_sessions: string[];
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.work_mode = source["work_mode"];
	        this.default_perm = source["default_perm"];
	        this.auto_review = source["auto_review"];
	        this.full_access = source["full_access"];
	        this.shell = source["shell"];
	        this.open_target = source["open_target"];
	        this.language = source["language"];
	        this.hotkey = source["hotkey"];
	        this.ctrl_enter_send = source["ctrl_enter_send"];
	        this.followup_mode = source["followup_mode"];
	        this.review_mode = source["review_mode"];
	        this.notify_complete = source["notify_complete"];
	        this.notify_permission = source["notify_permission"];
	        this.notify_issue = source["notify_issue"];
	        this.notification_turn = source["notification_turn"];
	        this.notification_permission = source["notification_permission"];
	        this.notification_question = source["notification_question"];
	        this.theme = source["theme"];
	        this.font_size = source["font_size"];
	        this.long_context = source["long_context"];
	        this.llm_provider = source["llm_provider"];
	        this.llm_api_url = source["llm_api_url"];
	        this.llm_model = source["llm_model"];
	        this.personality = source["personality"];
	        this.custom_instructions = source["custom_instructions"];
	        this.auto_memory = source["auto_memory"];
	        this.tool_memory = source["tool_memory"];
	        this.message_history_limit = source["message_history_limit"];
	        this.smtp_host = source["smtp_host"];
	        this.smtp_port = source["smtp_port"];
	        this.smtp_user = source["smtp_user"];
	        this.smtp_pass = source["smtp_pass"];
	        this.auto_commit = source["auto_commit"];
	        this.confirm_before_commit = source["confirm_before_commit"];
	        this.use_worktree = source["use_worktree"];
	        this.allow_browser = source["allow_browser"];
	        this.browser_approval = source["browser_approval"];
	        this.browser_history = source["browser_history"];
	        this.browser_clear_data = source["browser_clear_data"];
	        this.blocked_domains = source["blocked_domains"];
	        this.allowed_domains = source["allowed_domains"];
	        this.browser_plugin = source["browser_plugin"];
	        this.selenium_installed = source["selenium_installed"];
	        this.computer_control = source["computer_control"];
	        this.mcp_servers = this.convertValues(source["mcp_servers"], MCPServer);
	        this.model_configs = this.convertValues(source["model_configs"], ModelConfigItem);
	        this.env_vars = this.convertValues(source["env_vars"], EnvVar);
	        this.slash_commands = this.convertValues(source["slash_commands"], SlashCommand);
	        this.archived_sessions = source["archived_sessions"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Skill {
	    id: string;
	    name: string;
	    description: string;
	    prompt: string;
	    type: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Skill(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.prompt = source["prompt"];
	        this.type = source["type"];
	        this.created_at = source["created_at"];
	    }
	}
	
	
	export class ToolCatalogItem {
	    name: string;
	    category: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolCatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.category = source["category"];
	        this.description = source["description"];
	    }
	}
	export class UpdateInfo {
	    has_update: boolean;
	    current_version: string;
	    latest_version: string;
	    release_notes: string;
	    download_url: string;
	    published_at: string;
	    file_size: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.has_update = source["has_update"];
	        this.current_version = source["current_version"];
	        this.latest_version = source["latest_version"];
	        this.release_notes = source["release_notes"];
	        this.download_url = source["download_url"];
	        this.published_at = source["published_at"];
	        this.file_size = source["file_size"];
	    }
	}
	export class UpdateRecord {
	    from_version: string;
	    to_version: string;
	    updated_at: string;
	    success: boolean;
	    notes?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.from_version = source["from_version"];
	        this.to_version = source["to_version"];
	        this.updated_at = source["updated_at"];
	        this.success = source["success"];
	        this.notes = source["notes"];
	    }
	}

}

export namespace tools {
	
	export class Registry {
	
	
	    static createFrom(source: any = {}) {
	        return new Registry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

