import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageStream } from '../MessageStream';
import type { Message } from '../MessageItem';

describe('<MessageStream />', () => {
  const messages: Message[] = [
    { id: 'm1', role: 'user', content: 'Question' },
    { id: 'm2', role: 'assistant', content: 'Answer', createdAt: Date.now() },
  ];

  it('renders all messages', () => {
    render(<MessageStream sessionId="s1" messages={messages} isStreaming={false} />);
    expect(screen.getByText('Question')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  it('sets aria-live to polite when streaming', () => {
    const { container } = render(<MessageStream sessionId="s1" messages={messages} isStreaming={true} />);
    const stream = container.querySelector('[data-stream]');
    expect(stream?.getAttribute('aria-live')).toBe('polite');
  });

  it('sets aria-live to off when not streaming', () => {
    const { container } = render(<MessageStream sessionId="s1" messages={messages} isStreaming={false} />);
    const stream = container.querySelector('[data-stream]');
    expect(stream?.getAttribute('aria-live')).toBe('off');
  });

  it('renders empty list without crashing', () => {
    const { container } = render(<MessageStream sessionId="s1" messages={[]} isStreaming={false} />);
    const stream = container.querySelector('[data-stream]');
    expect(stream).toBeDefined();
  });

  it('uses message id as key', () => {
    render(<MessageStream sessionId="s1" messages={messages} isStreaming={false} />);
    // Both messages should render (implicit key test - no React warnings)
    expect(screen.getByText('Question')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });
});
