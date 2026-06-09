import { useState, useRef, useEffect } from 'react';
import { useError } from '../lib/useError';
import { useAppStore } from '../store';

interface Props {
  onSend?: (text: string) => void;
  onNavigate?: (path: string) => void;
  model?: string;
  thinking?: boolean;
  onCancel?: () => void;
}

/**
 * Cast 模式空状态 — 按4个区域精确还原截图设计
 *
 * 区域1: 居中大标题 ✱ 先把清单上的一件事做完 + 副标题
 * 区域2: 大圆角输入框 (placeholder: 技能类型/, 内置左下+ 右下↑)
 * 区域3: 底部左侧 📁 项目工作区
 * 区域4: 底部右侧 MiniMax-M3 (1M 上下文) ▼
 */
export function CastEmptyState({ onSend, onNavigate, model, thinking, onCancel }: Props) {
  useError('chat');
  const [text, setText] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const configs = useAppStore((s) => s.configs);
  const setCurrent = useAppStore((s) => s.setCurrent);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [text]);

  // Close model dropdown on outside click / Escape
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [modelDropdownOpen]);

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
          先把清单上的一件事做完
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
          了解如何安全使用 Cowork
        </p>

        {/* ====== 区域2: 大圆角输入框 ====== */}
        <div style={{ width: '100%', marginTop: 32 }}>
          <div
            style={{
              position: 'relative',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)',
              transition: 'border-color .15s ease, box-shadow .15s ease',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--c-borderStrong)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(232,93,4,.12), 0 4px 16px rgba(0,0,0,.08)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--c-border)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)';
            }}
            tabIndex={0}
          >
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (text.trim()) { onSend?.(text.trim()); setText(''); }
                }
              }}
              placeholder="今天我能为你提供什么帮助吗？"
              rows={1}
              style={{
                display: 'block',
                width: '100%',
                padding: '28px 56px 28px 20px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--c-text)',
                fontFamily: 'var(--font-sans)',
                minHeight: 120,
                textAlign: 'left',
              }}
            />
            {/* 左下 + 按钮 */}
            <button
              disabled
              style={{
                position: 'absolute',
                left: 16,
                bottom: 18,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--c-border)',
                borderRadius: 8,
                color: 'var(--c-textMute)',
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
              title="即将推出"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {/* 右下 ↑ 发送按钮 */}
            <button
              onClick={() => {
                if (text.trim()) { onSend?.(text.trim()); setText(''); }
              }}
              disabled={!text.trim()}
              style={{
                position: 'absolute',
                right: 16,
                bottom: 18,
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
              aria-label="发送"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="m3 8 10-5-4 12-2-5-4-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity=".3" />
              </svg>
            </button>
          </div>
        </div>

        {/* ====== 区域3 + 区域4: 底部一行（背景色与输入框区分） ====== */}
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
            disabled
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
              cursor: 'not-allowed',
              opacity: 0.6,
              transition: 'background .15s ease',
            }}
            title="即将推出"
            >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5C2 3.67 2.67 3 3.5 3h2.59c.46 0 .9.18 1.22.5L8 4.18c.32.32.76.5 1.22.5h3.28c.83 0 1.5.67 1.5 1.5v6.32c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            项目工作区
          </button>

          {/* 区域4: 模型选择器 */}
          <div ref={modelDropdownRef} style={{ position: 'relative' }}>
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
              <span style={{ fontFamily: 'var(--font-mono)' }}>{model || 'MiniMax-M3'}</span>
              <span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>({thinking ? '思考' : '1M'} 上下文)</span>
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
                {(configs && configs.length > 0 ? configs : [{ name: 'MiniMax-M3' }]).map((cfg: any) => {
                  const isActive = (model || 'MiniMax-M3') === cfg.name;
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
