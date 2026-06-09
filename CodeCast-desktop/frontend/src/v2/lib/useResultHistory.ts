import { useState, useCallback, useRef } from 'react';

/**
 * Manages a result history stack (max N entries).
 * Supports back/forward navigation through previous results.
 */
export function useResultHistory<T>(maxSize = 5) {
  const [history, setHistory] = useState<T[]>([]);
  const [index, setIndex] = useState(-1);

  const push = useCallback((item: T) => {
    setHistory(prev => {
      const next = [...prev, item];
      if (next.length > maxSize) next.shift();
      return next;
    });
    setIndex(-1); // Reset to latest
  }, [maxSize]);

  const current = history.length > 0
    ? history[index === -1 ? history.length - 1 : index]
    : undefined;

  const canGoBack = history.length > 1 && (index === -1 ? history.length - 1 : index) > 0;
  const canGoForward = index !== -1 && index < history.length - 1;

  const goBack = useCallback(() => {
    setIndex(prev => {
      const cur = prev === -1 ? history.length - 1 : prev;
      return cur > 0 ? cur - 1 : prev;
    });
  }, [history.length]);

  const goForward = useCallback(() => {
    setIndex(prev => {
      if (prev === -1) return prev;
      return prev < history.length - 1 ? prev + 1 : -1;
    });
  }, [history.length]);

  const clear = useCallback(() => {
    setHistory([]);
    setIndex(-1);
  }, []);

  return { current, history, push, goBack, goForward, canGoBack, canGoForward, clear, count: history.length };
}
