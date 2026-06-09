import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useToast } from '../components/primitives/Toast';
import { GitHub } from '../wails/adapter';

interface GatewayItem {
  id: string;
  label: string;
  desc?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  /** 嵌套子菜单（3 级菜单） */
  children?: { id: string; label: string; external?: boolean; onClick?: () => void }[];
}

const I = {
  settings: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  lang: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 8h12M8 2c1.5 1.5 2.5 3.5 2.5 6S9.5 12.5 8 14M8 2C6.5 3.5 5.5 5.5 5.5 8s1 4.5 2.5 6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  brain: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M6 2.5a2.5 2.5 0 0 0-2.5 2.5v.5A2 2 0 0 0 2 7.5 2 2 0 0 0 3.5 11v.5A2.5 2.5 0 0 0 6 14h.5V2.5H6ZM10 2.5v11.5h.5a2.5 2.5 0 0 0 2.5-2.5V11A2 2 0 0 0 14 7.5 2 2 0 0 0 12.5 5.5V5A2.5 2.5 0 0 0 10 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M6 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h2M10 5.5l2.5 2.5-2.5 2.5M6 8h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="m3 4 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronRight: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="m4 3 2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  gateway: (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="4.5" r="0.5" fill="currentColor" />
      <circle cx="5.5" cy="4.5" r="0.5" fill="currentColor" />
    </svg>
  ),
  history: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8a5 5 0 1 1 1.5 3.5L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 4v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  external: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M4 8l4-4M4.5 4H8v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  github: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.001 8.001 0 0 0 16 8c0-4.42-3.58-8-8-8z" fill="currentColor" />
    </svg>
  ),
};

/**
 * CodeCast 风格底栏 —— "设置" 面板
 * - 默认折叠：模型 / 上下文 / 设置按钮
 * - 展开后：设置 / 语言 / 推理配置 / 查看更新日志 / 了解更多（嵌套子菜单）/ 注销
 */
export function BottomBar() {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  // Escape to close settings panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);
  const model = useAppStore((s) => s.current);
  const thinking = useAppStore((s) => s.planMode);
  const togglePlanMode = useAppStore((s) => s.togglePlanMode);
  const configs = useAppStore((s) => s.configs);
  const currentVersion = useAppStore((s) => s.currentVersion);
  const connected = configs && configs.length > 0;
  const refreshVersion = useAppStore((s) => s.refreshVersion);
  const metricsSnap = useAppStore((s) => s.metricsSnap);
  const updateKey = useAppStore((s) => s.updateKey);
  const checkUpdate = useAppStore((s) => s.checkUpdate);
  const settings = useAppStore((s) => s.settings);
  const toast = useToast();
  const githubUser = useAppStore((s) => s.githubUser);
  const setGitHubUser = useAppStore((s) => s.setGitHubUser);
  const setGitHubLoading = useAppStore((s) => s.setGitHubLoading);
  const clearGitHubAuth = useAppStore((s) => s.clearGitHubAuth);

  // 加载 GitHub 登录状态
  useEffect(() => {
    GitHub.isLoggedIn().then((loggedIn) => {
      if (loggedIn) {
        GitHub.getUser().then((user) => {
          if (user) setGitHubUser(user);
        });
      }
    });
  }, [setGitHubUser]);

  // GitHub 登录
  const handleGitHubLogin = async () => {
    setGitHubLoading(true);
    try {
      const msg = await GitHub.login();
      toast.show(msg, 'info');
      // 轮询等待回调完成（最多 120 秒）
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const user = await GitHub.getUser();
        if (user) {
          setGitHubUser(user);
          return;
        }
      }
      toast.show('登录超时，请重试', 'warn');
    } catch (err: any) {
      toast.show(`登录失败: ${err?.message || err}`, 'danger');
    } finally {
      setGitHubLoading(false);
    }
  };

  // GitHub 注销
  const handleGitHubLogout = async () => {
    try {
      await GitHub.logout();
      clearGitHubAuth();
      toast.show('已注销 GitHub', 'success');
    } catch (err: any) {
      toast.show(`注销失败: ${err?.message || err}`, 'danger');
    }
  };

  // Derive context window from active model config
  const activeConfig = configs?.find((c) => c.model === model);
  const maxContext = activeConfig?.maxContext ?? 200_000;
  const maxContextDisplay = maxContext >= 1000 ? `${(maxContext / 1000).toFixed(0)}k` : String(maxContext);

  // Load version on mount if not yet set
  useEffect(() => {
    if (!currentVersion) refreshVersion();
  }, [currentVersion, refreshVersion]);

  // Compute total tokens from metrics
  const totalTokens = metricsSnap
    ? Object.values(metricsSnap.tokenUsageByModel || {}).reduce((sum, m) => sum + m.totalTokens, 0)
    : 0;
  const tokenStr = totalTokens > 1_000_000
    ? `${(totalTokens / 1_000_000).toFixed(1)}M`
    : totalTokens > 1000
      ? `${(totalTokens / 1000).toFixed(1)}k`
      : String(totalTokens);

  // Current language from settings
  const currentLang = (settings as Record<string, unknown> | null)?.language as string | undefined;
  const currentLangLabel = currentLang === 'en-US' ? 'English' : '中文';

  const langChildren = [
    { id: 'zh-CN', label: '简体中文', onClick: () => { updateKey('language', 'zh-CN'); toast.show('语言已切换为简体中文', 'success'); } },
    { id: 'en-US', label: 'English (United States)', onClick: () => { updateKey('language', 'en-US'); toast.show('Language switched to English', 'success'); } },
  ];

  const items: GatewayItem[] = [
    { id: 'settings', label: '设置', desc: '主题、快捷键、API Key', icon: I.settings, onClick: () => { setOpen(false); navigate('/settings'); } },
    {
      id: 'lang', label: '语言', icon: I.lang,
      // 有子菜单的项：点击不关闭面板，由 hover 触发子菜单
      onClick: () => {},
      right: <span style={{ color: 'var(--c-textMute)', display: 'inline-flex', fontSize: 11, gap: 4 }}>{currentLangLabel}{I.chevronRight}</span>,
      children: langChildren,
    },
    { id: 'reasoning', label: '推理配置', icon: I.brain, onClick: () => { setOpen(false); navigate('/inference'); },
      right: <span style={{ fontSize: 11, color: 'var(--c-textMute)' }}>{thinking ? 'On' : 'Off'}</span>,
    },
    { id: 'changelog', label: '查看更新日志', icon: I.history, onClick: () => {
      setOpen(false);
      checkUpdate().then(() => {
        const info = useAppStore.getState().updateInfo;
        if (info && info.version !== currentVersion) {
          toast.show(`最新版本 v${info.version}: ${info.title}`, 'success');
        } else {
          toast.show(`当前 v${currentVersion || '…'} 已是最新`, 'info');
        }
      });
    } },
    {
      id: 'about', label: '关于 CodeCast', icon: I.info, onClick: () => { setOpen(false); window.open('https://codecast.cloud', '_blank'); },
    },
    {
      id: 'github',
      label: githubUser ? githubUser.login : '使用 GitHub 登录',
      desc: githubUser ? `已连接为 ${githubUser.name || githubUser.login}` : '使用 GitHub 账号登录',
      icon: githubUser
        ? (
          <img src={githubUser.avatar_url} alt={githubUser.login} style={{ width: 18, height: 18, borderRadius: '50%' }} />
        )
        : I.github,
      onClick: () => { setOpen(false); githubUser ? handleGitHubLogout() : handleGitHubLogin(); },
      danger: false,
    },
  ];

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  const scheduleClose = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setHoveredId((cur) => (cur === id ? null : cur));
    }, 180);
  };
  const openImmediate = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setHoveredId(id);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          padding: '0 12px',
          fontSize: 12,
          color: 'var(--c-textSub)',
          gap: 12,
        }}
      >
        {/* Connection status indicator */}
        <span
          title={connected ? '已连接到后端' : '未连接到后端'}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: connected ? 'var(--c-success, #4caf50)' : 'var(--c-danger, #e74c3c)',
            flexShrink: 0,
          }}
        />
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            background: open ? 'var(--c-accentSoft)' : 'transparent',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            color: open ? 'var(--c-accentText)' : 'var(--c-textSub)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all var(--dur-fast) var(--ease)',
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        >
          {I.gateway}
          <span>设置</span>
          <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform var(--dur-fast) var(--ease)', display: 'inline-flex' }}>
            {I.chevron}
          </span>
        </button>
        <span style={{ color: 'var(--c-textMute)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{model || '—'}</span>
        <span style={{ color: 'var(--c-textMute)' }}>·</span>
        <span>context {totalTokens > 0 ? tokenStr : '0'}/{maxContextDisplay}</span>
        <div style={{ flex: 1 }} />
        {githubUser && (
          <img
            src={githubUser.avatar_url}
            alt={githubUser.login}
            title={`GitHub: ${githubUser.name || githubUser.login}`}
            style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer' }}
            onClick={() => setOpen((v) => !v)}
          />
        )}
        <button
          onClick={togglePlanMode}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            color: thinking ? 'var(--c-accent)' : 'var(--c-text)',
            transition: 'color var(--dur-fast) var(--ease)',
          }}
          title={thinking ? 'Plan 模式: 开启 (⌘⇧P 关闭)' : 'Plan 模式: 关闭 (⌘⇧P 开启)'}
        >
          Plan: {thinking ? 'On' : 'Off'}
        </button>
        <span style={{ color: 'var(--c-textMute)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>v{currentVersion || '…'}</span>
      </div>

      {open && (
        <>
          {/* 背景遮罩，点击关闭 */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              left: 8,
              bottom: 'calc(100% + 4px)',
              width: 280,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-pop)',
              padding: 6,
              zIndex: 50,
              animation: 'fadeUp var(--dur-base) var(--ease)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--c-textMute)', padding: '6px 10px 4px' }}>
              设置
            </div>
            {items.map((it) => {
              const hasChildren = !!it.children?.length;
              const isHover = hoveredId === it.id;
              return (
                <div
                  key={it.id}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => { if (hasChildren) openImmediate(it.id); }}
                  onMouseLeave={() => { if (hasChildren) scheduleClose(it.id); }}
                >
                  <button
                    onClick={hasChildren ? undefined : it.onClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 10px',
                      background: isHover ? 'var(--c-surface-hover)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--r-md)',
                      color: it.danger ? 'var(--c-danger)' : 'var(--c-text)',
                      fontSize: 13,
                      textAlign: 'left',
                      cursor: hasChildren ? 'default' : 'pointer',
                      transition: 'background var(--dur-fast) var(--ease)',
                    }}
                    onMouseEnter={(e) => { if (!hasChildren) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
                    onMouseLeave={(e) => { if (!hasChildren) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'inline-flex', color: it.danger ? 'var(--c-danger)' : 'var(--c-textSub)' }}>{it.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{it.label}</div>
                      {it.desc && <div style={{ fontSize: 11, color: 'var(--c-textMute)', marginTop: 1 }}>{it.desc}</div>}
                    </div>
                    {it.right}
                  </button>

                  {/* 3 级嵌套子菜单 */}
                  {hasChildren && isHover && (
                    <div
                      onMouseEnter={cancelClose}
                      onMouseLeave={() => scheduleClose(it.id)}
                      style={{
                        position: 'absolute',
                        left: '100%',
                        top: -6,
                        marginLeft: 4,
                        width: 220,
                        background: 'var(--c-surface)',
                        border: '1px solid var(--c-border)',
                        borderRadius: 'var(--r-lg)',
                        boxShadow: 'var(--shadow-pop)',
                        padding: 6,
                        zIndex: 60,
                        animation: 'fadeUp var(--dur-base) var(--ease)',
                      }}
                    >
                      {it.children!.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { c.onClick?.(); setOpen(false); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '6px 10px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--r-md)',
                            color: 'var(--c-text)',
                            fontSize: 12,
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ flex: 1 }}>{c.label}</span>
                          {c.external && (
                            <span style={{ color: 'var(--c-textMute)', display: 'inline-flex' }}>{I.external}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
