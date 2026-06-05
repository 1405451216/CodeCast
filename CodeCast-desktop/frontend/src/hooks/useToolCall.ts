import { useState, useCallback } from 'react';
import { useAppStore, AppState } from '../store';
import type { ToolInvocation } from '../store/useToolsStore';
import type { ToolCallResponse } from '@agentprimordia/sdk';
import * as api from '../api';

import { toError } from '../utils/errors';

interface UseToolCallOptions {
  toolName: string;
  category: string;
}

interface UseToolCallResult {
  call: (args: Record<string, any>) => Promise<ToolCallResponse & { durationMs: number }>;
  loading: boolean;
  error: string | null;
  lastInvocation: ToolInvocation | null;
}

/**
 * useToolCall 封装手动调用 Cast AP Tool 的逻辑。
 * 1. 通过 Wails 动态 invoke Cast Tool（后端返回 SDK 兼容的 ToolCallResponse）
 * 2. 记录到 useToolsStore 历史
 * 3. 返回 loading/error 状态
 *
 * 类型完全从 @agentprimordia/sdk 导入，确保前后端类型一致。
 */
export const useToolCall = (opts: UseToolCallOptions): UseToolCallResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvocation, setLastInvocation] = useState<ToolInvocation | null>(null);
  const addInvocation = useAppStore((s: AppState) => (s as any).addInvocation) as (inv: ToolInvocation) => void;

  const call = useCallback(
    async (args: Record<string, any>): Promise<ToolCallResponse & { durationMs: number }> => {
      setLoading(true);
      setError(null);
      const start = Date.now();
      try {
        // 后端 Wails 绑定（返回 JSON {content, isError}）
        const result = await (window as any).go?.main?.App?.InvokeCastTool?.(opts.toolName, JSON.stringify(args));
        const duration = Date.now() - start;
        // 标准化为 SDK ToolCallResponse 格式
        const response: ToolCallResponse = {
          result: result?.content || '',
          usage: { promptTokens: 0, completionTokens: 0 },
        };
        const invocation: ToolInvocation = {
          id: `${opts.toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolName: opts.toolName,
          category: opts.category,
          args: JSON.stringify(args),
          result: response.result,
          isError: !!result?.isError,
          sessionId: '',
          durationMs: duration,
          timestamp: Date.now(),
        };
        addInvocation(invocation);
        setLastInvocation(invocation);
        return { ...response, durationMs: duration };
      } catch (e: unknown) {
        const errMsg = toError(e).message || String(e);
        setError(errMsg);
        return {
          result: '',
          usage: { promptTokens: 0, completionTokens: 0 },
          durationMs: Date.now() - start,
        };
      } finally {
        setLoading(false);
      }
    },
    [opts.toolName, opts.category, addInvocation],
  );

  return { call, loading, error, lastInvocation };
};

export default useToolCall;
