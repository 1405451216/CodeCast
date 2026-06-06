import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const STYLE_PRESETS = ['润色', '扩写', '缩写', '正式', '口语'] as const;
type StylePreset = (typeof STYLE_PRESETS)[number];

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

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function CastWritingPage() {
  const loadCatalog = useAppStore((s) => s.loadCatalog);
  const byCategory = useAppStore((s) => s.byCategory);
  const invokeTool = useAppStore((s) => s.invokeTool);

  const [input, setInput] = useState('');
  const [style, setStyle] = useState<StylePreset>('润色');
  const [result, setResult] = useState('');
  const [invoking, setInvoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const writingTools = byCategory['writing'] ?? [];

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* ---- actions ---- */

  const handleGenerate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || invoking) return;

    setInvoking(true);
    setError(null);
    setResult('');
    setCopied(false);

    try {
      // Prefer a category-matched tool when available
      const toolName = writingTools[0]?.name ?? 'writing_assist';
      const argsJSON = JSON.stringify({ style, text: trimmed });
      const res = await invokeTool(toolName, argsJSON);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setInvoking(false);
    }
  }, [input, invoking, style, invokeTool, writingTools]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  /* ---- render ---- */

  return (
    <div style={{ padding: 32, maxWidth: 760, margin: '0 auto' }}>
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
      {writingTools.length > 0 && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: 'var(--c-textMute)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          已加载 {writingTools.length} 个写作工具
        </p>
      )}

      {/* Input text area */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
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
        {STYLE_PRESETS.map((preset) => {
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
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            color: 'var(--c-danger)',
          }}
        >
          {error}
        </p>
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
              输出结果
            </span>

            {result && (
              <button
                onClick={handleCopy}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  color: copied ? 'var(--c-accent)' : 'var(--c-textSub)',
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease)',
                }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {copied ? '已复制' : '复制'}
              </button>
            )}
          </div>

          <div
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
