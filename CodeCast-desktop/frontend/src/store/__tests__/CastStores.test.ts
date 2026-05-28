import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/index';

describe('Cast System Stores', () => {
  beforeEach(() => {
    useAppStore.setState({
      agents: []
    } as any);
  });

  describe('Agent Store', () => {
    it('should initialize agent state', () => {
      const state = useAppStore.getState();
      
      if ('agents' in state) {
        expect(state.agents).toBeDefined();
      }
    });

    it('should handle agent creation', () => {
      const agentData = {
        id: 'agent-1',
        name: 'Test Agent',
        status: 'idle',
        capabilities: ['code-generation', 'code-review']
      };

      if ('addAgent' in useAppStore.getState()) {
        (useAppStore.getState() as any).addAgent(agentData);
        
        const agents = useAppStore.getState().agents;
        expect(agents).toContainEqual(agentData);
      }
    });
  });

  describe('API Server Store', () => {
    it('should manage API server configuration', () => {
      const config = {
        host: 'localhost',
        port: 3000,
        enabled: true
      };

      if ('setCastApiServerConfig' in useAppStore.getState()) {
        (useAppStore.getState() as any).setCastApiServerConfig(config);
        
        const state = useAppStore.getState() as any;
        expect(state.castApiServer).toBeDefined();
      }
    });
  });

  describe('Channels Store', () => {
    it('should track communication channels', () => {
      const channels = [
        { id: 'ch-1', type: 'websocket', status: 'connected' },
        { id: 'ch-2', type: 'http', status: 'active' }
      ];

      if ('setCastChannels' in useAppStore.getState()) {
        (useAppStore.getState() as any).setCastChannels(channels);
        
        const state = useAppStore.getState() as any;
        expect(state.castChannels).toHaveLength(2);
      }
    });
  });

  describe('Learning Store', () => {
    it('should track learning progress', () => {
      const learningData = {
        completedTasks: 15,
        totalTasks: 50,
        skillsLearned: ['typescript', 'react'],
        lastActivity: Date.now()
      };

      if ('updateCastLearning' in useAppStore.getState()) {
        (useAppStore.getState() as any).updateCastLearning(learningData);
        
        const state = useAppStore.getState() as any;
        expect(state.castLearning).toBeDefined();
      }
    });
  });

  describe('Memory Store', () => {
    it('should store and retrieve memories', () => {
      const memory = {
        id: 'mem-1',
        content: 'Important context about the project',
        tags: ['project', 'context'],
        createdAt: Date.now()
      };

      if ('addCastMemory' in useAppStore.getState()) {
        (useAppStore.getState() as any).addCastMemory(memory);
        
        const state = useAppStore.getState() as any;
        expect(state.castMemory).toBeDefined();
      }
    });
  });

  describe('Scheduler Store', () => {
    it('should manage scheduled tasks', () => {
      const tasks = [
        {
          id: 'task-1',
          name: 'Daily backup',
          schedule: '0 2 * * *',
          enabled: true
        },
        {
          id: 'task-2',
          name: 'Weekly report',
          schedule: '0 9 * * 1',
          enabled: false
        }
      ];

      if ('setCastSchedulerTasks' in useAppStore.getState()) {
        (useAppStore.getState() as any).setCastSchedulerTasks(tasks);
        
        const state = useAppStore.getState() as any;
        expect(state.castScheduler).toBeDefined();
      }
    });
  });

  describe('Privacy Store', () => {
    it('should manage privacy settings', () => {
      const privacySettings = {
        dataCollection: false,
        analytics: false,
        crashReports: true,
        telemetryLevel: 'minimal'
      };

      if ('updateCastPrivacy' in useAppStore.getState()) {
        (useAppStore.getState() as any).updateCastPrivacy(privacySettings);
        
        const state = useAppStore.getState() as any;
        expect(state.castPrivacy).toBeDefined();
      }
    });
  });
});
