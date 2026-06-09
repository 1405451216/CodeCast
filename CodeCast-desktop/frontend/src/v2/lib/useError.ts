// frontend/src/v2/lib/useError.ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import type { SliceName } from '../store/slices/errorsSlice';

export function useError(slice: SliceName): string | undefined {
  const msg = useAppStore((s) => s.errors[slice]);
  const clearError = useAppStore((s) => s.clearError);
  const shown = useRef(false);
  useEffect(() => {
    if (msg && !shown.current) {
      // Don't show toast here — errors are already surfaced via onNotification in App.tsx
      shown.current = true;
      clearError(slice);
    }
    if (!msg) shown.current = false;
  }, [msg, slice, clearError]);
  return msg;
}
