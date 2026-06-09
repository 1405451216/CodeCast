import { useState } from 'react';
import { useError } from '../lib/useError';
import { useI18n } from '../lib/useI18n';
import { useAppStore } from '../store';
import { Composer } from '../components/composer/Composer';

interface Props {
  onSend?: (text: string) => void;
  onNavigate?: (path: string) => void;
  model?: string;
  thinking?: boolean;
  onCancel?: () => void;
}

/**
 * Cast 模式空状态 — 复用 Composer 组件，保持居中大标题 + 底部栏设计
 */
export function CastEmptyState({ onSend, onNavigate, model, thinking, onCancel }: Props) {
  useError('chat');
  const t = useI18n();
  const [text, setText] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const configs = useAppStore((s) => s.configs);
  const setCurrent = useAppStore((s) => s.setCurrent);
  const currentSessionId = useAppStore((s) => s.currentSessionId) || '';

  const handleSend = (v: string) => {
    onSend?.(v);
    setText('');
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'auto',
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
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
          width: '100%',
          maxWidth: 640,
          zIndex: 1,
        }}
      >
        {/* ====== 区域1: 大标题 + 副标题 ====== */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            fontWeight: 500,
            color: 'var(--c-text)',
            margin: 0,
            letterSpacing: -0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 24, color: '#e85d04' }}>✱</span>
          {t.empty.title}
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: 'var(--c-textMute)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {t.empty.subtitle}
        </p>

        {/* ====== 区域2: Composer 复用 ====== */}
        <div style={{ width: '100%', marginTop: 32 }}>
          <Composer
            sessionId={currentSessionId}
            model={model || '—'}
            thinking={thinking || false}
            onSend={handleSend}
            onCancel={onCancel || (() => {})}
            text={text}
            setText={setText}
            placeholder={t.empty.title}
            hideDefaultActions={false}
            hideDefaultFooter
            containerStyle={{
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)',
            }}
            textareaStyle={{
              padding: '28px 56px 28px 20px',
              fontSize: 15,
              lineHeight: 1.6,
              minHeight: 120,
            }}
            footerRight={
              <button
                onClick={() => { if (text.trim()) handleSend(text); }}
                disabled={!text.trim()}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: text.trim() ? '#f0d9cc' : 'var(--c-bgSub)',
                  border: 'none',
                  borderRadius: 8,
                  color: text.trim() ? '#b86125' : 'var(--c-textMute)',
                  cursor: text.trim() ? 'pointer' : 'not-allowed',
                  opacity: text.trim() ? 1 : 0.5,
                }}
                aria-label={t.composer.send}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="m3 8 10-5-4 12-2-5-4-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity=".3" />
                </svg>
              </button>
            }
          />
        </div>

        {/* ====== 区域3 + 区域4: 底部一行 ====== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 0,
            padding: '10px 14px',
            background: 'rgba(0,0,0,.02)',
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            borderTop: '1px solid var(--c-border)',
          }}
        >
          {/* 区域3: 项目工作区 */}
          <button
            onClick={() => onNavigate?.('/settings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: 'var(--c-textMute)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background .15s ease',
            }}
            title={t.empty.projectWorkspace}
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5C2 3.67 2.67 3 3.5 3h2.59c.46 0 .9.18 1.22.5L8 4.18c.32.32.76.5 1.22.5h3.28c.83 0 1.5.67 1.5 1.5v6.32c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {t.empty.projectWorkspace}
          </button>

          {/* 区域4: 模型选择器 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setModelDropdownOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: 'var(--c-textSub)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'background .15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontFamily: 'var(--font-mono)' }}>{model || '—'}</span>
              <span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>({thinking ? t.empty.thinking : '1M'} {t.empty.context})</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .5, transform: modelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                <path d="m3 4 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {modelDropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                bottom: 'calc(100% + 6px)',
                minWidth: 200,
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                padding: 4,
                zIndex: 50,
              }}>
                {(configs && configs.length > 0 ? configs : [{ name: '—' }]).map((cfg: any) => {
                  const isActive = (model || '—') === cfg.name;
                  return (
                    <button
                      key={cfg.name}
                      onClick={() => { setCurrent(cfg.name); setModelDropdownOpen(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '8px 10px',
                        background: isActive ? 'var(--c-surface-hover)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--r-sm)',
                        color: 'var(--c-text)',
                        fontSize: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ flex: 1, fontFamily: 'var(--font-mono)' }}>{cfg.name}</span>
                      {isActive && <span style={{ color: 'var(--c-accent)', fontSize: 11 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
