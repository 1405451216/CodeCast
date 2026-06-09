import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Popover } from '../primitives/Popover';
import { copyToClipboard } from '../../lib/clipboard';

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolCalls?: { id: string; name: string; args: string; result?: string }[];
  tool_calls?: { id: string; name: string; args: string; result?: string }[];
  pendingApproval?: { toolName: string; target: string; risk: 'low' | 'medium' | 'high' };
  createdAt?: number;
  thinkingMs?: number;
  isStreaming?: boolean;
}

interface Props {
  message: Message;
  onCopy?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onPreview?: () => void;
  onDiff?: () => void;
  onTerminal?: () => void;
  onBackground?: () => void;
  onPlan?: () => void;
}

const I = {
  info: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M8 5v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  copyIcon: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  preview: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2-5 7-5 7 5 7 5-2 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  diff: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M3 8h7M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  term: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="m4 7 2 2-2 2M8 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bg: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  plan: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" fill="var(--c-bg)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
};

/**
 * Claude Code 风格消息
 *  - 用户消息：右对齐，蓝色气泡 (--c-bubble-user)
 *  - 助手消息：左对齐，无头像，"✱ Ns · thinking..." 状态
 *  - 助手消息右上 ⓘ Popover 菜单
 */
export function MessageItem({ message, onCopy, onEdit, onRegenerate, onPreview, onDiff, onTerminal, onBackground, onPlan }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!message.isStreaming) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [message.isStreaming]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    onCopy?.();
  }, [message.content, onCopy]);

  if (message.role === 'user') {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', position: 'relative', alignItems: 'center', gap: 8 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered && (
          <button
            onClick={handleCopy}
            aria-label="复制消息"
            title="复制"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)',
              color: copied ? 'var(--c-success)' : 'var(--c-textMute)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'color var(--dur-fast) var(--ease)',
            }}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.2"/></svg>
            )}
          </button>
        )}
        {hovered && onEdit && (
          <button
            onClick={onEdit}
            aria-label="编辑消息"
            title="编辑"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--c-textMute)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
          </button>
        )}
        <div
          style={{
            maxWidth: '70%',
            padding: '10px 14px',
            background: 'var(--c-bubble-user)',
            color: 'var(--c-bubble-userText)',
            borderRadius: 'var(--r-xl)',
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // 助手 / 系统
  const thinkingSec = message.thinkingMs ? Math.round(message.thinkingMs / 1000) : Math.max(1, Math.round((now - (message.createdAt || now)) / 1000));

  return (
    <div style={{ position: 'relative', padding: '14px 0 14px 0' }}>
      {/* 右上 ⓘ Popover */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 0,
        }}
      >
        <Popover
          trigger={
            <button
              aria-label="消息操作"
              style={{
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-textMute)',
                cursor: 'pointer',
                transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--c-surface-hover)';
                e.currentTarget.style.color = 'var(--c-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--c-textMute)';
              }}
            >
              {I.info}
            </button>
          }
        >
          <div style={{ fontSize: 13, padding: '4px', minWidth: 180 }}>
            <MenuItem icon={copied ? I.check : I.copyIcon} label={copied ? '已复制' : '复制'} onClick={handleCopy} />
            <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 0' }} />
            <MenuItem icon={I.preview} label="预览" onClick={onPreview} />
            <MenuItem icon={I.diff} label="差异" onClick={onDiff} />
            <MenuItem icon={I.term} label="终端" onClick={onTerminal} />
            <MenuItem icon={I.bg} label="Background tasks" onClick={onBackground} />
            <MenuItem icon={I.plan} label="计划" onClick={onPlan} />
          </div>
        </Popover>
      </div>

      {/* 状态行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--c-textSub)',
          fontFamily: 'var(--font-mono)',
          marginBottom: 6,
        }}
      >
        <span style={{ color: 'var(--c-accent)' }}>✱</span>
        <span>{message.isStreaming ? `${thinkingSec}s · thinking…` : `${thinkingSec}s`}</span>
        {message.createdAt && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {message.isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--c-accent)',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* 内容 */}
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--c-bubble-assistantText)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {message.isStreaming && <Caret />}
      </div>
    </div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 6,
        height: 14,
        marginLeft: 2,
        verticalAlign: '-2px',
        background: 'var(--c-accent)',
        animation: 'caret 1s steps(1) infinite',
      }}
    />
  );
}

function MenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        color: 'var(--c-text)',
        fontSize: 13,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'inline-flex', color: 'var(--c-textSub)' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
