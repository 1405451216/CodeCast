// frontend/src/v2/lib/reportError.ts
// 统一报告错误到 errorsSlice，无需在每个 slice 用 (get() as any) 强转
import { useAppStore } from '../store';
import { formatWailsError } from './format';
import type { SliceName } from '../store/slices/errorsSlice';

// Debounce identical error messages so rapid retries don't flood the toast
let lastToastMsg = '';
let lastToastTime = 0;

export function reportError(slice: SliceName, e: unknown): void {
  const msg = formatWailsError(e);
  useAppStore.getState().setError(slice, msg);

  // Show a toast for the error (debounce identical messages within 2s)
  const now = Date.now();
  if (msg !== lastToastMsg || now - lastToastTime > 2000) {
    lastToastMsg = msg;
    lastToastTime = now;
    // Defer toast to next tick so it doesn't interfere with state updates
    setTimeout(() => {
      useAppStore.getState().pushNotification({
        title: '错误',
        type: 'error',
        body: `[${slice}] ${msg}`,
      });
    }, 0);
  }
}
