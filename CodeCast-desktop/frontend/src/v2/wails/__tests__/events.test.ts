// frontend/src/v2/wails/__tests__/events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import {
  onNotification,
  onMetricsSnapshot,
  onLifecycleStates,
  onSummaryReady,
  onGitCommitConfirm,
  onUpdateProgress,
  onOrchestrationEvent,
  onAgentEvent,
  onCostSummary,
  onCacheStats,
  onAgentStart,
  onAgentStop,
  onAgentError,
  onAgentTurn,
  onAgentTurnEnd,
  onAgentTool,
  onAgentToolResult,
  onLLMCall,
  onLLMResponse,
  onPoolDispatch,
  onPoolComplete,
  onEnvCheckReport,
  onSilentDownloadProgress,
  onSilentDownloadComplete,
  onPopoutRequested,
  onWorkflowStarted,
  onWorkflowComplete,
  onWorkflowPaused,
  onWorkflowResumed,
  onWorkflowCancelled,
  onWorkflowNodeEvent,
  onStreamChunk,
  onAPEvent,
} from '../events';

describe('events bridge', () => {
  it('onNotification subscribes to "notification" and returns unsubscribe', () => {
    const cb = vi.fn();
    const unsub = onNotification(cb);
    expect(EventsOn).toHaveBeenCalledWith('notification', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('notification');
  });

  it('onMetricsSnapshot subscribes to "metrics:snapshot"', () => {
    const cb = vi.fn();
    const unsub = onMetricsSnapshot(cb);
    expect(EventsOn).toHaveBeenCalledWith('metrics:snapshot', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('metrics:snapshot');
  });

  it('onLifecycleStates subscribes to "lifecycle:states"', () => {
    const cb = vi.fn();
    const unsub = onLifecycleStates(cb);
    expect(EventsOn).toHaveBeenCalledWith('lifecycle:states', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('lifecycle:states');
  });

  it('onSummaryReady subscribes to "summary:ready"', () => {
    const cb = vi.fn();
    const unsub = onSummaryReady(cb);
    expect(EventsOn).toHaveBeenCalledWith('summary:ready', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('summary:ready');
  });

  it('onGitCommitConfirm subscribes to "git-commit-confirm"', () => {
    const cb = vi.fn();
    const unsub = onGitCommitConfirm(cb);
    expect(EventsOn).toHaveBeenCalledWith('git-commit-confirm', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('git-commit-confirm');
  });

  it('onUpdateProgress subscribes to "update-progress"', () => {
    const cb = vi.fn();
    const unsub = onUpdateProgress(cb);
    expect(EventsOn).toHaveBeenCalledWith('update-progress', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('update-progress');
  });

  it('onOrchestrationEvent subscribes to "orchestration:{type}"', () => {
    const cb = vi.fn();
    const unsub = onOrchestrationEvent('start', cb);
    expect(EventsOn).toHaveBeenCalledWith('orchestration:start', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('orchestration:start');
  });

  it('onAgentEvent subscribes to generic type topic', () => {
    const cb = vi.fn();
    const unsub = onAgentEvent('agent:start', cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:start', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:start');
  });

  // ---- New subscriptions (Task 1) ----

  it('onStreamChunk subscribes to "stream:{sessionId}"', () => {
    const cb = vi.fn();
    const unsub = onStreamChunk('sess-1', cb);
    expect(EventsOn).toHaveBeenCalledWith('stream:sess-1', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('stream:sess-1');
  });

  it('onAPEvent subscribes to "ap:{eventType}"', () => {
    const cb = vi.fn();
    const unsub = onAPEvent('agent:start', cb);
    expect(EventsOn).toHaveBeenCalledWith('ap:agent:start', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('ap:agent:start');
  });

  it('onCostSummary subscribes to "cost:summary"', () => {
    const cb = vi.fn();
    const unsub = onCostSummary(cb);
    expect(EventsOn).toHaveBeenCalledWith('cost:summary', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('cost:summary');
  });

  it('onCacheStats subscribes to "cache:stats"', () => {
    const cb = vi.fn();
    const unsub = onCacheStats(cb);
    expect(EventsOn).toHaveBeenCalledWith('cache:stats', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('cache:stats');
  });

  it('onAgentStart subscribes to "agent:start"', () => {
    const cb = vi.fn();
    const unsub = onAgentStart(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:start', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:start');
  });

  it('onAgentStop subscribes to "agent:stop"', () => {
    const cb = vi.fn();
    const unsub = onAgentStop(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:stop', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:stop');
  });

  it('onAgentError subscribes to "agent:error"', () => {
    const cb = vi.fn();
    const unsub = onAgentError(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:error', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:error');
  });

  it('onAgentTurn subscribes to "agent:turn"', () => {
    const cb = vi.fn();
    const unsub = onAgentTurn(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:turn', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:turn');
  });

  it('onAgentTurnEnd subscribes to "agent:turn_end"', () => {
    const cb = vi.fn();
    const unsub = onAgentTurnEnd(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:turn_end', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:turn_end');
  });

  it('onAgentTool subscribes to "agent:tool"', () => {
    const cb = vi.fn();
    const unsub = onAgentTool(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:tool', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:tool');
  });

  it('onAgentToolResult subscribes to "agent:tool_result"', () => {
    const cb = vi.fn();
    const unsub = onAgentToolResult(cb);
    expect(EventsOn).toHaveBeenCalledWith('agent:tool_result', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('agent:tool_result');
  });

  it('onLLMCall subscribes to "llm:call"', () => {
    const cb = vi.fn();
    const unsub = onLLMCall(cb);
    expect(EventsOn).toHaveBeenCalledWith('llm:call', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('llm:call');
  });

  it('onLLMResponse subscribes to "llm:response"', () => {
    const cb = vi.fn();
    const unsub = onLLMResponse(cb);
    expect(EventsOn).toHaveBeenCalledWith('llm:response', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('llm:response');
  });

  it('onPoolDispatch subscribes to "pool:dispatch"', () => {
    const cb = vi.fn();
    const unsub = onPoolDispatch(cb);
    expect(EventsOn).toHaveBeenCalledWith('pool:dispatch', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('pool:dispatch');
  });

  it('onPoolComplete subscribes to "pool:complete"', () => {
    const cb = vi.fn();
    const unsub = onPoolComplete(cb);
    expect(EventsOn).toHaveBeenCalledWith('pool:complete', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('pool:complete');
  });

  it('onEnvCheckReport subscribes to "env-check-report"', () => {
    const cb = vi.fn();
    const unsub = onEnvCheckReport(cb);
    expect(EventsOn).toHaveBeenCalledWith('env-check-report', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('env-check-report');
  });

  it('onSilentDownloadProgress subscribes to "silent-download-progress"', () => {
    const cb = vi.fn();
    const unsub = onSilentDownloadProgress(cb);
    expect(EventsOn).toHaveBeenCalledWith('silent-download-progress', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('silent-download-progress');
  });

  it('onSilentDownloadComplete subscribes to "silent-download-complete"', () => {
    const cb = vi.fn();
    const unsub = onSilentDownloadComplete(cb);
    expect(EventsOn).toHaveBeenCalledWith('silent-download-complete', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('silent-download-complete');
  });

  it('onPopoutRequested subscribes to "popout-requested"', () => {
    const cb = vi.fn();
    const unsub = onPopoutRequested(cb);
    expect(EventsOn).toHaveBeenCalledWith('popout-requested', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('popout-requested');
  });

  it('onWorkflowStarted subscribes to "workflow:started"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowStarted(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:started', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:started');
  });

  it('onWorkflowComplete subscribes to "workflow:complete"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowComplete(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:complete', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:complete');
  });

  it('onWorkflowPaused subscribes to "workflow:paused"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowPaused(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:paused', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:paused');
  });

  it('onWorkflowResumed subscribes to "workflow:resumed"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowResumed(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:resumed', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:resumed');
  });

  it('onWorkflowCancelled subscribes to "workflow:cancelled"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowCancelled(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:cancelled', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:cancelled');
  });

  it('onWorkflowNodeEvent subscribes to "workflow:event"', () => {
    const cb = vi.fn();
    const unsub = onWorkflowNodeEvent(cb);
    expect(EventsOn).toHaveBeenCalledWith('workflow:event', cb);
    unsub();
    expect(EventsOff).toHaveBeenCalledWith('workflow:event');
  });
});
