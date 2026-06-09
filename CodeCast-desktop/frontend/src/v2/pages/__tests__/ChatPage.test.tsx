import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatPage } from '../ChatPage';

/* Mock child components to isolate ChatPage logic */
vi.mock('../../components/message/MessageStream', () => ({
  MessageStream: ({ messages, isStreaming }: any) => (
    <div data-testid="message-stream" data-streaming={isStreaming}>
      {messages.map((m: any) => (
        <div key={m.id} data-testid={`msg-${m.id}`}>
          {m.role}: {m.content} {m.isStreaming ? '(streaming)' : ''}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../components/composer/Composer', () => ({
  Composer: ({ model, thinking }: any) => (
    <div data-testid="composer" data-model={model} data-thinking={thinking} />
  ),
}));

vi.mock('../../layout/ChatArea', () => ({
  ChatArea: ({ children }: any) => <div data-testid="chat-area">{children}</div>,
}));

describe('<ChatPage />', () => {
  const defaultProps = {
    sessionId: 'sess-1',
    messages: [] as any[],
    isStreaming: false,
    model: 'GPT-4',
    thinking: true,
    onSend: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders ChatArea, MessageStream, and Composer', () => {
    render(<ChatPage {...defaultProps} />);
    expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    expect(screen.getByTestId('message-stream')).toBeInTheDocument();
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('passes model and thinking to Composer', () => {
    render(<ChatPage {...defaultProps} model="Claude-3" thinking={false} />);
    const composer = screen.getByTestId('composer');
    expect(composer.getAttribute('data-model')).toBe('Claude-3');
    expect(composer.getAttribute('data-thinking')).toBe('false');
  });

  it('maps backend messages to UI messages', () => {
    const messages = [
      { role: 'user', content: 'Hello', tool_calls: [] },
      { role: 'assistant', content: 'Hi there', tool_calls: [] },
    ] as any[];
    render(<ChatPage {...defaultProps} messages={messages} />);
    expect(screen.getByTestId('msg-msg-0')).toBeInTheDocument();
    expect(screen.getByTestId('msg-msg-1')).toBeInTheDocument();
  });

  it('marks last assistant message as streaming when isStreaming is true', () => {
    const messages = [
      { role: 'user', content: 'Q', tool_calls: [] },
      { role: 'assistant', content: 'A', tool_calls: [] },
    ] as any[];
    render(<ChatPage {...defaultProps} messages={messages} isStreaming={true} />);
    const lastMsg = screen.getByTestId('msg-msg-1');
    expect(lastMsg.textContent).toContain('(streaming)');
  });

  it('does not mark user message as streaming', () => {
    const messages = [
      { role: 'user', content: 'Q', tool_calls: [] },
    ] as any[];
    render(<ChatPage {...defaultProps} messages={messages} isStreaming={true} />);
    const userMsg = screen.getByTestId('msg-msg-0');
    expect(userMsg.textContent).not.toContain('(streaming)');
  });

  it('does not mark any message as streaming when isStreaming is false', () => {
    const messages = [
      { role: 'user', content: 'Q', tool_calls: [] },
      { role: 'assistant', content: 'A', tool_calls: [] },
    ] as any[];
    render(<ChatPage {...defaultProps} messages={messages} isStreaming={false} />);
    expect(screen.getByTestId('msg-msg-1').textContent).not.toContain('(streaming)');
  });

  it('passes isStreaming to MessageStream', () => {
    render(<ChatPage {...defaultProps} isStreaming={true} />);
    const stream = screen.getByTestId('message-stream');
    expect(stream.getAttribute('data-streaming')).toBe('true');
  });

  it('maps tool_calls from backend messages', () => {
    const messages = [
      { role: 'assistant', content: 'Using tool', tool_calls: [{ id: 'tc1', name: 'bash', args: '{}' }] },
    ] as any[];
    render(<ChatPage {...defaultProps} messages={messages} />);
    expect(screen.getByTestId('msg-msg-0')).toBeInTheDocument();
  });
});
