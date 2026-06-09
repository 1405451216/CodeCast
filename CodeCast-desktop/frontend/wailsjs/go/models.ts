export namespace agent {
	
	export class ModelCost {
	    cost_usd: number;
	    calls: number;
	    tokens: number;
	
	    static createFrom(source: any = {}) {
	        return new ModelCost(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cost_usd = source["cost_usd"];
	        this.calls = source["calls"];
	        this.tokens = source["tokens"];
	    }
	}
	export class CostSummary {
	    total_cost_usd: number;
	    total_prompt_tokens: number;
	    total_completion_tokens: number;
	    total_tokens: number;
	    call_count: number;
	    by_model: Record<string, ModelCost>;
	
	    static createFrom(source: any = {}) {
	        return new CostSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_cost_usd = source["total_cost_usd"];
	        this.total_prompt_tokens = source["total_prompt_tokens"];
	        this.total_completion_tokens = source["total_completion_tokens"];
	        this.total_tokens = source["total_tokens"];
	        this.call_count = source["call_count"];
	        this.by_model = this.convertValues(source["by_model"], ModelCost, true);
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
	
	export class WorkflowMetrics {
	    total_nodes: number;
	    executed_nodes: number;
	    failed_nodes: number;
	    skipped_nodes: number;
	    total_duration: number;
	    avg_node_duration: number;
	    iterations: number;
	    branches_taken: number;
	    retries_attempted: number;
	
	    static createFrom(source: any = {}) {
	        return new WorkflowMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_nodes = source["total_nodes"];
	        this.executed_nodes = source["executed_nodes"];
	        this.failed_nodes = source["failed_nodes"];
	        this.skipped_nodes = source["skipped_nodes"];
	        this.total_duration = source["total_duration"];
	        this.avg_node_duration = source["avg_node_duration"];
	        this.iterations = source["iterations"];
	        this.branches_taken = source["branches_taken"];
	        this.retries_attempted = source["retries_attempted"];
	    }
	}

}

export namespace llm {
	
	export class CacheStats {
	    total_queries: number;
	    cache_hits: number;
	    cache_misses: number;
	    hit_rate: number;
	    entry_count: number;
	    tokens_saved: number;
	    cost_saved_usd: number;
	
	    static createFrom(source: any = {}) {
	        return new CacheStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_queries = source["total_queries"];
	        this.cache_hits = source["cache_hits"];
	        this.cache_misses = source["cache_misses"];
	        this.hit_rate = source["hit_rate"];
	        this.entry_count = source["entry_count"];
	        this.tokens_saved = source["tokens_saved"];
	        this.cost_saved_usd = source["cost_saved_usd"];
	    }
	}

}

export namespace main {
	
	export class TokenUsageData {
	    promptTokens: number;
	    completionTokens: number;
	    totalTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new TokenUsageData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.promptTokens = source["promptTokens"];
	        this.completionTokens = source["completionTokens"];
	        this.totalTokens = source["totalTokens"];
	    }
	}
	export class APMetricsSnapshotData {
	    llmTotalCalls: number;
	    llmTotalErrors: number;
	    toolTotalCalls: number;
	    toolTotalErrors: number;
	    totalTurns: number;
	    totalEpisodes: number;
	    activeAgents: number;
	    poolQueueLength: number;
	    memorySizeBytes: number;
	    llmLatencyP50: number;
	    llmLatencyP99: number;
	    toolLatencyP50: number;
	    toolLatencyP99: number;
	    tokenUsageByModel: Record<string, TokenUsageData>;
	
	    static createFrom(source: any = {}) {
	        return new APMetricsSnapshotData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.llmTotalCalls = source["llmTotalCalls"];
	        this.llmTotalErrors = source["llmTotalErrors"];
	        this.toolTotalCalls = source["toolTotalCalls"];
	        this.toolTotalErrors = source["toolTotalErrors"];
	        this.totalTurns = source["totalTurns"];
	        this.totalEpisodes = source["totalEpisodes"];
	        this.activeAgents = source["activeAgents"];
	        this.poolQueueLength = source["poolQueueLength"];
	        this.memorySizeBytes = source["memorySizeBytes"];
	        this.llmLatencyP50 = source["llmLatencyP50"];
	        this.llmLatencyP99 = source["llmLatencyP99"];
	        this.toolLatencyP50 = source["toolLatencyP50"];
	        this.toolLatencyP99 = source["toolLatencyP99"];
	        this.tokenUsageByModel = this.convertValues(source["tokenUsageByModel"], TokenUsageData, true);
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
	export class AppearanceConfig {
	    theme_mode: string;
	    accent_color: string;
	    ui_font_size: string;
	    code_font_family: string;
	    code_font_size: number;
	    message_spacing: string;
	    show_timestamps: boolean;
	    render_markdown: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppearanceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme_mode = source["theme_mode"];
	        this.accent_color = source["accent_color"];
	        this.ui_font_size = source["ui_font_size"];
	        this.code_font_family = source["code_font_family"];
	        this.code_font_size = source["code_font_size"];
	        this.message_spacing = source["message_spacing"];
	        this.show_timestamps = source["show_timestamps"];
	        this.render_markdown = source["render_markdown"];
	    }
	}
	export class BudgetConfigDTO {
	    maxCostUSD: number;
	    alertThreshold: number;
	    enforcementEnabled: boolean;
	    maxTokensPerCall: number;
	    maxTokensPerSession: number;
	
	    static createFrom(source: any = {}) {
	        return new BudgetConfigDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.maxCostUSD = source["maxCostUSD"];
	        this.alertThreshold = source["alertThreshold"];
	        this.enforcementEnabled = source["enforcementEnabled"];
	        this.maxTokensPerCall = source["maxTokensPerCall"];
	        this.maxTokensPerSession = source["maxTokensPerSession"];
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
	
	export class CheckpointInfo {
	    ID: string;
	    SessionID: string;
	    Turn: number;
	    Status: string;
	    ToolName: string;
	    CreatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CheckpointInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.SessionID = source["SessionID"];
	        this.Turn = source["Turn"];
	        this.Status = source["Status"];
	        this.ToolName = source["ToolName"];
	        this.CreatedAt = source["CreatedAt"];
	    }
	}
	export class CodeReviewResult {
	    summary: string;
	    issues: string[];
	    suggestions: string[];
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new CodeReviewResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summary = source["summary"];
	        this.issues = source["issues"];
	        this.suggestions = source["suggestions"];
	        this.score = source["score"];
	    }
	}
	export class CompletionRequest {
	    language: string;
	    code: string;
	    position: number;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new CompletionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	        this.code = source["code"];
	        this.position = source["position"];
	        this.filePath = source["filePath"];
	    }
	}
	export class CompletionResult {
	    suggestions: string[];
	    confidence: number;
	
	    static createFrom(source: any = {}) {
	        return new CompletionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.suggestions = source["suggestions"];
	        this.confidence = source["confidence"];
	    }
	}
	export class ModelConfigSection {
	    discover_enabled: boolean;
	    models: string[];
	
	    static createFrom(source: any = {}) {
	        return new ModelConfigSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.discover_enabled = source["discover_enabled"];
	        this.models = source["models"];
	    }
	}
	export class ConnectionConfig {
	    gateway_type: string;
	    cred_type: string;
	    base_url: string;
	    api_key_enc: string;
	    auth_scheme: string;
	    custom_headers: Record<string, string>;
	    model: ModelConfigSection;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gateway_type = source["gateway_type"];
	        this.cred_type = source["cred_type"];
	        this.base_url = source["base_url"];
	        this.api_key_enc = source["api_key_enc"];
	        this.auth_scheme = source["auth_scheme"];
	        this.custom_headers = source["custom_headers"];
	        this.model = this.convertValues(source["model"], ModelConfigSection);
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
	export class MCPServerItem {
	    id: string;
	    name: string;
	    url: string;
	    command?: string;
	    args?: string[];
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new MCPServerItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.type = source["type"];
	    }
	}
	export class ConnectorsConfig {
	    mcp_managed_servers: MCPServerItem[];
	    allow_user_mcp: boolean;
	    allow_desktop_ext: boolean;
	    require_signed_ext: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConnectorsConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mcp_managed_servers = this.convertValues(source["mcp_managed_servers"], MCPServerItem);
	        this.allow_user_mcp = source["allow_user_mcp"];
	        this.allow_desktop_ext = source["allow_desktop_ext"];
	        this.require_signed_ext = source["require_signed_ext"];
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
	export class DiagnosticsConfig {
	    log_level: string;
	    log_dir: string;
	    telemetry_enabled: boolean;
	    telemetry_endpoint: string;
	    auto_update_enabled: boolean;
	    update_channel: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticsConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.log_level = source["log_level"];
	        this.log_dir = source["log_dir"];
	        this.telemetry_enabled = source["telemetry_enabled"];
	        this.telemetry_endpoint = source["telemetry_endpoint"];
	        this.auto_update_enabled = source["auto_update_enabled"];
	        this.update_channel = source["update_channel"];
	    }
	}
	export class DocumentPipelineConfig {
	    chunkSize: number;
	    chunkOverlap: number;
	    maxFileSize: number;
	    extensions: string[];
	
	    static createFrom(source: any = {}) {
	        return new DocumentPipelineConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.chunkSize = source["chunkSize"];
	        this.chunkOverlap = source["chunkOverlap"];
	        this.maxFileSize = source["maxFileSize"];
	        this.extensions = source["extensions"];
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
	export class GitHubUser {
	    login: string;
	    name: string;
	    avatar_url: string;
	    id: number;
	
	    static createFrom(source: any = {}) {
	        return new GitHubUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.login = source["login"];
	        this.name = source["name"];
	        this.avatar_url = source["avatar_url"];
	        this.id = source["id"];
	    }
	}
	export class GuardrailStatusData {
	    sanitizerEnabled: boolean;
	    sanitizerStrategy: string;
	    topicConstraints: string[];
	    ruleCount: number;
	
	    static createFrom(source: any = {}) {
	        return new GuardrailStatusData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sanitizerEnabled = source["sanitizerEnabled"];
	        this.sanitizerStrategy = source["sanitizerStrategy"];
	        this.topicConstraints = source["topicConstraints"];
	        this.ruleCount = source["ruleCount"];
	    }
	}
	export class ImageAnalysisResult {
	    content: string;
	    model: string;
	    inputTokens: number;
	
	    static createFrom(source: any = {}) {
	        return new ImageAnalysisResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.model = source["model"];
	        this.inputTokens = source["inputTokens"];
	    }
	}
	export class OutboundConfig {
	    http_proxy: string;
	    socks5_proxy: string;
	    no_proxy_hosts: string[];
	    tls_ca_cert_path: string;
	    tls_min_version: string;
	    custom_dns: string;
	    connect_timeout: number;
	    read_timeout: number;
	    allowed_ports: number[];
	
	    static createFrom(source: any = {}) {
	        return new OutboundConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.http_proxy = source["http_proxy"];
	        this.socks5_proxy = source["socks5_proxy"];
	        this.no_proxy_hosts = source["no_proxy_hosts"];
	        this.tls_ca_cert_path = source["tls_ca_cert_path"];
	        this.tls_min_version = source["tls_min_version"];
	        this.custom_dns = source["custom_dns"];
	        this.connect_timeout = source["connect_timeout"];
	        this.read_timeout = source["read_timeout"];
	        this.allowed_ports = source["allowed_ports"];
	    }
	}
	export class UsageConfig {
	    daily_token_limit: number;
	    daily_token_unit: string;
	    max_tokens_per_request: number;
	    over_limit_action: string;
	    daily_cost_cap_usd: number;
	    cost_alert_threshold: number;
	    rpm_limit: number;
	    concurrent_session_limit: number;
	
	    static createFrom(source: any = {}) {
	        return new UsageConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.daily_token_limit = source["daily_token_limit"];
	        this.daily_token_unit = source["daily_token_unit"];
	        this.max_tokens_per_request = source["max_tokens_per_request"];
	        this.over_limit_action = source["over_limit_action"];
	        this.daily_cost_cap_usd = source["daily_cost_cap_usd"];
	        this.cost_alert_threshold = source["cost_alert_threshold"];
	        this.rpm_limit = source["rpm_limit"];
	        this.concurrent_session_limit = source["concurrent_session_limit"];
	    }
	}
	export class ServerPolicy {
	    id: string;
	    name: string;
	    description: string;
	    config: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.config = source["config"];
	    }
	}
	export class PluginsConfig {
	    org_plugin_path: string;
	    server_policies: ServerPolicy[];
	
	    static createFrom(source: any = {}) {
	        return new PluginsConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.org_plugin_path = source["org_plugin_path"];
	        this.server_policies = this.convertValues(source["server_policies"], ServerPolicy);
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
	export class WorkspaceConfig {
	    cowork_enabled: boolean;
	    code_enabled: boolean;
	    allowed_hosts: string;
	    workspace_folder: string;
	    disabled_tools: string[];
	    tool_policy_mode: string;
	    disable_login: boolean;
	    disable_deep_link: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cowork_enabled = source["cowork_enabled"];
	        this.code_enabled = source["code_enabled"];
	        this.allowed_hosts = source["allowed_hosts"];
	        this.workspace_folder = source["workspace_folder"];
	        this.disabled_tools = source["disabled_tools"];
	        this.tool_policy_mode = source["tool_policy_mode"];
	        this.disable_login = source["disable_login"];
	        this.disable_deep_link = source["disable_deep_link"];
	    }
	}
	export class InferenceConfig {
	    connection: ConnectionConfig;
	    workspace: WorkspaceConfig;
	    connectors: ConnectorsConfig;
	    plugins: PluginsConfig;
	    diagnostics: DiagnosticsConfig;
	    usage: UsageConfig;
	    appearance: AppearanceConfig;
	    outbound: OutboundConfig;
	
	    static createFrom(source: any = {}) {
	        return new InferenceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connection = this.convertValues(source["connection"], ConnectionConfig);
	        this.workspace = this.convertValues(source["workspace"], WorkspaceConfig);
	        this.connectors = this.convertValues(source["connectors"], ConnectorsConfig);
	        this.plugins = this.convertValues(source["plugins"], PluginsConfig);
	        this.diagnostics = this.convertValues(source["diagnostics"], DiagnosticsConfig);
	        this.usage = this.convertValues(source["usage"], UsageConfig);
	        this.appearance = this.convertValues(source["appearance"], AppearanceConfig);
	        this.outbound = this.convertValues(source["outbound"], OutboundConfig);
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
	export class IngestionResult {
	    filesProcessed: number;
	    chunksCreated: number;
	    filesSkipped: number;
	    skippedReasons?: string[];
	    totalBytes: number;
	    durationMs: number;
	    directory: string;
	
	    static createFrom(source: any = {}) {
	        return new IngestionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filesProcessed = source["filesProcessed"];
	        this.chunksCreated = source["chunksCreated"];
	        this.filesSkipped = source["filesSkipped"];
	        this.skippedReasons = source["skippedReasons"];
	        this.totalBytes = source["totalBytes"];
	        this.durationMs = source["durationMs"];
	        this.directory = source["directory"];
	    }
	}
	export class IngestionStatus {
	    lastIngestionDir?: string;
	    lastIngestionAt?: string;
	    totalDocuments: number;
	    totalChunks: number;
	    isRunning: boolean;
	
	    static createFrom(source: any = {}) {
	        return new IngestionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lastIngestionDir = source["lastIngestionDir"];
	        this.lastIngestionAt = source["lastIngestionAt"];
	        this.totalDocuments = source["totalDocuments"];
	        this.totalChunks = source["totalChunks"];
	        this.isRunning = source["isRunning"];
	    }
	}
	export class MCPConnectionResult {
	    success: boolean;
	    message?: string;
	    tools?: string[];
	
	    static createFrom(source: any = {}) {
	        return new MCPConnectionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.tools = source["tools"];
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
	
	export class MCPStatusEntry {
	    id: string;
	    name: string;
	    connected: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new MCPStatusEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.connected = source["connected"];
	        this.error = source["error"];
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
	
	export class MultimodalCapabilities {
	    image: boolean;
	    audio: boolean;
	    video: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MultimodalCapabilities(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.image = source["image"];
	        this.audio = source["audio"];
	        this.video = source["video"];
	    }
	}
	export class Note {
	    id: string;
	    title: string;
	    content: string;
	    tags: string[];
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.tags = source["tags"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class OrchestrationRun {
	    id: string;
	    type: string;
	    status: string;
	    sessionId: string;
	    input: string;
	    output?: string;
	    error?: string;
	    startedAt: string;
	    endedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationRun(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.sessionId = source["sessionId"];
	        this.input = source["input"];
	        this.output = source["output"];
	        this.error = source["error"];
	        this.startedAt = source["startedAt"];
	        this.endedAt = source["endedAt"];
	    }
	}
	
	export class ParallelAnalysisResult {
	    results: string[];
	    errors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ParallelAnalysisResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = source["results"];
	        this.errors = source["errors"];
	    }
	}
	export class PluginInfoData {
	    id: string;
	    name: string;
	    version: string;
	    description?: string;
	    path?: string;
	    status: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PluginInfoData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.path = source["path"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}
	export class PluginStatusData {
	    loadedCount: number;
	    plugins: PluginInfoData[];
	
	    static createFrom(source: any = {}) {
	        return new PluginStatusData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.loadedCount = source["loadedCount"];
	        this.plugins = this.convertValues(source["plugins"], PluginInfoData);
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
	export class RefactoringResult {
	    originalCode: string;
	    refactoredCode: string;
	    changes: string[];
	    explanation: string;
	
	    static createFrom(source: any = {}) {
	        return new RefactoringResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.originalCode = source["originalCode"];
	        this.refactoredCode = source["refactoredCode"];
	        this.changes = source["changes"];
	        this.explanation = source["explanation"];
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
	    id: string;
	    name: string;
	    // Go type: time
	    created_at: any;
	    skill_id: string;
	    mode: string;
	    messages: Message[];
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.skill_id = source["skill_id"];
	        this.mode = source["mode"];
	        this.messages = this.convertValues(source["messages"], Message);
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
	    telemetry_enabled: boolean;
	    telemetry_endpoint: string;
	    sanitizer_enabled: boolean;
	    sanitizer_strategy: string;
	    topic_constraints: string[];
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
	        this.telemetry_enabled = source["telemetry_enabled"];
	        this.telemetry_endpoint = source["telemetry_endpoint"];
	        this.sanitizer_enabled = source["sanitizer_enabled"];
	        this.sanitizer_strategy = source["sanitizer_strategy"];
	        this.topic_constraints = source["topic_constraints"];
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
	
	export class TelemetryStatus {
	    enabled: boolean;
	    endpoint: string;
	    active: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new TelemetryStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.endpoint = source["endpoint"];
	        this.active = source["active"];
	        this.error = source["error"];
	    }
	}
	export class TestPipelineResult {
	    testCode: string;
	    coverage: number;
	    skipped?: string[];
	    framework: string;
	
	    static createFrom(source: any = {}) {
	        return new TestPipelineResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.testCode = source["testCode"];
	        this.coverage = source["coverage"];
	        this.skipped = source["skipped"];
	        this.framework = source["framework"];
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
	
	export class WorkflowRunData {
	    id: string;
	    name: string;
	    type: string;
	    status: string;
	    startedAt: string;
	    endedAt?: string;
	    output?: Record<string, any>;
	    metrics?: agent.WorkflowMetrics;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkflowRunData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.startedAt = source["startedAt"];
	        this.endedAt = source["endedAt"];
	        this.output = source["output"];
	        this.metrics = this.convertValues(source["metrics"], agent.WorkflowMetrics);
	        this.error = source["error"];
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

}

export namespace memory {
	
	export class SummaryResult {
	    Summary: string;
	    Topics: string;
	
	    static createFrom(source: any = {}) {
	        return new SummaryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Summary = source["Summary"];
	        this.Topics = source["Topics"];
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

