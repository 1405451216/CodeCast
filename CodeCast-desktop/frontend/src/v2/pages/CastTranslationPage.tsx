import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { useResultHistory } from '../lib/useResultHistory';
import { readPipedText, sendToPage, PIPELINE_TARGETS } from '../lib/pipeline';
import { useI18n } from '../lib/useI18n';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
/* ------------------------------------------------------------------ */

type Direction = 'zh2en' | 'en2zh' | 'zh2ja' | 'ja2zh' | 'zh2ko' | 'ko2zh' | 'en2fr' | 'fr2en' | 'en2de' | 'de2en';

function getDirLabel(t: ReturnType<typeof useI18n>): Record<Direction, string> {
  return {
    zh2en: t.translation.dirZh2En, en2zh: t.translation.dirEn2Zh,
    zh2ja: t.translation.dirZh2Ja, ja2zh: t.translation.dirJa2Zh,
    zh2ko: t.translation.dirZh2Ko, ko2zh: t.translation.dirKo2Zh,
    en2fr: t.translation.dirEn2Fr, fr2en: t.translation.dirFr2En,
    en2de: t.translation.dirEn2De, de2en: t.translation.dirDe2En,
  };
}

function getDirPlaceholder(t: ReturnType<typeof useI18n>): Record<Direction, string> {
  return {
    zh2en: t.translation.placeholderZh, en2zh: 'Enter English text…',
    zh2ja: t.translation.placeholderZh, ja2zh: t.translation.placeholderJa,
    zh2ko: t.translation.placeholderZh, ko2zh: t.translation.placeholderKo,
    en2fr: 'Enter English text…', fr2en: t.translation.placeholderFr,
    en2de: 'Enter English text…', de2en: t.translation.placeholderDe,
  };
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

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function CastTranslationPage() {
  const t = useI18n();
  const DIR_LABEL = getDirLabel(t);
  const DIR_PLACEHOLDER = getDirPlaceholder(t);
  const translation = useFirstTool('translation');
  const invokeCastTool = useAppStore((s) => s.invokeCastTool);

  const [direction, setDirection] = useDraft<Direction>('translation:dir', 'zh2en');
  const [source, setSource] = useDraft('translation:source', '');
  const resultHistory = useResultHistory<string>(5);
  const [resultLocal, setResultLocal] = useState('');
  const result = resultHistory.current ?? resultLocal;
  const setResult = (v: string) => {
    setResultLocal(v);
    if (v) resultHistory.push(v);
  };
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
    if (result) setSource(result);
    setResult('');
    setError(null);
    setCopied(false);
  }, []);

  const handleTranslate = useCallback(async () => {
    const trimmed = source.trim();
    if (!trimmed || invoking) return;
    if (!translation.tool) {
      setError(t.translation.noTool);
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
      setError(e instanceof Error ? e.message : t.translation.translateFailed);
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
            {t.translation.title}
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
              {t.translation.toolsLoaded(translation.tools.length)}
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
            {direction === 'zh2en' ? t.translation.sourceLabel : t.translation.sourceLabelEn}
          </label>
          {inputHistory.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) { setSource(e.target.value); e.target.value = ''; } }}
              style={{ fontSize: 11, padding: '2px 6px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', cursor: 'pointer', marginBottom: 6 }}
              defaultValue=""
            >
              <option value="" disabled>{t.translation.recentUsed}</option>
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
              {direction === 'zh2en' ? t.translation.targetLabel : t.translation.targetLabelCn}
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
                {copied ? t.translation.copied : t.translation.copy}
              </button>
            )}
            {result && (
              <button
                onClick={() => {
                  const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `translation-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  color: 'var(--c-textSub)',
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {t.translation.download}
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
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  color: 'var(--c-textSub)',
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  appearance: 'none' as any,
                  paddingRight: 20,
                }}
                defaultValue=""
                title={t.translation.sendTo}
              >
                <option value="" disabled>{t.translation.sendTo}</option>
                {PIPELINE_TARGETS.filter(t => t.path !== '/cast/translation').map(t => (
                  <option key={t.path} value={t.path}>{t.label}</option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={invoking ? t.translation.translating : result}
            onChange={(e) => {
              if (!invoking) {
                setResultLocal(e.target.value);
              }
            }}
            readOnly={invoking}
            placeholder={t.translation.resultPlaceholder}
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
          {invoking ? t.translation.translating : t.translation.translate}
        </button>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--c-danger)' }}>{error}</span>
            <button onClick={() => void handleTranslate()} style={{ fontSize: 11, padding: '2px 6px', background: 'transparent', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-sm)', color: 'var(--c-danger)', cursor: 'pointer' }}>{t.translation.retry}</button>
            <button onClick={() => setError(null)} style={{ fontSize: 14, background: 'transparent', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '0 2px' }}>×</button>
          </div>
        )}
      </div>
    </div>
  );
}
