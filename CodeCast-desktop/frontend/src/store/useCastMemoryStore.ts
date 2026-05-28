import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SoulConfig } from '../utils/cast/soul-engine';
import {
  DEFAULT_SOUL,
  SOUL_PRESETS,
  getSoulSystemPrompt
} from '../utils/cast/soul-engine';
import type { MemoryHealth, CastMemoryItemType } from '../types/cast-types';

export interface CastMemoryItem {
  id: string;
  content: string;
  type: CastMemoryItemType;
  source: string;
  sourceDetail?: string;
  tags: string[];
  timestamp: number;
  importance: number;
  embeddings?: number[];
  metadata?: Record<string, unknown>;
  expiresAt?: number;
  accessCount: number;
}

export interface CastMemoryStats {
  total: number;
  todayCount: number;
  weekCount: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  memoryHealth: MemoryHealth;
}

interface CastMemoryState {
  memories: CastMemoryItem[];
  stats: CastMemoryStats;
  soulConfig: SoulConfig;
  isLoading: boolean;
  searchQuery: string;
  filterType: CastMemoryItemType | 'all';

  setSearchQuery: (query: string) => void;
  setFilterType: (type: CastMemoryItemType | 'all') => void;

  addMemory: (memory: Omit<CastMemoryItem, 'id' | 'timestamp' | 'accessCount'>) => string;
  updateMemory: (id: string, updates: Partial<CastMemoryItem>) => void;
  deleteMemory: (id: string) => void;
  deleteMemoriesBySource: (source: string) => void;
  clearAll: () => void;

  searchMemories: (query: string, limit?: number) => CastMemoryItem[];
  getRecentMemories: (limit?: number) => CastMemoryItem[];
  getMemoriesByType: (type: CastMemoryItemType) => CastMemoryItem[];
  getMemoriesBySource: (source: string) => CastMemoryItem[];
  getImportantMemories: (threshold?: number) => CastMemoryItem[];
  getContextString: (maxChars?: number) => string;

  updateSoul: (updates: Partial<SoulConfig>) => void;
  setSoulPreset: (presetKey: string) => void;
  getSoulPrompt: () => string;

  loadFromStorage: () => void;
  saveToStorage: () => void;
  exportMemories: () => void;
  importMemories: (json: string) => { success: boolean; count: number };

  clearExpired: () => number;
  compactMemories: (maxItems?: number) => number;
  resetStats: () => void;
}

const STORAGE_KEY = 'codecast_cast_memories';
const SOUL_STORAGE_KEY = 'codecast_cast_soul';
const MAX_CAPACITY = 500;

function generateId(): string {
  return `cmem-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

function calculateStats(memories: CastMemoryItem[]): CastMemoryStats {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = memories.filter(m => m.timestamp >= todayStart.getTime()).length;
  const weekCount = memories.filter(m => m.timestamp >= weekAgo.getTime()).length;

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  memories.forEach(m => {
    byType[m.type] = (byType[m.type] || 0) + 1;
    bySource[m.source] = (bySource[m.source] || 0) + 1;
    m.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  let memoryHealth: MemoryHealth = 'good';
  if (memories.length >= MAX_CAPACITY) {
    memoryHealth = 'full';
  } else if (memories.length >= MAX_CAPACITY * 0.8) {
    memoryHealth = 'warning';
  }

  return {
    total: memories.length,
    todayCount,
    weekCount,
    byType,
    bySource,
    topTags,
    memoryHealth
  };
}

function hybridSearch(query: string, memories: CastMemoryItem[], limit: number = 20): CastMemoryItem[] {
  if (!query.trim()) return memories.slice(0, limit);

  const q = query.toLowerCase().trim();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const scored = memories.map(memory => {
    let score = 0;
    const searchText = `${memory.content} ${memory.tags.join(' ')} ${memory.sourceDetail || ''}`.toLowerCase();

    if (searchText.includes(q)) score += 25;

    const queryWords = q.split(/\s+/).filter(Boolean);
    queryWords.forEach(word => {
      if (memory.content.toLowerCase().includes(word)) score += 12;
      if (memory.tags.some(t => t.toLowerCase().includes(word))) score += 8;
      if ((memory.sourceDetail || '').toLowerCase().includes(word)) score += 5;
    });

    memory.tags.forEach(tag => {
      if (tag.toLowerCase().includes(q)) score += 15;
      if (q.includes(tag.toLowerCase())) score += 10;
    });

    if (memory.source === q || memory.source.includes(q)) score += 6;

    const ageHours = (now - memory.timestamp) / (1000 * 60 * 60);
    if (ageHours < 24) score += 5;
    else if (ageHours < 168) score += 2;

    if (memory.timestamp >= sevenDaysAgo) score += 3;

    score += (memory.importance / 100) * 15;

    score += Math.min(memory.accessCount * 2, 20);

    return { memory, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(s => s.memory);
}

export const useCastMemoryStore = create<CastMemoryState>()(
  devtools(
    (set, get) => ({
      memories: [],
      stats: {
        total: 0,
        todayCount: 0,
        weekCount: 0,
        byType: {},
        bySource: {},
        topTags: [],
        memoryHealth: 'good'
      },
      soulConfig: DEFAULT_SOUL,
      isLoading: false,
      searchQuery: '',
      filterType: 'all',

      addMemory: (memoryData) => {
        const state = get();

        if (state.memories.length >= MAX_CAPACITY) {
          console.warn('[CastMemoryStore] 已达到最大容量限制，无法添加新记忆');
          return '';
        }

        const id = generateId();
        const now = Date.now();
        const newMemory: CastMemoryItem = {
          ...memoryData,
          id,
          timestamp: now,
          accessCount: 0,
          importance: memoryData.importance ?? 50
        };

        set({
          memories: [newMemory, ...state.memories]
        });

        get().saveToStorage();
        return id;
      },

      updateMemory: (id, updates) => {
        set((state) => ({
          memories: state.memories.map(m =>
            m.id === id ? { ...m, ...updates } : m
          )
        }));
        get().saveToStorage();
      },

      deleteMemory: (id) => {
        set((state) => ({
          memories: state.memories.filter(m => m.id !== id)
        }));
        get().saveToStorage();
      },

      deleteMemoriesBySource: (source) => {
        set((state) => ({
          memories: state.memories.filter(m => m.source !== source)
        }));
        get().saveToStorage();
      },

      clearAll: () => {
        set({ memories: [] });
        get().saveToStorage();
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setFilterType: (type: CastMemoryItemType | 'all') => {
        set({ filterType: type });
      },

      searchMemories: (query, limit = 20) => {
        const { memories, filterType } = get();
        let filtered = memories;

        if (filterType !== 'all') {
          filtered = memories.filter(m => m.type === filterType);
        }

        return hybridSearch(query, filtered, limit);
      },

      getRecentMemories: (limit = 20) => {
        return [...get().memories]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      getMemoriesByType: (type) => {
        return get().memories.filter(m => m.type === type);
      },

      getMemoriesBySource: (source) => {
        return get().memories.filter(m => m.source === source);
      },

      getImportantMemories: (threshold = 70) => {
        return get()
          .memories
          .filter(m => m.importance >= threshold)
          .sort((a, b) => b.importance - a.importance);
      },

      getContextString: (maxChars = 2000) => {
        const recent = get().getRecentMemories(10);
        if (!recent.length) return '';

        let context = '[Cast 记忆上下文]\n';
        let charCount = context.length;

        for (const mem of recent) {
          const entry = `- [${new Date(mem.timestamp).toLocaleDateString()}][${mem.type}] ${mem.content.slice(0, 150)}${mem.content.length > 150 ? '...' : ''}\n`;
          if (charCount + entry.length > maxChars) break;
          context += entry;
          charCount += entry.length;
        }

        return context;
      },

      updateSoul: (updates) => {
        set((state) => ({
          soulConfig: { ...state.soulConfig, ...updates }
        }));
        get().saveToStorage();
      },

      setSoulPreset: (presetKey) => {
        const preset = SOUL_PRESETS[presetKey];
        if (preset) {
          set({ soulConfig: preset });
          get().saveToStorage();
        }
      },

      getSoulPrompt: () => {
        return getSoulSystemPrompt(get().soulConfig);
      },

      loadFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            const memories: CastMemoryItem[] = data.memories || [];
            set({ memories });
          }

          const soulRaw = localStorage.getItem(SOUL_STORAGE_KEY);
          if (soulRaw) {
            try {
              const soulData = JSON.parse(soulRaw);
              set({ soulConfig: soulData });
            } catch {
            }
          }
        } catch (error) {
          console.error('[CastMemoryStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { memories, soulConfig } = get();
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ memories }));
          localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(soulConfig));
        } catch (error) {
          console.error('[CastMemoryStore] Save failed:', error);
        }
      },

      exportMemories: () => {
        const { memories, soulConfig } = get();
        const exportData = {
          version: '2.0',
          exportTime: new Date().toISOString(),
          totalCount: memories.length,
          soulConfig,
          memories: memories.map(m => ({
            ...m,
            exportedAt: new Date().toISOString()
          }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codecast-cast-memories-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      importMemories: (json) => {
        try {
          const parsed = JSON.parse(json);
          const importedMemories: CastMemoryItem[] = parsed.memories || [];
          const currentMemories = get().memories;
          const existingIds = new Set(currentMemories.map(m => m.id));

          const newMemories = importedMemories
            .filter((m: CastMemoryItem) => !existingIds.has(m.id))
            .map((m: CastMemoryItem) => ({
              ...m,
              id: existingIds.has(m.id) ? generateId() : m.id
            }));

          const merged = [...newMemories, ...currentMemories].slice(0, MAX_CAPACITY);

          set({ memories: merged });
          get().saveToStorage();

          return { success: true, count: newMemories.length };
        } catch (error) {
          console.error('[CastMemoryStore] Import failed:', error);
          return { success: false, count: 0 };
        }
      },

      clearExpired: () => {
        const now = Date.now();
        const valid = get().memories.filter(m => {
          if (!m.expiresAt) return true;
          return m.expiresAt > now;
        });

        const removedCount = get().memories.length - valid.length;
        set({ memories: valid });
        get().saveToStorage();
        return removedCount;
      },

      compactMemories: (maxItems = 300) => {
        const sorted = [...get().memories].sort((a, b) => {
          const scoreA = a.importance + a.accessCount * 5 + (a.expiresAt ? 100 : 0);
          const scoreB = b.importance + b.accessCount * 5 + (b.expiresAt ? 100 : 0);
          return scoreB - scoreA;
        });

        const kept = sorted.slice(0, maxItems);
        const removedCount = get().memories.length - kept.length;

        set({ memories: kept });
        get().saveToStorage();
        return removedCount;
      },

      resetStats: () => {
        const stats = calculateStats(get().memories);
        set({ stats });
      }
    }),
    { name: 'cast-memory-store' }
  )
);
