import React, { useState, useMemo, useCallback } from 'react';
import type { EmailTemplateType, EmailDraft, EmailSignature } from '../../types/cast-types';
import { EMAIL_TEMPLATES } from '../../types/cast-types';
import { renderTemplate, polishEmail, SIGNATURE_PLACEHOLDERS } from '../../utils/cast/email-engine';

const EmailComposer: React.FC = () => {
  const [drafts, setDrafts] = useState<EmailDraft[]>([
    {
      id: 'draft-1',
      to: ['team@company.com'],
      cc: [],
      bcc: [],
      subject: '本周工作汇报 - 张三',
      body: '团队好：\n\n以下是本周的工作汇报：\n\n## 一、主要工作\n\n1. 完成了 Cast 模式工作台的基础搭建\n2. 实现了写作助手的核心功能\n3. 完成了翻译工作台的 UI 开发\n\n## 二、遇到问题\n\n- 组件间通信需要进一步优化\n- 样式在不同主题下的适配待验证\n\n## 三、下周计划\n\n1. 完善日程管理功能\n2. 实现知识库笔记系统\n3. 补充单元测试\n\n请审阅。',
      templateType: 'report',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000
    }
  ]);
  const [signatures, setSignatures] = useState<EmailSignature[]>(SIGNATURE_PLACEHOLDERS.slice(0, 2).map((tmpl, i) => ({
    id: `sig-${i}`,
    name: tmpl.name,
    content: tmpl.content,
    isDefault: i === 0
  })));
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(drafts[0]?.id || null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>('custom');
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishTone, setPolishTone] = useState<string>('formal');
  const [showVarForm, setShowVarForm] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  const selectedDraft = drafts.find(d => d.id === selectedDraftId);

  const updateDraft = useCallback((field: keyof EmailDraft, value: string | string[]) => {
    if (!selectedDraftId) return;
    setDrafts(prev => prev.map(d =>
      d.id === selectedDraftId ? { ...d, [field]: value, updatedAt: Date.now() } : d
    ));
  }, [selectedDraftId]);

  const handleCreateFromTemplate = useCallback((type: EmailTemplateType) => {
    setSelectedTemplate(type);
    const tmpl = EMAIL_TEMPLATES.find(t => t.key === type);
    if (!tmpl) return;

    const vars: Record<string, string> = {};
    tmpl.subject.match(/\{\{(\w+)\}\}/g)?.forEach(m => {
      const key = m.slice(2, -2);
      vars[key] = '';
    });
    tmpl.body.match(/\{\{(\w+)\}\}/g)?.forEach(m => {
      const key = m.slice(2, -2);
      vars[key] = '';
    });

    if (Object.keys(vars).length > 0) {
      setTemplateVars(vars);
      setShowVarForm(true);
      return;
    }

    const newDraft: EmailDraft = {
      id: `draft-${Date.now()}`,
      to: [], cc: [], bcc: [],
      subject: tmpl.subject,
      body: tmpl.body,
      templateType: type,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setDrafts(prev => [newDraft, ...prev]);
    setSelectedDraftId(newDraft.id);
    setShowTemplatePanel(false);
  }, []);

  const handleApplyTemplateVars = useCallback(() => {
    const tmpl = EMAIL_TEMPLATES.find(t => t.key === selectedTemplate);
    if (!tmpl) return;

    const { subject, body } = renderTemplate(selectedTemplate, templateVars);
    const newDraft: EmailDraft = {
      id: `draft-${Date.now()}`,
      to: [], cc: [], bcc: [],
      subject,
      body,
      templateType: selectedTemplate,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setDrafts(prev => [newDraft, ...prev]);
    setSelectedDraftId(newDraft.id);
    setShowVarForm(false);
    setShowTemplatePanel(false);
    setTemplateVars({});
  }, [selectedTemplate, templateVars]);

  const handleAIPolish = useCallback(async () => {
    if (!selectedDraft || !selectedDraft.body.trim()) return;
    setIsPolishing(true);

    try {
      const result = await polishEmail(
        { subject: selectedDraft.subject, body: selectedDraft.body },
        polishTone as any
      );

      if (result.subject || result.body) {
        setDrafts(prev => prev.map(d =>
          d.id === selectedDraftId
            ? {
                ...d,
                subject: result.subject || d.subject,
                body: result.body || d.body,
                updatedAt: Date.now()
              }
            : d
        ));
      }
    } catch (error: any) {
      console.error('[EmailComposer] Polish failed:', error);
    } finally {
      setIsPolishing(false);
    }
  }, [selectedDraft, selectedDraftId, polishTone]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const defaultSig = signatures.find(s => s.isDefault);

  return (
    <div className="cast-panel-container" style={{ padding: 0, display: 'flex', height: '100%' }}>
      <div style={{ width: '240px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className="cast-toolbar" style={{ padding: '8px 12px', gap: 6 }}>
          <button className="cast-toolbar-btn active" style={{ flex: 1 }} onClick={() => setShowTemplatePanel(!showTemplatePanel)}>
            📋 模板 ({EMAIL_TEMPLATES.length})
          </button>
          <button className="cast-toolbar-btn" onClick={() => {
            const newDraft: EmailDraft = {
              id: `draft-${Date.now()}`, to: [], cc: [], bcc: [],
              subject: '', body: '', templateType: 'custom',
              createdAt: Date.now(), updatedAt: Date.now()
            };
            setDrafts(prev => [newDraft, ...prev]);
            setSelectedDraftId(newDraft.id);
          }}>+ 新建</button>
        </div>

        {showTemplatePanel && (
          <div style={{ padding: '8px', maxHeight: '200px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)' }}>
            {EMAIL_TEMPLATES.map(tmpl => (
              <div key={tmpl.key} className="cast-list-item" style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => handleCreateFromTemplate(tmpl.key)}>
                <span className="cast-list-item-icon">{tmpl.icon}</span>
                <div className="cast-list-item-content">
                  <div className="cast-list-item-title">{tmpl.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showVarForm && (
          <div style={{ padding: '10px', background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: '#f59e0b' }}>📝 填写模板变量</div>
            {Object.entries(templateVars).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{key}</label>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setTemplateVars(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`输入 ${key}...`}
                  style={{
                    width: '100%', padding: '4px 8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 4,
                    fontSize: 11, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button className="cast-toolbar-btn active" style={{ flex: 1 }} onClick={handleApplyTemplateVars}>应用模板</button>
              <button className="cast-toolbar-btn" onClick={() => { setShowVarForm(false); setTemplateVars({}); }}>取消</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            草稿 ({drafts.length})
          </div>
          {drafts.map(draft => {
            const tmpl = EMAIL_TEMPLATES.find(t => t.key === draft.templateType);
            return (
              <div key={draft.id} className="cast-list-item" onClick={() => setSelectedDraftId(draft.id)}
                style={{ background: draft.id === selectedDraftId ? 'rgba(192,132,252,0.06)' : undefined, padding: '9px 12px' }}>
                <span className="cast-list-item-icon">{tmpl?.icon || '\u{1F4DD}'}</span>
                <div className="cast-list-item-content">
                  <div className="cast-list-item-title">{draft.subject || '(无主题)'}</div>
                  <div className="cast-list-item-subtitle">
                    <span>{tmpl?.label || '自定义'}</span>
                    <span style={{ margin: '0 4px' }}>·</span>
                    <span>{Array.isArray(draft.to) ? draft.to.length : 0} 收件人</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedDraft ? (
          <>
            <div style={{ padding: '10px 16px', display: 'flex', gap: 10, borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1', minWidth: '150px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>收件人:</label>
                <input type="text" value={Array.isArray(selectedDraft.to) ? selectedDraft.to.join(', ') : ''}
                  onChange={(e) => updateDraft('to', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="email@example.com"
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, outline: 'none', minWidth: 0 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1', minWidth: '150px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>主题:</label>
                <input type="text" value={selectedDraft.subject} onChange={(e) => updateDraft('subject', e.target.value)}
                  placeholder="邮件主题..."
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, outline: 'none', minWidth: 0 }} />
              </div>
            </div>

            <div className="cast-editor-area" style={{ flex: 1, position: 'relative' }}>
              <textarea className="cast-editor-textarea" value={selectedDraft.body} onChange={(e) => updateDraft('body', e.target.value)}
                placeholder="撰写邮件正文..." style={{ paddingBottom: '48px' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '8px 16px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center',
                background: 'linear-gradient(transparent, var(--bg-primary) 30%)', borderTop: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="cast-toolbar-btn" onClick={() => copyToClipboard(`收件人: ${selectedDraft.to.join(', ')}\n主题: ${selectedDraft.subject}\n\n${selectedDraft.body}`)}>📋 复制</button>
                  <button className="cast-toolbar-btn active" onClick={handleAIPolish} disabled={isPolishing || !selectedDraft.body.trim()}>
                    {isPolishing ? '\u{23F3} 润色中...' : '\u2728 AI润色'}
                  </button>
                  <select className="cast-toolbar-select" value={polishTone} onChange={(e) => setPolishTone(e.target.value)} style={{ width: 'auto', fontSize: '10.5px', padding: '4px 6px' }}>
                    <option value="formal">正式</option>
                    <option value="friendly">友好</option>
                    <option value="urgent">紧急</option>
                    <option value="apologetic">道歉</option>
                  </select>
                  <select className="cast-toolbar-select" style={{ width: 'auto', fontSize: '10.5px', padding: '4px 6px' }}>
                    {signatures.map(sig => (<option key={sig.id} value={sig.id}>{sig.name}</option>))}
                  </select>
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {selectedDraft.body.length} 字符 · 预计阅读 {(selectedDraft.body.length / 400).toFixed(1)}min · {new Date(selectedDraft.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="cast-empty-state">
            <div className="cast-empty-icon">📧</div>
            <h4>邮件起草器</h4>
            <p>选择草稿或从模板新建邮件</p>
            <p className="hint">支持 {EMAIL_TEMPLATES.length} 种模板 · AI 润色 · 变量填充 · 一键复制</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(EmailComposer);
