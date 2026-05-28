import { castChannels } from './cast-channels-engine';

export function emitCastEvent(params: {
  type: string;
  source: string;
  data: unknown;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}): string {
  return castChannels.emit({
    type: params.type,
    source: params.source,
    data: params.data,
    priority: params.priority || 'normal'
  });
}

export const CAST_EVENT_TYPES = {
  AGENT_TASK_COMPLETE: 'agent_task_complete',
  AGENT_STEP_COMPLETE: 'agent_step_complete',
  AGENT_ERROR: 'agent_error',
  SCHEDULE_REMINDER: 'schedule_reminder',
  SCHEDULE_TASK_RUN: 'schedule_task_run',
  MEMORY_SAVED: 'memory_saved',
  MEMORY_ALERT: 'memory_alert',
  TOOL_EXECUTED: 'tool_executed',
  PLUGIN_INSTALLED: 'plugin_installed',
  PLUGIN_ERROR: 'plugin_error',
  NOTIFICATION: 'notification',
  DAILY_SUMMARY: 'daily_summary',
  ERROR_REPORT: 'error_report'
} as const;

export type CastEventType = (typeof CAST_EVENT_TYPES)[keyof typeof CAST_EVENT_TYPES];

export function onCastEvent(
  eventType: string,
  handler: (event: import('../../types/cast-channels').CastEvent) => void
): () => void {
  return castChannels.on(eventType, handler);
}

export function onceCastEvent(
  eventType: string,
  handler: (event: import('../../types/cast-channels').CastEvent) => void
): () => void {
  return castChannels.once(eventType, handler);
}
