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
});
