import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { useResultHistory } from '../lib/useResultHistory';
import { readPipedText, sendToPage, PIPELINE_TARGETS } from '../lib/pipeline';
import { useI18n } from '../lib/useI18n';

/* ====================================================================
 *  Types
 * ==================================================================== */

interface EmailTemplate {
  label: string;
  subject: string;
  body: string;
}

/* ====================================================================
 *  Templates
 * ==================================================================== */

function getBuiltinTemplates(t: ReturnType<typeof useI18n>): EmailTemplate[] {
  return [
    {
      label: t.email.templateWorkReport,
      subject: t.email.templateWorkReportSubject,
      body: t.email.templateWorkReportBody,
    },
    {
      label: t.email.templateMeetingInvite,
      subject: t.email.templateMeetingInviteSubject,
      body: t.email.templateMeetingInviteBody,
    },
    {
      label: t.email.templateThankYou,
      subject: t.email.templateThankYouSubject,
      body: t.email.templateThankYouBody,
    },
    {
      label: t.email.templateInquiry,
      subject: t.email.templateInquirySubject,
      body: t.email.templateInquiryBody,
    },
    {
      label: t.email.templateFollowUp,
      subject: t.email.templateFollowUpSubject,
      body: t.email.templateFollowUpBody,
    },
    {
      label: t.email.templateApology,
      subject: t.email.templateApologySubject,
      body: t.email.templateApologyBody,
    },
    {
      label: t.email.templateRecommend,
      subject: t.email.templateRecommendSubject,
      body: t.email.templateRecommendBody,
    },
  ];
}

function loadCustomTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem('codecast-email-templates');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomTemplates(templates: EmailTemplate[]) {
  try { localStorage.setItem('codecast-email-templates', JSON.stringify(templates)); } catch { /* ignore */ }
}

/* ====================================================================
 *  Styles
 * ==================================================================== */

const S = {
  wrap: {
    padding: 32,
    maxWidth: 'var(--page-max-width)',
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--font-serif, serif)',
    fontSize: 20,
    color: 'var(--c-text)',
    margin: 0,
    marginBottom: 24,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--c-textSub)',
    marginBottom: 6,
    letterSpacing: 0.3,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--c-text)',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    outline: 'none',
    transition: `border-color var(--dur-fast) var(--ease)`,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--c-text)',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    outline: 'none',
    resize: 'vertical' as const,
    lineHeight: 1.6,
    transition: `border-color var(--dur-fast) var(--ease)`,
  } as React.CSSProperties,
  templateChip: (active: boolean) =>
    ({
      display: 'inline-block',
      padding: '6px 14px',
      fontSize: 13,
      fontWeight: 500,
      color: active ? 'var(--c-accentText)' : 'var(--c-textSub)',
      background: active ? 'var(--c-accentSoft)' : 'var(--c-surface)',
      border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
      borderRadius: 'var(--r-pill, 999px)',
      cursor: 'pointer',
      transition: `all var(--dur-fast) var(--ease)`,
      userSelect: 'none' as const,
    }) as React.CSSProperties,
  primaryBtn: (disabled: boolean) =>
    ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 24px',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'inherit',
      color: '#fff',
      background: disabled ? 'var(--c-border)' : 'var(--c-accent)',
      border: 'none',
      borderRadius: 'var(--r-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: `background var(--dur-fast) var(--ease)`,
    }) as React.CSSProperties,
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    color: 'var(--c-textSub)',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    cursor: 'pointer',
    transition: `all var(--dur-fast) var(--ease)`,
  } as React.CSSProperties,
  previewBox: {
    padding: 16,
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--c-text)',
    minHeight: 80,
  } as React.CSSProperties,
  card: {
    padding: 16,
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    marginBottom: 16,
  } as React.CSSProperties,
  errorText: {
    fontSize: 13,
    color: 'var(--c-danger)',
    marginTop: 8,
  } as React.CSSProperties,
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  } as React.CSSProperties,
} as const;

/* ====================================================================
 *  Component
 * ==================================================================== */

export function CastEmailPage() {
  const t = useI18n();
  const email = useFirstTool('email');
  const invokeCastTool = useAppStore((s) => s.invokeCastTool);

  const [to, setTo] = useDraft('email:to', '');
  const [cc, setCc] = useDraft('email:cc', '');
  const [bcc, setBcc] = useDraft('email:bcc', '');
  const [subject, setSubject] = useDraft('email:subject', '');
  const [body, setBody] = useDraft('email:body', '');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);
  const [customTemplates, setCustomTemplates] = useState<EmailTemplate[]>(loadCustomTemplates);
  const [generating, setGenerating] = useState(false);
  const resultHistory = useResultHistory<string>(5);
  const [editResult, setEditResult] = useState<string | null>(null);
  const result = editResult ?? resultHistory.current ?? null;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codecast-input-history:email') || '[]'); } catch { return []; }
  });

  /* Load catalog on mount */
  useEffect(() => {
    email.load();
  }, [email.load]);

  // Read piped text from another Cast page
  useEffect(() => {
    const piped = readPipedText('/cast/email');
    if (piped) setBody(piped);
  }, [setBody]);

  /* Derive email tools from catalog */
  const emailToolName = email.tool?.name;

  /* Template selection handler */
  const builtinTemplates = getBuiltinTemplates(t);
  const allTemplates = [...builtinTemplates, ...customTemplates];
  const handleSelectTemplate = useCallback((index: number) => {
    if (subject.trim() || body.trim()) {
      if (!window.confirm(t.email.confirmReplaceTemplate)) return;
    }
    setActiveTemplate(index);
    const tpl = allTemplates[index];
    setSubject(tpl.subject);
    setBody(tpl.body);
  }, [subject, body, allTemplates]);

  /* Generate email handler */
  const handleGenerate = useCallback(async () => {
    if (!subject.trim() && !body.trim()) return;
    if (!emailToolName) {
      setError(t.email.noTool);
      return;
    }
    setGenerating(true);
    setError(null);
    setEditResult(null);
    resultHistory.clear();
    setCopied(false);

    try {
      const args = JSON.stringify({ to, subject, body });
      const res = await invokeCastTool(emailToolName, args);
      resultHistory.push(res);
      setEditResult(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t.email.generateFailed;
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [to, subject, body, emailToolName, invokeCastTool]);

  /* Copy result handler */
  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyToClipboard(result);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const canGenerate =
    !generating && email.available && (subject.trim().length > 0 || body.trim().length > 0);

  const emailValid = !to.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const emailError = to.trim() && !emailValid ? t.email.invalidEmail : null;

  return (
    <div style={S.wrap}>
      <h2 style={S.title}>{t.email.title}</h2>

      {/* Template selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={S.sectionLabel}>{t.email.quickTemplates}</div>
          {subject.trim() && (
            <button
              onClick={() => {
                const name = window.prompt(t.email.templateNamePrompt);
                if (name && name.trim()) {
                  const newTpl = { label: name.trim(), subject, body };
                  const updated = [...customTemplates, newTpl];
                  setCustomTemplates(updated);
                  saveCustomTemplates(updated);
                }
              }}
              style={{ fontSize: 11, color: 'var(--c-accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              title={t.email.saveAsTemplate}
            >
              + {t.email.saveAsTemplate}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[...builtinTemplates, ...customTemplates].map((tpl, i) => (
            <span
              key={tpl.label + i}
              style={S.templateChip(activeTemplate === i)}
              onClick={() => handleSelectTemplate(i)}
              onContextMenu={i >= builtinTemplates.length ? (e) => {
                e.preventDefault();
                if (window.confirm(t.email.deleteTemplateConfirm(tpl.label))) {
                  const ci = i - builtinTemplates.length;
                  const updated = customTemplates.filter((_, idx) => idx !== ci);
                  setCustomTemplates(updated);
                  saveCustomTemplates(updated);
                  setActiveTemplate(null);
                }
              } : undefined}
            >
              {tpl.label}
              {i >= builtinTemplates.length && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>✕</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div style={S.card}>
        {/* To */}
        <div style={{ marginBottom: 14 }}>
          <div style={S.sectionLabel}>{t.email.to}</div>
          <input
            style={{ ...S.input, borderColor: emailError ? 'var(--c-danger, #dc2626)' : undefined }}
            placeholder="example@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {emailError && (
            <div style={{ fontSize: 11, color: 'var(--c-danger, #dc2626)', marginTop: 4 }}>{emailError}</div>
          )}
          {!showCcBcc && (
            <button
              onClick={() => setShowCcBcc(true)}
              style={{ fontSize: 11, color: 'var(--c-accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 2 }}
            >
              + CC / BCC
            </button>
          )}
          {showCcBcc && (
            <>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...S.sectionLabel, fontSize: 11 }}>{t.email.ccLabel}</div>
                <input style={S.input} placeholder={t.email.ccPlaceholder} value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...S.sectionLabel, fontSize: 11 }}>{t.email.bccLabel}</div>
                <input style={S.input} placeholder={t.email.bccPlaceholder} value={bcc} onChange={(e) => setBcc(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 14 }}>
          <div style={S.sectionLabel}>{t.email.subject}</div>
          <input
            style={S.input}
            placeholder={t.email.subjectPlaceholder}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setActiveTemplate(null);
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 16 }}>
          <div style={S.sectionLabel}>{t.email.body}</div>
          <textarea
            style={{ ...S.textarea, minHeight: 180 }}
            placeholder={t.email.bodyPlaceholder}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setActiveTemplate(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleGenerate();
              }
            }}
          />
        </div>

        {/* Generate button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            style={S.primaryBtn(!canGenerate)}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating && <span style={S.spinner} />}
            {generating ? t.email.generating : t.email.generate}
          </button>

          {!email.available && !email.loading && (
            <span style={{ fontSize: 12, color: 'var(--c-textMute)' }}>
              {t.email.noTool}
            </span>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...S.errorText }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => void handleGenerate()} style={{ fontSize: 11, padding: '2px 6px', background: 'transparent', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-sm)', color: 'var(--c-danger)', cursor: 'pointer' }}>{t.email.retry}</button>
            <button onClick={() => setError(null)} style={{ fontSize: 14, background: 'transparent', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '0 2px' }}>×</button>
          </div>
        )}
      </div>

      {/* Result preview */}
      {(result || generating) && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={S.sectionLabel}>{t.email.preview}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {result && (
                <button style={S.secondaryBtn} onClick={handleCopy}>
                  {copied ? t.email.copied : t.email.copy}
                </button>
              )}
              {result && (
                <button style={S.secondaryBtn} onClick={() => {
                  const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `email-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  {t.email.download}
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
                  style={{ ...S.secondaryBtn, appearance: 'none' as any, paddingRight: 20, cursor: 'pointer' }}
                  defaultValue=""
                  title={t.email.sendTo}
                >
                  <option value="" disabled>{t.email.sendTo}</option>
                  {PIPELINE_TARGETS.filter(t => t.path !== '/cast/email').map(t => (
                    <option key={t.path} value={t.path}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div style={S.previewBox}>
            {generating && !result && (
              <span style={{ color: 'var(--c-textMute)' }}>{t.email.generatingContent}</span>
            )}
            {result !== null && (
              <textarea
                value={result}
                onChange={(e) => setEditResult(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 120,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--c-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
