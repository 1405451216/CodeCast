// TODO(v2 spec): cast tool sub-state (todos/schedules/knotes/emails) 由独立 spec 设计。
// 当前 cast 工具调用走 castSlice.invoke。本 slice 暂为占位。
import type { StateCreator } from 'zustand';
export interface CastToolState { todos: any[]; schedules: any[]; knotes: any[]; emails: any[]; lastError: string | null }
export interface CastToolSlice { state: CastToolState; setState: (partial: Partial<CastToolState>) => void; }
export const createCastToolSlice: StateCreator<CastToolSlice, [], [], CastToolSlice> = (set) => ({
  state: { todos: [], schedules: [], knotes: [], emails: [], lastError: null },
  setState: (partial) => set(s => ({ state: { ...s.state, ...partial } })),
});
