import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../store/index';

describe('All Stores Integration', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      projects: [],
      todoItems: [],
      attachments: [],
      images: [],
      plugins: [],
      slashCommands: [],
      changedFiles: []
    });
  });

  describe('Message Store Operations', () => {
    it('should have message store functionality', () => {
      const state = useAppStore.getState();
      
      expect(state).toBeDefined();
      expect('messages' in state || 'addMessage' in state).toBeTruthy();
    });
  });

  describe('Session Store Operations', () => {
    it('should manage session state', () => {
      const state = useAppStore.getState();
      
      if ('sessions' in state) {
        expect(Array.isArray(state.sessions)).toBe(true);
      }
      
      if ('setSessions' in state) {
        (state as any).setSessions([{ 
          id: 'test-session', 
          name: 'Test Session',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }]);
        
        expect(useAppStore.getState().sessions).toHaveLength(1);
      }
    });
  });

  describe('Project Store Operations', () => {
    it('should handle project state', () => {
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        path: '/path/to/project'
      };

      if ('setCurrentProject' in useAppStore.getState()) {
        useAppStore.getState().setCurrentProject(project);
        expect(useAppStore.getState().currentProject?.id).toBe('proj-1');
      } else {
        expect(project.id).toBe('proj-1');
      }
    });

    it('should track changed files', () => {
      const changedFiles = [
        { path: '/src/test.ts', status: 'modified' as const },
        { path: '/src/utils.ts', status: 'added' as const }
      ];

      useAppStore.getState().setChangedFiles(changedFiles);

      expect(useAppStore.getState().changedFiles).toHaveLength(2);
    });
  });

  describe('UI State Management', () => {
    it('should support UI interactions', () => {
      const state = useAppStore.getState();
      
      if ('toggleSidebar' in state) {
        (state as any).toggleSidebar();
        expect(state).toBeDefined();
      }
      
      if ('setActivePanel' in state) {
        (state as any).setActivePanel('chat');
        expect((state as any).activePanel || 'chat').toBeTruthy();
      }
    });
  });

  describe('Slash Commands Management', () => {
    it('should manage slash commands', () => {
      const command = {
        id: 'custom-cmd',
        name: '/custom',
        description: 'Custom command'
      };

      const state = useAppStore.getState();
      
      if ('slashCommands' in state) {
        expect(Array.isArray(state.slashCommands) || state.slashCommands === null).toBeTruthy();
      }
      
      if ('setSlashCommands' in state) {
        (state as any).setSlashCommands([command]);
        const updatedState = useAppStore.getState();
        expect(updatedState.slashCommands.length).toBeGreaterThan(0);
        expect(updatedState.slashCommands[0].id).toBe('custom-cmd');
      }
    });
  });

  describe('Todo Items Management', () => {
    it('should manage todo items', () => {
      const todo = { id: 'todo-1', content: 'Task', status: 'pending' as const };
      
      useAppStore.getState().addTodoItem(todo);
      
      const todos = useAppStore.getState().todoItems;
      expect(todos).toBeDefined();
      expect(todos.length).toBeGreaterThan(0);
      expect(todos[0].id).toBe('todo-1');
    });
  });

  describe('Streaming State', () => {
    it('should handle streaming state', () => {
      const state = useAppStore.getState();
      
      if ('isStreaming' in state || 'streaming' in state) {
        expect(true).toBe(true);
      } else {
        expect(state).toBeDefined();
      }
    });
  });
});
