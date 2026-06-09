import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamBuffer, flushBuffer } from '../streaming';

describe('streaming', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('createStreamBuffer', () => {
    it('flushes when buffer reaches flushSize', () => {
      const onFlush = vi.fn();
      const buf = createStreamBuffer({ flushSize: 5, flushIntervalMs: 1000 });
      buf.onFlush = onFlush;
      buf.push('abc');
      expect(onFlush).not.toHaveBeenCalled();
      buf.push('de');
      expect(onFlush).toHaveBeenCalledWith('abcde');
      buf.dispose();
    });

    it('flushes on interval when buffer has data', () => {
      const onFlush = vi.fn();
      const buf = createStreamBuffer({ flushSize: 100, flushIntervalMs: 200 });
      buf.onFlush = onFlush;
      buf.push('partial');
      expect(onFlush).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(onFlush).toHaveBeenCalledWith('partial');
      buf.dispose();
    });

    it('does not flush on interval when buffer is empty', () => {
      const onFlush = vi.fn();
      const buf = createStreamBuffer({ flushSize: 100, flushIntervalMs: 200 });
      buf.onFlush = onFlush;
      vi.advanceTimersByTime(250);
      expect(onFlush).not.toHaveBeenCalled();
      buf.dispose();
    });

    it('dispose clears pending buffer', () => {
      const onFlush = vi.fn();
      const buf = createStreamBuffer({ flushSize: 100, flushIntervalMs: 200 });
      buf.onFlush = onFlush;
      buf.push('data');
      buf.dispose();
      vi.advanceTimersByTime(250);
      expect(onFlush).not.toHaveBeenCalled();
    });

    it('accumulates chunks before flush', () => {
      const onFlush = vi.fn();
      const buf = createStreamBuffer({ flushSize: 10, flushIntervalMs: 5000 });
      buf.onFlush = onFlush;
      buf.push('a');
      buf.push('b');
      buf.push('c');
      expect(onFlush).not.toHaveBeenCalled();
      buf.push('defghij');
      expect(onFlush).toHaveBeenCalledWith('abcdefghij');
      buf.dispose();
    });
  });

  describe('flushBuffer', () => {
    it('joins chunks into a single string', () => {
      expect(flushBuffer(['hello', ' ', 'world'])).toBe('hello world');
    });

    it('returns empty string for empty array', () => {
      expect(flushBuffer([])).toBe('');
    });

    it('handles single chunk', () => {
      expect(flushBuffer(['solo'])).toBe('solo');
    });
  });
});
