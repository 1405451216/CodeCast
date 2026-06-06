// frontend/src/v2/lib/__tests__/stream-guard.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamGuard } from '../stream-guard';

describe('createStreamGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onTimeout after timeoutMs of inactivity', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('reset() postpones timeout', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    vi.advanceTimersByTime(500);
    g.reset();
    vi.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('dispose() prevents further timeouts', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    g.dispose();
    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
