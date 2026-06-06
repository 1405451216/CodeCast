import { useMemo } from 'react';
import { MessageStream } from '../components/message/MessageStream';
import { Composer } from '../components/composer/Composer';
import { ChatArea } from '../layout/ChatArea';
import type { Message } from '../components/message/MessageItem';
import type { Message as BackendMessage } from '../wails/types';

interface Props {
  sessionId: string;
  messages: BackendMessage[];
  isStreaming: boolean;
  model: string;
  thinking: boolean;
  onSend: (text: string, opts?: any) => void;
  onCancel: () => void;
}

/**
 * Map backend Message → UI Message.
 *  - Generates a stable id from index for React keys
 *  - Marks the last assistant message as streaming when applicable
 *  - Maps tool_calls (snake_case) → toolCalls (camelCase)
 */
function toUIMessages(raw: BackendMessage[], isStreaming: boolean): Message[] {
  return raw.map((m, i) => {
    const isLast = i === raw.length - 1;
    return {
      id: `msg-${i}`,
      role: m.role,
      content: m.content,
      reasoning: m.reasoning,
      toolCalls: m.tool_calls,
      isStreaming: isStreaming && isLast && m.role === 'assistant',
      createdAt: undefined,
    };
  });
}

export function ChatPage({ sessionId, messages, isStreaming, model, thinking, onSend, onCancel }: Props) {
  const uiMessages = useMemo(() => toUIMessages(messages, isStreaming), [messages, isStreaming]);

  return (
    <ChatArea>
      <MessageStream sessionId={sessionId} messages={uiMessages} isStreaming={isStreaming} />
      <Composer sessionId={sessionId} model={model} thinking={thinking} onSend={onSend} onCancel={onCancel} />
    </ChatArea>
  );
}
