// frontend/src/v2/components/agent/__tests__/CheckpointApproval.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../../store';
import { CheckpointApproval } from '../CheckpointApproval';

const CP = {
  ID: 'cp-1',
  SessionID: 's1',
  Turn: 3,
  Status: 'pending',
  ToolName: 'shell',
  CreatedAt: '',
  reason: 'shell command requires approval',
};

beforeEach(() => {
  vi.mocked(App.ResolveCheckpoint).mockReset();
  useAppStore.setState({
    pending: CP,
    checkpoints: [],
    errors: {},
  });
});

describe('<CheckpointApproval />', () => {
  it('renders tool name, turn and reason', () => {
    render(<CheckpointApproval checkpoint={CP} />);
    expect(screen.getByText('shell')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText(/shell command requires approval/)).toBeInTheDocument();
  });

  it('clicking 继续 calls ResolveCheckpoint(approved=true)', async () => {
    vi.mocked(App.ResolveCheckpoint).mockResolvedValueOnce(undefined);
    render(<CheckpointApproval checkpoint={CP} />);
    fireEvent.click(screen.getByText('继续'));
    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(App.ResolveCheckpoint).toHaveBeenCalledWith('cp-1', true);
    expect(useAppStore.getState().pending).toBeNull();
  });

  it('clicking 拒绝 calls ResolveCheckpoint(approved=false)', async () => {
    vi.mocked(App.ResolveCheckpoint).mockResolvedValueOnce(undefined);
    render(<CheckpointApproval checkpoint={CP} />);
    fireEvent.click(screen.getByText('拒绝'));
    await new Promise((r) => setTimeout(r, 0));
    expect(App.ResolveCheckpoint).toHaveBeenCalledWith('cp-1', false);
  });
});
