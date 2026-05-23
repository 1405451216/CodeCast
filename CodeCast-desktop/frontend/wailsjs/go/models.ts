export namespace main {
	
	export class ToolResult {
	    tool_call_id: string;
	    content: string;
	    is_error: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ToolResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tool_call_id = source["tool_call_id"];
	        this.content = source["content"];
	        this.is_error = source["is_error"];
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
	export class AgentMessage {
	    role: string;
	    content: string;
	    tool_calls?: ToolCall[];
	    tool_result?: ToolResult;
	
	    static createFrom(source: any = {}) {
	        return new AgentMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	        this.tool_calls = this.convertValues(source["tool_calls"], ToolCall);
	        this.tool_result = this.convertValues(source["tool_result"], ToolResult);
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
	export class Message {
	    role: string;
	    content: string;
	    reasoning?: string;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	        this.reasoning = source["reasoning"];
	    }
	}
	export class Project {
	    id: string;
	    path: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.name = source["name"];
	    }
	}
	export class Session {
	    ID: string;
	    Name: string;
	    // Go type: time
	    CreatedAt: any;
	    SkillID: string;
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
	    api_key: string;
	    long_context: boolean;
	    llm_provider: string;
	    llm_api_url: string;
	    llm_model: string;
	    personality: string;
	    custom_instructions: string;
	    auto_memory: boolean;
	    tool_memory: boolean;
	    message_history_limit: number;
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
	        this.api_key = source["api_key"];
	        this.long_context = source["long_context"];
	        this.llm_provider = source["llm_provider"];
	        this.llm_api_url = source["llm_api_url"];
	        this.llm_model = source["llm_model"];
	        this.personality = source["personality"];
	        this.custom_instructions = source["custom_instructions"];
	        this.auto_memory = source["auto_memory"];
	        this.tool_memory = source["tool_memory"];
	        this.message_history_limit = source["message_history_limit"];
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
	
	export class SubAgent {
	    id: string;
	    session_id: string;
	    parent_msg_id: string;
	    title: string;
	    prompt: string;
	    files_scope: string[];
	    status: string;
	    messages: AgentMessage[];
	    result: string;
	    error?: string;
	    turn_count: number;
	    max_turns: number;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new SubAgent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.session_id = source["session_id"];
	        this.parent_msg_id = source["parent_msg_id"];
	        this.title = source["title"];
	        this.prompt = source["prompt"];
	        this.files_scope = source["files_scope"];
	        this.status = source["status"];
	        this.messages = this.convertValues(source["messages"], AgentMessage);
	        this.result = source["result"];
	        this.error = source["error"];
	        this.turn_count = source["turn_count"];
	        this.max_turns = source["max_turns"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.mode = source["mode"];
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
	export class Task {
	    id: string;
	    name: string;
	    description: string;
	    command: string;
	    schedule: string;
	    enabled: boolean;
	    last_run: number;
	    next_run: number;
	    status: string;
	    last_error: string;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.command = source["command"];
	        this.schedule = source["schedule"];
	        this.enabled = source["enabled"];
	        this.last_run = source["last_run"];
	        this.next_run = source["next_run"];
	        this.status = source["status"];
	        this.last_error = source["last_error"];
	    }
	}
	

}

