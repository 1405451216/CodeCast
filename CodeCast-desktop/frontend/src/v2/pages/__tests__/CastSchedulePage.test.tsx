import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastSchedulePage } from '../CastSchedulePage';
import { useAppStore } from '../../store';

vi.mock('../components/orchestration/OrchestrationRunner', () => ({
  OrchestrationRunner: () => <div data-testid="orchestration-runner" />,
}));

beforeEach(() => {
  useAppStore.setState({
    loadCastTools: vi.fn(),
    castToolByCategory: {
      schedule: [
        { name: 'add-task', category: 'schedule', description: 'Add a task' },
        { name: 'list-tasks', category: 'schedule', description: 'List all tasks' },
      ],
    },
    castToolLoading: false,
    invokeCastTool: vi.fn(async () => '{"tasks":[]}'),
    castToolInvoking: false,
    castToolResult: null,
    errors: {},
  } as any);
});

describe('<CastSchedulePage />', () => {
  it('renders page title', () => {
    render(<CastSchedulePage />);
    expect(screen.getByText(/日程管理/)).toBeInTheDocument();
  });

  it('renders task form fields', () => {
    render(<CastSchedulePage />);
    expect(screen.getByPlaceholderText(/任务标题/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/任务描述/)).toBeInTheDocument();
  });

  it('disables add button when title is empty', () => {
    render(<CastSchedulePage />);
    const addBtn = screen.getByText('添加任务').closest('button');
    expect(addBtn?.disabled).toBe(true);
  });

  it('enables add button when title is filled', () => {
    render(<CastSchedulePage />);
    const titleInput = screen.getByPlaceholderText(/任务标题/);
    fireEvent.change(titleInput, { target: { value: '新任务' } });
    const addBtn = screen.getByText('添加任务').closest('button');
    expect(addBtn?.disabled).toBe(false);
  });

  it('calls invokeCastTool on add button click', async () => {
    render(<CastSchedulePage />);
    const titleInput = screen.getByPlaceholderText(/任务标题/);
    fireEvent.change(titleInput, { target: { value: '写测试' } });
    fireEvent.click(screen.getByText('添加任务'));
    await new Promise((r) => setTimeout(r, 50));
    const state = useAppStore.getState() as any;
    expect(state.invokeCastTool).toHaveBeenCalled();
  });

  it('shows error on add failure', async () => {
    useAppStore.setState({
      invokeCastTool: vi.fn(async () => { throw new Error('add failed'); }),
    } as any);
    render(<CastSchedulePage />);
    const titleInput = screen.getByPlaceholderText(/任务标题/);
    fireEvent.change(titleInput, { target: { value: '失败任务' } });
    fireEvent.click(screen.getByText('添加任务'));
    await new Promise((r) => setTimeout(r, 100));
    // Component renders error as "添加失败: <message>"
    expect(screen.getByText(/添加失败.*add failed/)).toBeInTheDocument();
  });
});
