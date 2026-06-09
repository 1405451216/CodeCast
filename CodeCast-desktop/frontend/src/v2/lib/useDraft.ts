import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

/**
 * Drop-in replacement for useState that auto-persists to sessionStorage (navigation survival)
 * and localStorage (crash recovery). Drafts are keyed by `draftKey`.
 * Drafts older than `ttlMs` (default 4 hours) are automatically discarded.
 */
export function useDraft<T>(draftKey: string, initial: T, ttlMs = 4 * 60 * 60 * 1000): [T, Dispatch<SetStateAction<T>>, () => void] {
  const sessionKey = `codecast-draft:${draftKey}`;
  const localKey = `codecast-draft-recovery:${draftKey}`;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [value, setValue] = useState<T>(() => {
    try {
      // Prefer sessionStorage (most recent navigation state)
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < ttlMs) return parsed.v as T;
      }
      // Fallback to localStorage (crash recovery)
      const rawLocal = localStorage.getItem(localKey);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Date.now() - parsed.ts < ttlMs) return parsed.v as T;
      }
    } catch { /* ignore */ }
    return initial;
  });

  // Persist to sessionStorage immediately + localStorage debounced
  useEffect(() => {
    try {
      const payload = JSON.stringify({ v: value, ts: Date.now() });
      sessionStorage.setItem(sessionKey, payload);
    } catch { /* ignore */ }

    // Debounce localStorage writes to 2s to avoid excessive I/O
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(localKey, JSON.stringify({ v: value, ts: Date.now() }));
      } catch { /* ignore */ }
    }, 2000);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, sessionKey, localKey]);

  // Clear this draft from both storages
  const clear = useCallback(() => {
    try { sessionStorage.removeItem(sessionKey); } catch { /* ignore */ }
    try { localStorage.removeItem(localKey); } catch { /* ignore */ }
    setValue(initial);
  }, [sessionKey, localKey, initial]);

  return [value, setValue, clear];
}
