import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { readPipedText, sendToPage, PIPELINE_TARGETS } from '../lib/pipeline';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
/* ------------------------------------------------------------------ */

type Direction = 'zh2en' | 'en2zh' | 'zh2ja' | 'ja2zh' | 'zh2ko' | 'ko2zh' | 'en2fr' | 'fr2en' | 'en2de' | 'de2en';

const DIR_LABEL: Record<Direction, string> = {
  zh2en: '中 → 英', en2zh: '英 → 中',
  zh2ja: '中 → 日', ja2zh: '日 → 中',
  zh2ko: '中 → 韩', ko2zh: '韩 → 中',
  en2fr: '英 → 法', fr2en: '法 → 英',
  en2de: '英 → 德', de2en: '德 → 英',
};

const DIR_PLACEHOLDER: Record<Direction, string> = {
  zh2en: '输入中文内容…', en2zh: 'Enter English text…',
  zh2ja: '输入中文内容…', ja2zh: '日本語を入力…',
  zh2ko: '输入中文内容…', ko2zh: '한국어를 입력하세요…',
  en2fr: 'Enter English text…', fr2en: 'Entrez le texte français…',
  en2de: 'Enter English text…', de2en: 'Deutschen Text eingeben…',
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
  const translation = useFirstTool('translation');
  const invokeCastTool = useAppStore((s) => s.invokeCastTool);

  const [direction, setDirection] = useDraft<Direction>('translation:dir', 'zh2en');
  const [source, setSource] = useDraft('translation:source', '');
  const [result, setResult] = useState('');
  const [invoking, setInvoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codecast-input-history:translation') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    translation.load();
  }, [translation.load]);

  // Read piped text from another Cast page
  useEffect(() => {
    const piped = readPipedText('/cast/translation');
    if (piped) setSource(piped);
  }, [setSource]);

  /* ---- actions ---- */

  const DIRECTIONS: Direction[] = ['zh2en', 'en2zh', 'zh2ja', 'ja2zh', 'zh2ko', 'ko2zh', 'en2fr', 'fr2en', 'en2de', 'de2en'];

  const toggleDirection = useCallback(() => {
    setDirection((d) => {
      const idx = DIRECTIONS.indexOf(d);
      return DIRECTIONS[(idx + 1) % DIRECTIONS.length];
    });
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
    if (!translation.tool) {
      setError('暂无可用的翻译工具');
      return;
    }

    setInvoking(true);
    setError(null);
    // Save to input history
    if (trimmed) {
      const newHistory = [trimmed, ...inputHistory.filter(h => h !== trimmed)].slice(0, 10);
      setInputHistory(newHistory);
      try { localStorage.setItem('codecast-input-history:translation', JSON.stringify(newHistory)); } catch { /* ignore */ }
    }
    setResult('');
    setCopied(false);

    try {
      const argsJSON = JSON.stringify({ direction, text: trimmed });
      const res = await invokeCastTool(translation.tool.name, argsJSON);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '翻译失败，请重试');
    } finally {
      setInvoking(false);
    }
  }, [source, invoking, direction, invokeCastTool, translation.tool]);

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
          {translation.tools.length > 0 && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: 'var(--c-textMute)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              已加载 {translation.tools.length} 个翻译工具
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
          {inputHistory.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) { setSource(e.target.value); e.target.value = ''; } }}
              style={{ fontSize: 11, padding: '2px 6px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', cursor: 'pointer', marginBottom: 6 }}
              defaultValue=""
            >
              <option value="" disabled>最近使用…</option>
              {inputHistory.map((h, i) => (
                <option key={i} value={h}>{h.slice(0, 60)}{h.length > 60 ? '…' : ''}</option>
              ))}
            </select>
          )}
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={DIR_PLACEHOLDER[direction]}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleTranslate();
              }
            }}
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
            value={invoking ? '正在翻译…' : result}
            onChange={(e) => {/* result is from history, user can edit freely */}}
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
              background: result ? 'var(--c-surface)' : 'var(--c-bgSub, rgba(0,0,0,.02))',
              border: `1px solid ${result ? 'var(--c-border)' : 'var(--c-border)'}`,
              borderRadius: 'var(--r-md)',
              resize: 'vertical',
              outline: 'none',
              cursor: result ? 'text' : 'default',
              boxSizing: 'border-box',
              opacity: !result && !invoking ? 0.7 : 1,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--c-danger)' }}>{error}</span>
            <button onClick={() => void handleTranslate()} style={{ fontSize: 11, padding: '2px 6px', background: 'transparent', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-sm)', color: 'var(--c-danger)', cursor: 'pointer' }}>重试</button>
            <button onClick={() => setError(null)} style={{ fontSize: 14, background: 'transparent', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '0 2px' }}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}
