// frontend/src/v2/lib/reportError.ts
// 统一报告错误到 errorsSlice，无需在每个 slice 用 (get() as any) 强转
import { useAppStore } from '../store';
import { formatWailsError } from './format';
import type { SliceName } from '../store/slices/errorsSlice';

export function reportError(slice: SliceName, e: unknown): void {
  useAppStore.getState().setError(slice, formatWailsError(e));
}
