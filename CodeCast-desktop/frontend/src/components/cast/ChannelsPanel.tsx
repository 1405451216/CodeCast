import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  ChannelConfig,
  ChannelType,
  CastMessage,
  WebhookChannelConfig,
  EmailChannelConfig,
  CustomChannelConfig
} from '../../types/cast-channels';
import { useCastChannelsStore } from '../../store/useCastChannelsStore';
import { WEBHOOK_TEMPLATES } from '../../utils/cast/cast-channels-engine';
import '../../styles/cast-workspace.css';

const CHANNEL_TYPES: { key: ChannelType; label: string; icon: string; color: string }[] = [
  { key: 'webhook', label: 'Webhook', icon: '🔗', color: '#3b82f6' },
  { key: 'email', label: '邮件', icon: '📧', color: '#ef4444' },
  { key: 'custom', label: '自定义', icon: '⚙️', color: '#8b5cf6' },
  { key: 'console', label: '控制台', icon: '🖥️', color: '#6b7280' },
  { key: 'notification', label: '通知', icon: '🔔', color: '#f59e0b' }
];

const AVAILABLE_EVENT_TYPES = [
  'agent_task_complete',
  'agent_step_complete',
  'agent_error',
  'schedule_reminder',
  'schedule_task_run',
  'memory_saved',
  'memory_alert',
  'tool_executed',
  'plugin_installed',
  'plugin_error',
  'notification',
  'daily_summary',
  'error_report'
];

interface WebhookFormState {
  name: string;
  url: string;
  method: 'POST' | 'GET';
  headers: string;
  secret: string;
  contentType: 'json' | 'form';
  retryCount: number;
  timeout: number;
  enabledEvents: string[];
}

interface EmailFormState {
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  useTLS: boolean;
  fromAddress: string;
  toAddresses: string;
  subjectPrefix: string;
  enabledEvents: string[];
}

interface CustomFormState {
  name: string;
  handler: string;
  configJson: string;
}

const EMPTY_WEBHOOK_FORM: WebhookFormState = {
  name: '',
  url: '',
  method: 'POST',
  headers: '{}',
  secret: '',
  contentType: 'json',
  retryCount: 3,
  timeout: 10000,
  enabledEvents: ['*']
};

const EMPTY_EMAIL_FORM: EmailFormState = {
  name: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  useTLS: true,
  fromAddress: '',
  toAddresses: '',
  subjectPrefix: '[Cast]',
  enabledEvents: ['*']
};

const EMPTY_CUSTOM_FORM: CustomFormState = {
  name: '',
  handler: '',
  configJson: '{}'
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function maskSensitiveUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '****';
    }
    const pathParts = urlObj.pathname.split('/');
    if (pathParts.length > 3) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart.length > 8) {
        pathParts[pathParts.length - 1] = lastPart.slice(0, 4) + '****';
      }
    }
    urlObj.pathname = pathParts.join('/');
    return urlObj.toString();
  } catch {
    if (url.length > 40) {
      return url.slice(0, 20) + '...' + url.slice(-15);
    }
    return url;
  }
}

function getChannelDisplayInfo(config: ChannelConfig): { displayUrl: string; subtitle: string } {
  if (config.type === 'webhook') {
    const wc = config as WebhookChannelConfig;
    return {
      displayUrl: maskSensitiveUrl(wc.url),
      subtitle: wc.enabledEvents.join(', ') || '(无事件)'
    };
  }
  if (config.type === 'email') {
    const ec = config as EmailChannelConfig;
    return {
      displayUrl: `${ec.smtpHost}:${ec.smtpPort} → ${ec.toAddresses.join(', ')}`,
      subtitle: ec.enabledEvents.join(', ') || '(无事件)'
    };
  }
  if (config.type === 'custom') {
    const cc = config as CustomChannelConfig;
    return {
      displayUrl: cc.handler,
      subtitle: 'Custom handler'
    };
  }
  return { displayUrl: '', subtitle: '' };
}

const ChannelsPanel: React.FC = () => {
  const {
    channels, messages, activeEventBridges,
    addChannel, updateChannel, removeChannel, toggleChannel, testChannel,
    setupFromTemplate, bridgeEvent, unbridgeEvent,
    getMessages, loadFromStorage, clearAll
  } = useCastChannelsStore();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<ChannelType>('webhook');
  const [webhookForm, setWebhookForm] = useState<WebhookFormState>({ ...EMPTY_WEBHOOK_FORM });
  const [emailForm, setEmailForm] = useState<EmailFormState>({ ...EMPTY_EMAIL_FORM });
  const [customForm, setCustomForm] = useState<CustomFormState>({ ...EMPTY_CUSTOM_FORM });
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency: number; error?: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const recentMessages = useMemo(() => getMessages(20), [messages, getMessages]);

  const handleAddChannel = useCallback(() => {
    if (formType === 'webhook') {
      if (!webhookForm.name.trim() || !webhookForm.url.trim()) return;

      let headers: Record<string, string> = {};
      try { headers = JSON.parse(webhookForm.headers || '{}'); } catch { headers = {}; }

      const config: WebhookChannelConfig = {
        type: 'webhook',
        name: webhookForm.name.trim(),
        url: webhookForm.url.trim(),
        method: webhookForm.method,
        headers,
        secret: webhookForm.secret || undefined,
        contentType: webhookForm.contentType,
        retryCount: webhookForm.retryCount,
        timeout: webhookForm.timeout,
        enabledEvents: webhookForm.enabledEvents
      };

      addChannel(config);
      setWebhookForm({ ...EMPTY_WEBHOOK_FORM });
    }

    if (formType === 'email') {
      if (!emailForm.name.trim() || !emailForm.smtpHost.trim()) return;

      const config: EmailChannelConfig = {
        type: 'email',
        name: emailForm.name.trim(),
        smtpHost: emailForm.smtpHost.trim(),
        smtpPort: emailForm.smtpPort,
        smtpUser: emailForm.smtpUser,
        smtpPass: emailForm.smtpPass,
        useTLS: emailForm.useTLS,
        fromAddress: emailForm.fromAddress,
        toAddresses: emailForm.toAddresses.split(',').map(a => a.trim()).filter(Boolean),
        subjectPrefix: emailForm.subjectPrefix,
        enabledEvents: emailForm.enabledEvents
      };

      addChannel(config);
      setEmailForm({ ...EMPTY_EMAIL_FORM });
    }

    if (formType === 'custom') {
      if (!customForm.name.trim() || !customForm.handler.trim()) return;

      let customConfig: Record<string, unknown> = {};
      try { customConfig = JSON.parse(customForm.configJson || '{}'); } catch { customConfig = {}; }

      const config: CustomChannelConfig = {
        type: 'custom',
        name: customForm.name.trim(),
        handler: customForm.handler.trim(),
        config: customConfig
      };

      addChannel(config);
      setCustomForm({ ...EMPTY_CUSTOM_FORM });
    }

    setShowNewForm(false);
    setEditingId(null);
  }, [formType, webhookForm, emailForm, customForm, addChannel]);

  const handleEditSave = useCallback(() => {
    if (!editingId) return;

    handleAddChannel();
  }, [editingId, handleAddChannel]);

  const startEdit = useCallback((channel: { id: string; config: ChannelConfig }) => {
    setEditingId(channel.id);
    setFormType(channel.config.type);

    if (channel.config.type === 'webhook') {
      const wc = channel.config as WebhookChannelConfig;
      setWebhookForm({
        name: wc.name,
        url: wc.url,
        method: wc.method,
        headers: JSON.stringify(wc.headers || {}, null, 2),
        secret: wc.secret || '',
        contentType: wc.contentType,
        retryCount: wc.retryCount,
        timeout: wc.timeout,
        enabledEvents: [...wc.enabledEvents]
      });
    }

    if (channel.config.type === 'email') {
      const ec = channel.config as EmailChannelConfig;
      setEmailForm({
        name: ec.name,
        smtpHost: ec.smtpHost,
        smtpPort: ec.smtpPort,
        smtpUser: ec.smtpUser,
        smtpPass: ec.smtpPass,
        useTLS: ec.useTLS,
        fromAddress: ec.fromAddress,
        toAddresses: ec.toAddresses.join(', '),
        subjectPrefix: ec.subjectPrefix,
        enabledEvents: [...ec.enabledEvents]
      });
    }

    if (channel.config.type === 'custom') {
      const cc = channel.config as CustomChannelConfig;
      setCustomForm({
        name: cc.name,
        handler: cc.handler,
        configJson: JSON.stringify(cc.config, null, 2)
      });
    }

    setShowNewForm(true);
  }, []);

  const handleTestChannel = useCallback(async (id: string) => {
    setTestingId(id);
    const result = await testChannel(id);
    setTestResults(prev => ({ ...prev, [id]: result }));
    setTestingId(null);
  }, [testChannel]);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      console.error('Failed to copy URL');
    }
  }, []);

  const handleTemplateSelect = useCallback((templateKey: string) => {
    const template = WEBHOOK_TEMPLATES[templateKey];
    if (!template) return;

    setFormType('webhook');
    setWebhookForm({
      ...EMPTY_WEBHOOK_FORM,
      name: template.name,
      url: template.urlTemplate,
      contentType: template.contentType
    });

    setShowTemplatePicker(false);
    setShowNewForm(true);
  }, []);

  const toggleEventBridge = useCallback((eventType: string) => {
    if (activeEventBridges.includes(eventType)) {
      unbridgeEvent(eventType);
    } else {
      bridgeEvent(eventType);
    }
  }, [activeEventBridges, bridgeEvent, unbridgeEvent]);

  const renderForm = () => {
    if (formType === 'webhook') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={webhookForm.name}
              onChange={(e) => setWebhookForm(f => ({ ...f, name: e.target.value }))}
              placeholder="通道名称 *"
              style={inputStyle(180)}
              autoFocus={!editingId}
            />
            <input
              type="text"
              value={webhookForm.url}
              onChange={(e) => setWebhookForm(f => ({ ...f, url: e.target.value }))}
              placeholder="Webhook URL *"
              style={inputStyle(320)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={webhookForm.method}
              onChange={(e) => setWebhookForm(f => ({ ...f, method: e.target.value as 'POST' | 'GET' }))}
              style={selectStyle(80)}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>

            <select
              value={webhookForm.contentType}
              onChange={(e) => setWebhookForm(f => ({ ...f, contentType: e.target.value as 'json' | 'form' }))}
              style={selectStyle(100)}
            >
              <option value="json">JSON</option>
              <option value="form">Form</option>
            </select>

            <label style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>重试:</label>
            <input
              type="number"
              value={webhookForm.retryCount}
              onChange={(e) => setWebhookForm(f => ({ ...f, retryCount: parseInt(e.target.value) || 3 }))}
              style={inputStyle(60)}
              min={0}
              max={10}
            />

            <label style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>超时(ms):</label>
            <input
              type="number"
              value={webhookForm.timeout}
              onChange={(e) => setWebhookForm(f => ({ ...f, timeout: parseInt(e.target.value) || 10000 }))}
              style={inputStyle(90)}
              min={1000}
              max={60000}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              value={webhookForm.secret}
              onChange={(e) => setWebhookForm(f => ({ ...f, secret: e.target.value }))}
              placeholder="签名密钥 (可选，HMAC-SHA256)"
              style={{ ...inputStyle(280), fontFamily: 'monospace', fontSize: 11 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>自定义Headers (JSON):</label>
            <textarea
              value={webhookForm.headers}
              onChange={(e) => setWebhookForm(f => ({ ...f, headers: e.target.value }))}
              placeholder='{"Authorization": "Bearer xxx"}'
              rows={2}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                marginTop: 4
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>事件白名单 (多选):</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              marginTop: 4,
              maxHeight: 80,
              overflowY: 'auto',
              padding: 4,
              border: '1px solid var(--border-color)',
              borderRadius: 6
            }}>
              {AVAILABLE_EVENT_TYPES.map(evt => (
                <label key={evt} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 8px',
                  background: webhookForm.enabledEvents.includes(evt)
                    ? 'rgba(59,130,246,0.12)'
                    : 'transparent',
                  border: `1px solid ${webhookForm.enabledEvents.includes(evt) ? '#3b82f6' : 'var(--border-color)'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 10
                }}>
                  <input
                    type="checkbox"
                    checked={webhookForm.enabledEvents.includes(evt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setWebhookForm(f => ({
                          ...f,
                          enabledEvents: [...f.enabledEvents.filter(x => x !== '*'), evt]
                        }));
                      } else {
                        setWebhookForm(f => ({
                          ...f,
                          enabledEvents: f.enabledEvents.filter(x => x !== evt)
                        }));
                      }
                    }}
                  />
                  {evt}
                </label>
              ))}
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 8px',
                background: webhookForm.enabledEvents.includes('*')
                  ? 'rgba(59,130,246,0.12)'
                  : 'transparent',
                border: `1px solid ${webhookForm.enabledEvents.includes('*') ? '#3b82f6' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 10
              }}>
                <input
                  type="checkbox"
                  checked={webhookForm.enabledEvents.includes('*')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setWebhookForm(f => ({ ...f, enabledEvents: ['*'] }));
                    } else {
                      setWebhookForm(f => ({ ...f, enabledEvents: [] }));
                    }
                  }}
                />
                * (全部事件)
              </label>
            </div>
          </div>
        </div>
      );
    }

    if (formType === 'email') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={emailForm.name}
              onChange={(e) => setEmailForm(f => ({ ...f, name: e.target.value }))}
              placeholder="通道名称 *"
              style={inputStyle(160)}
              autoFocus={!editingId}
            />
            <input
              type="text"
              value={emailForm.fromAddress}
              onChange={(e) => setEmailForm(f => ({ ...f, fromAddress: e.target.value }))}
              placeholder="发件人地址"
              style={inputStyle(200)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={emailForm.smtpHost}
              onChange={(e) => setEmailForm(f => ({ ...f, smtpHost: e.target.value }))}
              placeholder="SMTP服务器 *"
              style={inputStyle(180)}
            />
            <input
              type="number"
              value={emailForm.smtpPort}
              onChange={(e) => setEmailForm(f => ({ ...f, smtpPort: parseInt(e.target.value) || 587 }))}
              placeholder="端口"
              style={inputStyle(70)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={emailForm.useTLS}
                onChange={(e) => setEmailForm(f => ({ ...f, useTLS: e.target.checked }))}
              />
              TLS
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={emailForm.smtpUser}
              onChange={(e) => setEmailForm(f => ({ ...f, smtpUser: e.target.value }))}
              placeholder="SMTP用户名"
              style={inputStyle(150)}
            />
            <input
              type="password"
              value={emailForm.smtpPass}
              onChange={(e) => setEmailForm(f => ({ ...f, smtpPass: e.target.value }))}
              placeholder="SMTP密码"
              style={inputStyle(150)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>收件人 (逗号分隔):</label>
            <input
              type="text"
              value={emailForm.toAddresses}
              onChange={(e) => setEmailForm(f => ({ ...f, toAddresses: e.target.value }))}
              placeholder="user1@example.com, user2@example.com"
              style={{ ...inputStyle(400), width: '100%', marginTop: 4 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>主题前缀:</label>
            <input
              type="text"
              value={emailForm.subjectPrefix}
              onChange={(e) => setEmailForm(f => ({ ...f, subjectPrefix: e.target.value }))}
              placeholder="[Cast]"
              style={inputStyle(120)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>事件白名单:</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              marginTop: 4,
              maxHeight: 80,
              overflowY: 'auto',
              padding: 4,
              border: '1px solid var(--border-color)',
              borderRadius: 6
            }}>
              {AVAILABLE_EVENT_TYPES.map(evt => (
                <label key={evt} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 8px',
                  background: emailForm.enabledEvents.includes(evt)
                    ? 'rgba(239,68,68,0.08)'
                    : 'transparent',
                  border: `1px solid ${emailForm.enabledEvents.includes(evt) ? '#ef4444' : 'var(--border-color)'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 10
                }}>
                  <input
                    type="checkbox"
                    checked={emailForm.enabledEvents.includes(evt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEmailForm(f => ({
                          ...f,
                          enabledEvents: [...f.enabledEvents.filter(x => x !== '*'), evt]
                        }));
                      } else {
                        setEmailForm(f => ({
                          ...f,
                          enabledEvents: f.enabledEvents.filter(x => x !== evt)
                        }));
                      }
                    }}
                  />
                  {evt}
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (formType === 'custom') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={customForm.name}
              onChange={(e) => setCustomForm(f => ({ ...f, name: e.target.value }))}
              placeholder="通道名称 *"
              style={inputStyle(180)}
              autoFocus={!editingId}
            />
            <input
              type="text"
              value={customForm.handler}
              onChange={(e) => setCustomForm(f => ({ ...f, handler: e.target.value }))}
              placeholder="处理器名或URL *"
              style={inputStyle(300)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>配置 (JSON):</label>
            <textarea
              value={customForm.configJson}
              onChange={(e) => setCustomForm(f => ({ ...f, configJson: e.target.value }))}
              placeholder='{"key": "value"}'
              rows={4}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                marginTop: 4
              }}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="cast-panel-container">
      <div className="cast-toolbar">
        <div className="cast-toolbar-group" style={{ alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            外部通信通道
          </span>
          <span className="cast-stat-item cast-tag-blue" style={{ fontSize: 11 }}>
            已配置: {channels.length}
          </span>
          <span className="cast-stat-item cast-tag-green" style={{ fontSize: 11 }}>
            桥接事件: {activeEventBridges.length}
          </span>
        </div>

        <div className="cast-toolbar-divider" />

        <div className="cast-toolbar-group">
          <button
            className="cast-toolbar-btn active"
            onClick={() => {
              setEditingId(null);
              setFormType('webhook');
              setWebhookForm({ ...EMPTY_WEBHOOK_FORM });
              setShowNewForm(!showNewForm);
            }}
          >
            + 新建通道
          </button>

          <button
            className="cast-toolbar-btn"
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
          >
            从模板创建
          </button>

          <button
            className="cast-toolbar-btn"
            onClick={clearAll}
            disabled={channels.length === 0}
            style={{ color: channels.length > 0 ? '#ef4444' : undefined }}
          >
            清空全部
          </button>
        </div>
      </div>

      {showTemplatePicker && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(139,92,246,0.05)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            选择Webhook模板
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(WEBHOOK_TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                className="cast-toolbar-btn"
                onClick={() => handleTemplateSelect(key)}
                style={{ fontSize: 11, padding: '6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 120 }}
                title={tmpl.docs || tmpl.name}
              >
                <span>{tmpl.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{tmpl.urlTemplate.slice(0, 30)}...</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showNewForm && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(59,130,246,0.04)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {editingId ? '编辑通道' : '新建通信通道'}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>类型:</span>
            {CHANNEL_TYPES.map(t => (
              <button
                key={t.key}
                className={`cast-toolbar-btn ${formType === t.key ? 'active' : ''}`}
                onClick={() => setFormType(t.key)}
                style={{ fontSize: 11, padding: '3px 10px' }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {renderForm()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <button
              className="cast-toolbar-btn"
              onClick={() => {
                setShowNewForm(false);
                setEditingId(null);
                setWebhookForm({ ...EMPTY_WEBHOOK_FORM });
                setEmailForm({ ...EMPTY_EMAIL_FORM });
                setCustomForm({ ...EMPTY_CUSTOM_FORM });
              }}
            >
              取消
            </button>
            <button
              className="cast-toolbar-btn active"
              onClick={editingId ? handleEditSave : handleAddChannel}
            >
              {editingId ? '保存修改' : '创建通道'}
            </button>
          </div>
        </div>
      )}

      {channels.length === 0 ? (
        <div className="cast-empty-state">
          <div className="cast-empty-icon">📡</div>
          <h4>暂无通信通道</h4>
          <p className="hint">点击 "新建通道" 或使用模板快速配置飞书/钉钉/企业微信等通知</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {channels.map(channel => {
            const config = channel.config;
            const typeInfo = CHANNEL_TYPES.find(t => t.key === config.type);
            const displayInfo = getChannelDisplayInfo(config);
            const testResult = testResults[channel.id];
            const isActive = config.type === 'webhook'
              ? (config as WebhookChannelConfig).enabledEvents.length > 0
              : config.type === 'email'
                ? (config as EmailChannelConfig).enabledEvents.length > 0
                : true;

            return (
              <div key={channel.id} className="cast-list-item">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  flex: 1
                }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: isActive ? '#10b981' : '#9ca3af',
                    display: 'inline-block',
                    flexShrink: 0
                  }} />

                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {typeInfo?.icon || '📡'}
                  </span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cast-list-item-title" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {config.name}
                      <span className="cast-tag cast-tag-blue" style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        flexShrink: 0
                      }}>
                        {typeInfo?.label || config.type}
                      </span>
                    </div>
                    <div className="cast-list-item-subtitle">
                      <span style={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                        fontFamily: 'monospace',
                        fontSize: 10
                      }}>
                        {displayInfo.displayUrl}
                      </span>
                      <span style={{ margin: '0 4px' }}>·</span>
                      <span>事件: {displayInfo.subtitle}</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0
                }}>
                  {testResult && (
                    <span style={{
                      fontSize: 10,
                      color: testResult.success ? '#10b981' : '#ef4444',
                      marginRight: 4,
                      whiteSpace: 'nowrap'
                    }}>
                      {testResult.success ? `OK ${testResult.latency}ms` : `FAIL ${testResult.error?.slice(0, 20)}`}
                    </span>
                  )}

                  <button
                    className="cast-toolbar-btn"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => startEdit(channel)}
                    title="编辑"
                  >
                    编辑
                  </button>

                  <button
                    className="cast-toolbar-btn"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => handleTestChannel(channel.id)}
                    title="测试连接"
                    disabled={testingId === channel.id}
                  >
                    {testingId === channel.id ? '测试中...' : '测试'}
                  </button>

                  {(config.type === 'webhook') && (
                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => handleCopyUrl((config as WebhookChannelConfig).url)}
                      title="复制URL"
                    >
                      复制URL
                    </button>
                  )}

                  <button
                    className="cast-toolbar-btn"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => toggleChannel(channel.id)}
                    title={isActive ? '禁用' : '启用'}
                  >
                    {isActive ? '⏸️' : '▶️'}
                  </button>

                  <button
                    className="cast-toolbar-btn"
                    style={{ padding: '2px 6px', fontSize: 10, color: '#ef4444' }}
                    onClick={() => removeChannel(channel.id)}
                    title="删除"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        borderTop: '2px solid var(--border-color)',
        padding: '12px 16px',
        background: 'rgba(245,158,11,0.03)'
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          事件桥接
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>
            自动将以下事件转发到已配置的通道
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {AVAILABLE_EVENT_TYPES.map(evt => {
            const isBridged = activeEventBridges.includes(evt);
            return (
              <button
                key={evt}
                className={`cast-toolbar-btn ${isBridged ? 'active' : ''}`}
                onClick={() => toggleEventBridge(evt)}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  background: isBridged ? 'rgba(16,185,129,0.1)' : undefined,
                  borderColor: isBridged ? '#10b981' : undefined,
                  color: isBridged ? '#10b981' : undefined
                }}
              >
                {isBridged ? '✅' : '⬜'} {evt}
              </button>
            );
          })}
        </div>
      </div>

      {recentMessages.length > 0 && (
        <div style={{
          borderTop: '2px solid var(--border-color)',
          padding: '12px 16px',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              最近消息
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="cast-toolbar-btn"
                onClick={clearAll}
                style={{ fontSize: 10, color: '#ef4444' }}
              >
                清空
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentMessages.slice(0, 10).map(msg => {
              const ch = channels.find(c => c.id === msg.channelId);
              return (
                <div key={msg.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  fontSize: 11,
                  borderBottom: '1px solid rgba(128,128,128,0.06)'
                }}>
                  <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 10 }}>
                    [{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}]
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {ch?.config.name || msg.channelId}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    → {msg.eventType}
                  </span>
                  <span style={{
                    color: msg.status === 'sent' || msg.status === 'delivered'
                      ? '#10b981'
                      : msg.status === 'failed'
                        ? '#ef4444'
                        : '#f59e0b'
                  }}>
                    {msg.status === 'sent' ? 'OK' : msg.status === 'delivered' ? 'DELIVERED' : msg.status === 'failed' ? 'FAIL' : 'PENDING'}
                  </span>
                  {msg.error && (
                    <span style={{ color: '#ef4444', fontSize: 10, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.error.slice(0, 30)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function inputStyle(width: number): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    width,
    boxSizing: 'border-box'
  };
}

function selectStyle(width: number): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    width,
    boxSizing: 'border-box',
    cursor: 'pointer'
  };
}

export default React.memo(ChannelsPanel);
