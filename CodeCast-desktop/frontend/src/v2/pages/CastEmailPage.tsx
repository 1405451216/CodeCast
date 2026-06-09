import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { readPipedText, sendToPage, PIPELINE_TARGETS } from '../lib/pipeline';

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

const BUILTIN_TEMPLATES: EmailTemplate[] = [
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
  {
    label: '跟进',
    subject: '跟进：[主题]',
    body: '您好，\n\n我想跟进一下之前关于 [主题] 的沟通。\n\n[跟进内容]\n\n如有任何更新，请随时告知。\n\n此致',
  },
  {
    label: '道歉',
    subject: '关于 [事项] 的致歉',
    body: '您好，\n\n对于 [事项] 给您带来的不便，我深表歉意。\n\n[具体情况说明]\n\n我们已采取以下措施确保不再发生：\n\n1. \n2. \n\n感谢您的理解与支持。\n\n此致',
  },
  {
    label: '推荐/介绍',
    subject: '推荐：[人名/产品]',
    body: '您好，\n\n我想向您推荐 [人名/产品]，原因如下：\n\n[推荐理由]\n\n如您有兴趣，我可以安排进一步沟通。\n\n此致',
  },
];

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
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];
  const handleSelectTemplate = useCallback((index: number) => {
    if (subject.trim() || body.trim()) {
      if (!window.confirm('应用模板将替换当前的邮件内容，确定继续吗？')) return;
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
      setError('暂无可用的邮件工具');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const args = JSON.stringify({ to, subject, body });
      const res = await invokeCastTool(emailToolName, args);
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '生成失败，请重试';
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
  const emailError = to.trim() && !emailValid ? '请输入有效的邮箱地址' : null;

  return (
    <div style={S.wrap}>
      <h2 style={S.title}>邮件草稿</h2>

      {/* Template selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={S.sectionLabel}>快速模板</div>
          {subject.trim() && (
            <button
              onClick={() => {
                const name = window.prompt('模板名称:');
                if (name && name.trim()) {
                  const newTpl = { label: name.trim(), subject, body };
                  const updated = [...customTemplates, newTpl];
                  setCustomTemplates(updated);
                  saveCustomTemplates(updated);
                }
              }}
              style={{ fontSize: 11, color: 'var(--c-accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              title="将当前内容保存为模板"
            >
              + 保存为模板
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[...BUILTIN_TEMPLATES, ...customTemplates].map((tpl, i) => (
            <span
              key={tpl.label + i}
              style={S.templateChip(activeTemplate === i)}
              onClick={() => handleSelectTemplate(i)}
              onContextMenu={i >= BUILTIN_TEMPLATES.length ? (e) => {
                e.preventDefault();
                if (window.confirm(`删除自定义模板「${tpl.label}」？`)) {
                  const ci = i - BUILTIN_TEMPLATES.length;
                  const updated = customTemplates.filter((_, idx) => idx !== ci);
                  setCustomTemplates(updated);
                  saveCustomTemplates(updated);
                  setActiveTemplate(null);
                }
              } : undefined}
            >
              {tpl.label}
              {i >= BUILTIN_TEMPLATES.length && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.5 }}>✕</span>}
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
                <div style={{ ...S.sectionLabel, fontSize: 11 }}>CC</div>
                <input style={S.input} placeholder="抄送邮箱" value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...S.sectionLabel, fontSize: 11 }}>BCC</div>
                <input style={S.input} placeholder="密送邮箱" value={bcc} onChange={(e) => setBcc(e.target.value)} />
              </div>
            </>
          )}
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
            {generating ? '生成中...' : '生成邮件'}
          </button>

          {!email.available && !email.loading && (
            <span style={{ fontSize: 12, color: 'var(--c-textMute)' }}>
              暂无可用的邮件工具
            </span>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...S.errorText }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => void handleGenerate()} style={{ fontSize: 11, padding: '2px 6px', background: 'transparent', border: '1px solid var(--c-danger)', borderRadius: 'var(--r-sm)', color: 'var(--c-danger)', cursor: 'pointer' }}>重试</button>
            <button onClick={() => setError(null)} style={{ fontSize: 14, background: 'transparent', border: 'none', color: 'var(--c-danger)', cursor: 'pointer', padding: '0 2px' }}>×</button>
          </div>
        )}
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
