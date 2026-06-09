import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { MessageStream } from '../components/message/MessageStream';
import { Composer } from '../components/composer/Composer';
import { ChatArea } from '../layout/ChatArea';
import type { Message } from '../components/message/MessageItem';
import type { Message as BackendMessage } from '../wails/types';
import { copyToClipboard } from '../lib/clipboard';
import { useToast } from '../components/primitives/Toast';
import { useI18n } from '../lib/useI18n';

const searchBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  color: 'var(--c-textMute)',
  cursor: 'pointer',
  flexShrink: 0,
};

interface Props {
  sessionId: string;
  messages: BackendMessage[];
  isStreaming: boolean;
  model: string;
  thinking: boolean;
  onSend: (text: string, opts?: any) => void;
  onCancel: () => void;
}

/** Simple stable hash for message content (djb2) */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function toUIMessages(raw: BackendMessage[], isStreaming: boolean): Message[] {
  return raw.map((m, i) => {
    const isLast = i === raw.length - 1;
    const fallback = `msg-${m.role}-${hashStr(m.content?.slice(0, 64) || String(i))}-${i}`;
    return {
      id: (m as any).id || (m as any).timestamp || fallback,
      role: m.role,
      content: m.content,
      reasoning: m.reasoning,
      toolCalls: m.tool_calls,
      isStreaming: isStreaming && isLast && m.role === 'assistant',
      createdAt: (m as any).timestamp ? Number((m as any).timestamp) * 1000 : undefined,
    };
  });
}

export function ChatPage({ sessionId, messages, isStreaming, model, thinking, onSend, onCancel }: Props) {
  const t = useI18n();
  const uiMessages = useMemo(() => toUIMessages(messages, isStreaming), [messages, isStreaming]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottom = useRef(true);
  const toast = useToast();

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return uiMessages
      .map((m, i) => ({ index: i, content: m.content }))
      .filter(m => m.content.toLowerCase().includes(q));
  }, [searchQuery, uiMessages]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Track user's scroll position to decide if we should auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottom.current = distFromBottom < 60;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  // Ctrl+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);

  // Navigate search matches
  const goNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (currentMatch + 1) % searchMatches.length;
    setCurrentMatch(next);
    const el = document.querySelector(`[data-msg-idx="${searchMatches[next].index}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatch, searchMatches]);

  const goPrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatch - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatch(prev);
    const el = document.querySelector(`[data-msg-idx="${searchMatches[prev].index}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatch, searchMatches]);

  // Reset current match when query changes
  useEffect(() => { setCurrentMatch(0); }, [searchQuery]);
  useEffect(() => {
    if (!isStreaming) return;
    const el = scrollRef.current;
    if (!el) return;

    // Use ResizeObserver to detect content growth during streaming
    const ro = new ResizeObserver(() => {
      if (isNearBottom.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);

    // Also observe children for content changes
    const mo = new MutationObserver(() => {
      if (isNearBottom.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });

    return () => { ro.disconnect(); mo.disconnect(); };
  }, [isStreaming]);

  // Initial scroll when messages load
  useEffect(() => {
    if (!isStreaming) return;
    if (isNearBottom.current) {
      scrollToBottom(false);
    }
  }, [messages.length, isStreaming, scrollToBottom]);

  // Message operation callbacks
  const handleCopy = useCallback(async (msg: Message) => {
    const ok = await copyToClipboard(msg.content);
    if (ok) toast.show(t.chat.copied, 'success');
    else toast.show(t.chat.copyFailed, 'danger');
  }, [toast]);

  const handleEdit = useCallback((msg: Message) => {
    // Fill the composer with the message text for editing
    const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-testid="composer-input"]');
    if (ta) {
      ta.value = msg.content;
      ta.focus();
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    // Re-send the last user message
    const userMsgs = uiMessages.filter(m => m.role === 'user');
    const lastUser = userMsgs[userMsgs.length - 1];
    if (lastUser) {
      onSend(lastUser.content);
    }
  }, [uiMessages, onSend]);

  const handleDelete = useCallback((msg: Message) => {
    // Remove message from local state by filtering it out
    // Backend delete is optional - local removal provides immediate UX
    const idx = uiMessages.findIndex(m => m.id === msg.id);
    if (idx >= 0) {
      // Use the messages prop (backend array) index mapping
      const backendIdx = idx;
      (window as any).__codecast_deleteMessage?.(backendIdx);
    }
    toast.show(t.chat.messageDeleted, 'success');
  }, [uiMessages, toast]);

  return (
    <ChatArea>
      {searchOpen && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-border)',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--c-textMute)', flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.shiftKey ? goPrevMatch() : goNextMatch(); }
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
            }}
            placeholder={t.chat.searchMessages}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--c-text)',
              fontSize: 13,
            }}
          />
          {searchQuery && (
            <span style={{ fontSize: 12, color: 'var(--c-textMute)', whiteSpace: 'nowrap' }}>
              {searchMatches.length > 0 ? `${currentMatch + 1}/${searchMatches.length}` : t.chat.noMatch}
            </span>
          )}
          <button onClick={goPrevMatch} disabled={searchMatches.length === 0} aria-label={t.chat.prev} style={{ ...searchBtnStyle, opacity: searchMatches.length ? 1 : 0.4 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={goNextMatch} disabled={searchMatches.length === 0} aria-label={t.chat.next} style={{ ...searchBtnStyle, opacity: searchMatches.length ? 1 : 0.4 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label={t.chat.closeSearch} style={searchBtnStyle}>×</button>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}
      >
        <MessageStream
          sessionId={sessionId}
          messages={uiMessages}
          isStreaming={isStreaming}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
          searchQuery={searchQuery}
          highlightMatchIdx={searchMatches.length > 0 && currentMatch < searchMatches.length ? searchMatches[currentMatch].index : -1}
        />
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            aria-label={t.chat.scrollToBottom}
            style={{
              position: 'sticky',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(0,0,0,.12)',
              cursor: 'pointer',
              color: 'var(--c-textSub)',
              zIndex: 10,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      {isStreaming && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              background: 'var(--c-danger, #e74c3c)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-lg)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(231,76,60,0.3)',
              transition: 'background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-dangerHover, #c0392b)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-danger, #e74c3c)'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/>
            </svg>
            {t.chat.stopGeneration}
          </button>
        </div>
      )}
      <Composer sessionId={sessionId} model={model} thinking={thinking} onSend={onSend} onCancel={onCancel} isStreaming={isStreaming} />
    </ChatArea>
  );
}
