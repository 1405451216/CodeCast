import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';

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

const TEMPLATES: EmailTemplate[] = [
  {
    label: '工作汇报',
    subject: '工作汇报 — [日期]',
    body: '您好，\n\n以下是本周的工作汇报：\n\n1. 已完成：\n   - \n\n2. 进行中：\n   - \n\n3. 下周计划：\n   - \n\n如有疑问请随时沟通。\n\n此致',
  },
  {
    label: '会议邀请',
    subject: '会议邀请 — [主题]',
    body: '您好，\n\n诚邀您参加以下会议：\n\n主题：\n时间：\n地点/链接：\n议程：\n  1. \n  2. \n\n请提前准备相关材料，期待您的参加。\n\n此致',
  },
  {
    label: '感谢信',
    subject: '感谢您的支持与帮助',
    body: '您好，\n\n非常感谢您在 [事项] 中给予的大力支持与帮助。\n\n[具体感谢内容]\n\n期待今后有更多合作的机会。\n\n此致敬礼',
  },
  {
    label: '询问',
    subject: '关于 [主题] 的咨询',
    body: '您好，\n\n我有一些关于 [主题] 的问题，希望能得到您的解答：\n\n1. \n2. \n\n方便的话请告知您的看法，感谢您的时间。\n\n此致',
  },
];

/* ====================================================================
 *  Styles
 * ==================================================================== */

const S = {
  wrap: {
    padding: 32,
    maxWidth: 760,
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
  const { catalog, loadCatalog, invokeTool, castLoading } = useAppStore();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Load catalog on mount */
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /* Derive email tools from catalog */
  const emailTools = catalog.filter((t) => t.category === 'email');
  const emailToolName = emailTools[0]?.name ?? 'email';

  /* Template selection handler */
  const handleSelectTemplate = useCallback((index: number) => {
    setActiveTemplate(index);
    const tpl = TEMPLATES[index];
    setSubject(tpl.subject);
    setBody(tpl.body);
  }, []);

  /* Generate email handler */
  const handleGenerate = useCallback(async () => {
    if (!subject.trim() && !body.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const args = JSON.stringify({ to, subject, body });
      const res = await invokeTool(emailToolName, args);
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '生成失败，请重试';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [to, subject, body, emailToolName, invokeTool]);

  /* Copy result handler */
  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Fallback for clipboard failure */
      const ta = document.createElement('textarea');
      ta.value = result;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const canGenerate = !generating && (subject.trim().length > 0 || body.trim().length > 0);

  return (
    <div style={S.wrap}>
      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h2 style={S.title}>邮件草稿</h2>

      {/* Template selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={S.sectionLabel}>快速模板</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TEMPLATES.map((tpl, i) => (
            <span
              key={tpl.label}
              style={S.templateChip(activeTemplate === i)}
              onClick={() => handleSelectTemplate(i)}
            >
              {tpl.label}
            </span>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div style={S.card}>
        {/* To */}
        <div style={{ marginBottom: 14 }}>
          <div style={S.sectionLabel}>收件人</div>
          <input
            style={S.input}
            placeholder="example@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 14 }}>
          <div style={S.sectionLabel}>主题</div>
          <input
            style={S.input}
            placeholder="邮件主题"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setActiveTemplate(null);
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 16 }}>
          <div style={S.sectionLabel}>正文</div>
          <textarea
            style={{ ...S.textarea, minHeight: 180 }}
            placeholder="在此输入邮件正文..."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setActiveTemplate(null);
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
            {generating ? '生成中...' : '生成邮件'}
          </button>

          {emailTools.length === 0 && !castLoading && (
            <span style={{ fontSize: 12, color: 'var(--c-textMute)' }}>
              未找到邮件工具，将使用默认引擎
            </span>
          )}
        </div>

        {error && <div style={S.errorText}>{error}</div>}
      </div>

      {/* Result preview */}
      {(result || generating) && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={S.sectionLabel}>预览</div>
            {result && (
              <button style={S.secondaryBtn} onClick={handleCopy}>
                {copied ? '已复制' : '复制'}
              </button>
            )}
          </div>
          <div style={S.previewBox}>
            {generating && !result && (
              <span style={{ color: 'var(--c-textMute)' }}>正在生成邮件内容...</span>
            )}
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
