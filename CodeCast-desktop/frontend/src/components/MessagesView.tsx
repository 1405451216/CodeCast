import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '../store';
import { formatContent } from '../utils';

const MessageItem: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
  const avatarText = isUser ? 'U' : 'G';
  const roleName = isUser ? '你' : 'CodeCast';

  return (
    <div className="message">
      <div className={`msg-avatar ${avatarClass}`}>{avatarText}</div>
      <div className="msg-body">
        <div className="msg-role">{roleName}</div>
        <div
          className="msg-content"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="typing-indicator">
    <span></span>
    <span></span>
    <span></span>
  </div>
);

const MessagesView: React.FC<{ messages: Message[]; isLoading: boolean }> = ({ messages, isLoading }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Auto-scroll only when user is near bottom
  useEffect(() => {
    if (!userScrolledUp && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading, userScrolledUp]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setUserScrolledUp(!isNearBottom);
  }, []);

  return (
    <div
      id="messagesView"
      ref={containerRef}
      style={{ flex: 1, overflowY: 'auto', padding: '20px' }}
      onScroll={handleScroll}
    >
      <div id="messagesList">
        {messages.length === 0 ? (
          <div className="empty-hint">还没有消息，开始输入吧</div>
        ) : (
          messages.map((m, i) => (
            <MessageItem key={`${m.role}-${i}-${m.content.slice(0, 20)}`} message={m} />
          ))
        )}
        {isLoading && <TypingIndicator />}
      </div>
    </div>
  );
};

export default MessagesView;
