import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TodoItem, TodoPriority, TodoStatus, RepeatRule, ScheduleEvent, CalendarView } from '../types/cast-types';
import { TODO_PRIORITIES } from '../types/cast-types';

interface ScheduleState {
  todos: TodoItem[];
  events: ScheduleEvent[];
  calendarView: CalendarView;
  selectedDate: number;
  filterStatus: TodoStatus | 'all';
  isLoading: boolean;

  setCalendarView: (view: CalendarView) => void;
  setSelectedDate: (date: number) => void;
  setFilterStatus: (status: TodoStatus | 'all') => void;

  addTodo: (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTodo: (id: string, updates: Partial<TodoItem>) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  toggleAllComplete: (ids: string[]) => void;

  addEvent: (event: Omit<ScheduleEvent, 'id'>) => string;
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;

  getTodosByStatus: (status: TodoStatus) => TodoItem[];
  getTodosByDate: (date: number) => TodoItem[];
  getTodayTodos: () => TodoItem[];
  getOverdueTodos: () => TodoItem[];
  getStats: () => { total: number; completed: number; pending: number; urgent: number };

  aiSuggestSchedule: (tasks: string[], timeRange: { start: number; end: number }) => Promise<ScheduleEvent[]>;

  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearCompleted: () => void;
}

const STORAGE_KEY = 'codecast_schedule_data';

function generateId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

export const useScheduleStore = create<ScheduleState>()(
  devtools(
    (set, get) => ({
      todos: [],
      events: [],
      calendarView: 'day',
      selectedDate: Date.now(),
      filterStatus: 'all',
      isLoading: false,

      setCalendarView: (view) => set({ calendarView: view }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setFilterStatus: (status) => set({ filterStatus: status }),

      addTodo: (todoData) => {
        const id = generateId();
        const now = Date.now();
        const newTodo: TodoItem = {
          ...todoData,
          id,
          createdAt: now,
          updatedAt: now
        };
        set((state) => ({ todos: [newTodo, ...state.todos] }));
        get().saveToStorage();
        return id;
      },

      updateTodo: (id, updates) => {
        set((state) => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          )
        }));
        get().saveToStorage();
      },

      deleteTodo: (id) => {
        set((state) => ({ todos: state.todos.filter(t => t.id !== id) }));
        get().saveToStorage();
      },

      toggleTodo: (id) => {
        set((state) => ({
          todos: state.todos.map(t => {
            if (t.id !== id) return t;
            const newStatus: TodoStatus = t.status === 'completed' ? 'pending' : 'completed';
            return {
              ...t,
              status: newStatus,
              completedAt: newStatus === 'completed' ? Date.now() : undefined,
              updatedAt: Date.now()
            };
          })
        }));
        get().saveToStorage();
      },

      toggleAllComplete: (ids) => {
        set((state) => ({
          todos: state.todos.map(t =>
            ids.includes(t.id)
              ? { ...t, status: ('completed' as TodoStatus), completedAt: Date.now(), updatedAt: Date.now() }
              : t
          )
        }));
        get().saveToStorage();
      },

      addEvent: (eventData) => {
        const id = `evt-${Date.now()}`;
        const newEvent: ScheduleEvent = { ...eventData, id };
        set((state) => ({ events: [...state.events, newEvent] }));
        get().saveToStorage();
        return id;
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
        }));
      },

      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter(e => e.id !== id) }));
        get().saveToStorage();
      },

      getTodosByStatus: (status) => get().todos.filter(t => t.status === status),

      getTodosByDate: (date) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        return get().todos.filter(t => {
          if (!t.dueDate) return false;
          return t.dueDate >= startOfDay.getTime() && t.dueDate <= endOfDay.getTime();
        });
      },

      getTodayTodos: () => get().getTodosByDate(Date.now()),

      getOverdueTodos: () => {
        const now = Date.now();
        return get().todos.filter(t =>
          t.dueDate && t.dueDate < now && t.status !== 'completed' && t.status !== 'archived'
        );
      },

      getStats: () => {
        const todos = get().todos;
        return {
          total: todos.length,
          completed: todos.filter(t => t.status === 'completed').length,
          pending: todos.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
          urgent: todos.filter(t => t.priority === 'urgent' && t.status !== 'completed').length
        };
      },

      aiSuggestSchedule: async (tasks, timeRange) => {
        try {
          const prompt = `我需要在以下时间段安排任务：
时间范围：${new Date(timeRange.start).toLocaleString()} 到 ${new Date(timeRange.end).toLocaleString()}
待安排任务：
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请帮我：
1. 分析每个任务的预估耗时
2. 考虑任务优先级和依赖关系
3. 给出推荐的时间安排（JSON格式数组，每项包含 taskIndex, startTime, endTime, reason）`;

          const result = await import('../api').then(api => 
            api.sendMessageEx('', prompt, 'deepseek-v4-pro', false)
          );

          if (typeof result === 'string') {
            const jsonMatch = (result as string).match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
          }
          return [];
        } catch (error) {
          console.error('[ScheduleStore] AI suggest failed:', error);
          return [];
        }
      },

      loadFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            set({
              todos: data.todos || [],
              events: data.events || []
            });
          }
        } catch (error) {
          console.error('[ScheduleStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { todos, events } = get();
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos, events }));
        } catch (error) {
          console.error('[ScheduleStore] Save failed:', error);
        }
      },

      clearCompleted: () => {
        set((state) => ({
          todos: state.todos.filter(t => t.status !== 'completed')
        }));
        get().saveToStorage();
      }
    }),
    { name: 'schedule-store' }
  )
);
