import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useToast } from '../components/primitives/Toast';
import type { APMetricsSnapshot } from '../wails/types';

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
};

/**
 * CodeCast 风格底栏 —— "网关" 面板
 * - 默认折叠：模型 / 上下文 / 网关按钮
 * - 展开后：设置 / 语言 / 推理配置 / 查看更新日志 / 了解更多（嵌套子菜单）/ 注销
 */
export function BottomBar() {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const navigate = useNavigate();
  const model = useAppStore((s) => s.current);
  const thinking = useAppStore((s) => s.planMode);
  const configs = useAppStore((s) => s.configs);
  const currentVersion = useAppStore((s) => s.currentVersion);
  const refreshVersion = useAppStore((s) => s.refreshVersion);
  const metricsSnap = useAppStore((s) => s.metricsSnap);
  const updateKey = useAppStore((s) => s.updateKey);
  const checkUpdate = useAppStore((s) => s.checkUpdate);
  const settings = useAppStore((s) => s.settings);
  const toast = useToast();

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

  const learnChildren = [
    { id: 'about', label: '关于 Anthropic', external: true },
    { id: 'tutorial', label: '教程', external: true },
    { id: 'course', label: '课程', external: true },
    { id: 'usage', label: '使用政策', external: true },
    { id: 'privacy', label: '隐私政策', external: true },
    { id: 'your-privacy', label: '你的隐私选择', external: true },
    { id: 'shortcuts', label: '键盘快捷键' },
  ];

  const langChildren = [
    { id: 'zh-CN', label: '简体中文', onClick: () => { updateKey('language', 'zh-CN'); toast.show('语言已切换为简体中文', 'success'); } },
    { id: 'en-US', label: 'English (United States)', onClick: () => { updateKey('language', 'en-US'); toast.show('Language switched to English', 'success'); } },
  ];

  const items: GatewayItem[] = [
    { id: 'settings', label: '设置', desc: '主题、快捷键、API Key', icon: I.settings, onClick: () => { setOpen(false); navigate('/settings'); } },
    {
      id: 'lang', label: '语言', icon: I.lang, onClick: () => { setOpen(false); },
      right: <span style={{ color: 'var(--c-textMute)', display: 'inline-flex', fontSize: 11, gap: 4 }}>{currentLangLabel}{I.chevronRight}</span>,
      children: langChildren,
    },
    {
      id: 'reasoning', label: '推理配置', icon: I.brain, onClick: () => { setOpen(false); },
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
      id: 'learn', label: '了解更多', icon: I.info, onClick: () => { setOpen(false); },
      right: <span style={{ color: 'var(--c-textMute)', display: 'inline-flex' }}>{I.chevronRight}</span>,
      children: learnChildren,
    },
    { id: 'logout', label: '注销', desc: '清除本地凭据', icon: I.logout, onClick: () => { setOpen(false); }, danger: true },
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
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
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
          <span>网关</span>
          <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform var(--dur-fast) var(--ease)', display: 'inline-flex' }}>
            {I.chevron}
          </span>
        </button>
        <span style={{ color: 'var(--c-textMute)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{model || '—'}</span>
        <span style={{ color: 'var(--c-textMute)' }}>·</span>
        <span>context {totalTokens > 0 ? tokenStr : '0'}/{maxContextDisplay}</span>
        <div style={{ flex: 1 }} />
        <span>Plan</span>
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
              网关
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

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
