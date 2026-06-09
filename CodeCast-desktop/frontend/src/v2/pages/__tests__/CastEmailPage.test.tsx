import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastEmailPage } from '../CastEmailPage';
import { useAppStore } from '../../store';
import { useFirstTool } from '../../lib/useFirstTool';

/* mock useFirstTool */
vi.mock('../../lib/useFirstTool', () => ({
  useFirstTool: vi.fn(() => ({
    load: vi.fn(),
    tool: { name: 'mock-email-tool', category: 'email' },
    available: true,
    loading: false,
    tools: [{ name: 'mock-email-tool', category: 'email' }],
  })),
}));

const mockedUseFirstTool = vi.mocked(useFirstTool);

beforeEach(() => {
  // Reset to default mock
  mockedUseFirstTool.mockReturnValue({
    load: vi.fn(),
    tool: { name: 'mock-email-tool', category: 'email' } as any,
    available: true,
    loading: false,
    tools: [{ name: 'mock-email-tool', category: 'email' }] as any,
  } as any);

  useAppStore.setState({
    invokeCastTool: vi.fn(async () => '邮件内容已生成'),
    errors: {},
  } as any);
});

describe('<CastEmailPage />', () => {
  it('renders title and template chips', () => {
    render(<CastEmailPage />);
    expect(screen.getByText('邮件草稿')).toBeInTheDocument();
    expect(screen.getByText('工作汇报')).toBeInTheDocument();
    expect(screen.getByText('会议邀请')).toBeInTheDocument();
    expect(screen.getByText('感谢信')).toBeInTheDocument();
    expect(screen.getByText('询问')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<CastEmailPage />);
    expect(screen.getByPlaceholderText('example@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('邮件主题')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('在此输入邮件正文...')).toBeInTheDocument();
  });

  it('fills template on chip click', () => {
    render(<CastEmailPage />);
    fireEvent.click(screen.getByText('工作汇报'));
    const subjectInput = screen.getByPlaceholderText('邮件主题') as HTMLInputElement;
    const bodyInput = screen.getByPlaceholderText('在此输入邮件正文...') as HTMLTextAreaElement;
    expect(subjectInput.value).toContain('工作汇报');
    expect(bodyInput.value).toContain('已完成');
  });

  it('clears activeTemplate when subject is manually edited', () => {
    render(<CastEmailPage />);
    fireEvent.click(screen.getByText('感谢信'));
    const subjectInput = screen.getByPlaceholderText('邮件主题') as HTMLInputElement;
    fireEvent.change(subjectInput, { target: { value: '自定义主题' } });
    expect(subjectInput.value).toBe('自定义主题');
  });

  it('disables generate button when subject and body are empty', () => {
    render(<CastEmailPage />);
    const btn = screen.getByText('生成邮件');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('enables generate button when subject has content', () => {
    render(<CastEmailPage />);
    fireEvent.click(screen.getByText('会议邀请'));
    const btn = screen.getByText('生成邮件').closest('button');
    expect(btn?.disabled).toBe(false);
  });

  it('calls invokeCastTool on generate click', async () => {
    render(<CastEmailPage />);
    fireEvent.click(screen.getByText('感谢信'));
    fireEvent.click(screen.getByText('生成邮件'));
    await new Promise((r) => setTimeout(r, 50));
    const state = useAppStore.getState() as any;
    expect(state.invokeCastTool).toHaveBeenCalled();
  });

  it('shows error when invokeCastTool rejects', async () => {
    useAppStore.setState({
      invokeCastTool: vi.fn(async () => { throw new Error('network error'); }),
    } as any);
    render(<CastEmailPage />);
    fireEvent.click(screen.getByText('询问'));
    fireEvent.click(screen.getByText('生成邮件'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('network error')).toBeInTheDocument();
  });

  it('shows unavailable hint when no email tool', () => {
    mockedUseFirstTool.mockReturnValueOnce({
      load: vi.fn(),
      tool: null,
      available: false,
      loading: false,
      tools: [],
    } as any);
    render(<CastEmailPage />);
    expect(screen.getByText('暂无可用的邮件工具')).toBeInTheDocument();
  });
});
