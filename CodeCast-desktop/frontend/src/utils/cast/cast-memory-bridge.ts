import { useMemoryStore } from '../../store/useMemoryStore';
import type { MemoryItem } from '../../store/useMemoryStore';

const CAST_MEMORY_PREFIX = 'cast-';
const CAST_MEMORY_TYPES: MemoryItem['type'][] = ['conversation', 'context'];
const MAX_CAST_MEMORIES = 100;

function generateCastId(): string {
  return `${CAST_MEMORY_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

export function saveCastMemory(params: {
  content: string;
  tags?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { addMemory } = useMemoryStore.getState();

  return addMemory({
    content: params.content,
    type: 'conversation',
    source: params.source || 'Cast Mode',
    tags: ['cast', ...(params.tags || [])],
    metadata: {
      castMode: true,
      ...params.metadata
    }
  });
}

export function saveCastContext(params: {
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { addMemory } = useMemoryStore.getState();

  return addMemory({
    content: params.content,
    type: 'context',
    source: 'Cast Context',
    tags: ['cast-context', ...(params.tags || [])],
    metadata: {
      castMode: true,
      ...params.metadata
    }
  });
}

export function getCastMemories(): MemoryItem[] {
  const { memories } = useMemoryStore.getState();
  return memories
    .filter(m => m.source?.includes('Cast') || m.tags?.includes('cast'))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getRelevantCastMemories(query: string, limit = 5): MemoryItem[] {
  const memories = getCastMemories();
  if (!query.trim() || !memories.length) return [];

  const q = query.toLowerCase();
  const scored = memories
    .map(memory => {
      let score = 0;
      const searchText = `${memory.content} ${memory.tags.join(' ')}`.toLowerCase();

      if (memory.content.toLowerCase().includes(q)) score += 20;
      memory.tags.forEach(tag => {
        if (tag.toLowerCase().includes(q)) score += 10;
        if (q.includes(tag.toLowerCase())) score += 8;
      });

      const words = q.split(/\s+/).filter(Boolean);
      words.forEach(word => {
        if (searchText.includes(word)) score += 3;
      });

      return { memory, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(s => s.memory);
}

export function getCastMemoryContextString(): string {
  const recent = getCastMemories().slice(0, 8);
  if (!recent.length) return '';

  return '\n\n[Cast 长期记忆上下文]\n' +
    recent.map(m => `- [${new Date(m.timestamp).toLocaleDateString()}] ${m.content.slice(0, 120)}${m.content.length > 120 ? '...' : ''} (${m.tags.slice(0, 3).join(', ')})`).join('\n');
}

export async function autoSaveCastInteraction(params: {
  userMessage: string;
  aiResponse?: string;
  panel?: string;
  actionType?: string;
}): Promise<void> {
  const content = params.aiResponse
    ? `用户: ${params.userMessage}\nAI: ${params.aiResponse}`
    : params.userMessage;

  if (content.length < 15) return;

  const isImportant =
    content.includes('总结') ||
    content.includes('计划') ||
    content.includes('决定') ||
    content.includes('翻译') ||
    content.length > 200 ||
    params.actionType === 'generate' ||
    params.actionType === 'translate';

  if (isImportant) {
    await saveCastMemory({
      content: content.slice(0, 500),
      tags: [
        params.panel || 'general',
        params.actionType || 'interaction',
        ...extractKeywords(content)
      ],
      source: `Cast-${params.panel || 'general'}`,
      metadata: {
        panel: params.panel,
        actionType: params.actionType,
        messageLength: content.length
      }
    });
  }
}

export function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const castKeywords = [
    '周报', '方案', '邮件', '翻译', '日程', '笔记',
    '会议', '待办', '文档', '报告', '润色', '摘要'
  ];

  castKeywords.forEach(kw => {
    if (text.includes(kw)) keywords.add(kw);
  });

  const tagPattern = /#(\S{2,10})/g;
  let match;
  while ((match = tagPattern.exec(text)) !== null) {
    keywords.add(match[1]);
  }

  return Array.from(keywords).slice(0, 6);
}

export function getCastMemoryStats(): {
  total: number;
  todayCount: number;
  byPanel: Record<string, number>;
} {
  const all = getCastMemories();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const byPanel: Record<string, number> = {};
  all.forEach(m => {
    const panel = (m.metadata as any)?.panel || 'general';
    byPanel[panel] = (byPanel[panel] || 0) + 1;
  });

  return {
    total: all.length,
    todayCount: all.filter(m => m.timestamp >= todayStart.getTime()).length,
    byPanel
  };
}
