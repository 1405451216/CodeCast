import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageItem, type Message } from '../MessageItem';

describe('<MessageItem />', () => {
  const userMsg: Message = { id: 'u1', role: 'user', content: 'Hello there' };
  const assistantMsg: Message = { id: 'a1', role: 'assistant', content: 'Hi! How can I help?', createdAt: Date.now() - 5000 };
  const streamingMsg: Message = { id: 'a2', role: 'assistant', content: 'Generating...', isStreaming: true, createdAt: Date.now() };

  it('renders user message in a bubble', () => {
    render(<MessageItem message={userMsg} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<MessageItem message={assistantMsg} />);
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
  });

  it('shows info button for assistant messages', () => {
    render(<MessageItem message={assistantMsg} />);
    expect(screen.getByLabelText('消息操作')).toBeInTheDocument();
  });

  it('does not show info button for user messages', () => {
    render(<MessageItem message={userMsg} />);
    expect(screen.queryByLabelText('消息操作')).toBeNull();
  });

  it('shows thinking indicator when streaming', () => {
    render(<MessageItem message={streamingMsg} />);
    expect(screen.getByText(/thinking…/)).toBeInTheDocument();
  });

  it('shows time in seconds for assistant messages', () => {
    render(<MessageItem message={{ ...assistantMsg, thinkingMs: 3000 }} />);
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('opens popover menu on info button click', () => {
    render(<MessageItem message={assistantMsg} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    expect(screen.getByText('预览')).toBeInTheDocument();
    expect(screen.getByText('差异')).toBeInTheDocument();
    expect(screen.getByText('终端')).toBeInTheDocument();
    expect(screen.getByText('Background tasks')).toBeInTheDocument();
    expect(screen.getByText('计划')).toBeInTheDocument();
  });

  it('calls onPreview when preview menu item is clicked', () => {
    const onPreview = vi.fn();
    render(<MessageItem message={assistantMsg} onPreview={onPreview} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    fireEvent.click(screen.getByText('预览'));
    expect(onPreview).toHaveBeenCalled();
  });

  it('calls onDiff when diff menu item is clicked', () => {
    const onDiff = vi.fn();
    render(<MessageItem message={assistantMsg} onDiff={onDiff} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    fireEvent.click(screen.getByText('差异'));
    expect(onDiff).toHaveBeenCalled();
  });

  it('calls onTerminal when terminal menu item is clicked', () => {
    const onTerminal = vi.fn();
    render(<MessageItem message={assistantMsg} onTerminal={onTerminal} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    fireEvent.click(screen.getByText('终端'));
    expect(onTerminal).toHaveBeenCalled();
  });

  it('calls onPlan when plan menu item is clicked', () => {
    const onPlan = vi.fn();
    render(<MessageItem message={assistantMsg} onPlan={onPlan} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    fireEvent.click(screen.getByText('计划'));
    expect(onPlan).toHaveBeenCalled();
  });

  it('calls onBackground when background tasks menu item is clicked', () => {
    const onBackground = vi.fn();
    render(<MessageItem message={assistantMsg} onBackground={onBackground} />);
    fireEvent.click(screen.getByLabelText('消息操作'));
    fireEvent.click(screen.getByText('Background tasks'));
    expect(onBackground).toHaveBeenCalled();
  });

  it('shows accent star for assistant messages', () => {
    render(<MessageItem message={assistantMsg} />);
    expect(screen.getByText('✱')).toBeInTheDocument();
  });
});
