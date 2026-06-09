import { ThemeToggle } from '../lib/theme-toggle';
import { forwardRef, type RefObject } from 'react';
import { useError } from '../lib/useError';
import { useI18n } from '../lib/useI18n';

interface Props {
  onPrevSession?: () => void;
  onNextSession?: () => void;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
  onToggleSplit?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onBack?: () => void;
  backLabel?: string;
  menuButtonRef?: RefObject<HTMLButtonElement>;
  menuOpen?: boolean;
  sessionName?: string;
}

/**
 * Claude Code 风格 TopBar
 * 左侧：☰ 菜单 / ⏷ 分屏 / 🔍 搜索 / ← 上一会话 / → 下一会话
 * 右侧：— 最小化 / ▢ 最大化 / × 关闭
 *
 * 也支持二级页面：传入 onBack + backLabel 后左侧变为 ← 返回 + 标题
 */
export function TopBar({
  onPrevSession, onNextSession, onOpenSearch, onOpenMenu, onToggleSplit,
  onMinimize, onMaximize, onClose,
  onBack, backLabel,
  menuButtonRef, menuOpen,
  sessionName,
}: Props) {
  useError('model');
  const t = useI18n();
  if (onBack) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px', gap: 4, fontSize: 13, color: 'var(--c-text)' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            background: 'transparent', border: 'none', borderRadius: 'var(--r-md)',
            color: 'var(--c-text)', fontSize: 13, cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel || t.topbar.back}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        padding: '0 4px 0 4px',
        gap: 2,
        fontSize: 13,
        color: 'var(--c-text)',
        '--wails-draggable': 'drag',
      } as React.CSSProperties}
    >
      {/* 左侧按钮组 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, '--wails-draggable': 'no-drag' } as React.CSSProperties}>
        <TopIconBtn ref={menuButtonRef} aria-label={t.topbar.mainMenu} title={t.topbar.mainMenu} onClick={onOpenMenu} active={menuOpen}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.splitView} title={t.topbar.splitViewComingSoon} onClick={onToggleSplit} style={{ opacity: 0.4, cursor: 'default' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.search} title={t.topbar.searchShortcut} onClick={onOpenSearch}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.prevSession} title={t.topbar.prevSession} onClick={onPrevSession}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.nextSession} title={t.topbar.nextSession} onClick={onNextSession}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </TopIconBtn>
      </div>

      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', '--wails-draggable': 'drag' } as React.CSSProperties}>
        {sessionName && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--c-textMute)',
              fontFamily: 'var(--font-mono)',
              maxWidth: 240,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={sessionName}
          >
            {sessionName}
          </span>
        )}
      </div>

      {/* 右侧：主题切换 + 窗口控件 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, '--wails-draggable': 'no-drag' } as React.CSSProperties}>
        <ThemeToggle />
        <div style={{ width: 1, height: 18, background: 'var(--c-border)', margin: '0 4px' }} />
        <TopIconBtn aria-label={t.topbar.minimize} title={t.topbar.minimize} onClick={onMinimize}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.maximize} title={t.topbar.maximize} onClick={onMaximize}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="3" width="10" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </TopIconBtn>
        <TopIconBtn aria-label={t.topbar.close} title={t.topbar.close} onClick={onClose} danger>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </TopIconBtn>
      </div>
    </div>
  );
}

const TopIconBtn = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; danger?: boolean; active?: boolean }>(function TopIconBtn(
  { children, danger, active, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--c-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        color: active ? 'var(--c-text)' : 'var(--c-textSub)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
        ...(rest.style || {}),
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.background = danger ? 'var(--c-danger)' : 'var(--c-surface-hover)';
        e.currentTarget.style.color = danger ? '#fff' : 'var(--c-text)';
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--c-textSub)';
      }}
    >
      {children}
    </button>
  );
});
