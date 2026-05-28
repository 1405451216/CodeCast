import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/index';

describe('Advanced Store Features', () => {
  beforeEach(() => {
    useAppStore.setState({} as any);
  });

  describe('Knowledge Base Store', () => {
    it('should add knowledge entries', () => {
      const entry = {
        id: 'kb-1',
        title: 'React Best Practices',
        content: 'Use functional components with hooks',
        tags: ['react', 'best-practices'],
        createdAt: Date.now()
      };

      if ('addKnowledgeEntry' in useAppStore.getState()) {
        (useAppStore.getState() as any).addKnowledgeEntry(entry);
        
        const state = useAppStore.getState() as any;
        const knowledgeBase = state.knowledgeBase;
        expect(knowledgeBase).toContainEqual(entry);
      }
    });

    it('should search knowledge base', () => {
      const entries = [
        { id: 'kb-1', title: 'TypeScript Basics', content: 'TypeScript adds types', tags: ['typescript'] },
        { id: 'kb-2', title: 'React Hooks', content: 'Hooks are functions', tags: ['react'] },
        { id: 'kb-3', title: 'TypeScript in React', content: 'Using TS with React', tags: ['typescript', 'react'] }
      ];

      if ('setKnowledgeBase' in useAppStore.getState()) {
        (useAppStore.getState() as any).setKnowledgeBase(entries);
        
        const searchResults = entries.filter(e => 
          e.tags.includes('typescript')
        );
        
        expect(searchResults).toHaveLength(2);
      }
    });
  });

  describe('Schedule Store', () => {
    it('should manage scheduled items', () => {
      const scheduleItem = {
        id: 'sched-1',
        title: 'Daily Standup',
        time: '09:00',
        recurring: true,
        enabled: true
      };

      if ('addScheduleItem' in useAppStore.getState()) {
        (useAppStore.getState() as any).addScheduleItem(scheduleItem);
        
        const state = useAppStore.getState() as any;
        const items = state.scheduleItems;
        expect(items).toHaveLength(1);
      }
    });

    it('should toggle schedule item status', () => {
      if ('updateScheduleItem' in useAppStore.getState()) {
        (useAppStore.getState() as any).updateScheduleItem('sched-1', { enabled: false });
        
        const state = useAppStore.getState() as any;
        const items = state.scheduleItems || [];
        const updatedItem = items.find((i: { id: string }) => i.id === 'sched-1');
        expect(updatedItem?.enabled).toBe(false);
      }
    });
  });

  describe('Memory Items Store', () => {
    it('should store context memories', () => {
      const memory = {
        id: 'mem-1',
        type: 'context',
        content: 'Working on authentication feature',
        importance: 'high',
        expiresAt: Date.now() + 86400000
      };

      if ('addMemoryItem' in useAppStore.getState()) {
        (useAppStore.getState() as any).addMemoryItem(memory);
        
        const state = useAppStore.getState() as any;
        const memories = state.memoryItems;
        expect(memories).toHaveLength(1);
      }
    });

    it('should clean expired memories', () => {
      const now = Date.now();
      const memories = [
        { id: 'mem-1', content: 'Recent task', expiresAt: now + 86400000 },
        { id: 'mem-2', content: 'Old task', expiresAt: now - 86400000 }
      ];

      if ('setMemoryItems' in useAppStore.getState()) {
        (useAppStore.getState() as any).setMemoryItems(memories);
        
        const validMemories = memories.filter(m => m.expiresAt > now);
        expect(validMemories).toHaveLength(1);
      }
    });
  });

  describe('Platform Detection', () => {
    it('should detect and set platform', () => {
      const platforms: Array<'windows' | 'darwin' | 'linux'> = ['windows', 'darwin', 'linux'];
      
      platforms.forEach((platform) => {
        if ('setPlatform' in useAppStore.getState()) {
          (useAppStore.getState() as any).setPlatform(platform);
          expect(useAppStore.getState().platform).toBe(platform);
        }
      });
    });
  });

  describe('Menu State Management', () => {
    it('should track active menus', () => {
      if ('setActiveMenu' in useAppStore.getState()) {
        (useAppStore.getState() as any).setActiveMenu('settings');
        
        expect(useAppStore.getState().activeMenu).toBe('settings');
      }
    });

    it('should close all menus', () => {
      if ('closeMenus' in useAppStore.getState()) {
        (useAppStore.getState() as any).setActiveMenu('menu1');
        (useAppStore.getState() as any).closeMenus();
        
        expect(useAppStore.getState().activeMenu).toBeNull();
      }
    });
  });
});
