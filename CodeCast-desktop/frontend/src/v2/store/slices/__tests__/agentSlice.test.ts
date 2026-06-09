// frontend/src/v2/store/slices/__tests__/agentSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('agentSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetAgents).mockReset();
    vi.mocked(App.GetAgentDetail).mockReset();
    vi.mocked(App.CancelAgent).mockReset();
    vi.mocked(App.CancelSessionAgents).mockReset();
    vi.mocked(App.DispatchAgents).mockReset();
    useAppStore.setState({ agents: [], agentLoading: false, agentEventLog: [], errors: {} });
  });

  it('refreshAgents: success sets agents', async () => {
    vi.mocked(App.GetAgents).mockResolvedValueOnce([
      { id: 'a1', sessionId: 's1', title: 'Agent 1', status: 'running', turn: 1, maxTurns: 10, createdAt: '', updatedAt: '' },
    ] as any);
    await useAppStore.getState().refreshAgents('s1');
    expect(useAppStore.getState().agents).toHaveLength(1);
    expect(useAppStore.getState().agents[0].id).toBe('a1');
  });

  it('refreshAgents: failure sets agent error', async () => {
    vi.mocked(App.GetAgents).mockRejectedValueOnce(new Error('fail'));
    await useAppStore.getState().refreshAgents('s1');
    expect(useAppStore.getState().errors.agent).toBe('fail');
  });

  it('cancelAgent: calls App.CancelAgent with correct arg', async () => {
    await useAppStore.getState().cancelAgent('a1');
    expect(App.CancelAgent).toHaveBeenCalledWith('a1');
  });

  it('dispatchAgents: calls App.DispatchAgents and returns ids', async () => {
    vi.mocked(App.DispatchAgents).mockResolvedValueOnce(['id1', 'id2']);
    const ids = await useAppStore.getState().dispatchAgents('[{"task":"t1"}]');
    expect(App.DispatchAgents).toHaveBeenCalledWith('[{"task":"t1"}]');
    expect(ids).toEqual(['id1', 'id2']);
  });

  it('appendAgentEvent: appends to agentEventLog', () => {
    useAppStore.getState().appendAgentEvent({ _type: 'agent:start', _ts: 1 });
    expect(useAppStore.getState().agentEventLog).toHaveLength(1);
    useAppStore.getState().appendAgentEvent({ _type: 'agent:stop', _ts: 2 });
    expect(useAppStore.getState().agentEventLog).toHaveLength(2);
  });

  it('appendAgentEvent: LRU drops oldest beyond capacity (200)', () => {
    // Seed with 200 entries.
    for (let i = 0; i < 200; i++) {
      useAppStore.getState().appendAgentEvent({ _type: 'agent:turn', _ts: i });
    }
    expect(useAppStore.getState().agentEventLog).toHaveLength(200);

    // Push 50 more — total 250, expect 50 dropped, 200 retained, last entry is _ts:249.
    for (let i = 200; i < 250; i++) {
      useAppStore.getState().appendAgentEvent({ _type: 'agent:turn', _ts: i });
    }
    const log = useAppStore.getState().agentEventLog;
    expect(log).toHaveLength(200);
    expect(log[0]._ts).toBe(50); // oldest kept
    expect(log[199]._ts).toBe(249); // newest
  });

  it('clearAgentEventLog: empties the log', () => {
    useAppStore.getState().appendAgentEvent({ _type: 'agent:start', _ts: 1 });
    useAppStore.getState().clearAgentEventLog();
    expect(useAppStore.getState().agentEventLog).toHaveLength(0);
  });
});
