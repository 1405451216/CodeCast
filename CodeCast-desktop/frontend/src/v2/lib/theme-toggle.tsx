import { useEffect, useState } from 'react';
import { getStoredTheme, setStoredTheme } from '../design/theme';
type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  useEffect(() => { setStoredTheme(theme); }, [theme]);
  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="切换主题"
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
      {theme === 'light' ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3c0-.5.07-1 .18-1.45A6 6 0 1 0 14.45 9.32 5.5 5.5 0 0 1 13 9.5Z" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
