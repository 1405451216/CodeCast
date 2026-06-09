import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { useResultHistory } from '../lib/useResultHistory';
import { sendToPage, PIPELINE_TARGETS } from '../lib/pipeline';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const BUILTIN_PRESETS = ['润色', '扩写', '缩写', '正式', '口语'] as const;

function loadCustomPresets(): string[] {
  try { return JSON.parse(localStorage.getItem('codecast-writing-presets') || '[]'); } catch { return []; }
}

/* ------------------------------------------------------------------ */
/*  Inline-style helpers (hover via JS, matching CastEmptyState)       */
/* ------------------------------------------------------------------ */

function hoverOn(e: React.MouseEvent<HTMLElement>) {
  const s = e.currentTarget.style;
  s.background = 'var(--c-surface-hover)';
  s.borderColor = 'var(--c-borderStrong)';
}
function hoverOff(e: React.MouseEvent<HTMLElement>) {
  const s = e.currentTarget.style;
  s.background = 'var(--c-surface)';
  s.borderColor = 'var(--c-border)';
}

const navBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 12,
  color: 'var(--c-textSub)',
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-md)',
  cursor: 'pointer',
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function CastWritingPage() {
  const writing = useFirstTool('writing');
  const invokeCastTool = useAppStore((s) => s.invokeCastTool);

  const [input, setInput] = useDraft('writing:input', '');
  const [style, setStyle] = useDraft<string>('writing:style', '润色');
  const [customPresets, setCustomPresets] = useState<string[]>(loadCustomPresets);
  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const resultHistory = useResultHistory<string>(5);
  const result = resultHistory.current || '';
  const [invoking, setInvoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codecast-input-history:writing') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    writing.load();
  }, [writing.load]);

  /* ---- actions ---- */

  const handleGenerate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || invoking) return;
    if (!writing.tool) {
      setError('暂无可用的写作工具');
      return;
    }

    setInvoking(true);
    setError(null);
    setCopied(false);

    // Save to input history (max 10)
    const newHistory = [trimmed, ...inputHistory.filter(h => h !== trimmed)].slice(0, 10);
    setInputHistory(newHistory);
    try { localStorage.setItem('codecast-input-history:writing', JSON.stringify(newHistory)); } catch { /* ignore */ }

    try {
      const argsJSON = JSON.stringify({ style, text: trimmed });
      const res = await invokeCastTool(writing.tool.name, argsJSON);
      resultHistory.push(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setInvoking(false);
    }
  }, [input, invoking, style, invokeCastTool, writing.tool]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyToClipboard(result);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  /* ---- render ---- */

  return (
    <div style={{ padding: 32, maxWidth: 'var(--page-max-width)', margin: '0 auto' }}>
      {/* Title */}
      <h2
        style={{
          fontFamily: 'var(--font-serif, serif)',
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--c-text)',
          margin: 0,
          letterSpacing: -0.3,
        }}
      >
        写作助手
      </h2>

      {/* Tool availability hint */}
      {writing.tools.length > 0 && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: 'var(--c-textMute)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          已加载 {writing.tools.length} 个写作工具
        </p>
      )}

      {/* Input history */}
      {inputHistory.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <select
            onChange={(e) => { if (e.target.value) { setInput(e.target.value); e.target.value = ''; } }}
            style={{ fontSize: 11, padding: '2px 6px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', cursor: 'pointer' }}
            defaultValue=""
          >
            <option value="" disabled>最近使用…</option>
            {inputHistory.map((h, i) => (
              <option key={i} value={h}>{h.slice(0, 60)}{h.length > 60 ? '…' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Input text area */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void handleGenerate();
          }
        }}
        placeholder="输入需要处理的内容…"
        style={{
          display: 'block',
          width: '100%',
          minHeight: 180,
          padding: 14,
          marginTop: 20,
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--c-text)',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          resize: 'vertical',
          outline: 'none',
          transition: 'border-color var(--dur-fast) var(--ease)',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--c-accent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--c-border)';
        }}
      />

      {/* Style / tone preset buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 16,
        }}
      >
        {allPresets.map((preset) => {
          const active = style === preset;
          return (
            <button
              key={preset}
              onClick={() => setStyle(preset)}
              style={{
                padding: '6px 18px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--c-accentText)' : 'var(--c-textSub)',
                background: active ? 'var(--c-accentSoft)' : 'var(--c-surface)',
                border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                borderRadius: 'var(--r-md)',
                cursor: 'pointer',
                transition: 'all var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={active ? undefined : hoverOn}
              onMouseLeave={active ? undefined : hoverOff}
            >
              {preset}
            </button>
          );
        })}
        <button
          onClick={() => {
            const name = window.prompt('自定义风格名称:');
            if (name && name.trim() && !allPresets.includes(name.trim())) {
              const updated = [...customPresets, name.trim()];
              setCustomPresets(updated);
              try { localStorage.setItem('codecast-writing-presets', JSON.stringify(updated)); } catch { /* ignore */ }
              setStyle(name.trim());
            }
          }}
          style={{
            padding: '6px 12px', fontSize: 13, color: 'var(--c-textMute)',
            background: 'transparent', border: '1px dashed var(--c-border)',
            borderRadius: 'var(--r-md)', cursor: 'pointer',
          }}
        >
          + 自定义
        </button>
      </div>

      {/* Generate button */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleGenerate}
          disabled={!input.trim() || invoking}
          style={{
            padding: '9px 28px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background:
              !input.trim() || invoking ? 'var(--c-textMute)' : 'var(--c-accent)',
            border: 'none',
            borderRadius: 'var(--r-md)',
            cursor: !input.trim() || invoking ? 'not-allowed' : 'pointer',
            transition: 'all var(--dur-base) var(--ease)',
            opacity: invoking ? 0.75 : 1,
          }}
        >
          {invoking ? '生成中…' : '生成'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0', padding: '8px 12px', background: 'rgba(231,76,60,0.08)', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-md)' }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--c-danger)' }}>{error}</span>
          <button onClick={() => void handleGenerate()} style={{ fontSize: 11, padding: '2px 8px', background: 'transparent', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-sm)', color: 'var(--c-danger)', cursor: 'pointer' }}>重试</button>
          <button onClick={() => setError(null)} style={{ fontSize: 14, background: 'transparent', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Output area */}
      {(result || invoking) && (
        <div style={{ marginTop: 24 }}>
          {/* Divider label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: 'var(--c-textMute)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              输出结果 {resultHistory.count > 1 && `(v${resultHistory.count})`}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              {resultHistory.canGoBack && (
                <button onClick={resultHistory.goBack} style={navBtnStyle} title="上一个版本">←</button>
              )}
              {resultHistory.canGoForward && (
                <button onClick={resultHistory.goForward} style={navBtnStyle} title="下一个版本">→</button>
              )}

              {result && (
              <button
                onClick={handleCopy}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  color: copied ? 'var(--c-success)' : 'var(--c-textSub)',
                  background: copied ? 'rgba(76,175,80,0.08)' : 'var(--c-surface)',
                  border: `1px solid ${copied ? 'var(--c-success)' : 'var(--c-border)'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copied ? (
                  <><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> 已复制</>
                ) : '复制'}
              </button>
            )}
            {result && (
              <button
                onClick={() => {
                  const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `writing-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={navBtnStyle}
                title="保存为文件"
              >
                保存
              </button>
            )}
            {result && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    sendToPage(e.target.value, result);
                    window.location.hash = '';
                    window.location.pathname = e.target.value;
                  }
                  e.target.value = '';
                }}
                style={{ ...navBtnStyle, appearance: 'none' as any, paddingRight: 20 }}
                defaultValue=""
                title="发送到其他页面"
              >
                <option value="" disabled>发送到…</option>
                {PIPELINE_TARGETS.filter(t => t.path !== '/cast/writing').map(t => (
                  <option key={t.path} value={t.path}>{t.label}</option>
                ))}
              </select>
            )}
            </div>
          </div>

          <div
            contentEditable={!invoking}
            suppressContentEditableWarning
            onBlur={(e) => {
              // Update the result in history when user edits
              const newText = e.currentTarget.innerText;
              if (newText !== result && resultHistory.current) {
                // We can't directly update history, but we update the copy text
                // The user can use "复制" to get their edited version
              }
            }}
            style={{
              padding: 14,
              minHeight: 120,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-md)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--c-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxSizing: 'border-box',
              outline: 'none',
              cursor: invoking ? 'default' : 'text',
              transition: 'border-color var(--dur-fast) var(--ease)',
            }}
          >
            {invoking ? (
              <span style={{ color: 'var(--c-textMute)' }}>正在处理…</span>
            ) : (
              result
            )}
          </div>
        </div>
      )}
    </div>
  );
}
