import { useState } from 'react';
import { Composer } from '../components/composer/Composer';
import { useError } from '../lib/useError';

interface CastShortcut {
  cmd: string;
  desc: string;
  emoji: string;
  path: string;
}

const shortcuts: CastShortcut[] = [
  { cmd: '/cast writing', desc: '写作助手', emoji: '✍️', path: '/cast/writing' },
  { cmd: '/cast translation', desc: '中英互译', emoji: '🌐', path: '/cast/translation' },
  { cmd: '/cast knowledge', desc: '知识库检索', emoji: '📚', path: '/cast/knowledge' },
  { cmd: '/cast schedule', desc: '日程管理', emoji: '📅', path: '/cast/schedule' },
  { cmd: '/cast email', desc: '邮件草稿', emoji: '✉️', path: '/cast/email' },
  { cmd: '/cast tools', desc: '工具箱', emoji: '🧰', path: '/cast/tools' },
];

interface Props {
  onSend?: (text: string) => void;
  onNavigate?: (path: string) => void;
  model?: string;
  thinking?: boolean;
  onCancel?: () => void;
}

/**
 * Claude Code 风格空状态：
 *  - 居中大标题（先把清单上的一件事做完）
 *  - 副标题（了解如何安全使用…）
 *  - 浅灰点状网格背景
 *  - 大圆角输入框（下方，sticky 在视口底部）
 *  - 快捷命令网格（Cast）
 */
export function CastEmptyState({ onSend, onNavigate, model, thinking, onCancel }: Props) {
  useError('chat');
  const [text, setText] = useState('');

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'auto',
        background: 'var(--c-bg)',
      }}
    >
      {/* 点状网格背景 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(var(--c-dot-grid) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          backgroundPosition: '0 0',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 80%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '80px 24px 0',
          zIndex: 1,
        }}
      >
        {/* 大标题 */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--c-text)',
            margin: 0,
            letterSpacing: -0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 28 }}>✱</span>
          先把清单上的一件事做完
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--c-textSub)',
            maxWidth: 540,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          了解如何安全有效地使用 CodeCast
          <a
            href="https://docs.anthropic.com/zh-CN/docs/claude-code"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--c-accentText)', marginLeft: 6, textDecoration: 'none', borderBottom: '1px dashed var(--c-accent)' }}
          >
            阅读使用须知 →
          </a>
        </p>

        {/* Cast 快捷命令 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 36,
            width: '100%',
            maxWidth: 720,
          }}
        >
          {shortcuts.map((s) => (
            <button
              key={s.cmd}
              onClick={() => onNavigate?.(s.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-text)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--c-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--c-borderStrong)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--c-surface)';
                e.currentTarget.style.borderColor = 'var(--c-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{s.desc}</span>
                <span style={{ fontSize: 11, color: 'var(--c-textMute)', fontFamily: 'var(--font-mono)' }}>{s.cmd}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 底部输入区（居中、大圆角） */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '32px 24px 24px',
          display: 'flex',
          justifyContent: 'center',
          background: 'linear-gradient(to top, var(--c-bg) 60%, transparent 100%)',
          zIndex: 2,
        }}
      >
        <div style={{ width: '100%', maxWidth: 760 }}>
          <EmptyComposer
            text={text}
            setText={setText}
            onSend={onSend}
            model={model}
            thinking={thinking}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyComposer({
  text, setText, onSend, model, thinking, onCancel,
}: {
  text: string; setText: (v: string) => void;
  onSend?: (t: string) => void;
  model?: string; thinking?: boolean; onCancel?: () => void;
}) {
  return (
    <Composer
      sessionId="empty"
      model={model || 'Opus 4.5'}
      thinking={!!thinking}
      text={text}
      setText={setText}
      onSend={(t) => { onSend?.(t); setText(''); }}
      onCancel={onCancel || (() => {})}
    />
  );
}
