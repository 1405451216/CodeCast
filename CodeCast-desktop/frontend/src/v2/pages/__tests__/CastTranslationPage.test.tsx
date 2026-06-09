import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastTranslationPage } from '../CastTranslationPage';
import { useAppStore } from '../../store';

vi.mock('../../lib/useFirstTool', () => ({
  useFirstTool: vi.fn(() => ({
    load: vi.fn(),
    tool: { name: 'mock-translate-tool', category: 'translation' },
    available: true,
    loading: false,
    tools: [{ name: 'mock-translate-tool', category: 'translation' }],
  })),
}));

beforeEach(() => {
  useAppStore.setState({
    invokeCastTool: vi.fn(async () => 'Hello World'),
    errors: {},
  } as any);
});

describe('<CastTranslationPage />', () => {
  it('renders title and direction toggle', () => {
    render(<CastTranslationPage />);
    expect(screen.getByText('中英互译')).toBeInTheDocument();
    expect(screen.getByText('中 → 英')).toBeInTheDocument();
  });

  it('shows tool count', () => {
    render(<CastTranslationPage />);
    expect(screen.getByText(/已加载 1 个翻译工具/)).toBeInTheDocument();
  });

  it('renders source and target textareas', () => {
    render(<CastTranslationPage />);
    expect(screen.getByPlaceholderText('输入中文内容…')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('翻译结果将显示在这里')).toBeInTheDocument();
  });

  it('toggles translation direction', () => {
    render(<CastTranslationPage />);
    const toggleBtn = screen.getByText('中 → 英').closest('button')!;
    fireEvent.click(toggleBtn);
    expect(screen.getByText('英 → 中')).toBeInTheDocument();
  });

  it('disables translate button when source is empty', () => {
    render(<CastTranslationPage />);
    const btn = screen.getByText('翻译').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('enables translate button when source has content', () => {
    render(<CastTranslationPage />);
    const sourceTextarea = screen.getByPlaceholderText('输入中文内容…');
    fireEvent.change(sourceTextarea, { target: { value: '你好世界' } });
    const btn = screen.getByText('翻译').closest('button');
    expect(btn?.disabled).toBe(false);
  });

  it('calls invokeCastTool on translate click', async () => {
    render(<CastTranslationPage />);
    const sourceTextarea = screen.getByPlaceholderText('输入中文内容…');
    fireEvent.change(sourceTextarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('翻译'));
    await new Promise((r) => setTimeout(r, 50));
    const state = useAppStore.getState() as any;
    expect(state.invokeCastTool).toHaveBeenCalledWith(
      'mock-translate-tool',
      expect.stringContaining('"direction":"zh2en"'),
    );
  });

  it('shows error on translate failure', async () => {
    useAppStore.setState({
      invokeCastTool: vi.fn(async () => { throw new Error('API timeout'); }),
    } as any);
    render(<CastTranslationPage />);
    const sourceTextarea = screen.getByPlaceholderText('输入中文内容…');
    fireEvent.change(sourceTextarea, { target: { value: '测试' } });
    fireEvent.click(screen.getByText('翻译'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('API timeout')).toBeInTheDocument();
  });

  it('shows result after successful translation', async () => {
    render(<CastTranslationPage />);
    const sourceTextarea = screen.getByPlaceholderText('输入中文内容…');
    fireEvent.change(sourceTextarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('翻译'));
    await new Promise((r) => setTimeout(r, 50));
    const targetTextarea = screen.getByPlaceholderText('翻译结果将显示在这里') as HTMLTextAreaElement;
    expect(targetTextarea.value).toBe('Hello World');
  });
});
