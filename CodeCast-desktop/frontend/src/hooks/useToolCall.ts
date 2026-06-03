import { useState, useCallback } from 'react';
import { useAppStore, AppState } from '../store';
import type { ToolInvocation } from '../store/useToolsStore';
import * as api from '../api';

interface UseToolCallOptions {
  toolName: string;
  category: string;
}

interface UseToolCallResult {
  call: (args: Record<string, any>) => Promise<{ result: string; isError: boolean }>;
  loading: boolean;
  error: string | null;
  lastInvocation: ToolInvocation | null;
}

/**
 * useToolCall 封装手动调用 Cast AP Tool 的逻辑。
 * 1. 通过 Wails 绑定 invoke 工具
 * 2. 记录到 useToolsStore 历史
 * 3. 返回 loading/error 状态
 *
 * 主要用于 UI 面板上"手动触发"按钮（不是 AI 自动调用）。
 */
export const useToolCall = (opts: UseToolCallOptions): UseToolCallResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvocation, setLastInvocation] = useState<ToolInvocation | null>(null);
  const addInvocation = useAppStore((s: AppState) => (s as any).addInvocation) as (inv: ToolInvocation) => void;

  const call = useCallback(
    async (args: Record<string, any>) => {
      setLoading(true);
      setError(null);
      const start = Date.now();
      try {
        // 通过 Wails 动态 invoke Cast Tool
        // 后端 Wails 暴露 GetToolHistory + ToolRegistry 可迭代
        // 这里我们用通用 invoke (Wails 自动生成)
        const argsJSON = JSON.stringify(args);
        const result = await (window as any).go?.main?.App?.InvokeCastTool?.(opts.toolName, argsJSON);
        const duration = Date.now() - start;
        const isError = !!result?.isError;
        const invocation: ToolInvocation = {
          id: `${opts.toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolName: opts.toolName,
          category: opts.category,
          args: argsJSON,
          result: result?.content || '',
          isError,
          sessionId: '',
          durationMs: duration,
          timestamp: Date.now(),
        };
        addInvocation(invocation);
        setLastInvocation(invocation);
        return { result: invocation.result, isError };
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        setError(errMsg);
        return { result: '', isError: true };
      } finally {
        setLoading(false);
      }
    },
    [opts.toolName, opts.category, addInvocation],
  );

  return { call, loading, error, lastInvocation };
};

export default useToolCall;
