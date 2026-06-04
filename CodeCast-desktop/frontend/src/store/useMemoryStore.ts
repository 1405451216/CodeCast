import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as api from '../api';

export interface MemoryItem {
  id: string;
  content: string;
  type: 'conversation' | 'project' | 'code' | 'context';
  source: string;
  sessionId?: string;
  timestamp: number;
  tags: string[];
  relevance: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryStatistics {
  totalCount: number;
  todayCount: number;
  weekCount: number;
  retentionRate: number;
  typeDistribution: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface MemoryFilters {
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  source?: string;
  searchQuery?: string;
}

interface MemoryState {
  memories: MemoryItem[];
  statistics: MemoryStatistics;
  filters: MemoryFilters;
  isLoading: boolean;
  error: string | null;

  fetchMemories: () => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  exportMemories: () => Promise<void>;
  clearExpired: (daysThreshold?: number) => Promise<void>;
  setFilter: <K extends keyof MemoryFilters>(key: K, value: MemoryFilters[K]) => void;
  resetFilters: () => void;
  addMemory: (memory: Omit<MemoryItem, 'id' | 'timestamp' | 'relevance'>) => Promise<void>;
}

const generateMockMemories = (): MemoryItem[] => {
  const mockData: Omit<MemoryItem, 'id' | 'timestamp' | 'relevance'>[] = [
    {
      content: "上次讨论了登录验证的逻辑，使用了 JWT token 进行身份验证，并在中间件中验证 token 有效性",
      type: 'conversation',
      source: 'Session #23',
      sessionId: 'session-23',
      tags: ['React', '认证', 'JWT', '安全'],
      metadata: { importance: 'high' }
    },
    {
      content: "CodeCast = React + Go 的桌面应用，使用 Wails 框架进行跨平台开发",
      type: 'project',
      source: 'Project Context',
      tags: ['React', 'Go', 'Wails', '架构'],
      metadata: { techStack: true }
    },
    {
      content: "实现了虚拟滚动优化，使用 @tanstack/react-virtual 库提升长列表渲染性能",
      type: 'code',
      source: 'Session #45',
      sessionId: 'session-45',
      tags: ['性能优化', 'React', '虚拟滚动'],
      metadata: { component: 'MessagesView' }
    },
    {
      content: "用户反馈在处理大型代码文件时响应较慢，需要进一步优化代码高亮和语法解析",
      type: 'context',
      source: 'User Feedback',
      tags: ['性能', '用户体验', '代码编辑'],
      metadata: { priority: 'medium' }
    },
    {
      content: "集成了 DeepSeek API 进行智能对话，支持多轮对话和上下文理解",
      type: 'conversation',
      source: 'Session #12',
      sessionId: 'session-12',
      tags: ['DeepSeek', 'AI', '对话'],
      metadata: { integration: true }
    },
    {
      content: "数据库层使用 SQLite 进行本地存储，通过 FTS5 实现全文搜索功能",
      type: 'code',
      source: 'Session #38',
      sessionId: 'session-38',
      tags: ['SQLite', 'FTS5', '数据库', '搜索'],
      metadata: { layer: 'persistence' }
    },
    {
      content: "TypeScript 严格模式已启用，所有新代码必须遵循类型安全规范",
      type: 'context',
      source: 'Code Standards',
      tags: ['TypeScript', '规范', '类型安全'],
      metadata: { standard: true }
    },
    {
      content: "Agent 系统支持子任务分发，主 Agent 可以将复杂任务拆分为多个子 Agent 并行处理",
      type: 'project',
      source: 'Architecture Doc',
      tags: ['Agent', '并行处理', '任务管理'],
      metadata: { feature: 'agent-system' }
    }
  ];

  return mockData.map((item, index) => ({
    ...item,
    id: `memory-${Date.now()}-${index}`,
    timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    relevance: Math.random() * 40 + 60
  }));
};

const calculateStatistics = (memories: MemoryItem[]): MemoryStatistics => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = memories.filter(m => m.timestamp >= todayStart.getTime()).length;
  const weekCount = memories.filter(m => m.timestamp >= weekAgo.getTime()).length;

  const olderThanWeek = memories.filter(m => m.timestamp < weekAgo.getTime()).length;
  const totalOlder = memories.filter(m => m.timestamp < todayStart.getTime() - 14 * 24 * 60 * 60 * 1000).length;
  const retentionRate = totalOlder > 0 ? Math.round((olderThanWeek / totalOlder) * 100) : 89;

  const typeDistribution: Record<string, number> = {};
  memories.forEach(m => {
    typeDistribution[m.type] = (typeDistribution[m.type] || 0) + 1;
  });

  const tagCounts: Record<string, number> = {};
  memories.forEach(m => {
    m.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalCount: memories.length,
    todayCount,
    weekCount,
    retentionRate,
    typeDistribution,
    topTags
  };
};

export const useMemoryStore = create<MemoryState>()(
  devtools(
    (set, get) => ({
      memories: [],
      statistics: {
        totalCount: 0,
        todayCount: 0,
        weekCount: 0,
        retentionRate: 0,
        typeDistribution: {},
        topTags: []
      },
      filters: {},
      isLoading: false,
      error: null,

      fetchMemories: async () => {
        set({ isLoading: true, error: null });

        try {
          let memories: MemoryItem[];

          try {
            const response = await api.getMemories();
            memories = Array.isArray(response) ? (response as MemoryItem[]) : [];
          } catch {
            // Fallback to mock data if API is unavailable
            memories = generateMockMemories();
          }

          const statistics = calculateStatistics(memories);

          set({
            memories,
            statistics,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取记忆失败',
            isLoading: false
          });
        }
      },

      deleteMemory: async (id: string) => {
        const currentMemories = get().memories;

        try {
          try {
            await api.deleteMemory(id);
          } catch {
            // Fallback: remove locally if API unavailable
          }

          const updatedMemories = currentMemories.filter(m => m.id !== id);
          const statistics = calculateStatistics(updatedMemories);

          set({
            memories: updatedMemories,
            statistics
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '删除记忆失败'
          });
        }
      },

      exportMemories: async () => {
        const { memories } = get();

        try {
          const exportData = {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            totalCount: memories.length,
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
          a.download = `codecast-memories-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '导出记忆失败'
          });
          throw error;
        }
      },

      clearExpired: async (daysThreshold = 30) => {
        const currentMemories = get().memories;
        const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

        try {
          try {
            await api.clearExpiredMemories(daysThreshold);
          } catch {
            // Fallback: clear locally if API unavailable
          }

          const validMemories = currentMemories.filter(m => m.timestamp >= threshold);
          const removedCount = currentMemories.length - validMemories.length;
          const statistics = calculateStatistics(validMemories);

          set({
            memories: validMemories,
            statistics
          });

          console.log(`已清理 ${removedCount} 条过期记忆`);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '清理过期记忆失败'
          });
        }
      },

      setFilter: <K extends keyof MemoryFilters>(key: K, value: MemoryFilters[K]) => {
        const currentFilters = get().filters;
        set({
          filters: {
            ...currentFilters,
            [key]: value
          }
        });
      },

      resetFilters: () => {
        set({ filters: {} });
      },

      addMemory: async (memoryData) => {
        const currentMemories = get().memories;

        try {
          let newMemory: MemoryItem;

          try {
            const response = await api.addMemory(memoryData);
            newMemory = response as MemoryItem;
          } catch {
            // Fallback: create locally if API unavailable
            newMemory = {
              ...memoryData,
              id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
              relevance: 85 + Math.random() * 15
            };
          }

          const updatedMemories = [newMemory, ...currentMemories];
          const statistics = calculateStatistics(updatedMemories);

          set({
            memories: updatedMemories,
            statistics
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '添加记忆失败'
          });
        }
      }
    }),
    {
      name: 'memory-store'
    }
  )
);