import { useCallback, useRef, useEffect } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return debouncedFn;
}

export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): T {
  const lastCall = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const throttledFn = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall.current >= interval) {
      lastCall.current = now;
      fn(...args);
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        fn(...args);
        timerRef.current = undefined;
      }, interval - (now - lastCall.current));
    }
  }, [fn, interval]) as T;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return throttledFn;
}

export function useMemoize<T extends (...args: any[]) => any>(
  fn: T
): T {
  const cacheRef = useRef<Map<string, ReturnType<T>>>(new Map());
  const cacheSize = 100;

  return useCallback((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);

    if (cacheRef.current.has(key)) return cacheRef.current.get(key)!;

    const result = fn(...args);

    if (cacheRef.current.size >= cacheSize) {
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey !== undefined) cacheRef.current.delete(firstKey);
    }

    cacheRef.current.set(key, result);
    return result;
  }, [fn]) as T;
}

export function useLazyState<T extends {}>(initializer: () => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const ref = useRef<{ value: T | null }>({ value: null });

  if (ref.current.value === null) {
    ref.current.value = initializer();
  }

  const [state, setState] = useState(ref.current.value!);

  const setAndSync = useCallback((action: React.SetStateAction<T>) => {
    setState(prev => {
      const next = typeof action === 'function' ? (action as (prev: T) => unknown)(prev) as T : action;
      ref.current.value = next;
      return next;
    });
  }, []);

  return [state, setAndSync];
}

export function useCleanupEffect(
  cleanup: () => void,
  deps?: React.DependencyList
): void {
  useEffect(() => cleanup, deps ?? []);
}

export function useMountedRef(): React.MutableRefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return mounted;
}

export function useAsyncEffect(
  effect: () => Promise<void> | void,
  deps?: React.DependencyList
): void {
  const mounted = useMountedRef();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await effect();
      } catch (err) {
        if (!cancelled && mounted.current) console.error('[useAsyncEffect]', err);
      }
    };

    run();

    return () => { cancelled = true; };
  }, deps ?? []);

}

export function useVirtualScrollOptions() {
  return {
    overscan: 8,
    estimateSize: () => 48,
  };
}

import { useState } from 'react';
