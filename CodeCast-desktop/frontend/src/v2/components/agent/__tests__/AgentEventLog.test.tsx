// frontend/src/v2/components/agent/__tests__/AgentEventLog.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store';
import { AgentEventLog } from '../AgentEventLog';

beforeEach(() => {
  useAppStore.setState({
    agentEventLog: [],
    errors: {},
  });
});

describe('<AgentEventLog />', () => {
  it('renders an empty state when log is empty', () => {
    render(<AgentEventLog />);
    expect(screen.getByText('暂无事件')).toBeInTheDocument();
  });

  it('renders log entries with type, agent id and tool name', () => {
    useAppStore.setState({
      agentEventLog: [
        { _type: 'agent:start', _ts: Date.now(), agentID: 'agent-abc' },
        { _type: 'agent:turn', _ts: Date.now(), agentID: 'agent-abc', turn: 1 },
        { _type: 'agent:tool', _ts: Date.now(), agentID: 'agent-abc', toolName: 'search' },
        { _type: 'agent:error', _ts: Date.now(), agentID: 'agent-abc', error: 'boom' },
      ],
    });
    render(<AgentEventLog />);
    // agentID is rendered as "· <id.slice(0, 6)>" — match a regex.
    expect(screen.getAllByText(/agent-/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('clear button empties the log', () => {
    useAppStore.setState({
      agentEventLog: [{ _type: 'agent:start', _ts: Date.now() }],
    });
    render(<AgentEventLog />);
    fireEvent.click(screen.getByText('清空'));
    expect(useAppStore.getState().agentEventLog).toHaveLength(0);
  });
});
