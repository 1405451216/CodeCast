import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastEmptyState } from '../CastEmptyState';

/* Mock ToastProvider context so useError does not crash */
vi.mock('../../components/primitives/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

describe('<CastEmptyState />', () => {
  it('renders headline and subtitle', () => {
    render(<CastEmptyState />);
    expect(screen.getByText(/先把清单上的一件事做完/)).toBeInTheDocument();
    expect(screen.getByText(/了解如何安全使用 Cowork/)).toBeInTheDocument();
  });

  it('renders textarea with placeholder', () => {
    render(<CastEmptyState />);
    expect(screen.getByPlaceholderText('今天我能为你提供什么帮助吗？')).toBeInTheDocument();
  });

  it('renders send button with aria-label', () => {
    render(<CastEmptyState />);
    expect(screen.getByLabelText('发送')).toBeInTheDocument();
  });

  it('renders attachment button', () => {
    render(<CastEmptyState />);
    expect(screen.getAllByTitle('即将推出').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSend when send button clicked with text', () => {
    const onSend = vi.fn();
    render(<CastEmptyState onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('今天我能为你提供什么帮助吗？');
    fireEvent.change(textarea, { target: { value: '帮我写代码' } });
    fireEvent.click(screen.getByLabelText('发送'));
    expect(onSend).toHaveBeenCalledWith('帮我写代码');
  });

  it('does not call onSend when text is empty', () => {
    const onSend = vi.fn();
    render(<CastEmptyState onSend={onSend} />);
    fireEvent.click(screen.getByLabelText('发送'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onSend on Enter key', () => {
    const onSend = vi.fn();
    render(<CastEmptyState onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('今天我能为你提供什么帮助吗？');
    fireEvent.change(textarea, { target: { value: '测试输入' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('测试输入');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<CastEmptyState onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('今天我能为你提供什么帮助吗？');
    fireEvent.change(textarea, { target: { value: '测试' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears text after sending', () => {
    const onSend = vi.fn();
    render(<CastEmptyState onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('今天我能为你提供什么帮助吗？') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '发送后清空' } });
    fireEvent.click(screen.getByLabelText('发送'));
    expect(textarea.value).toBe('');
  });

  it('shows model name', () => {
    render(<CastEmptyState model="GPT-4o" />);
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
  });

  it('shows default model when none provided', () => {
    render(<CastEmptyState />);
    expect(screen.getByText('MiniMax-M3')).toBeInTheDocument();
  });

  it('shows thinking label when thinking is true', () => {
    render(<CastEmptyState thinking />);
    expect(screen.getByText(/思考/)).toBeInTheDocument();
  });

  it('shows 1M label when thinking is false', () => {
    render(<CastEmptyState thinking={false} />);
    expect(screen.getByText(/1M/)).toBeInTheDocument();
  });

  it('renders project workspace button', () => {
    render(<CastEmptyState />);
    expect(screen.getByText('项目工作区')).toBeInTheDocument();
  });
});
