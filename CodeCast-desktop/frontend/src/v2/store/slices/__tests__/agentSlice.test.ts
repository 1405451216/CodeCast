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
    useAppStore.getState().appendAgentEvent({ type: 'test' });
    expect(useAppStore.getState().agentEventLog).toHaveLength(1);
    useAppStore.getState().appendAgentEvent({ type: 'test2' });
    expect(useAppStore.getState().agentEventLog).toHaveLength(2);
  });
});
