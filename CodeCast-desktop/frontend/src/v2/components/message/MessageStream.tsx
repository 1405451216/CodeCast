import { MessageItem, type Message } from './MessageItem';
interface Props {
  sessionId: string;
  messages: Message[];
  isStreaming: boolean;
  onCopy?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onRegenerate?: () => void;
  onPreview?: () => void;
  onDiff?: () => void;
  onTerminal?: () => void;
  searchQuery?: string;
  highlightMatchIdx?: number;
}
export function MessageStream({ messages, isStreaming, onCopy, onEdit, onDelete, onRegenerate, onPreview, onDiff, onTerminal, searchQuery, highlightMatchIdx }: Props) {
  return <div data-stream aria-live={isStreaming ? 'polite' : 'off'} style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px', overflow: 'auto', flex: 1 }}>
    {messages.map((m, i) => {
      const isMatch = searchQuery && m.content.toLowerCase().includes(searchQuery.toLowerCase());
      const isHighlight = highlightMatchIdx === i;
      return (
        <div key={m.id ?? i} data-msg-idx={i} style={isMatch ? { background: isHighlight ? 'rgba(255,200,0,0.12)' : 'rgba(255,200,0,0.06)', borderRadius: 6, transition: 'background 0.2s ease' } : undefined}>
          <MessageItem
            message={m}
            onCopy={() => onCopy?.(m)}
            onEdit={m.role === 'user' ? () => onEdit?.(m) : undefined}
            onDelete={() => onDelete?.(m)}
            onRegenerate={i === messages.length - 1 && m.role === 'assistant' ? onRegenerate : undefined}
            onPreview={onPreview}
            onDiff={onDiff}
            onTerminal={onTerminal}
          />
        </div>
      );
    })}
  </div>;
}
