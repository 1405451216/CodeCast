import type { AgentInfo } from '../store/types';

export interface GoProject {
  id: string;
  path: string;
  name: string;
  created_at?: number;
  last_accessed_at?: number;
  custom_instructions?: string;
}

export interface GoSession {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Mode: string;
  Messages: GoMessage[];
}

export interface GoMessage {
  role: string;
  content: string;
  reasoning?: string;
}

/** Convert GoMessage from backend to frontend Message with stable ID */
export function toMessage(gm: GoMessage): import('../store/types').Message {
  return {
    id: crypto.randomUUID(),
    role: gm.role as 'user' | 'assistant',
    content: gm.content,
    reasoning: gm.reasoning,
    timestamp: Date.now(),
  };
}

/** Convert GoSession to frontend Session (adds IDs to messages) */
export function toSession(gs: GoSession): import('../store/types').Session {
  return {
    ID: gs.ID,
    Name: gs.Name,
    CreatedAt: gs.CreatedAt,
    SkillID: gs.SkillID,
    Mode: (gs.Mode as 'coding' | 'daily' | '') || '',
    Messages: (gs.Messages || []).map(toMessage),
  };
}

// AP AgentInfo — maps directly from Go AgentInfo struct (agent_bridge.go)
export interface GoAgentInfo {
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
}

/** Convert GoAgentInfo from backend to frontend AgentInfo */
export function toAgentInfo(ga: GoAgentInfo): AgentInfo {
  return {
    id: ga.id,
    sessionId: ga.sessionId,
    title: ga.title,
    status: ga.status as AgentInfo['status'],
    turn: ga.turn,
    maxTurns: ga.maxTurns,
    result: ga.result,
    error: ga.error,
    lastToolName: ga.lastToolName,
    createdAt: ga.createdAt,
    updatedAt: ga.updatedAt,
  };
}

export interface GoSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  type: string;
  createdAt: number;
}

export interface GoTask {
  id: string;
  name: string;
  description: string;
  command: string;
  schedule: string;
  enabled: boolean;
  lastRun: number;
  nextRun: number;
  status: string;
  lastError: string;
}

export interface GoMCPServer {
  id: string;
  name: string;
  url: string;
  command: string;
  args: string[];
  type: string;
  enabled: boolean;
  builtin: boolean;
}

export interface GoEnvVar {
  key: string;
  value: string;
}

export interface GoSlashCommand {
  id: string;
  name: string;
  description: string;
  fill_text: string;
}

export interface GoEditorInfo {
  ID: string;
  Name: string;
  Command: string;
}

export interface GoFileEntry {
  Name: string;
  Path: string;
  IsDir: boolean;
  Size: number;
  ModTime: string;
}

export interface GoSettings {
  theme?: string;
  font_size?: 'small' | 'medium' | 'large';
  api_key?: string;
  preferred_editor?: string;
  blocked_domains?: string[];
  allowed_domains?: string[];
  always_on_top?: boolean;
  [key: string]: string | string[] | boolean | undefined;
}

// AP Checkpoint info — mirrors Go CheckpointInfo struct
export interface CheckpointInfo {
  ID:        string;
  SessionID: string;
  Turn:      number;
  Status:    string;
  ToolName:  string;
  CreatedAt: string;
}

// AP Lifecycle states (mirrors agentprimordia/internal/agent.AgentStatus)
export type LifecycleState =
  | 'idle' | 'running' | 'paused' | 'waiting_for_input'
  | 'completed' | 'failed' | 'cancelled' | 'unknown';

export interface LifecycleStatesEvent {
  [sessionId: string]: LifecycleState;
}

// AP Metrics snapshot (mirrors Go APMetricsSnapshotData)
export interface APMetricsSnapshot {
  llmTotalCalls:     number;
  llmTotalErrors:    number;
  toolTotalCalls:    number;
  toolTotalErrors:   number;
  totalTurns:        number;
  totalEpisodes:     number;
  activeAgents:      number;
  poolQueueLength:   number;
  memorySizeBytes:   number;
  llmLatencyP50:     number;
  llmLatencyP99:     number;
  toolLatencyP50:    number;
  toolLatencyP99:    number;
  tokenUsageByModel: Record<string, TokenUsageStats>;
}

export interface TokenUsageStats {
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
}

// Orchestration types — maps from Go OrchestrationRun struct (orchestration_bridge.go)
export interface OrchestrationRun {
  id: string;
  type: 'code_review' | 'refactoring' | 'test_pipeline' | 'handoff' | 'parallel';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  sessionId: string;
  input: string;
  output?: string;
  error?: string;
  startedAt: string;
  endedAt?: string;
}

export interface CodeReviewResult {
  summary: string;
  issues: string[];
  suggestions: string[];
  score: number;
}

export interface RefactoringResult {
  originalCode: string;
  refactoredCode: string;
  changes: string[];
  explanation: string;
}

export interface TestPipelineResult {
  testCode: string;
  coverage: number;
  skipped?: string[];
  framework: string;
}

export interface ParallelResult {
  results: string[];
  errors?: string[];
}

export interface IngestionResult {
  filesProcessed: number;
  chunksCreated: number;
  filesSkipped: number;
  skippedReasons?: string[];
  totalBytes: number;
  durationMs: number;
  directory: string;
}

export interface IngestionStatus {
  lastIngestionDir?: string;
  lastIngestionAt?: string;
  totalDocuments: number;
  totalChunks: number;
  isRunning: boolean;
}

// Cost tracking types
export interface CostSummary {
  total_cost_usd: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  call_count: number;
  by_model: Record<string, ModelCost>;
}

export interface ModelCost {
  cost_usd: number;
  calls: number;
  tokens: number;
}

export interface BudgetConfig {
  max_total_cost_usd: number;
  max_tokens_per_call: number;
  max_tokens_per_session: number;
}

// Cache stats types
export interface CacheStats {
  total_queries: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  entry_count: number;
  tokens_saved: number;
  cost_saved_usd: number;
}

// Summarizer types
export interface SummaryResult {
  Summary: string;
  Topics: string;
}

// Structured extraction schema names
export type PredefinedSchemaName =
  | 'sentiment'
  | 'sentiment_detail'
  | 'ner'
  | 'classification'
  | 'multi_label_classification'
  | 'summary'
  | 'extractive_summary';

// Multimodal types
export interface MultimodalCapabilities {
  image: boolean;
  audio: boolean;
  video: boolean;
}

export interface ImageAnalysisResult {
  content: string;
  model: string;
  inputTokens: number;
}

// M14 fix: renamed from ImageAttachment to APIImageAttachment to avoid collision
// with the richer store/types.ts ImageAttachment. Use toAPIImageAttachment() to convert.
export interface APIImageAttachment {
  type: 'image';
  data: string; // file path, URL, or data:image/...;base64,...
}

/** Convert a store ImageAttachment to the API wire format. */
export function toAPIImageAttachment(att: { dataUrl: string; type?: string }): APIImageAttachment {
  return { type: 'image', data: att.dataUrl };
}

// Telemetry types
export interface TelemetryStatus {
  enabled: boolean;
  endpoint: string;
  active: boolean;
  error?: string;
}

// AP Plugin types
export interface PluginInfoData {
  id: string;
  name: string;
  version: string;
  description?: string;
  path?: string;
  status: string;
  error?: string;
}

export interface PluginStatusData {
  loadedCount: number;
  plugins: PluginInfoData[];
}

// Guardrail types
export interface GuardrailStatusData {
  sanitizerEnabled: boolean;
  sanitizerStrategy: string;
  topicConstraints: string[];
  ruleCount: number;
}

// Workflow execution types (AP WorkflowExecution Phase 6)
export type WorkflowType = 'linear' | 'conditional' | 'loop' | 'parallel_fork_join' | 'state_machine';
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type NodeType = 'task' | 'condition' | 'parallel' | 'loop_start' | 'loop_end' | 'fallback' | 'sub_workflow';

export interface WorkflowConditionDef {
  field: string;
  operator: string;
  value: unknown;
}

export interface WorkflowNodeDef {
  id: string;
  name: string;
  type: NodeType;
  systemPrompt?: string;
  promptTemplate?: string;
  condition?: WorkflowConditionDef;
}

export interface WorkflowTransitionDef {
  from: string;
  to: string;
  condition?: WorkflowConditionDef;
  weight?: number;
  type?: string;
  probability?: number;
}

export interface WorkflowErrorHandlingDef {
  onError?: string;
  maxRetries?: number;
  fallbackStep?: string;
  continueOnError?: boolean;
}

export interface WorkflowDefinition {
  type: WorkflowType;
  name: string;
  description?: string;
  startNodeId: string;
  errorHandling: WorkflowErrorHandlingDef;
  maxIterations: number;
  timeoutSec: number;
  nodes: WorkflowNodeDef[];
  transitions: WorkflowTransitionDef[];
}

export interface WorkflowMetrics {
  total_nodes: number;
  executed_nodes: number;
  failed_nodes: number;
  skipped_nodes: number;
  total_duration: number;
  avg_node_duration: number;
  iterations: number;
  branches_taken: number;
  retries_attempted: number;
}

export interface WorkflowRunData {
  id: string;
  name: string;
  type: string;
  status: WorkflowStatus;
  startedAt: string;
  endedAt?: string;
  output?: Record<string, unknown>;
  metrics?: WorkflowMetrics;
  error?: string;
}

export interface WorkflowEvent {
  runId: string;
  type: string;
  nodeId?: string;
  data?: unknown;
  timestamp: string;
}
