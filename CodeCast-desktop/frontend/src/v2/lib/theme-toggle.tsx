import { useEffect, useState } from 'react';
import { getStoredTheme, setStoredTheme } from '../design/theme';
import { useI18n } from './useI18n';
type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const t = useI18n();
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  useEffect(() => { setStoredTheme(theme); }, [theme]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setStoredTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const icons: Record<Theme, React.ReactNode> = {
    light: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    dark: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3c0-.5.07-1 .18-1.45A6 6 0 1 0 14.45 9.32 5.5 5.5 0 0 1 13 9.5Z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    system: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M8 6v3M6.5 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  };

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'))}
      aria-label={t.themeToggle.ariaLabel(t.themeToggle[theme])}
      title={t.themeToggle.ariaLabel(t.themeToggle[theme])}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        color: 'var(--c-textSub)',
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--c-surface-hover)';
        e.currentTarget.style.color = 'var(--c-text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--c-textSub)';
      }}
    >
      {icons[theme]}
    </button>
  );
}
