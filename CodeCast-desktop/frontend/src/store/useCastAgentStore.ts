import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CastAgentExecutor } from '../utils/cast/cast-agent-executor';
import { planCastTask } from '../utils/cast/cast-agent-planner';
import type {
  CastAgentTask,
  CastAgentStep,
  CastAgentState,
  CastAgentTemplateKey,
  CastAgentExecutionEvent
} from '../types/cast-agent';
import { TaskStatus } from '../types/agent';

const STORAGE_KEY = 'codecast_cast_agent_history';
const MAX_HISTORY_SIZE = 50;

function generateTaskId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

function generateStepId(): string {
  return `cas-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

function createInitialSteps(
  rawSteps: Array<Omit<CastAgentStep, 'id' | 'status' | 'startTime' | 'endTime' | 'duration'>>
): CastAgentStep[] {
  return rawSteps.map(raw => ({
    ...raw,
    id: generateStepId(),
    status: 'pending' as const,
    startTime: undefined,
    endTime: undefined,
    duration: undefined
  }));
}

interface CastAgentStore extends CastAgentState {
  executor: CastAgentExecutor | null;
  setExecutor: (executor: CastAgentExecutor | null) => void;
  setCurrentTask: (task: CastAgentTask | null) => void;
  addEvent: (event: CastAgentExecutionEvent) => void;
  pushToHistory: (task: CastAgentTask) => void;
}

export const useCastAgentStore = create<CastAgentStore>()(
  devtools(
    (set, get) => ({
      currentTask: null,
      taskHistory: [],
      isPlanning: false,
      isExecuting: false,
      isPaused: false,
      events: [],
      executor: null,

      setExecutor: (executor) => set({ executor }),

      setCurrentTask: (task) => set({ currentTask: task }),

      addEvent: (event) =>
        set((state) => ({ events: [...state.events, event] })),

      pushToHistory: (task) =>
        set((state) => {
          const updatedHistory = [task, ...state.taskHistory].slice(0, MAX_HISTORY_SIZE);
          return { taskHistory: updatedHistory };
        }),

      submitGoal: async (goal, templateKey) => {
        const taskId = generateTaskId();

        set({ isPlanning: true, isExecuting: false, isPaused: false });

        try {
          const planningStart = Date.now();

          const { parsedGoal, steps: rawSteps } = await planCastTask(goal, undefined, templateKey);

          const planningTime = Date.now() - planningStart;
          const initializedSteps = createInitialSteps(rawSteps);

          const newTask: CastAgentTask = {
            id: taskId,
            userGoal: goal,
            parsedGoal,
            steps: initializedSteps,
            status: TaskStatus.IDLE,
            currentStepIndex: 0,
            totalSteps: initializedSteps.length,
            completedSteps: 0,
            failedSteps: 0,
            createdAt: Date.now(),
            metadata: {
              modelUsed: 'gpt-4o-mini',
              planningTime,
              tokensEstimated: Math.ceil(goal.length / 4)
            }
          };

          set({
            currentTask: newTask,
            isPlanning: false,
            isExecuting: true,
            isPaused: false,
            events: [
              {
                type: 'task_created',
                taskId,
                data: { goal, stepCount: initializedSteps.length },
                timestamp: Date.now()
              },
              {
                type: 'planning_start',
                taskId,
                timestamp: planningStart
              },
              {
                type: 'planning_complete',
                taskId,
                data: { planningTime, stepCount: initializedSteps.length },
                timestamp: Date.now()
              }
          ]});

          const executor = new CastAgentExecutor(newTask);
          set({ executor });

          const unsubscribe = executor.onEvent((event) => {
            get().addEvent(event);

            if (event.type === 'progress') {
              set((state) => {
                if (!state.currentTask) return state;
                return {
                  currentTask: { ...state.currentTask }
                };
              });
            }

            if (event.type === 'step_complete' || event.type === 'step_fail') {
              set((state) => {
                if (!state.currentTask || !state.executor) return state;
                const updatedTask = state.executor.getTask();
                return { currentTask: updatedTask };
              });
            }
          });

          const completedTask = await executor.execute();

          unsubscribe();

          set((state) => ({
            currentTask: completedTask,
            isExecuting: false,
            isPaused: false,
            executor: null
          }));

          if (
            completedTask.status === 'completed' ||
            completedTask.status === 'failed'
          ) {
            get().pushToHistory(completedTask);
            get().saveToStorage();
          }

          return taskId;
        } catch (error: any) {
          console.error('[CastAgentStore] submitGoal failed:', error);
          set({
            isPlanning: false,
            isExecuting: false,
            isPaused: false,
            executor: null
          });
          throw error;
        }
      },

      approveStep: async (stepId) => {
        const { executor } = get();
        if (!executor) {
          console.warn('[CastAgentStore] No active executor to approve step');
          return;
        }

        executor.approveStep(stepId);

        set((state) => {
          if (!state.currentTask) return state;
          const updatedSteps = state.currentTask.steps.map(step =>
            step.id === stepId ? { ...step, approvedByUser: true } : step
          );
          return {
            currentTask: { ...state.currentTask, steps: updatedSteps }
          };
        });

        get().addEvent({
          type: 'step_approved',
          taskId: get().currentTask?.id || '',
          stepId,
          timestamp: Date.now()
        });
      },

      rejectStep: (stepId, reason) => {
        const { executor } = get();
        if (!executor) {
          console.warn('[CastAgentStore] No active executor to reject step');
          return;
        }

        executor.rejectStep(stepId);

        set((state) => {
          if (!state.currentTask) return state;
          const updatedSteps = state.currentTask.steps.map(step =>
            step.id === stepId ? { ...step, status: 'skipped' as const, error: reason || '用户拒绝执行' } : step
          );
          return {
            currentTask: { ...state.currentTask, steps: updatedSteps }
          };
        });

        get().addEvent({
          type: 'step_fail',
          taskId: get().currentTask?.id || '',
          stepId,
          data: { reason: reason || '用户拒绝', rejected: true },
          timestamp: Date.now()
        });
      },

      pauseExecution: () => {
        const { executor } = get();
        if (executor && !executor.isCancelled()) {
          executor.pause();
          set({ isPaused: true });
        }
      },

      resumeExecution: () => {
        const { executor } = get();
        if (executor && !executor.isCancelled()) {
          executor.resume();
          set({ isPaused: false });
        }
      },

      cancelTask: () => {
        const { executor } = get();
        if (executor) {
          executor.cancel();
          executor.destroy();
        }

        set((state) => {
          let finalTask = state.currentTask;
          if (finalTask) {
            finalTask = { ...finalTask, status: 'failed' as TaskStatus };
            get().pushToHistory(finalTask);
            get().saveToStorage();
          }

          return {
            isExecuting: false,
            isPaused: false,
            isPlanning: false,
            executor: null,
            currentTask: finalTask
          };
        });

        get().addEvent({
          type: 'task_cancelled',
          taskId: get().currentTask?.id || '',
          timestamp: Date.now()
        });
      },

      retryStep: async (stepId) => {
        const { executor, currentTask } = get();
        if (!executor || !currentTask) {
          throw new Error('[CastAgentStore] No active task or executor for retry');
        }

        try {
          set({ isExecuting: true, isPaused: false });

          await executor.executeSingleStep(stepId);

          const updatedTask = executor.getTask();
          set({ currentTask: updatedTask, isExecuting: false });
        } catch (error: any) {
          console.error('[CastAgentStore] retryStep failed:', error);
          set({ isExecuting: false });
          throw error;
        }
      },

      getTaskHistory: (limit) => {
        const { taskHistory } = get();
        if (limit !== undefined) {
          return taskHistory.slice(0, limit);
        }
        return taskHistory;
      },

      getEvents: (taskId) => {
        const { events } = get();
        if (taskId) {
          return events.filter(e => e.taskId === taskId);
        }
        return events;
      },

      loadFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            const history: CastAgentTask[] = data.history || [];
            set({ taskHistory: history.slice(0, MAX_HISTORY_SIZE) });
          }
        } catch (error) {
          console.error('[CastAgentStore] Load from storage failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { taskHistory } = get();
          const serializableHistory = taskHistory.map(task => ({
            ...task,
            steps: task.steps.map(step => ({
              ...step,
              outputResult: step.outputResult?.slice(0, 2000)
            }))
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: serializableHistory }));
        } catch (error) {
          console.error('[CastAgentStore] Save to storage failed:', error);
        }
      },

      clearHistory: () => {
        set({ taskHistory: [], events: [] });
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          console.error('[CastAgentStore] Clear history failed:', error);
        }
      }
    }),
    { name: 'cast-agent-store' }
  )
);
