import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  castSandbox,
  SANDBOX_POLICIES,
  type SandboxedScript,
  type SandboxPolicy,
  type SandboxExecutionResult,
  type ExecutionLog
} from '../utils/cast/cast-sandbox';

export type { SandboxedScript, SandboxPolicy, SandboxExecutionResult, ExecutionLog };

const SCRIPTS_STORAGE_KEY = 'cast_sandbox_scripts';
const POLICY_STORAGE_KEY = 'cast_sandbox_policy';

interface CastSandboxState {
  scripts: SandboxedScript[];
  currentScriptId: string | null;
  currentPolicy: SandboxPolicy;
  executionHistory: ExecutionLog[];
  isExecuting: boolean;
  activeExecutionId: string | null;
  lastResult: SandboxExecutionResult | null;

  saveScript: (script: Omit<SandboxedScript, 'id' | 'createdAt' | 'executionCount' | 'lastExecutedAt'>) => string;
  updateScript: (id: string, updates: Partial<SandboxedScript>) => void;
  deleteScript: (id: string) => void;
  duplicateScript: (id: string) => string;
  getScript: (id: string) => SandboxedScript | undefined;

  executeCurrentScript: (context?: Record<string, unknown>) => Promise<SandboxExecutionResult>;
  executeScriptById: (id: string, context?: Record<string, unknown>) => Promise<SandboxExecutionResult>;
  quickExecute: (code: string, language?: SandboxedScript['language']) => Promise<SandboxExecutionResult>;
  stopExecution: () => boolean;

  updatePolicy: (updates: Partial<SandboxPolicy>) => void;
  setPresetPolicy: (preset: 'strict' | 'balanced' | 'permissive') => void;

  selectScript: (id: string | null) => void;

  getHistory: (limit?: number) => ExecutionLog[];
  clearHistory: () => void;
  exportHistory: () => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;
}

function generateScriptId(): string {
  return `script-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useCastSandboxStore = create<CastSandboxState>()(
  devtools(
    (set, get) => ({
      scripts: [],
      currentScriptId: null,
      currentPolicy: { ...SANDBOX_POLICIES.balanced },
      executionHistory: [],
      isExecuting: false,
      activeExecutionId: null,
      lastResult: null,

      saveScript: (scriptData) => {
        const id = generateScriptId();
        const now = Date.now();

        const newScript: SandboxedScript = {
          ...scriptData,
          id,
          createdAt: now,
          executionCount: 0
        };

        set((state) => ({
          scripts: [newScript, ...state.scripts],
          currentScriptId: id
        }));

        get().saveToStorage();
        return id;
      },

      updateScript: (id, updates) => {
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          )
        }));
        get().saveToStorage();
      },

      deleteScript: (id) => {
        set((state) => ({
          scripts: state.scripts.filter((s) => s.id !== id),
          currentScriptId:
            state.currentScriptId === id ? null : state.currentScriptId
        }));
        get().saveToStorage();
      },

      duplicateScript: (id) => {
        const script = get().scripts.find((s) => s.id === id);
        if (!script) return '';

        const newId = generateScriptId();
        const now = Date.now();

        const duplicated: SandboxedScript = {
          ...script,
          id: newId,
          name: `${script.name} (副本)`,
          createdAt: now,
          lastExecutedAt: undefined,
          executionCount: 0
        };

        set((state) => ({
          scripts: [duplicated, ...state.scripts],
          currentScriptId: newId
        }));

        get().saveToStorage();
        return newId;
      },

      getScript: (id) => {
        return get().scripts.find((s) => s.id === id);
      },

      executeCurrentScript: async (context?: Record<string, unknown>) => {
        const { currentScriptId, currentPolicy } = get();

        if (!currentScriptId) {
          const result: SandboxExecutionResult = {
            success: false,
            stdout: '',
            stderr: '未选择脚本',
            executionTime: 0,
            timedOut: false,
            killed: false,
            error: 'No script selected'
          };
          set({ lastResult: result });
          return result;
        }

        return get().executeScriptById(currentScriptId, context);
      },

      executeScriptById: async (id, context?) => {
        const script = get().scripts.find((s) => s.id === id);
        if (!script) {
          const result: SandboxExecutionResult = {
            success: false,
            stdout: '',
            stderr: `脚本不存在: ${id}`,
            executionTime: 0,
            timedOut: false,
            killed: false,
            error: `Script not found: ${id}`
          };
          set({ lastResult: result });
          return result;
        }

        const { currentPolicy } = get();
        const execId = `exec-${Date.now()}`;

        set({
          isExecuting: true,
          activeExecutionId: execId,
          lastResult: null
        });

        try {
          const result = await castSandbox.execute(script, {
            policy: currentPolicy,
            context
          });

          const logEntry: ExecutionLog = {
            id: execId,
            scriptId: script.id,
            scriptName: script.name,
            result,
            policy: { ...currentPolicy },
            timestamp: Date.now(),
            triggeredBy: 'user'
          };

          castSandbox.addExecutionLog(logEntry);

          set((state) => ({
            isExecuting: false,
            activeExecutionId: null,
            lastResult: result,
            executionHistory: [logEntry, ...state.executionHistory].slice(0, 200),
            scripts: state.scripts.map((s) =>
              s.id === id
                ? {
                    ...s,
                    lastExecutedAt: Date.now(),
                    executionCount: s.executionCount + 1
                  }
                : s
            )
          }));

          get().saveToStorage();
          return result;
        } catch (error: any) {
          const errorResult: SandboxExecutionResult = {
            success: false,
            stdout: '',
            stderr: error.message || '执行异常',
            executionTime: 0,
            timedOut: false,
            killed: false,
            error: error.message
          };

          set({
            isExecuting: false,
            activeExecutionId: null,
            lastResult: errorResult
          });

          return errorResult;
        }
      },

      quickExecute: async (code, language = 'javascript') => {
        const tempScript: SandboxedScript = {
          id: `temp-${Date.now()}`,
          name: '快速执行',
          language,
          code,
          permissions: [],
          source: 'quick_execute',
          createdAt: Date.now(),
          executionCount: 0
        };

        const { currentPolicy } = get();
        const execId = `exec-${Date.now()}`;

        set({
          isExecuting: true,
          activeExecutionId: execId,
          lastResult: null
        });

        try {
          const result = await castSandbox.execute(tempScript, {
            policy: currentPolicy
          });

          const logEntry: ExecutionLog = {
            id: execId,
            scriptId: tempScript.id,
            scriptName: tempScript.name,
            result,
            policy: { ...currentPolicy },
            timestamp: Date.now(),
            triggeredBy: 'user'
          };

          castSandbox.addExecutionLog(logEntry);

          set((state) => ({
            isExecuting: false,
            activeExecutionId: null,
            lastResult: result,
            executionHistory: [logEntry, ...state.executionHistory].slice(0, 200)
          }));

          return result;
        } catch (error: any) {
          const errorResult: SandboxExecutionResult = {
            success: false,
            stdout: '',
            stderr: error.message || '快速执行异常',
            executionTime: 0,
            timedOut: false,
            killed: false,
            error: error.message
          };

          set({
            isExecuting: false,
            activeExecutionId: null,
            lastResult: errorResult
          });

          return errorResult;
        }
      },

      stopExecution: () => {
        const { activeExecutionId } = get();
        if (!activeExecutionId) return false;

        const cancelled = castSandbox.cancelExecution(activeExecutionId);

        if (cancelled) {
          set({
            isExecuting: false,
            activeExecutionId: null
          });
        }

        return cancelled;
      },

      updatePolicy: (updates) => {
        set((state) => ({
          currentPolicy: { ...state.currentPolicy, ...updates }
        }));
        get().saveToStorage();
      },

      setPresetPolicy: (preset) => {
        const policy = SANDBOX_POLICIES[preset];
        set({ currentPolicy: { ...policy } });
        get().saveToStorage();
      },

      selectScript: (id) => {
        set({ currentScriptId: id });
      },

      getHistory: (limit) => {
        const { executionHistory } = get();
        if (limit && limit > 0) {
          return executionHistory.slice(0, limit);
        }
        return executionHistory;
      },

      clearHistory: () => {
        set({ executionHistory: [] });
        castSandbox.clearLogs();
      },

      exportHistory: () => {
        const json = castSandbox.exportLogs();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sandbox-execution-log-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      loadFromStorage: () => {
        try {
          const scriptsRaw = localStorage.getItem(SCRIPTS_STORAGE_KEY);
          if (scriptsRaw) {
            const scripts = JSON.parse(scriptsRaw) as SandboxedScript[];
            set({ scripts });
          }

          const policyRaw = localStorage.getItem(POLICY_STORAGE_KEY);
          if (policyRaw) {
            const policy = JSON.parse(policyRaw) as SandboxPolicy;
            set({ currentPolicy: policy });
          }
        } catch (error) {
          console.error('[CastSandboxStore] Load from storage failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { scripts, currentPolicy } = get();
          localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
          localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(currentPolicy));
        } catch (error) {
          console.error('[CastSandboxStore] Save to storage failed:', error);
        }
      }
    }),
    { name: 'cast-sandbox-store' }
  )
);
