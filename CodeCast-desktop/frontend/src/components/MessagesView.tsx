import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore, Message, AppState } from '../store';
import { shallow } from 'zustand/shallow';
import { formatContent } from '../utils';
import { Skeleton, SkeletonContainer } from './Skeleton';

const ReasoningBlock: React.FC<{ reasoning: string }> = ({ reasoning }) => {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning) return null;

  return (
    <div className="reasoning-block" role="region" aria-label="思考过程">
      <button
        className="reasoning-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="reasoning-icon" aria-hidden="true">💭</span>
        <span className="reasoning-label">思考过程</span>
        <span className="reasoning-toggle">{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && (
        <div className="reasoning-content" role="article">
          {reasoning}
        </div>
      )}
    </div>
  );
};

const UserIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const AIIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const formatTime = (timestamp?: number): string => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const MessageItem: React.FC<{ message: Message; index?: number }> = React.memo(({ message, index = 0 }) => {
  const isUser = message.role === 'user';
  const messageClass = `message ${isUser ? 'message-user' : 'message-ai'} stagger-${Math.min(index + 1, 10)}`;
  const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';

  return (
    <article
      className={messageClass}
      role="article"
      aria-label={`${isUser ? '你' : 'CodeCast'}的消息`}
    >
      <div className={`msg-avatar ${avatarClass}`} aria-hidden="true">
        {isUser ? <UserIcon /> : <AIIcon />}
      </div>
      <div className="msg-body">
        <header className="msg-role-row">
          <span className="msg-role">{isUser ? '你' : 'CodeCast'}</span>
          <time className="msg-time" dateTime={message.timestamp ? new Date(message.timestamp).toISOString() : undefined}>
            {formatTime(message.timestamp)}
          </time>
        </header>
        {!isUser && message.reasoning && (
          <ReasoningBlock reasoning={message.reasoning} />
        )}
        <div
          className="msg-content"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />
      </div>
    </article>
  );
});

MessageItem.displayName = 'MessageItem';

const TypingIndicator: React.FC = () => (
  <div className="typing-indicator" role="status" aria-label="正在输入">
    <span></span>
    <span></span>
    <span></span>
  </div>
);

const MessagesListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="messages-list-skeleton" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="message" animation="shimmer" />
    ))}
  </div>
);

const MessagesView: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const messages = useAppStore((s: AppState) => s.messages, shallow);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const virtualizer = useVirtualizer({
    count: messages.length + (isLoading ? 1 : 0),
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  useEffect(() => {
    if (messages.length > 0 || !isLoading) {
      const timer = setTimeout(() => setInitialLoad(false), 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (!userScrolledUp && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1 + (isLoading ? 1 : 0), { align: 'end' });
    }
  }, [messages.length, isLoading, userScrolledUp]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setUserScrolledUp(!isNearBottom);
  }, []);

  const items = virtualizer.getVirtualItems();

  if (initialLoad && messages.length === 0 && isLoading) {
    return (
      <div id="messagesView" ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div id="messagesList" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <MessagesListSkeleton count={3} />
        </div>
      </div>
    );
  }

  return (
    <div
      id="messagesView"
      ref={containerRef}
      style={{ flex: 1, overflowY: 'auto', padding: '20px' }}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="消息列表"
    >
      <div
        id="messagesList"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {items.map((virtualRow) => {
          if (virtualRow.index >= messages.length) {
            return (
              <div
                key="typing"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
              >
                <TypingIndicator />
              </div>
            );
          }
          
          const m = messages[virtualRow.index];
          return (
            <div
              key={m.id || virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
            >
              <MessageItem message={m} index={virtualRow.index} />
            </div>
          );
        })}
        
        {messages.length === 0 && !isLoading && (
          <div className="empty-hint" role="status">
            还没有消息，开始输入吧
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessagesView);
