import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GitPanel } from '../GitPanel';
import { useAppStore } from '../../../store';

vi.mock('../../../lib/useError', () => ({
  useError: vi.fn(() => undefined),
}));

beforeEach(() => {
  useAppStore.setState({
    status: null,
    gitLoading: false,
    refreshGit: vi.fn(),
    errors: {},
  } as any);
});

describe('<GitPanel />', () => {
  it('shows loading indicator when gitLoading is true', () => {
    useAppStore.setState({ gitLoading: true } as any);
    render(<GitPanel />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows refresh button when no status', () => {
    render(<GitPanel />);
    expect(screen.getByText('Git Status')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('calls refreshGit on Refresh button click', () => {
    const refreshGit = vi.fn();
    useAppStore.setState({ refreshGit } as any);
    render(<GitPanel />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(refreshGit).toHaveBeenCalled();
  });

  it('displays branch info when status is present', () => {
    useAppStore.setState({
      status: { branch: 'main', ahead: 2, behind: 0, dirty: false, enabled: true },
    } as any);
    render(<GitPanel />);
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText(/Ahead: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Behind: 0/)).toBeInTheDocument();
  });

  it('shows Clean when not dirty', () => {
    useAppStore.setState({
      status: { branch: 'dev', ahead: 0, behind: 1, dirty: false, enabled: true },
    } as any);
    render(<GitPanel />);
    expect(screen.getByText('Clean')).toBeInTheDocument();
  });

  it('shows Yes when dirty', () => {
    useAppStore.setState({
      status: { branch: 'feature', ahead: 1, behind: 3, dirty: true, enabled: true },
    } as any);
    render(<GitPanel />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('shows Enabled: No when disabled', () => {
    useAppStore.setState({
      status: { branch: 'main', ahead: 0, behind: 0, dirty: false, enabled: false },
    } as any);
    render(<GitPanel />);
    expect(screen.getByText(/Enabled: No/)).toBeInTheDocument();
  });
});
