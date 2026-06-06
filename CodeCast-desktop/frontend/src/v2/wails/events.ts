// wails/events.ts — Wails event bridge
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import type {
  NotificationPayload, UpdateProgress, APMetricsSnapshot,
  AgentEventPayload, LLMEventPayload, PoolEventPayload,
  CacheStatsPayload, CostSummaryPayload, EnvCheckReport,
  OrchestrationPayload, WorkflowEventPayload, WorkflowNodeEventPayload,
  PopoutPayload, DownloadProgressPayload, DownloadCompletePayload,
} from './types';

// ---- Stream events (chat) ----

export type StreamEvent = {
  type: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  args?: string;
  result?: string;
  error?: string;
  done?: boolean;
};

export function onStreamChunk(sessionId: string, cb: (e: StreamEvent) => void): () => void {
  const topic = `stream:${sessionId}`;
  EventsOn(topic, cb);
  return () => EventsOff(topic);
}

// ---- AP framework events ----

export function onAPEvent(eventType: string, cb: (e: unknown) => void): () => void {
  const topic = `ap:${eventType}`;
  EventsOn(topic, cb);
  return () => EventsOff(topic);
}

// ---- Notification ----

export function onNotification(cb: (n: NotificationPayload) => void): () => void {
  EventsOn('notification', cb);
  return () => EventsOff('notification');
}

// ---- Git commit confirmation ----

export interface GitCommitConfirmPayload {
  file: string;
  directory: string;
}

export function onGitCommitConfirm(cb: (p: GitCommitConfirmPayload) => void): () => void {
  EventsOn('git-commit-confirm', cb);
  return () => EventsOff('git-commit-confirm');
}

// ---- Session summary ----

export interface SummaryReadyPayload {
  sessionID: string;
  summary: string;
  topics: string;
}

export function onSummaryReady(cb: (p: SummaryReadyPayload) => void): () => void {
  EventsOn('summary:ready', cb);
  return () => EventsOff('summary:ready');
}

// ---- Agent lifecycle (generic) ----

export function onAgentEvent(type: string, cb: (payload: unknown) => void): () => void {
  EventsOn(type, cb);
  return () => EventsOff(type);
}

// ---- Metrics snapshot (periodic broadcast) ----

export function onMetricsSnapshot(cb: (snap: APMetricsSnapshot) => void): () => void {
  EventsOn('metrics:snapshot', cb);
  return () => EventsOff('metrics:snapshot');
}

// ---- Cost summary ----

export function onCostSummary(cb: (cost: CostSummaryPayload) => void): () => void {
  EventsOn('cost:summary', cb);
  return () => EventsOff('cost:summary');
}

// ---- Cache stats ----

export function onCacheStats(cb: (stats: CacheStatsPayload) => void): () => void {
  EventsOn('cache:stats', cb);
  return () => EventsOff('cache:stats');
}

// ---- Lifecycle states ----

export function onLifecycleStates(cb: (states: Record<string, string>) => void): () => void {
  EventsOn('lifecycle:states', cb);
  return () => EventsOff('lifecycle:states');
}

// ---- Update progress ----

export function onUpdateProgress(cb: (p: UpdateProgress) => void): () => void {
  EventsOn('update-progress', cb);
  return () => EventsOff('update-progress');
}

// ---- Orchestration events ----

export function onOrchestrationEvent(
  type: 'start' | 'complete' | 'error',
  cb: (p: OrchestrationPayload) => void,
): () => void {
  const topic = `orchestration:${type}`;
  EventsOn(topic, cb);
  return () => EventsOff(topic);
}

// ---- Agent lifecycle events ----

export function onAgentStart(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:start', cb);
  return () => EventsOff('agent:start');
}

export function onAgentStop(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:stop', cb);
  return () => EventsOff('agent:stop');
}

export function onAgentError(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:error', cb);
  return () => EventsOff('agent:error');
}

export function onAgentTurn(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:turn', cb);
  return () => EventsOff('agent:turn');
}

export function onAgentTurnEnd(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:turn_end', cb);
  return () => EventsOff('agent:turn_end');
}

export function onAgentTool(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:tool', cb);
  return () => EventsOff('agent:tool');
}

export function onAgentToolResult(cb: (p: AgentEventPayload) => void): () => void {
  EventsOn('agent:tool_result', cb);
  return () => EventsOff('agent:tool_result');
}

// ---- LLM events ----

export function onLLMCall(cb: (p: LLMEventPayload) => void): () => void {
  EventsOn('llm:call', cb);
  return () => EventsOff('llm:call');
}

export function onLLMResponse(cb: (p: LLMEventPayload) => void): () => void {
  EventsOn('llm:response', cb);
  return () => EventsOff('llm:response');
}

// ---- Pool events ----

export function onPoolDispatch(cb: (p: PoolEventPayload) => void): () => void {
  EventsOn('pool:dispatch', cb);
  return () => EventsOff('pool:dispatch');
}

export function onPoolComplete(cb: (p: PoolEventPayload) => void): () => void {
  EventsOn('pool:complete', cb);
  return () => EventsOff('pool:complete');
}

// ---- Environment check ----

export function onEnvCheckReport(cb: (report: EnvCheckReport) => void): () => void {
  EventsOn('env-check-report', cb);
  return () => EventsOff('env-check-report');
}

// ---- Silent download (updater) ----

export function onSilentDownloadProgress(cb: (p: DownloadProgressPayload) => void): () => void {
  EventsOn('silent-download-progress', cb);
  return () => EventsOff('silent-download-progress');
}

export function onSilentDownloadComplete(cb: (p: DownloadCompletePayload) => void): () => void {
  EventsOn('silent-download-complete', cb);
  return () => EventsOff('silent-download-complete');
}

// ---- Popout / Window ----

export function onPopoutRequested(cb: (p: PopoutPayload) => void): () => void {
  EventsOn('popout-requested', cb);
  return () => EventsOff('popout-requested');
}

// ---- Workflow events ----

export function onWorkflowStarted(cb: (p: WorkflowEventPayload) => void): () => void {
  EventsOn('workflow:started', cb);
  return () => EventsOff('workflow:started');
}

export function onWorkflowComplete(cb: (p: WorkflowEventPayload) => void): () => void {
  EventsOn('workflow:complete', cb);
  return () => EventsOff('workflow:complete');
}

export function onWorkflowPaused(cb: (p: { runId: string }) => void): () => void {
  EventsOn('workflow:paused', cb);
  return () => EventsOff('workflow:paused');
}

export function onWorkflowResumed(cb: (p: { runId: string }) => void): () => void {
  EventsOn('workflow:resumed', cb);
  return () => EventsOff('workflow:resumed');
}

export function onWorkflowCancelled(cb: (p: { runId: string }) => void): () => void {
  EventsOn('workflow:cancelled', cb);
  return () => EventsOff('workflow:cancelled');
}

export function onWorkflowNodeEvent(cb: (p: WorkflowNodeEventPayload) => void): () => void {
  EventsOn('workflow:event', cb);
  return () => EventsOff('workflow:event');
}
