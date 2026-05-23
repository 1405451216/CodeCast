import { TodoItem } from './types';
import type { SliceSet } from './storeTypes';

interface TodoSlice {
  todoItems: TodoItem[];
  setTodoItems: (items: TodoItem[]) => void;
  addTodoItem: (item: TodoItem) => void;
  updateTodoItem: (id: string, updates: Partial<TodoItem>) => void;
}

const createTodoSlice = (set: SliceSet): TodoSlice => ({
  todoItems: [],
  setTodoItems: (items) => set({ todoItems: items }),
  addTodoItem: (item) =>
    set((state) => ({ todoItems: [...(state.todoItems as TodoItem[]), item] })),
  updateTodoItem: (id, updates) =>
    set((state) => ({
      todoItems: (state.todoItems as TodoItem[]).map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    })),
});

export { type TodoSlice, createTodoSlice };
