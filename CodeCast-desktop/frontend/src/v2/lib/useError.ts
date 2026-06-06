// frontend/src/v2/lib/useError.ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useToast } from '../components/primitives/Toast';
import type { SliceName } from '../store/slices/errorsSlice';

export function useError(slice: SliceName): string | undefined {
  const msg = useAppStore((s) => s.errors[slice]);
  const clearError = useAppStore((s) => s.clearError);
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (msg && !shown.current) {
      toast.show(msg, 'danger');
      shown.current = true;
      clearError(slice);
    }
    if (!msg) shown.current = false;
  }, [msg, slice, clearError, toast]);
  return msg;
}
