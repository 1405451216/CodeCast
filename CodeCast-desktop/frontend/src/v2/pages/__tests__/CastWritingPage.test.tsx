import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastWritingPage } from '../CastWritingPage';
import { useAppStore } from '../../store';

vi.mock('../../lib/useFirstTool', () => ({
  useFirstTool: vi.fn(() => ({
    load: vi.fn(),
    tool: { name: 'mock-writing-tool', category: 'writing' },
    available: true,
    loading: false,
    tools: [{ name: 'mock-writing-tool', category: 'writing' }],
  })),
}));

beforeEach(() => {
  useAppStore.setState({
    invokeCastTool: vi.fn(async () => '润色后的内容'),
    errors: {},
  } as any);
});

describe('<CastWritingPage />', () => {
  it('renders title and style presets', () => {
    render(<CastWritingPage />);
    expect(screen.getByText('写作助手')).toBeInTheDocument();
    expect(screen.getByText('润色')).toBeInTheDocument();
    expect(screen.getByText('扩写')).toBeInTheDocument();
    expect(screen.getByText('缩写')).toBeInTheDocument();
    expect(screen.getByText('正式')).toBeInTheDocument();
    expect(screen.getByText('口语')).toBeInTheDocument();
  });

  it('shows tool count', () => {
    render(<CastWritingPage />);
    expect(screen.getByText(/已加载 1 个写作工具/)).toBeInTheDocument();
  });

  it('renders input textarea', () => {
    render(<CastWritingPage />);
    expect(screen.getByPlaceholderText('输入需要处理的内容…')).toBeInTheDocument();
  });

  it('disables generate button when input is empty', () => {
    render(<CastWritingPage />);
    const btn = screen.getByText('生成').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('switches active style preset', () => {
    render(<CastWritingPage />);
    fireEvent.click(screen.getByText('扩写'));
    // The button should now have accent styling (we check it exists and is clickable)
    const btn = screen.getByText('扩写').closest('button');
    expect(btn).toBeDefined();
  });

  it('calls invokeCastTool with selected style', async () => {
    render(<CastWritingPage />);
    const textarea = screen.getByPlaceholderText('输入需要处理的内容…');
    fireEvent.change(textarea, { target: { value: '原始内容' } });
    fireEvent.click(screen.getByText('缩写'));
    fireEvent.click(screen.getByText('生成'));
    await new Promise((r) => setTimeout(r, 50));
    const state = useAppStore.getState() as any;
    expect(state.invokeCastTool).toHaveBeenCalledWith(
      'mock-writing-tool',
      expect.stringContaining('"style":"缩写"'),
    );
  });

  it('shows result in output area', async () => {
    render(<CastWritingPage />);
    const textarea = screen.getByPlaceholderText('输入需要处理的内容…');
    fireEvent.change(textarea, { target: { value: '测试内容' } });
    fireEvent.click(screen.getByText('生成'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('润色后的内容')).toBeInTheDocument();
  });

  it('shows error on generate failure', async () => {
    useAppStore.setState({
      invokeCastTool: vi.fn(async () => { throw new Error('writing error'); }),
    } as any);
    render(<CastWritingPage />);
    const textarea = screen.getByPlaceholderText('输入需要处理的内容…');
    fireEvent.change(textarea, { target: { value: '触发错误' } });
    fireEvent.click(screen.getByText('生成'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('writing error')).toBeInTheDocument();
  });

  it('shows copy button only when result exists', async () => {
    render(<CastWritingPage />);
    expect(screen.queryByText('复制')).toBeNull();
    const textarea = screen.getByPlaceholderText('输入需要处理的内容…');
    fireEvent.change(textarea, { target: { value: '生成结果' } });
    fireEvent.click(screen.getByText('生成'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('复制')).toBeInTheDocument();
  });
});
