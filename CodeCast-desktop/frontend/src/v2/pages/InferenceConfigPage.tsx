import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { InferenceConfig } from '../wails/adapter';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';
import { Breadcrumb } from '../components/primitives/Breadcrumb';

// 定义简化的配置接口，不包含内部方法
interface ConnectionCfg {
  gateway_type: string;
  cred_type: string;
  base_url: string;
  api_key_enc: string;
  auth_scheme: string;
  custom_headers: Record<string, string>;
  model: { discover_enabled: boolean; models: string[] };
}

interface WorkspaceCfg {
  cowork_enabled: boolean;
  code_enabled: boolean;
  allowed_hosts: string;
  workspace_folder: string;
  disabled_tools: string[];
  disable_login: boolean;
  disable_deep_link: boolean;
}

interface ConnectorsCfg {
  mcp_managed_servers: Array<{ name: string; url: string; auth_type: string }>;
  allow_user_mcp: boolean;
  allow_desktop_ext: boolean;
  require_signed: boolean;
}

interface PluginsCfg {
  org_plugin_path: string;
  server_policies: Array<{ name: string; path: string }>;
}

interface DiagnosticsCfg {
  log_level: string;
  enable_telemetry: boolean;
  auto_update?: boolean;
}

interface UsageCfg {
  daily_token_limit: number;
  monthly_cost_limit: number;
  warn_threshold_pct: number;
}

interface AppearanceCfg {
  theme: string;
  font_size: string;
  code_font_size: string;
  language: string;
  sidebar_width: number;
  show_line_numbers: boolean;
}

interface OutboundCfg {
  http_proxy: string;
  https_proxy: string;
  no_proxy: string;
  tls_min_version: string;
  verify_tls: boolean;
  connect_timeout: number;
  read_timeout: number;
  allowed_ports: string;
  allowed_hosts_list?: Array<{ host: string; port: string; desc: string }>;
}

export interface InferenceCfgType {
  connection: ConnectionCfg;
  workspace: WorkspaceCfg;
  connectors: ConnectorsCfg;
  plugins: PluginsCfg;
  diagnostics: DiagnosticsCfg;
  usage: UsageCfg;
  appearance: AppearanceCfg;
  outbound: OutboundCfg;
}

/* ====================================================================
 *  配置第三方推理页面 — 浅色主题，匹配截图
 * ==================================================================== */

type InferenceSection =
  | 'connection'
  | 'workspace'
  | 'connectors'
  | 'diagnostics'
  | 'usage'
  | 'appearance'
  | 'plugins'
  | 'outbound';

const SIDEBAR_ITEMS: { id: InferenceSection; label: string; keywords: string[] }[] = [
  { id: 'connection', label: '连接', keywords: ['gateway', 'proxy', 'api', 'key', 'url', 'endpoint', 'model', 'TLS', 'SSL', '认证', 'timeout', '超时', '密钥', 'base URL', '端口', 'port'] },
  { id: 'workspace', label: '工作区限制', keywords: ['workspace', 'folder', '工具', '禁用', 'Bash', 'Edit', 'Read', '登录', '目录', '路径', 'path', 'allowed', 'blocked'] },
  { id: 'connectors', label: '连接器与扩展', keywords: ['connector', 'MCP', 'server', 'plugin', '扩展', '托管', 'managed', 'host', '服务器'] },
  { id: 'diagnostics', label: '诊断与更新', keywords: ['diagnostic', 'update', 'test', '测试', '连接', '自动更新', 'health', '健康', '版本', 'version'] },
  { id: 'usage', label: '使用限制', keywords: ['token', 'limit', 'cost', 'budget', '成本', '限制', '上下文', 'context', 'daily', 'monthly', '每日', '每月', '额度'] },
  { id: 'appearance', label: '外观', keywords: ['theme', 'font', 'timestamp', 'markdown', '主题', '字体', '时间戳', '外观', '显示', 'render'] },
  { id: 'plugins', label: '插件与技能', keywords: ['plugin', 'skill', 'tool', '插件', '技能', '工具', '文件夹', 'command', '命令'] },
  { id: 'outbound', label: '出站要求', keywords: ['outbound', 'host', 'domain', 'proxy', '出站', '主机', '域名', 'allowlist', '白名单'] },
];

/* ---------- 主题感知颜色（CSS 变量） ---------- */
const C = {
  bg: 'var(--c-bg)',
  bgPage: 'var(--c-bgSub)',
  bgHeader: 'var(--c-surface)',
  bgSidebar: 'var(--c-bgSub)',
  bgCard: 'var(--c-surface)',
  bgInput: 'var(--c-bg)',
  bgHover: 'var(--c-surface-hover)',
  border: 'var(--c-border)',
  borderFocus: 'var(--c-borderStrong, var(--c-textMute))',
  text: 'var(--c-text)',
  textMuted: 'var(--c-textMute)',
  textDesc: 'var(--c-textSub)',
  accent: 'var(--c-accent)',
  tagBg: 'var(--c-bgSub)',
};

export function InferenceConfigPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<InferenceSection>('connection');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<InferenceCfgType | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const savedConfigRef = useRef<InferenceCfgType | null>(null);

  /* 加载配置 */
  const loadConfig = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    InferenceConfig.get()
      .then((cfg) => { if (!cancelled) { setConfig(cfg); savedConfigRef.current = JSON.parse(JSON.stringify(cfg)); setLoading(false); } })
      .catch((err) => { if (!cancelled) { const msg = err instanceof Error ? err.message : '加载失败'; setLoadError(msg); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { loadConfig(); }, [loadConfig]);

  /* 保存配置 */
  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await InferenceConfig.save(config);
      savedConfigRef.current = JSON.parse(JSON.stringify(config));
      setSaveMsg('已保存');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  }, [config]);

  /* Dirty state tracking */
  const isDirty = config && savedConfigRef.current
    ? JSON.stringify(config) !== JSON.stringify(savedConfigRef.current)
    : false;

  /* Warn on browser tab close with unsaved changes */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* Discard with confirmation */
  const handleDiscard = useCallback(() => {
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      navigate('/');
    }
  }, [isDirty, navigate]);

  const doDiscard = useCallback(() => {
    setConfirmDiscard(false);
    if (savedConfigRef.current) setConfig(JSON.parse(JSON.stringify(savedConfigRef.current)));
    navigate('/');
  }, [navigate]);
  const handleReset = useCallback(async () => {
    setConfirmReset(true);
  }, []);

  const doReset = useCallback(async () => {
    setConfirmReset(false);
    setSaving(true);
    try {
      await InferenceConfig.reset();
      const cfg = await InferenceConfig.get();
      setConfig(cfg);
      savedConfigRef.current = JSON.parse(JSON.stringify(cfg));
      setSaveMsg('已重置为默认值');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重置失败';
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', background: C.bgPage }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>正在加载配置...</span>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, background: C.bgPage, padding: 32 }}>
        <svg width="40" height="40" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--c-danger, #e74c3c)' }}>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 4.5v4M8 10.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 14, color: C.text }}>{loadError || '配置加载失败'}</span>
        <button
          onClick={() => loadConfig()}
          style={{ padding: '8px 20px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: C.bgPage }}>
      {/* 顶部标题栏 */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 48,
        borderBottom: `1px solid ${C.border}`,
        background: C.bgHeader,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              background: 'transparent', border: 'none', borderRadius: 6,
              color: C.textMuted, cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = C.bgHover}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            title="返回"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <Breadcrumb items={[{ label: '设置', path: '/settings' }, { label: '推理配置' }]} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* CC Switch */}
          <button style={btnStyle} onClick={() => {
            if (!config) return;
            // Toggle a cc_mode flag in the config
            const next = (config as any).cc_mode === 'claude-code' ? 'codecast' : 'claude-code';
            setConfig({ ...(config as any), cc_mode: next });
            setSaveMsg(`已切换到 ${next === 'claude-code' ? 'Claude Code' : 'CodeCast'} 模式`);
            setTimeout(() => setSaveMsg(null), 2000);
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: (config as any)?.cc_mode === 'claude-code' ? 'var(--c-accent)' : 'var(--c-success, #52c41a)' }} />
            {(config as any)?.cc_mode === 'claude-code' ? 'Claude Code' : 'CodeCast'}
            <ChevronIcon />
          </button>
          {/* 导出 */}
          <button style={btnStyle} onClick={() => {
            if (!config) return;
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `codecast-config-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            导出
            <ChevronIcon />
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左侧导航 */}
        <nav style={{
          width: 200,
          padding: '16px 10px',
          borderRight: `1px solid ${C.border}`,
          background: C.bgSidebar,
          overflow: 'auto',
        }}>
          <input type="text" placeholder="搜索设置" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} style={searchInputStyle} />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SIDEBAR_ITEMS.filter((it) => {
              if (!searchFilter) return true;
              const q = searchFilter.toLowerCase();
              return it.label.toLowerCase().includes(q) || it.keywords.some(k => k.toLowerCase().includes(q));
            }).map((it) => (
              <li key={it.id}>
                <button onClick={() => setActive(it.id)} style={navBtnStyle(active === it.id)}>
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* 右侧内容 — 独立滚动区域 */}
        <main style={{
          flex: 1,
          padding: '28px 36px',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: C.bg,
          minHeight: 0,
          overscrollBehavior: 'contain',
        }}>
          {active === 'connection' && config && <ConnectionSection config={config} onChange={setConfig} />}
          {active === 'workspace' && config && <WorkspaceSection config={config} onChange={setConfig} />}
          {active === 'connectors' && config && <ConnectorsSection config={config} onChange={setConfig} />}
          {active === 'diagnostics' && config && <DiagnosticsSection config={config} onChange={setConfig} />}
          {active === 'usage' && config && <UsageSection config={config} onChange={setConfig} />}
          {active === 'appearance' && config && <AppearanceSection config={config} onChange={setConfig} />}
          {active === 'plugins' && config && <PluginsSection config={config} onChange={setConfig} />}
          {active === 'outbound' && config && <OutboundSection config={config} onChange={setConfig} />}
        </main>
      </div>

      {/* 底部操作栏 */}
      <footer style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center',
        padding: '12px 24px',
        borderTop: `1px solid ${C.border}`,
        background: C.bgHeader,
        flexShrink: 0,
      }}>
        {saveMsg && (
          <span style={{ fontSize: 12, color: saveMsg.includes('失败') ? 'var(--c-danger, #e55)' : 'var(--c-success, #52c41a)', marginRight: 'auto' }}>
            {saveMsg}
          </span>
        )}
        <button onClick={handleReset} disabled={saving} style={{ ...footerBtnStyle(false), opacity: saving ? 0.5 : 1 }}>重置默认</button>
        <button onClick={handleDiscard} style={footerBtnStyle(false)}>放弃更改</button>
        <button onClick={handleSave} disabled={saving || !config} style={{ ...footerBtnStyle(true), opacity: saving ? 0.5 : 1 }}>
          {saving ? '保存中...' : '保存更改'}
        </button>
      </footer>
      <ConfirmDialog
        open={confirmReset}
        title="重置配置"
        message="确定要将所有配置重置为默认值吗？此操作不可撤销，所有自定义设置将丢失。"
        confirmLabel="重置"
        onConfirm={() => void doReset()}
        onCancel={() => setConfirmReset(false)}
        danger
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="放弃未保存的更改"
        message="您有未保存的配置更改。确定要放弃这些更改并离开吗？"
        confirmLabel="放弃更改"
        onConfirm={doDiscard}
        onCancel={() => setConfirmDiscard(false)}
        danger
      />
    </div>
  );
}

/* ====================================================================
 *  连接区域（含模型配置）
 * ==================================================================== */

function ConnectionSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const [showKey, setShowKey] = useState(false);
  const [showConnMore, setShowConnMore] = useState(false);
  const [showModelMore, setShowModelMore] = useState(false);
  const [addingModel, setAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  const conn = config.connection;
  const model = conn.model;

  const updateConn = (patch: Partial<InferenceCfgType['connection']>) => {
    onChange({ ...config, connection: { ...conn, ...patch } });
  };
  const updateModel = (patch: Partial<InferenceCfgType['connection']['model']>) => {
    updateConn({ model: { ...model, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      {/* ---- 连接标题 ---- */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>连接</h2>
        <p style={{ fontSize: 13, color: C.textDesc, margin: 0 }}>选择 Claude Desktop 发送推理请求的位置。</p>
      </div>

      {/* 网关选择器 */}
      <div style={selectorRowStyle}>
        <GlobeIcon />
        <select value={conn.gateway_type} onChange={(e) => updateConn({ gateway_type: e.target.value })} style={gatewaySelectStyle}>
          <option>网关</option>
          <option>Anthropic API</option>
          <option>Azure OpenAI</option>
          <option>Ollama</option>
        </select>
        <ChevronIcon color="#999" />
      </div>

      {/* ---- 网关凭据卡片 ---- */}
      <Card title="网关 凭据"
        action={<TestButton label="测试连接" />}
      >
        <FieldRow label="凭据类型">
          <select value={conn.cred_type} onChange={(e) => updateConn({ cred_type: e.target.value })} style={fieldSelect}>
            <option>Static API key</option>
            <option>OAuth 2.0</option>
            <option>MCP Bearer Token</option>
          </select>
        </FieldRow>
        <FieldDesc>选择凭据来源。设置后只使用该来源（不回退）。</FieldDesc>

        <FieldRow label="Gateway 基础 URL" required>
          <input value={conn.base_url} onChange={(e) => updateConn({ base_url: e.target.value })} style={fieldInput} />
        </FieldRow>
        <FieldDesc>推理 Gateway 端点的完整 URL。</FieldDesc>

        <FieldRow label="Gateway API 密钥" required lock>
          <div style={{ position: 'relative', flex: 1 }}>
            <input type={showKey ? 'text' : 'password'} value={conn.api_key_enc || ''} onChange={(e) => updateConn({ api_key_enc: e.target.value })} style={{ ...fieldInput, paddingRight: 32 }} />
            <EyeToggle show={showKey} onToggle={() => setShowKey(!showKey)} />
          </div>
        </FieldRow>

        <FieldRow label="Gateway 认证方案">
          <select value={conn.auth_scheme} onChange={(e) => updateConn({ auth_scheme: e.target.value })} style={fieldSelect}>
            <option>bearer</option>
            <option>basic</option>
            <option>custom</option>
          </select>
        </FieldRow>
        <FieldDesc>网关凭据在线路上的发送方式（Authorization: Bearer 与 x-api-key 请求头）。</FieldDesc>

        <FieldRow label="自定义推理请求头" lock>
          <CustomHeadersEditor
            headers={conn.custom_headers || {}}
            onChange={(headers) => updateConn({ custom_headers: headers })}
          />
        </FieldRow>
        <FieldDesc>发送到已配置提供商的每个推理请求上的额外 HTTP 请求头。可用于租户路由、组织 ID、Bedrock Guardrails 等。</FieldDesc>

        <LearnMore expanded={showConnMore} onToggle={() => setShowConnMore(!showConnMore)} />
      </Card>

      {/* ---- 模型区域 ---- */}
      <Card title="模型"
        action={<TestButton label="测试模型发现" />}
      >
        <FieldRow label="模型发现">
          <ToggleSwitch checked={model.discover_enabled} onChange={(v) => updateModel({ discover_enabled: v })} />
        </FieldRow>
        <FieldDesc>启动时从 http://127.0.0.1:15721/claude-desktop/v1/models 自动填充模型选择器。</FieldDesc>
        <LearnMore expanded={showModelMore} onToggle={() => setShowModelMore(!showModelMore)} />

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8, display: 'block' }}>模型列表</label>
          <p style={{ fontSize: 12, color: C.textDesc, margin: '0 0 10px' }}>覆盖自动发现的模型列表。第一项为默认模型。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(model.models || []).map((m: string) => (
              <ModelTag key={m} name={m} onRemove={() => updateModel({ models: (model.models || []).filter((x: string) => x !== m) })} />
            ))}
            {addingModel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  autoFocus
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newModelName.trim()) {
                      updateModel({ models: [...(model.models || []), newModelName.trim()] });
                      setNewModelName(''); setAddingModel(false);
                    }
                    if (e.key === 'Escape') { setNewModelName(''); setAddingModel(false); }
                  }}
                  placeholder="输入模型名称，回车确认"
                  style={{ ...fieldInput, flex: 1 }}
                />
                <button
                  onClick={() => {
                    if (newModelName.trim()) {
                      updateModel({ models: [...(model.models || []), newModelName.trim()] });
                      setNewModelName(''); setAddingModel(false);
                    }
                  }}
                  style={{ ...addBtnStyle, padding: '6px 12px' }}
                >添加</button>
                <button
                  onClick={() => { setNewModelName(''); setAddingModel(false); }}
                  style={{ ...addBtnStyle, padding: '6px 12px' }}
                >取消</button>
              </div>
            ) : (
              <AddButton label="添加" plain onClick={() => setAddingModel(true)} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  工作区限制
 * ==================================================================== */

function WorkspaceSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const ws = config.workspace;
  const [showWorkMore, setShowWorkMore] = useState(false);

  const update = (patch: Partial<InferenceCfgType['workspace']>) => {
    onChange({ ...config, workspace: { ...ws, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>工作区限制</h2>

      {/* 功能界面 */}
      <Card title="功能界面">
        <FieldRow label="Cowork">
          <ToggleSwitch checked={ws.cowork_enabled} onChange={(v) => update({ cowork_enabled: v })} />
        </FieldRow>
        <FieldDesc>启用 Cowork 标签页。Claude 会处理较长任务，例如研究、分析和文档。</FieldDesc>

        <FieldRow label="代码">
          <ToggleSwitch checked={ws.code_enabled} onChange={(v) => update({ code_enabled: v })} />
        </FieldRow>
        <FieldDesc>启用 Code 标签页。Claude 会编写并运行代码。</FieldDesc>
      </Card>

      {/* 通用限制 */}
      <Card title="通用限制">
        <p style={{ fontSize: 13, color: C.textDesc, margin: '0 0 18px' }}>无论启用哪些功能界面，这些限制都会生效。</p>

        <FieldRow label="允许的出站主机">
          <TagInput value={ws.allowed_hosts || '*'} onChange={(v) => update({ allowed_hosts: v })} />
        </FieldRow>
        <FieldDesc>代理工具可从 Cowork 和 Code 标签页访问的主机名。也会显示在出站要求中。</FieldDesc>
        <LearnMore expanded={showWorkMore} onToggle={() => setShowWorkMore(!showWorkMore)} />

        <FieldRow label="允许的工作区文件夹">
          <div style={{ position: 'relative', flex: 1 }}>
            <input value={ws.workspace_folder || ''} onChange={(e) => update({ workspace_folder: e.target.value })} style={fieldInput} />
            <button
              type="button"
              onClick={() => {
                // Focus the input so user can type the path
                const input = document.querySelector('input[value="' + (ws.workspace_folder || '') + '"]') as HTMLInputElement;
                input?.focus();
                input?.select();
              }}
              title="点击输入路径"
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <FolderIcon />
            </button>
          </div>
        </FieldRow>
        <FieldDesc>用户可附加为工作区的文件夹。留空则不限制访问。</FieldDesc>

        <FieldRow label="禁用的内置工具">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {['Bash', 'Edit', 'Read', 'Glob', 'Grep'].map((tool) => {
              const disabled = (ws.disabled_tools || []).includes(tool);
              return (
                <label key={tool} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', color: C.text }}>
                  <input
                    type="checkbox"
                    checked={disabled}
                    onChange={(e) => {
                      const current = ws.disabled_tools || [];
                      update({
                        disabled_tools: e.target.checked
                          ? [...current, tool]
                          : current.filter(t => t !== tool),
                      });
                    }}
                  />
                  {tool}
                </label>
              );
            })}
          </div>
        </FieldRow>
        <FieldDesc>从 Cowork 中移除的内置工具。</FieldDesc>

        <FieldRow label="禁用 Claude.ai 登录">
          <ToggleSwitch checked={ws.disable_login} onChange={(v) => update({ disable_login: v })} />
        </FieldRow>
        <FieldDesc>用户在登录界面只会看到此提供商。登录 Claude.ai 的选项将被隐藏。</FieldDesc>

        <FieldRow label="禁用 claude:// 深度链接处理">
          <ToggleSwitch checked={ws.disable_deep_link} onChange={(v) => update({ disable_deep_link: v })} />
        </FieldRow>
        <FieldDesc>阻止外部应用和网站通过 claude:// 链接打开 Cowork。</FieldDesc>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  连接器与扩展
 * ==================================================================== */

function ConnectorsSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const cn = config.connectors;
  const update = (patch: Partial<InferenceCfgType['connectors']>) => {
    onChange({ ...config, connectors: { ...cn, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>连接器与扩展</h2>

      {/* MCP 服务器 */}
      <Card title="MCP 服务器">
        <FieldRow label="托管的 MCP 服务器" lock>
          <DropdownBtn label="添加服务器" />
        </FieldRow>
        <FieldDesc>组织推送的 MCP 服务器：远程（HTTP/SSE）或本地（stdio 命令）。可能嵌入 Bearer 令牌。</FieldDesc>

        <FieldRow label="允许用户添加 MCP 服务器">
          <ToggleSwitch checked={cn.allow_user_mcp} onChange={(v) => update({ allow_user_mcp: v })} />
        </FieldRow>
        <FieldDesc>通过开发者设置添加的本地 stdio 服务器。远程服务器来自上方托管列表，或来自组织管理员挂载到用户电脑上的插件。</FieldDesc>
      </Card>

      {/* 扩展 */}
      <Card title="扩展">
        <FieldRow label="允许桌面扩展">
          <ToggleSwitch checked={cn.allow_desktop_ext} onChange={(v) => update({ allow_desktop_ext: v })} />
        </FieldRow>
        <FieldDesc>.dxt and .mcpb installs.</FieldDesc>

        <FieldRow label="要求扩展已签名">
          <ToggleSwitch checked={cn.require_signed} onChange={(v) => update({ require_signed: v })} />
        </FieldRow>
        <FieldDesc>拒绝未由受信任发布者签名的桌面扩展。</FieldDesc>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  插件与技能
 * ==================================================================== */

function PluginsSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const pl = config.plugins;
  const update = (patch: Partial<InferenceCfgType['plugins']>) => {
    onChange({ ...config, plugins: { ...pl, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>插件与技能</h2>

      {/* 组织插件 */}
      <Card
        title="组织插件"
        action={
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px',
            background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 14,
            color: C.textMuted, fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#999' }} />
            未找到组织插件
          </span>
        }
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          background: C.bgHover, border: `1px solid ${C.border}`, borderRadius: 8,
          marginBottom: 10,
        }}>
          <input value={pl.org_plugin_path || ''} onChange={(e) => update({ org_plugin_path: e.target.value })} style={{
            flex: 1, fontSize: 13, color: C.text, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit',
          }} />
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 12px',
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.textMuted, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 6h4M6 8h4M6 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            复制
          </button>
        </div>

        <p style={{ fontSize: 12, color: C.textDesc, margin: '0 0 16px', lineHeight: 1.6 }}>
          使用设备管理工具将插件包挂载到此文件夹，Cowork 会在启动时加载它们。该文件夹为只读；你在下方设置的工具策略会保存在此配置中。
        </p>

        <AddButton label="添加服务器策略" />
      </Card>
    </div>
  );
}

/* ====================================================================
 *  诊断与更新
 * ==================================================================== */

function DiagnosticsSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const diag = config.diagnostics;
  const update = (patch: Partial<InferenceCfgType['diagnostics']>) => {
    onChange({ ...config, diagnostics: { ...diag, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>诊断与更新</h2>

      {/* 日志 */}
      <Card title="日志">
        <FieldRow label="日志级别">
          <select value={diag.log_level || 'Info'} onChange={(e) => update({ log_level: e.target.value })} style={inputStyle}>
            {['Debug', 'Info', 'Warn', 'Error'].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </FieldRow>
        <FieldDesc>控制日志输出的详细程度。Debug 模式会产生大量日志，建议仅在排查问题时使用。</FieldDesc>
        <div style={{ marginTop: 12 }}>
          <button style={{ ...addBtnStyle }}>打开日志文件夹</button>
        </div>
      </Card>

      {/* 遥测 */}
      <Card title="遥测">
        <FieldRow label="发送使用数据">
          <ToggleSwitch checked={diag.enable_telemetry} onChange={(v) => update({ enable_telemetry: v })} />
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{diag.enable_telemetry ? '已开启' : '已关闭'}</span>
        </FieldRow>
        <FieldDesc>匿名发送性能指标和错误频率数据，帮助改进产品。不包含任何个人或项目信息。</FieldDesc>
      </Card>

      {/* 更新 */}
      <Card title="更新">
        <FieldRow label="自动检查更新">
          <ToggleSwitch checked={diag.auto_update ?? true} onChange={(v) => update({ auto_update: v })} />
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{(diag.auto_update ?? true) ? '已开启' : '已关闭'}</span>
        </FieldRow>
        <div style={{ marginTop: 12 }}>
          <button style={{ ...addBtnStyle }}>立即检查更新</button>
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  使用限制
 * ==================================================================== */

function UsageSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const usage = config.usage;
  const update = (patch: Partial<InferenceCfgType['usage']>) => {
    onChange({ ...config, usage: { ...usage, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>使用限制</h2>

      {/* Token 限制 */}
      <Card title="Token 限制">
        <FieldRow label="每日 Token 上限">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={usage.daily_token_limit ? String(usage.daily_token_limit) : ''} onChange={(e) => update({ daily_token_limit: Number(e.target.value) || 0 })} placeholder="1000000" style={{ ...fieldInput, width: 140 }} />
            <select style={{ ...inputStyle, width: 70 }} defaultValue="tokens">
              <option value="K">K</option>
              <option value="M">M</option>
              <option value="tokens">tokens</option>
            </select>
          </div>
        </FieldRow>
      </Card>

      {/* 成本控制 */}
      <Card title="成本控制">
        <FieldRow label="每月成本上限 (USD)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>$</span>
            <input value={usage.monthly_cost_limit ? String(usage.monthly_cost_limit) : ''} onChange={(e) => update({ monthly_cost_limit: Number(e.target.value) || 0 })} placeholder="10.00" style={{ ...fieldInput, width: 120 }} />
          </div>
        </FieldRow>
        <FieldDesc>超出成本上限后，推理请求将被暂停直到次日重置。</FieldDesc>
        <FieldRow label="成本提醒阈值 (%)">
          <input value={usage.warn_threshold_pct ? String(usage.warn_threshold_pct) : ''} onChange={(e) => update({ warn_threshold_pct: Number(e.target.value) || 0 })} placeholder="80" style={{ ...fieldInput, width: 80 }} />
        </FieldRow>
        <FieldDesc>当当日消耗达到阈值时弹窗提醒。</FieldDesc>
      </Card>

      {/* 速率限制 */}
      <Card title="速率限制">
        <FieldRow label="并发会话数上限">
          <input placeholder="5" style={{ ...fieldInput, width: 80 }} readOnly />
        </FieldRow>
        <FieldDesc>同时运行的 Agent/对话数量上限。设置为 0 表示无限制。</FieldDesc>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  外观
 * ==================================================================== */

function AppearanceSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const app = config.appearance;
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [renderMarkdown, setRenderMarkdown] = useState(true);
  const update = (patch: Partial<InferenceCfgType['appearance']>) => {
    onChange({ ...config, appearance: { ...app, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>外观</h2>

      {/* 主题 */}
      <Card title="主题">
        <FieldRow label="模式">
          <select value={app.theme || 'system'} onChange={(e) => update({ theme: e.target.value })} style={inputStyle}>
            {['浅色', '深色', '跟随系统'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldRow>
      </Card>

      {/* 字体 */}
      <Card title="字体">
        <FieldRow label="UI 字体大小">
          <select value={app.font_size || 'medium'} onChange={(e) => update({ font_size: e.target.value })} style={inputStyle}>
            {['小', '中', '大'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="代码字号 (px)">
          <input value={app.code_font_size || ''} onChange={(e) => update({ code_font_size: e.target.value })} placeholder="13" style={{ ...fieldInput, width: 80 }} />
        </FieldRow>
      </Card>

      {/* 聊天界面 */}
      <Card title="聊天界面">
        <FieldRow label="显示时间戳">
          <ToggleSwitch checked={showTimestamps} onChange={setShowTimestamps} />
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{showTimestamps ? '显示' : '隐藏'}</span>
        </FieldRow>
        <FieldRow label="Markdown 渲染">
          <ToggleSwitch checked={renderMarkdown} onChange={setRenderMarkdown} />
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{renderMarkdown ? '渲染' : '纯文本'}</span>
        </FieldRow>
        <FieldDesc>启用后，代码块、表格、公式等内容将以 Markdown 格式渲染展示。</FieldDesc>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  出站要求
 * ==================================================================== */

function OutboundSection({ config, onChange }: { config: InferenceCfgType; onChange: (c: InferenceCfgType) => void }) {
  const out = config.outbound;
  const update = (patch: Partial<InferenceCfgType['outbound']>) => {
    onChange({ ...config, outbound: { ...out, ...patch } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'var(--page-max-width)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>出站要求</h2>

      {/* 网络代理 */}
      <Card title="网络代理">
        <FieldRow label="HTTP 代理">
          <input value={out.http_proxy || ''} onChange={(e) => update({ http_proxy: e.target.value })} placeholder="http://host:port" style={fieldInput} />
        </FieldRow>
        <FieldRow label="不走代理的域名">
          <input value={out.no_proxy || ''} onChange={(e) => update({ no_proxy: e.target.value })} placeholder="localhost,127.0.0.1" style={fieldInput} />
        </FieldRow>
        <FieldDesc>逗号分隔的域名列表，匹配的请求将绕过代理直接连接。</FieldDesc>
      </Card>

      {/* TLS 设置 */}
      <Card title="TLS 设置">
        <FieldRow label="TLS 最小版本">
          <select value={out.tls_min_version || '1.2'} onChange={(e) => update({ tls_min_version: e.target.value })} style={inputStyle}>
            {['1.2', '1.3'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="验证 TLS 证书">
          <ToggleSwitch checked={out.verify_tls ?? true} onChange={(v) => update({ verify_tls: v })} />
        </FieldRow>
      </Card>

      {/* 超时 */}
      <Card title="超时">
        <FieldRow label="连接超时 (秒)">
          <input value={out.connect_timeout ? String(out.connect_timeout) : ''} onChange={(e) => update({ connect_timeout: Number(e.target.value) || 0 })} placeholder="30" style={{ ...fieldInput, width: 100 }} />
        </FieldRow>
        <FieldRow label="读取超时 (秒)">
          <input value={out.read_timeout ? String(out.read_timeout) : ''} onChange={(e) => update({ read_timeout: Number(e.target.value) || 0 })} placeholder="120" style={{ ...fieldInput, width: 100 }} />
        </FieldRow>
      </Card>

      {/* 安全 */}
      <Card title="安全">
        <FieldRow label="允许的出站端口">
          <input value={out.allowed_ports || ''} onChange={(e) => update({ allowed_ports: e.target.value })} placeholder="443,80" style={fieldInput} />
        </FieldRow>
        <FieldDesc>仅允许连接到列表中的端口。留空表示允许所有端口（不推荐）。</FieldDesc>
      </Card>
    </div>
  );
}

/* ====================================================================
 *  占位区域
 * ==================================================================== */

function PlaceholderSection({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: 13, color: C.textDesc, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ====================================================================
 *  内联组件
 * ==================================================================== */

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '22px 26px',
    }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function FieldRow({ label, children, required, lock }: { label: string; children: React.ReactNode; required?: boolean; lock?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 16, alignItems: 'start', marginBottom: 2 }}>
      <label style={{ fontSize: 13, color: C.text, paddingTop: 7, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: '#e55', marginLeft: 1 }}>*</span>}
        {lock && <LockIcon />}
      </label>
      <div>{children}</div>
    </div>
  );
}

function FieldDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: C.textDesc, marginLeft: 206, marginTop: 2, marginBottom: 14, lineHeight: 1.5 }}>{children}</p>;
}

function LearnMore({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: 4 }}>
      <button onClick={onToggle} style={learnMoreBtnStyle}>
        了解更多
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
          <path d="M4 6l4 4 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? C.accent : '#ccc',
        border: 'none', cursor: 'pointer', padding: 2,
        position: 'relative', transition: 'background 150ms',
      }}
    >
      <span style={{
        display: 'block', width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        transform: checked ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 150ms',
      }} />
    </button>
  );
}

function TestButton({ label }: { label: string }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleTest = async () => {
    setTesting(true);
    setResult('idle');
    try {
      // Try to fetch the gateway endpoint
      const resp = await fetch('http://127.0.0.1:15721/health', { signal: AbortSignal.timeout(5000) });
      setResult(resp.ok ? 'ok' : 'fail');
    } catch {
      setResult('fail');
    } finally {
      setTesting(false);
      setTimeout(() => setResult('idle'), 3000);
    }
  };

  return (
    <button
      onClick={handleTest}
      disabled={testing}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 14px',
        background: result === 'ok' ? 'var(--c-success, #4caf50)' : result === 'fail' ? 'var(--c-danger, #e74c3c)' : 'transparent',
        border: `1px solid ${result === 'ok' ? 'var(--c-success)' : result === 'fail' ? 'var(--c-danger)' : C.border}`,
        borderRadius: 8,
        color: result !== 'idle' ? '#fff' : C.textMuted,
        fontSize: 12,
        cursor: testing ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        border: result !== 'idle' ? 'none' : '1.5px solid #999',
        background: result === 'ok' ? '#fff' : result === 'fail' ? '#fff' : 'transparent',
      }} />
      {testing ? '测试中…' : result === 'ok' ? '连接成功' : result === 'fail' ? '连接失败' : label}
    </button>
  );
}

function CustomHeadersEditor({ headers, onChange }: { headers: Record<string, string>; onChange: (h: Record<string, string>) => void }) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const entries = Object.entries(headers);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: C.text, minWidth: 80 }}>{k}:</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: C.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
          <button
            onClick={() => {
              const next = { ...headers };
              delete next[k];
              onChange(next);
            }}
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
            title="删除"
          >×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Header-Name"
          style={{ flex: 1, padding: '3px 6px', fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, background: C.bgInput, color: C.text, fontFamily: 'var(--font-mono)', outline: 'none' }}
        />
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          style={{ flex: 1, padding: '3px 6px', fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, background: C.bgInput, color: C.text, fontFamily: 'var(--font-mono)', outline: 'none' }}
        />
        <button
          onClick={() => {
            if (newKey.trim()) {
              onChange({ ...headers, [newKey.trim()]: newValue });
              setNewKey('');
              setNewValue('');
            }
          }}
          style={{ padding: '3px 8px', fontSize: 12, background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          添加
        </button>
      </div>
    </div>
  );
}

function AddButton({ label, plain, onClick }: { label: string; plain?: boolean; onClick?: () => void }) {
  if (plain) {
    return (
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none',
          color: C.textMuted, fontSize: 13, cursor: 'pointer',
          padding: '4px 0', fontFamily: 'inherit',
        }}
      >
        <PlusIcon /> {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 12px',
        background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 6,
        color: C.textMuted, fontSize: 12, cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <PlusIcon /> {label}
    </button>
  );
}

function DropdownBtn({ label }: { label: string }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px',
      background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
      color: C.textMuted, fontSize: 12, cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      <PlusIcon /> {label} <ChevronIcon />
    </button>
  );
}

function ModelTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 14px',
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
      fontSize: 13, color: C.text,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ChevronIcon size={10} color="#aaa" />
        {name}
      </span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2, lineHeight: 0 }}>
        <CloseIcon />
      </button>
    </div>
  );
}

function TagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inputVal, setInputVal] = useState('');
  const tags = value.split(',').filter(Boolean);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (!tags.includes(t)) onChange([...tags, t].join(','));
    setInputVal('');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '5px 8px', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', background: C.tagBg, borderRadius: 4,
          fontSize: 12, color: C.text,
        }}>
          {tag.trim()}
          <button onClick={() => { const next = tags.filter((_, j) => j !== i); onChange(next.join(',')); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 0, fontSize: 11 }}
          >&times;</button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',') || v.endsWith(' ')) {
            addTag(v.slice(0, -1));
          } else {
            setInputVal(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(inputVal); }
          if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
            onChange(tags.slice(0, -1).join(','));
          }
        }}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, minWidth: 60, fontFamily: 'inherit', color: C.text }}
        placeholder={tags.length === 0 ? '输入后按回车添加' : ''}
      />
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {show ? (
          <path d="M8 4.5C5.5 4.5 3.4 6 2.5 8c.9 2 3 3.5 5.5 3.5s4.6-1.5 5.5-3.5c-.9-2-3-3.5-5.5-3.5zM8 10a2 2 0 110-4 2 2 0 010 4z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        ) : (
          <>
            <path d="M3 7.5S4.5 4.5 8 4.5s5 3 5 3-1.5 3-5 3-5-3-5-3z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            <circle cx="8" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.2"/>
          </>
        )}
      </svg>
    </button>
  );
}

/* ---------- SVG 图标 ---------- */

function ChevronIcon({ size = 10, color = '#666' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#999', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#bbb' }}><path d="M5 7V5a3 3 0 116 0v2M4 7h8a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>;
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#999', pointerEvents: 'none' }}>
      <path d="M2 4h4l1 1h7v8H2V4z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
    </svg>
  );
}

function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

function CloseIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

/* ---------- 样式常量 ---------- */

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '5px 12px',
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.textMuted, fontSize: 12, cursor: 'pointer',
  fontFamily: 'inherit',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 12px',
  marginBottom: 14,
  background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, fontSize: 12, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

function navBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '7px 12px',
    background: active ? C.bgHover : 'transparent',
    color: active ? C.text : C.textMuted,
    border: 'none', borderRadius: 6,
    fontSize: 13, fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  };
}

function footerBtnStyle(primary: boolean): React.CSSProperties {
  return {
    padding: '6px 18px',
    background: primary ? C.text : 'transparent',
    border: primary ? `1px solid ${C.text}` : `1px solid ${C.border}`,
    borderRadius: 8,
    color: primary ? C.bg : C.textMuted,
    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  };
}

const selectorRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px',
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
};

const gatewaySelectStyle: React.CSSProperties = {
  flex: 1, padding: '4px 0',
  background: 'transparent', border: 'none',
  color: C.text, fontSize: 14, fontWeight: 500,
  appearance: 'auto', cursor: 'pointer', fontFamily: 'inherit',
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '7px 12px',
  background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const fieldSelect: React.CSSProperties = {
  ...fieldInput, appearance: 'auto', cursor: 'pointer',
};

const learnMoreBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'none', border: 'none',
  color: C.accent, fontSize: 12, cursor: 'pointer',
  padding: 0, fontFamily: 'inherit',
};

/* ---------- 共享样式常量 ---------- */
const inputStyle: React.CSSProperties = {
  ...fieldSelect, minWidth: 200,
};

const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 14px',
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
};

/* ---------- TextInput 内联组件 ---------- */
function TextInput({
  value, onChange, placeholder, style: extraStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...fieldInput, ...(extraStyle || {}) }}
    />
  );
}
