import { MessageItem, type Message } from './MessageItem';
interface Props { sessionId: string; messages: Message[]; isStreaming: boolean }
export function MessageStream({ messages, isStreaming }: Props) {
  return <div data-stream aria-live={isStreaming ? 'polite' : 'off'} style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px', overflow: 'auto', flex: 1 }}>
    {messages.map((m, i) => <MessageItem key={m.id ?? i} message={m} />)}
  </div>;
}
