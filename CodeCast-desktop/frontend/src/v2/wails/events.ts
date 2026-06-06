// wails/events.ts — Wails event bridge
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import type {
  NotificationPayload, UpdateProgress, APMetricsSnapshot,
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

export function onCostSummary(cb: (cost: unknown) => void): () => void {
  EventsOn('cost:summary', cb);
  return () => EventsOff('cost:summary');
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
  cb: (p: unknown) => void,
): () => void {
  const topic = `orchestration:${type}`;
  EventsOn(topic, cb);
  return () => EventsOff(topic);
}
