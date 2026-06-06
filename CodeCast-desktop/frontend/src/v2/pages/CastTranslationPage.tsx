import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
/* ------------------------------------------------------------------ */

type Direction = 'zh2en' | 'en2zh';

const DIR_LABEL: Record<Direction, string> = {
  zh2en: '中 → 英',
  en2zh: '英 → 中',
};

const DIR_PLACEHOLDER: Record<Direction, string> = {
  zh2en: '输入中文内容…',
  en2zh: 'Enter English text…',
};

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

export function CastTranslationPage() {
  const loadCatalog = useAppStore((s) => s.loadCatalog);
  const byCategory = useAppStore((s) => s.byCategory);
  const invokeTool = useAppStore((s) => s.invokeTool);

  const [direction, setDirection] = useState<Direction>('zh2en');
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [invoking, setInvoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const translationTools = byCategory['translation'] ?? [];

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* ---- actions ---- */

  const toggleDirection = useCallback(() => {
    setDirection((d) => (d === 'zh2en' ? 'en2zh' : 'zh2en'));
    // Swap content: move result into source (if there is a result)
    setResult((prev) => {
      if (prev) setSource(prev);
      return '';
    });
    setError(null);
    setCopied(false);
  }, []);

  const handleTranslate = useCallback(async () => {
    const trimmed = source.trim();
    if (!trimmed || invoking) return;

    setInvoking(true);
    setError(null);
    setResult('');
    setCopied(false);

    try {
      const toolName = translationTools[0]?.name ?? 'translate';
      const argsJSON = JSON.stringify({ direction, text: trimmed });
      const res = await invokeTool(toolName, argsJSON);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '翻译失败，请重试');
    } finally {
      setInvoking(false);
    }
  }, [source, invoking, direction, invokeTool, translationTools]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  /* ---- render ---- */

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      {/* Header row: title + direction toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
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
            中英互译
          </h2>
          {translationTools.length > 0 && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: 'var(--c-textMute)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              已加载 {translationTools.length} 个翻译工具
            </p>
          )}
        </div>

        {/* Direction toggle */}
        <button
          onClick={toggleDirection}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--c-text)',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            cursor: 'pointer',
            transition: 'all var(--dur-fast) var(--ease)',
            fontFamily: 'var(--font-mono)',
          }}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
        >
          <span
            style={{
              display: 'inline-block',
              transition: 'transform var(--dur-fast) var(--ease)',
              transform: direction === 'en2zh' ? 'scaleX(-1)' : 'scaleX(1)',
              fontSize: 16,
            }}
          >
            ⇄
          </span>
          {DIR_LABEL[direction]}
        </button>
      </div>

      {/* Two-column textarea layout */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 20,
        }}
      >
        {/* Source */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--c-textMute)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            {direction === 'zh2en' ? '原文（中文）' : 'Source (English)'}
          </label>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={DIR_PLACEHOLDER[direction]}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 260,
              padding: 14,
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
        </div>

        {/* Target */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <label
              style={{
                fontSize: 12,
                color: 'var(--c-textMute)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {direction === 'zh2en' ? '译文（English）' : '译文（中文）'}
            </label>

            {result && (
              <button
                onClick={handleCopy}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
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
          <textarea
            readOnly
            value={invoking ? '正在翻译…' : result}
            placeholder="翻译结果将显示在这里"
            style={{
              display: 'block',
              width: '100%',
              minHeight: 260,
              padding: 14,
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.7,
              color: invoking ? 'var(--c-textMute)' : 'var(--c-text)',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-md)',
              resize: 'vertical',
              outline: 'none',
              cursor: 'default',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Action row: translate button + error */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginTop: 16,
        }}
      >
        <button
          onClick={handleTranslate}
          disabled={!source.trim() || invoking}
          style={{
            padding: '9px 28px',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background:
              !source.trim() || invoking ? 'var(--c-textMute)' : 'var(--c-accent)',
            border: 'none',
            borderRadius: 'var(--r-md)',
            cursor: !source.trim() || invoking ? 'not-allowed' : 'pointer',
            transition: 'all var(--dur-base) var(--ease)',
            opacity: invoking ? 0.75 : 1,
          }}
        >
          {invoking ? '翻译中…' : '翻译'}
        </button>

        {error && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--c-danger)',
            }}
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
