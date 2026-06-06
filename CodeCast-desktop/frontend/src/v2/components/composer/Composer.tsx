import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { useAppStore } from '../../store';
import { Models } from '../../wails/adapter';
import { Button } from '../primitives/Button';
import { SlashCommandMenu } from './SlashCommandMenu';
import { AttachmentList, type Attachment } from './AttachmentList';

export interface ComposerProps {
  sessionId: string;
  model: string;
  thinking: boolean;
  onSend: (text: string, opts?: { model?: string; thinking?: boolean }) => void;
  onCancel: () => void;
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** 受控文本（用于空状态共享） */
  text?: string;
  setText?: (v: string) => void;
  /** 自定义占位符 */
  placeholder?: string;
}

const I = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="m3 8 10-5-4 12-2-5-4-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  ),
  chevron: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="m3 4 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  paperclip: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="m11 5-5 5a2 2 0 1 0 2.83 2.83l5-5a3.5 3.5 0 1 0-4.95-4.95l-5 5a5 5 0 0 0 7.07 7.07l3.54-3.54" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * Claude Code 风格 Composer
 *
 *  ┌─────────────────────────────────────────────┐
 *  │  +   -    [多行输入]               🧠 ◀ │   ⏎
 *  └─────────────────────────────────────────────┘
 *
 *  - 大圆角 24px
 *  - 左侧 +/- 按钮（可隐藏 / 显示附件）
 *  - 右侧模型选择器 + 发送按钮
 */
export function Composer({
  model, thinking, onSend, onCancel,
  attachments = [], onRemoveAttachment,
  text: controlledText, setText: controlledSetText,
  placeholder = '发消息 · ⌘⇧P 切换 Plan 模式',
}: ComposerProps) {
  const [localText, setLocalText] = useLocalOrControlled(controlledText, controlledSetText);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
  }, [localText]);

  const send = () => {
    const v = localText.trim();
    if (!v) return;
    onSend(v, { model, thinking });
    if (!controlledSetText) setLocalText('');
    else controlledSetText('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-input)',
        boxShadow: 'var(--shadow-md)',
        transition: 'border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--c-borderStrong)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px var(--c-accentSoft), var(--shadow-md)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--c-border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {localText.startsWith('/') && (
        <SlashCommandMenu query={localText} onSelect={(cmd) => (controlledSetText ?? setLocalText)(cmd.label + ' ')} />
      )}
      <AttachmentList items={attachments} onRemove={onRemoveAttachment || (() => {})} />
      <textarea
        ref={taRef}
        aria-label="消息输入"
        value={localText}
        onChange={(e) => (controlledSetText ?? setLocalText)(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        rows={1}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px 60px 14px 88px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--c-text)',
          fontFamily: 'var(--font-sans)',
        }}
      />
      {/* 左侧 +/- 按钮组 */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          display: 'flex',
          gap: 2,
        }}
      >
        <RoundIconBtn aria-label="添加附件" title="添加附件">
          {I.plus}
        </RoundIconBtn>
        <RoundIconBtn aria-label="工具" title="工具">
          {I.minus}
        </RoundIconBtn>
      </div>
      {/* 右侧模型选择器 + 发送 */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ModelSelector model={model} />
        <Button
          variant="primary"
          onClick={send}
          aria-label="发送"
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {I.send}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          aria-label="取消"
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </Button>
      </div>
    </div>
  );
}

function RoundIconBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      {...rest}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        color: 'var(--c-textSub)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

function ModelSelector({ model }: { model: string }) {
  const [open, setOpen] = useState(false);
  const configs = useAppStore((s) => s.configs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSelect = async (modelName: string) => {
    try {
      await Models.setCurrent(modelName);
      useAppStore.setState({ current: modelName } as Record<string, unknown>);
    } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: 'var(--c-bgSub)',
          border: '1px solid transparent',
          borderRadius: 'var(--r-md)',
          color: 'var(--c-textSub)',
          fontSize: 12,
          cursor: 'pointer',
          height: 30,
          transition: 'all var(--dur-fast) var(--ease)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface-hover)'; e.currentTarget.style.borderColor = 'var(--c-border)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--c-bgSub)'; e.currentTarget.style.borderColor = 'transparent'; }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--c-accent)' }}>✱</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{model}</span>
        <span style={{ display: 'inline-flex', opacity: 0.6 }}>{I.chevron}</span>
      </button>
      {open && configs.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 'calc(100% + 6px)',
            minWidth: 220,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-pop)',
            padding: 4,
            zIndex: 50,
          }}
        >
          {configs.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.model)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                color: c.model === model ? 'var(--c-accentText)' : 'var(--c-text)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {c.enabled && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--c-success, #4caf50)', flexShrink: 0,
                }} />
              )}
              <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>{c.model}</span>
              <span style={{ fontSize: 11, color: 'var(--c-textMute)' }}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useLocalOrControlled(text?: string, setText?: (v: string) => void) {
  const [local, setLocal] = useState('');
  const value = text ?? local;
  const set = (v: string) => (setText ?? setLocal)(v);
  return [value, set] as const;
}
