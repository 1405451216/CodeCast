import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  CastSchedulerEngine,
  type ScheduledTask,
  type SchedulerStats,
  type SchedulerCallbacks,
  type ScheduledTaskType,
  type TaskStatus,
  BUILTIN_TASK_TEMPLATES
} from '../utils/cast/cast-scheduler-engine';

interface ExecutionLogEntry {
  taskId: string;
  taskName: string;
  status: TaskStatus;
  timestamp: number;
  result?: string;
  error?: string;
}

interface CastSchedulerState {
  tasks: ScheduledTask[];
  stats: SchedulerStats;
  isRunning: boolean;
  isPaused: boolean;
  selectedTaskId: string | null;
  executionLog: ExecutionLogEntry[];

  addTask: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'failCount' | 'status'>) => string;
  updateTask: (id: string, updates: Partial<ScheduledTask>) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  runTaskNow: (id: string) => Promise<void>;
  duplicateTask: (id: string) => string;

  startScheduler: () => void;
  stopScheduler: () => void;
  pauseScheduler: () => void;
  resumeScheduler: () => void;

  getActiveTasks: () => ScheduledTask[];
  getTasksByType: (type: ScheduledTaskType) => ScheduledTask[];
  getExecutionLogs: (taskId?: string, limit?: number) => ExecutionLogEntry[];

  selectTask: (id: string | null) => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;

  clearLogs: () => void;
  exportLogs: () => void;

  refreshStats: () => void;
  syncTasksFromEngine: () => void;
  addBuiltinTemplate: (templateIndex: number) => string;
}

const TASKS_STORAGE_KEY = 'codecast_cast_scheduler_tasks';
const LOGS_STORAGE_KEY = 'codecast_cast_scheduler_logs';

function generateId(): string {
  return `store-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

const schedulerCallbacks: SchedulerCallbacks = {
  onTaskStart: (task) => {
    const store = useCastSchedulerStore.getState();
    store.executionLog.push({
      taskId: task.id,
      taskName: task.name,
      status: 'running',
      timestamp: Date.now()
    });
    if (store.executionLog.length > 500) {
      store.executionLog.splice(0, store.executionLog.length - 500);
    }
    store.saveToStorage();
  },
  onTaskComplete: (task, result) => {
    const store = useCastSchedulerStore.getState();
    store.executionLog.push({
      taskId: task.id,
      taskName: task.name,
      status: 'success',
      timestamp: Date.now(),
      result: result.substring(0, 200)
    });
    if (store.executionLog.length > 500) {
      store.executionLog.splice(0, store.executionLog.length - 500);
    }
    store.syncTasksFromEngine();
    store.refreshStats();
    store.saveToStorage();
  },
  onTaskError: (task, error) => {
    const store = useCastSchedulerStore.getState();
    store.executionLog.push({
      taskId: task.id,
      taskName: task.name,
      status: 'failed',
      timestamp: Date.now(),
      error: error.substring(0, 200)
    });
    if (store.executionLog.length > 500) {
      store.executionLog.splice(0, store.executionLog.length - 500);
    }
    store.syncTasksFromEngine();
    store.refreshStats();
    store.saveToStorage();
  },
  onTick: () => {
    const store = useCastSchedulerStore.getState();
    store.syncTasksFromEngine();
    store.refreshStats();
  }
};

CastSchedulerEngine.setCallbacks(schedulerCallbacks);

export const useCastSchedulerStore = create<CastSchedulerState>()(
  devtools(
    (set, get) => ({
      tasks: [],
      stats: {
        totalTasks: 0,
        activeTasks: 0,
        todayRuns: 0,
        successRate: 100,
        nextRunTime: null,
        uptimeSeconds: 0
      },
      isRunning: false,
      isPaused: false,
      selectedTaskId: null,
      executionLog: [],

      addTask: (taskData) => {
        const id = CastSchedulerEngine.addTask(taskData);
        get().syncTasksFromEngine();
        get().refreshStats();
        get().saveToStorage();
        return id;
      },

      updateTask: (id, updates) => {
        CastSchedulerEngine.updateTask(id, updates);
        get().syncTasksFromEngine();
        get().refreshStats();
        get().saveToStorage();
      },

      removeTask: (id) => {
        CastSchedulerEngine.removeTask(id);
        set((state) => ({
          tasks: state.tasks.filter(t => t.id !== id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId
        }));
        get().refreshStats();
        get().saveToStorage();
      },

      toggleTask: (id) => {
        CastSchedulerEngine.toggleTask(id);
        get().syncTasksFromEngine();
        get().refreshStats();
        get().saveToStorage();
      },

      runTaskNow: async (id) => {
        await CastSchedulerEngine.runTaskNow(id);
        get().syncTasksFromEngine();
        get().refreshStats();
        get().saveToStorage();
      },

      duplicateTask: (id) => {
        const source = get().tasks.find(t => t.id === id);
        if (!source) return '';

        const newId = CastSchedulerEngine.addTask({
          name: `${source.name} (副本)`,
          description: source.description,
          type: source.type,
          frequency: source.frequency,
          cronExpression: source.cronExpression,
          intervalMs: source.intervalMs,
          enabled: false,
          config: { ...source.config }
        });

        get().syncTasksFromEngine();
        get().refreshStats();
        get().saveToStorage();

        return newId;
      },

      startScheduler: () => {
        CastSchedulerEngine.start();
        set({ isRunning: true, isPaused: false });

        const tickInterval = setInterval(() => {
          const state = useCastSchedulerStore.getState();
          if (!state.isRunning) {
            clearInterval(tickInterval);
            return;
          }
          state.refreshStats();
        }, 5000);
      },

      stopScheduler: () => {
        CastSchedulerEngine.stop();
        set({ isRunning: false, isPaused: false });
        get().refreshStats();
      },

      pauseScheduler: () => {
        CastSchedulerEngine.pause();
        set({ isPaused: true });
      },

      resumeScheduler: () => {
        CastSchedulerEngine.resume();
        set({ isPaused: false });
      },

      getActiveTasks: () => {
        return get().tasks.filter(t => t.enabled && t.status !== 'disabled');
      },

      getTasksByType: (type) => {
        return get().tasks.filter(t => t.type === type);
      },

      getExecutionLogs: (taskId, limit) => {
        let logs = [...get().executionLog].reverse();

        if (taskId) {
          logs = logs.filter(l => l.taskId === taskId);
        }

        if (limit && limit > 0) {
          logs = logs.slice(0, limit);
        }

        return logs;
      },

      selectTask: (id) => {
        set({ selectedTaskId: id });
      },

      loadFromStorage: () => {
        try {
          const rawTasks = localStorage.getItem(TASKS_STORAGE_KEY);
          if (rawTasks) {
            const parsedTasks: ScheduledTask[] = JSON.parse(rawTasks);
            if (parsedTasks.length > 0) {
              CastSchedulerEngine.importTasks(parsedTasks);
            }
          }

          const rawLogs = localStorage.getItem(LOGS_STORAGE_KEY);
          if (rawLogs) {
            const parsedLogs: ExecutionLogEntry[] = JSON.parse(rawLogs);
            set({ executionLog: parsedLogs });
          }

          get().syncTasksFromEngine();
          get().refreshStats();
        } catch (error) {
          console.error('[CastSchedulerStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { tasks, executionLog } = get();
          localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
          localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(executionLog.slice(-500)));
        } catch (error) {
          console.error('[CastSchedulerStore] Save failed:', error);
        }
      },

      clearLogs: () => {
        set({ executionLog: [] });
        get().saveToStorage();
      },

      exportLogs: () => {
        const { executionLog } = get();
        const header = 'timestamp,taskId,taskName,status,result,error\n';
        const rows = executionLog.map(log =>
          `${new Date(log.timestamp).toISOString()},${log.taskId},"${log.taskName}",${log.status},"${log.result || ''}","${log.error || ''}"`
        ).join('\n');

        const csv = header + rows;
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cast-scheduler-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },

      refreshStats: () => {
        const stats = CastSchedulerEngine.getStats();
        set({
          stats,
          isRunning: CastSchedulerEngine.isRunning(),
          isPaused: CastSchedulerEngine.isPaused()
        });
      },

      syncTasksFromEngine: () => {
        const tasks = CastSchedulerEngine.getAllTasks();
        set({ tasks });
      },

      addBuiltinTemplate: (templateIndex) => {
        if (templateIndex < 0 || templateIndex >= BUILTIN_TASK_TEMPLATES.length) return '';

        const template = BUILTIN_TASK_TEMPLATES[templateIndex];
        const id = get().addTask({ ...template });

        return id;
      }
    }),
    { name: 'cast-scheduler-store' }
  )
);
