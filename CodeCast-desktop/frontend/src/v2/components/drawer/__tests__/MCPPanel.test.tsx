import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MCPPanel } from '../MCPPanel';
import { useAppStore } from '../../../store';

vi.mock('../../../lib/useError', () => ({
  useError: vi.fn(() => undefined),
}));

beforeEach(() => {
  useAppStore.setState({
    servers: [],
    mcpLoading: false,
    refreshMCP: vi.fn(),
    toggle: vi.fn(),
    errors: {},
  } as any);
});

describe('<MCPPanel />', () => {
  it('renders header', () => {
    render(<MCPPanel />);
    expect(screen.getByText(/MCP Servers/)).toBeInTheDocument();
  });

  it('shows loading indicator when loading', () => {
    useAppStore.setState({ mcpLoading: true } as any);
    render(<MCPPanel />);
    expect(screen.getByText(/loading…/)).toBeInTheDocument();
  });

  it('shows no servers message and refresh button when empty', () => {
    render(<MCPPanel />);
    expect(screen.getByText('No servers detected')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('calls refreshMCP on Refresh click', () => {
    const refreshMCP = vi.fn();
    useAppStore.setState({ refreshMCP } as any);
    render(<MCPPanel />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(refreshMCP).toHaveBeenCalled();
  });

  it('renders server list', () => {
    useAppStore.setState({
      servers: [
        { id: 's1', name: 'server-alpha', connected: true, error: null },
        { id: 's2', name: 'server-beta', connected: false, error: null },
      ],
    } as any);
    render(<MCPPanel />);
    expect(screen.getByText('server-alpha')).toBeInTheDocument();
    expect(screen.getByText('server-beta')).toBeInTheDocument();
  });

  it('shows Connect button for disconnected servers', () => {
    useAppStore.setState({
      servers: [{ id: 's1', name: 'srv', connected: false, error: null }],
    } as any);
    render(<MCPPanel />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('shows Disconnect button for connected servers', () => {
    useAppStore.setState({
      servers: [{ id: 's1', name: 'srv', connected: true, error: null }],
    } as any);
    render(<MCPPanel />);
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('calls toggle on Connect click', () => {
    const toggle = vi.fn();
    useAppStore.setState({
      servers: [{ id: 's1', name: 'srv', connected: false, error: null }],
      toggle,
    } as any);
    render(<MCPPanel />);
    fireEvent.click(screen.getByText('Connect'));
    expect(toggle).toHaveBeenCalledWith('s1', true);
  });

  it('calls toggle on Disconnect click', () => {
    const toggle = vi.fn();
    useAppStore.setState({
      servers: [{ id: 's1', name: 'srv', connected: true, error: null }],
      toggle,
    } as any);
    render(<MCPPanel />);
    fireEvent.click(screen.getByText('Disconnect'));
    expect(toggle).toHaveBeenCalledWith('s1', false);
  });

  it('displays server errors', () => {
    useAppStore.setState({
      servers: [{ id: 's1', name: 'bad-server', connected: false, error: 'connection refused' }],
    } as any);
    render(<MCPPanel />);
    expect(screen.getByText(/bad-server: connection refused/)).toBeInTheDocument();
  });
});
