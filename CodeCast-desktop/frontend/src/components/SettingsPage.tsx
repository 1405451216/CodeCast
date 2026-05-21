import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import * as api from '../api';
import { S } from '../settingsKeys';

// ─── Types ─────────────────────────────────────────────────────

type TabId =
  | 'general'
  | 'appearance'
  | 'model'
  | 'personalize'
  | 'mcp'
  | 'git'
  | 'env'
  | 'worktree'
  | 'browser'
  | 'computer'
  | 'archived'
  | 'slashcmd';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface MCPServerItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
}

interface EnvVarItem {
  key: string;
  value: string;
}

interface SlashCommandItem {
  id: string;
  name: string;
  description: string;
  fill_text: string;
}

interface ArchivedSession {
  ID: string;
  Name: string;
  CreatedAt: string;
}

interface SettingsData {
  work_mode?: string;
  default_permission?: boolean;
  auto_review?: boolean;
  full_access?: boolean;
  default_target?: string;
  shell?: string;
  language?: string;
  hotkey?: string;
  ctrl_enter?: boolean;
  followup_mode?: string;
  review_mode?: string;
  notification_turn?: string;
  notification_permission?: boolean;
  notification_question?: boolean;
  theme?: string;
  font_size?: string;
  api_key?: string;
  context_1m?: boolean;
  personality?: string;
  custom_instructions?: string;
  memory_self?: boolean;
  memory_tool?: boolean;
  message_history_limit?: number;
  auto_commit?: boolean;
  confirm_before_commit?: boolean;
  worktree_enabled?: boolean;
  computer_control?: boolean;
  blocked_domains?: string[];
  allowed_domains?: string[];
  browser_plugin?: string;
  browser_clear_data?: string;
  browser_approval?: string;
  browser_history?: string;
  mcp_servers?: MCPServerItem[];
  selenium_installed?: boolean;
}

// ─── Nav items definition ──────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: '常规',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: '外观',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    id: 'model',
    label: '配置',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'personalize',
    label: '个性化',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: 'mcp',
    label: 'MCP 服务器',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'git',
    label: 'Git',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
  {
    id: 'env',
    label: '环境',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'worktree',
    label: '工作树',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
        <line x1="4" y1="4" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    id: 'browser',
    label: '浏览器使用',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'computer',
    label: '电脑操控',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'archived',
    label: '已归档对话',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    id: 'slashcmd',
    label: '斜杠命令',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="6" y2="4" />
      </svg>
    ),
  },
];

// ─── Builtin slash commands ────────────────────────────────────

const BUILTIN_COMMANDS = [
  { name: '/help', description: '显示帮助信息' },
  { name: '/clear', description: '清空当前对话' },
  { name: '/compact', description: '压缩对话上下文' },
  { name: '/model', description: '切换模型' },
  { name: '/theme', description: '切换主题' },
];

// ─── Component ─────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const platform = useAppStore((s) => s.platform);
  const isDarwin = platform === 'darwin';
  const modKey = isDarwin ? '⌘' : 'Ctrl';

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Settings data
  const [settings, setSettings] = useState<SettingsData>({});
  const [config, setConfig] = useState<any>({});

  // MCP
  const [mcpServers, setMcpServers] = useState<MCPServerItem[]>([]);
  const [mcpType, setMcpType] = useState<'stdio' | 'websocket'>('stdio');
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpCmd, setMcpCmd] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');

  // Env vars
  const [envVars, setEnvVars] = useState<EnvVarItem[]>([]);
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');

  // Slash commands
  const [slashCommands, setSlashCommands] = useState<SlashCommandItem[]>([]);
  const [cmdName, setCmdName] = useState('');
  const [cmdDesc, setCmdDesc] = useState('');
  const [cmdFillText, setCmdFillText] = useState('');

  // Browser domains
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [newAllowedDomain, setNewAllowedDomain] = useState('');

  // Archived sessions
  const [archivedSessions, setArchivedSessions] = useState<ArchivedSession[]>([]);

  // Model config
  const [apiKey, setApiKey] = useState('');
  const [context1M, setContext1M] = useState(false);

  // ─── Load data on open ─────────────────────────────────────

  const loadEnvVars = async () => {
    try {
      const envs = await api.getEnvVars();
      if (Array.isArray(envs)) setEnvVars(envs);
    } catch (e) { /* ignore */ }
  };

  const loadSlashCommands = async () => {
    try {
      const cmds = await api.getSlashCommands();
      if (Array.isArray(cmds)) setSlashCommands(cmds);
    } catch (e) { /* ignore */ }
  };

  const loadArchivedSessions = async () => {
    try {
      const archived = await api.getArchivedSessions();
      if (Array.isArray(archived)) setArchivedSessions(archived);
    } catch (e) { /* ignore */ }
  };

  const loadMCPServers = async () => {
    try {
      const s = await api.getSettings();
      if (s && Array.isArray(s.mcp_servers)) {
        setMcpServers(s.mcp_servers);
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (!settingsOpen) return;

    const loadData = async () => {
      try {
        const s = await api.getSettings();
        if (s) {
          setSettings(s);
          setContext1M(s.context_1m || false);
          setBlockedDomains(s.blocked_domains || []);
          setAllowedDomains(s.allowed_domains || []);
          if (Array.isArray(s.mcp_servers)) {
            setMcpServers(s.mcp_servers);
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }

      try {
        const c = await api.getConfig();
        if (c) {
          setConfig(c);
          if (c.api_key) setApiKey(c.api_key);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }

      loadEnvVars();
      loadSlashCommands();
      loadArchivedSessions();
    };

    loadData();
  }, [settingsOpen]);

  // ─── Helpers ───────────────────────────────────────────────────

  const updateAndSave = async (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    if (key === S.long_context) {
      setContext1M(!!value);
    }

    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem('codecast_theme', value);
    }
    if (key === 'font_size') {
      document.documentElement.style.setProperty(
        '--font-size-base',
        value === 'small' ? '12px' : value === 'large' ? '16px' : '14px',
      );
    }

    try {
      await api.updateSetting(key, value);
    } catch (e) {
      console.error('Failed to update setting:', e);
    }
  };

  // ─── Render: Toggle ────────────────────────────────────────────

  const renderToggle = (key: string, checked: boolean, label: string, desc?: string) => (
    <div className="settings-row">
      <div className="settings-row-left">
        <div className="settings-row-title">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <button
        className={`toggle${checked ? ' active' : ''}`}
        onClick={() => updateAndSave(key, !checked)}
      />
    </div>
  );

  // ─── Render: Select ────────────────────────────────────────────

  const renderSelect = (
    key: string,
    value: string,
    options: { value: string; label: string }[],
    label: string,
    desc?: string,
  ) => (
    <div className="settings-row">
      <div className="settings-row-left">
        <div className="settings-row-title">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <select
        className="settings-select"
        value={value}
        onChange={(e) => updateAndSave(key, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  // ─── Render: Radio Cards ───────────────────────────────────────

  const renderRadioGroup = (
    key: string,
    value: string,
    options: { value: string; title: string; desc: string }[],
  ) => (
    <div className="settings-radio-group">
      {options.map((o) => (
        <div
          key={o.value}
          className={`settings-radio-card${value === o.value ? ' selected' : ''}`}
          onClick={() => updateAndSave(key, o.value)}
        >
          <div className="settings-radio-dot" />
          <div className="settings-radio-body">
            <div className="settings-radio-title">{o.title}</div>
            <div className="settings-radio-desc">{o.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // ─── Tab: General ──────────────────────────────────────────────

  const renderGeneral = () => (
    <div className="stab-panel">
      <div className="settings-section-title">常规</div>

      <div className="settings-group">
        <div className="settings-group-title">工作模式</div>
        {renderRadioGroup('work_mode', settings.work_mode || 'coding', [
          { value: 'coding', title: '编码', desc: '专注于代码编写和项目开发' },
          { value: 'daily', title: '日常', desc: '通用对话和日常任务' },
        ])}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">权限</div>
        {renderToggle(S.default_perm, settings.default_permission ?? true, '默认权限', '允许基本文件操作')}
        {renderToggle(S.auto_review, settings.auto_review ?? false, '自动审核', '自动审核代码变更')}
        {renderToggle(S.full_access, settings.full_access ?? false, '完全访问权限', '允许所有文件和系统操作')}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">常规</div>
        {renderSelect(S.open_target, settings.default_target || 'editor', [
          { value: 'editor', label: '编辑器' },
          { value: 'terminal', label: '终端' },
          { value: 'browser', label: '浏览器' },
        ], '默认打开目标')}
        {renderSelect(S.shell, settings.shell || (isDarwin ? 'zsh' : 'powershell'),
          isDarwin
            ? [
                { value: 'zsh', label: 'Zsh' },
                { value: 'bash', label: 'Bash' },
              ]
            : [
                { value: 'powershell', label: 'PowerShell' },
                { value: 'cmd', label: 'CMD' },
                { value: 'bash', label: 'Bash' },
                { value: 'zsh', label: 'Zsh' },
              ],
          'Shell')}
        {renderSelect(S.language, settings.language || 'zh-CN', [
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en', label: 'English' },
          { value: 'ja', label: '日本語' },
        ], '语言')}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">快捷键</div>
          </div>
          <button
            className="settings-add-btn"
            onClick={() => alert('请按下新的快捷键组合')}
          >
            {settings.hotkey || (isDarwin ? '⌘+Shift+K' : 'Ctrl+Shift+K')}
          </button>
        </div>
        {renderToggle(S.ctrl_enter_send, settings.ctrl_enter ?? false, `${modKey}+Enter 发送`, `使用 ${modKey}+Enter 替代 Enter 发送消息`)}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">后续模式</div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['auto', 'manual', 'off'] as const).map((mode) => (
              <button
                key={mode}
                className="settings-add-btn"
                style={
                  (settings.followup_mode || 'auto') === mode
                    ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                    : {}
                }
                onClick={() => updateAndSave('followup_mode', mode)}
              >
                {mode === 'auto' ? '自动' : mode === 'manual' ? '手动' : '关闭'}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">审核模式</div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['normal', 'strict', 'off'] as const).map((mode) => (
              <button
                key={mode}
                className="settings-add-btn"
                style={
                  (settings.review_mode || 'normal') === mode
                    ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                    : {}
                }
                onClick={() => updateAndSave('review_mode', mode)}
              >
                {mode === 'normal' ? '标准' : mode === 'strict' ? '严格' : '关闭'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">通知</div>
        {renderSelect(S.notification_turn, settings.notification_turn || 'all', [
          { value: 'all', label: '所有轮次' },
          { value: 'last', label: '仅最后一轮' },
          { value: 'off', label: '关闭' },
        ], '轮次完成通知')}
        {renderToggle(S.notification_permission, settings.notification_permission ?? true, '权限通知', '权限请求时发送通知')}
        {renderToggle(S.notification_question, settings.notification_question ?? true, '问题通知', '需要用户输入时发送通知')}
      </div>
    </div>
  );

  // ─── Tab: Appearance ───────────────────────────────────────────

  const renderAppearance = () => (
    <div className="stab-panel">
      <div className="settings-section-title">外观</div>

      <div className="settings-group">
        <div className="settings-group-title">主题</div>
        {renderRadioGroup('theme', settings.theme || 'dark', [
          { value: 'dark', title: '深色', desc: '深色主题，适合夜间使用' },
          { value: 'light', title: '浅色', desc: '浅色主题，适合白天使用' },
        ])}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">字体大小</div>
        {renderSelect(S.font_size, settings.font_size || 'medium', [
          { value: 'small', label: '小' },
          { value: 'medium', label: '中' },
          { value: 'large', label: '大' },
        ], '字体大小')}
      </div>
    </div>
  );

  // ─── Tab: Model ────────────────────────────────────────────────

  const renderModel = () => (
    <div className="stab-panel">
      <div className="settings-section-title">配置</div>

      <div className="settings-group">
        <div className="settings-group-title">API 配置</div>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="password"
            className="form-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入 API Key"
          />
        </div>
        {renderToggle(S.long_context, context1M, '1M 上下文', '启用 1M token 上下文窗口')}
        <div style={{ marginTop: '12px' }}>
          <button
            className="save-btn"
            onClick={async () => {
              try {
                if (apiKey) await api.setApiKey(apiKey);
                await api.updateSetting(S.long_context, context1M);
                await api.saveSettings({ ...settings, context_1m: context1M });
                alert('配置已保存');
              } catch (e) {
                alert('保存失败: ' + e);
              }
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tab: Personalize ──────────────────────────────────────────

  const renderPersonalize = () => (
    <div className="stab-panel">
      <div className="settings-section-title">个性化</div>

      <div className="settings-group">
        <div className="settings-group-title">个性</div>
        {renderSelect(S.personality, settings.personality || 'friendly', [
          { value: 'friendly', label: '亲和' },
          { value: 'professional', label: '专业' },
          { value: 'concise', label: '简洁' },
          { value: 'detailed', label: '详细' },
        ], '个性风格')}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">自定义指令</div>
        <div className="form-group">
          <textarea
            className="form-input"
            style={{ minHeight: '100px', resize: 'vertical' }}
            value={settings.custom_instructions || ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, custom_instructions: e.target.value }))}
            placeholder="输入自定义指令，这些指令将附加到每次对话中..."
          />
        </div>
        <button
          className="save-btn"
          onClick={async () => {
            try {
              await api.updateSetting(S.custom_instructions, settings.custom_instructions || '');
              alert('自定义指令已保存');
            } catch (e) {
              alert('保存失败: ' + e);
            }
          }}
        >
          保存
        </button>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">记忆</div>
        {renderToggle(S.auto_memory, settings.memory_self ?? true, '自用记忆', '记住您的偏好和习惯')}
        {renderToggle(S.tool_memory, settings.memory_tool ?? true, '通过工具辅助对话', '使用记忆工具增强对话上下文')}
        <div className="settings-row" style={{ marginTop: '8px' }}>
          <div className="settings-row-left">
            <div className="settings-row-title">工作记忆保留条数</div>
            <div className="settings-row-desc">每次发送消息时保留的历史消息数量（越多越占 token）</div>
          </div>
          <input
            type="number"
            min={5}
            max={100}
            defaultValue={settings.message_history_limit ?? 20}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 5 && val <= 100) {
                api.updateSetting(S.message_history_limit, val).catch(console.error);
              } else {
                e.target.value = String(settings.message_history_limit ?? 20);
              }
            }}
            style={{
              width: '70px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          />
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            className="save-btn"
            style={{ background: '#e81123', color: 'white' }}
            onClick={async () => {
              if (confirm('确定要重置所有记忆吗？此操作不可撤销。')) {
                try {
                  await api.resetMemory();
                  alert('记忆已重置');
                } catch (e) {
                  alert('重置失败: ' + e);
                }
              }
            }}
          >
            重置记忆
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tab: MCP ──────────────────────────────────────────────────

  const renderMCP = () => (
    <div className="stab-panel">
      <div className="settings-section-title">MCP 服务器</div>

      <div className="settings-group">
        <div className="settings-group-title">服务器列表</div>
        {mcpServers.length === 0 ? (
          <div className="domain-list">
            <div className="empty-hint">暂无 MCP 服务器</div>
          </div>
        ) : (
          <div className="domain-list">
            {mcpServers.map((server) => (
              <div className="domain-item" key={server.id}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className={`toggle${server.enabled ? ' active' : ''}`}
                    style={{ width: '32px', height: '18px' }}
                    onClick={async () => {
                      try {
                        await api.toggleMCPServer(server.id, !server.enabled);
                        setMcpServers((prev) =>
                          prev.map((s) => (s.id === server.id ? { ...s, enabled: !s.enabled } : s)),
                        );
                      } catch (e) {
                        console.error('Toggle MCP server failed:', e);
                      }
                    }}
                  />
                  <span>{server.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({server.type})</span>
                </span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeMCPServer(server.id);
                      setMcpServers((prev) => prev.filter((s) => s.id !== server.id));
                    } catch (e) {
                      console.error('Remove MCP server failed:', e);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">添加服务器</div>
        <div className="form-group">
          <label className="form-label">类型</label>
          <select
            className="settings-select"
            value={mcpType}
            onChange={(e) => setMcpType(e.target.value as 'stdio' | 'websocket')}
            style={{ width: '100%' }}
          >
            <option value="stdio">stdio</option>
            <option value="websocket">websocket</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">名称</label>
          <input
            className="form-input"
            value={mcpName}
            onChange={(e) => setMcpName(e.target.value)}
            placeholder="服务器名称"
          />
        </div>
        {mcpType === 'websocket' ? (
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              className="form-input"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="ws://localhost:8080"
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">命令</label>
              <input
                className="form-input"
                value={mcpCmd}
                onChange={(e) => setMcpCmd(e.target.value)}
                placeholder="npx"
              />
            </div>
            <div className="form-group">
              <label className="form-label">参数（空格分隔）</label>
              <input
                className="form-input"
                value={mcpArgs}
                onChange={(e) => setMcpArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server"
              />
            </div>
          </>
        )}
        <button
          className="settings-add-btn"
          onClick={async () => {
            if (!mcpName) return;
            try {
              if (mcpType === 'websocket') {
                await api.addMCPServer(mcpName, mcpUrl);
              } else {
                const args = mcpArgs ? mcpArgs.split(' ').filter(Boolean) : [];
                await api.addMCPServerStdio(mcpName, mcpCmd, args);
              }
              await loadMCPServers();
              setMcpName('');
              setMcpUrl('');
              setMcpCmd('');
              setMcpArgs('');
            } catch (e) {
              alert('添加失败: ' + e);
            }
          }}
        >
          添加
        </button>
      </div>
    </div>
  );

  // ─── Tab: Git ──────────────────────────────────────────────────

  const renderGit = () => (
    <div className="stab-panel">
      <div className="settings-section-title">Git</div>

      <div className="settings-group">
        <div className="settings-group-title">Git 设置</div>
        {renderToggle(S.auto_commit, settings.auto_commit ?? false, '自动提交', '在代码修改后自动提交更改')}
        {renderToggle(S.confirm_before_commit, settings.confirm_before_commit ?? true, '提交前确认', '在提交前显示确认对话框')}
      </div>
    </div>
  );

  // ─── Tab: Env ──────────────────────────────────────────────────

  const renderEnv = () => (
    <div className="stab-panel">
      <div className="settings-section-title">环境变量</div>

      <div className="settings-group">
        <div className="settings-group-title">环境变量列表</div>
        {envVars.length === 0 ? (
          <div className="domain-list">
            <div className="empty-hint">暂无环境变量</div>
          </div>
        ) : (
          <div className="domain-list">
            {envVars.map((ev) => (
              <div className="domain-item" key={ev.key}>
                <span>
                  <strong>{ev.key}</strong>={ev.value}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeEnvVar(ev.key);
                      await loadEnvVars();
                    } catch (e) {
                      console.error('Remove env var failed:', e);
                    }
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">添加环境变量</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="KEY"
            value={envKey}
            onChange={(e) => setEnvKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            className="form-input"
            placeholder="VALUE"
            value={envValue}
            onChange={(e) => setEnvValue(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!envKey) return;
              try {
                await api.addEnvVar(envKey, envValue);
                await loadEnvVars();
                setEnvKey('');
                setEnvValue('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tab: Worktree ─────────────────────────────────────────────

  const renderWorktree = () => (
    <div className="stab-panel">
      <div className="settings-section-title">工作树</div>

      <div className="settings-group">
        {renderToggle(
          S.use_worktree,
          settings.worktree_enabled ?? false,
          '在独立工作树中运行',
          '在独立的 git worktree 中执行任务，避免修改当前工作目录',
        )}
      </div>
    </div>
  );

  // ─── Tab: Browser ──────────────────────────────────────────────

  const renderBrowser = () => (
    <div className="stab-panel">
      <div className="settings-section-title">浏览器使用</div>

      <div className="settings-group">
        <div className="settings-group-title">插件</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">Selenium IDE</div>
            <div className="settings-row-desc">用于录制和回放浏览器操作的插件</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {settings.selenium_installed ? '已安装' : '未安装'}
          </span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">浏览器</div>
        {renderSelect(S.browser_clear_data, settings.browser_clear_data || 'never', [
          { value: 'never', label: '从不' },
          { value: 'onClose', label: '关闭时' },
          { value: 'onStart', label: '启动时' },
        ], '清除浏览数据')}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">权限</div>
        {renderSelect(S.browser_approval, settings.browser_approval || 'ask', [
          { value: 'ask', label: '每次询问' },
          { value: 'allow', label: '自动允许' },
          { value: 'deny', label: '自动拒绝' },
        ], '审批')}
        {renderSelect(S.browser_history, settings.browser_history || 'keep', [
          { value: 'keep', label: '保留' },
          { value: 'clear', label: '清除' },
        ], '历史记录')}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">已屏蔽的域名</div>
        <div className="domain-list">
          {blockedDomains.length === 0 ? (
            <div className="empty-hint">暂无屏蔽域名</div>
          ) : (
            blockedDomains.map((d) => (
              <div className="domain-item" key={d}>
                <span>{d}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeBlockedDomain(d);
                      setBlockedDomains((prev) => prev.filter((x) => x !== d));
                    } catch (e) {
                      console.error('Remove blocked domain failed:', e);
                    }
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="域名"
            value={newBlockedDomain}
            onChange={(e) => setNewBlockedDomain(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newBlockedDomain.trim()) {
                api.addBlockedDomain(newBlockedDomain.trim()).then(() => {
                  setBlockedDomains((prev) => [...prev, newBlockedDomain.trim()]);
                  setNewBlockedDomain('');
                }).catch(() => {});
              }
            }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!newBlockedDomain.trim()) return;
              try {
                await api.addBlockedDomain(newBlockedDomain.trim());
                setBlockedDomains((prev) => [...prev, newBlockedDomain.trim()]);
                setNewBlockedDomain('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">允许的域名</div>
        <div className="domain-list">
          {allowedDomains.length === 0 ? (
            <div className="empty-hint">暂无允许域名</div>
          ) : (
            allowedDomains.map((d) => (
              <div className="domain-item" key={d}>
                <span>{d}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeAllowedDomain(d);
                      setAllowedDomains((prev) => prev.filter((x) => x !== d));
                    } catch (e) {
                      console.error('Remove allowed domain failed:', e);
                    }
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="域名"
            value={newAllowedDomain}
            onChange={(e) => setNewAllowedDomain(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newAllowedDomain.trim()) {
                api.addAllowedDomain(newAllowedDomain.trim()).then(() => {
                  setAllowedDomains((prev) => [...prev, newAllowedDomain.trim()]);
                  setNewAllowedDomain('');
                }).catch(() => {});
              }
            }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!newAllowedDomain.trim()) return;
              try {
                await api.addAllowedDomain(newAllowedDomain.trim());
                setAllowedDomains((prev) => [...prev, newAllowedDomain.trim()]);
                setNewAllowedDomain('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tab: Computer ─────────────────────────────────────────────

  const renderComputer = () => (
    <div className="stab-panel">
      <div className="settings-section-title">电脑操控</div>

      <div className="settings-group">
        {renderToggle(
          S.computer_control,
          settings.computer_control ?? false,
          '允许鼠标和键盘控制',
          '允许 AI 直接控制鼠标和键盘操作',
        )}
      </div>
    </div>
  );

  // ─── Tab: Archived ─────────────────────────────────────────────

  const renderArchived = () => (
    <div className="stab-panel">
      <div className="settings-section-title">已归档对话</div>

      <div className="settings-group">
        <div className="domain-list">
          {archivedSessions.length === 0 ? (
            <div className="empty-hint">暂无已归档对话</div>
          ) : (
            archivedSessions.map((s) => (
              <div className="domain-item" key={s.ID}>
                <span>{s.Name || s.ID}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {s.CreatedAt ? new Date(s.CreatedAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ─── Tab: Slash Commands ───────────────────────────────────────

  const renderSlashCmd = () => (
    <div className="stab-panel">
      <div className="settings-section-title">斜杠命令</div>

      <div className="settings-group">
        <div className="settings-group-title">自定义命令</div>
        <div className="domain-list">
          {slashCommands.length === 0 ? (
            <div className="empty-hint">暂无自定义命令</div>
          ) : (
            slashCommands.map((cmd) => (
              <div className="domain-item" key={cmd.id || cmd.name}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 500 }}>/{cmd.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.description}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.removeSlashCommand(cmd.id);
                      await loadSlashCommands();
                    } catch (e) {
                      console.error('Remove slash command failed:', e);
                    }
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="命令名称"
            value={cmdName}
            onChange={(e) => setCmdName(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
          <input
            className="form-input"
            placeholder="描述"
            value={cmdDesc}
            onChange={(e) => setCmdDesc(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="填充文本"
            value={cmdFillText}
            onChange={(e) => setCmdFillText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!cmdName) return;
              try {
                await api.addSlashCommand(cmdName, cmdDesc, cmdFillText);
                await loadSlashCommands();
                setCmdName('');
                setCmdDesc('');
                setCmdFillText('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">内置命令</div>
        <div className="domain-list">
          {BUILTIN_COMMANDS.map((cmd) => (
            <div className="domain-item" key={cmd.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 500 }}>{cmd.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Tab routing ───────────────────────────────────────────────

  const renderTab = () => {
    switch (activeTab) {
      case 'general': return renderGeneral();
      case 'appearance': return renderAppearance();
      case 'model': return renderModel();
      case 'personalize': return renderPersonalize();
      case 'mcp': return renderMCP();
      case 'git': return renderGit();
      case 'env': return renderEnv();
      case 'worktree': return renderWorktree();
      case 'browser': return renderBrowser();
      case 'computer': return renderComputer();
      case 'archived': return renderArchived();
      case 'slashcmd': return renderSlashCmd();
      default: return null;
    }
  };

  // ─── Main render ───────────────────────────────────────────────

  if (!settingsOpen) return null;

  return (
    <div className="settings-page open">
      <div className="settings-page-header">
        <button className="settings-back-btn" onClick={closeSettings}>
          ← 返回
        </button>
        <span className="settings-page-title">设置</span>
      </div>
      <div className="settings-layout">
        <div className="settings-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="settings-content">
          {renderTab()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
