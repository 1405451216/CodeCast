import React, { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';
type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'cyan';

interface ThemeConfig {
  mode: ThemeMode;
  accentColor: AccentColor;
}

const ACCENT_COLORS: Record<AccentColor, { primary: string; hover: string; gradient: string }> = {
  purple: { primary: '#7c7cff', hover: '#9a9aff', gradient: 'linear-gradient(135deg, #7c7cff, #a78bfa)' },
  blue: { primary: '#60a5fa', hover: '#93c5fd', gradient: 'linear-gradient(135deg, #60a5fa, #34d399)' },
  green: { primary: '#34d399', hover: '#6ee7b7', gradient: 'linear-gradient(135deg, #34d399, #10b981)' },
  orange: { primary: '#fb923c', hover: '#fdba74', gradient: 'linear-gradient(135deg, #fb923c, #f59e0b)' },
  pink: { primary: '#f472b6', hover: '#f9a8d4', gradient: 'linear-gradient(135deg, #f472b6, #ec4899)' },
  cyan: { primary: '#22d3ee', hover: '#67e8f9', gradient: 'linear-gradient(135deg, #22d3ee, #06b6d4)' }
};

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem('codecast-theme');

    if (!saved) {
      return { mode: 'dark' as ThemeMode, accentColor: 'purple' as AccentColor };
    }

    try {
      const parsed = JSON.parse(saved);

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.mode === 'string' &&
        ['dark', 'light', 'system'].includes(parsed.mode) &&
        typeof parsed.accentColor === 'string' &&
        ['purple', 'blue', 'green', 'orange', 'pink', 'cyan'].includes(parsed.accentColor)
      ) {
        return {
          mode: parsed.mode as ThemeMode,
          accentColor: parsed.accentColor as AccentColor
        };
      }

      console.warn('[Theme] Invalid theme config structure, using default');
      localStorage.removeItem('codecast-theme');
    } catch (error) {
      console.warn('[Theme] Failed to parse theme data:', error);
      localStorage.removeItem('codecast-theme');
    }

    return { mode: 'dark' as ThemeMode, accentColor: 'purple' as AccentColor };
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
      if (theme.mode === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme.mode]);

  const applyTheme = useCallback((config: ThemeConfig) => {
    const root = document.documentElement;

    const currentSystemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = config.mode === 'dark' || (config.mode === 'system' && currentSystemIsDark);
    
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', config.mode);
    root.setAttribute('data-accent', config.accentColor);

    const accent = ACCENT_COLORS[config.accentColor];
    root.style.setProperty('--accent', accent.primary);
    root.style.setProperty('--accent-hover', accent.hover);
    root.style.setProperty('--gradient-accent', accent.gradient);

    localStorage.setItem('codecast-theme', JSON.stringify(config));
  }, []);

  const toggleMode = (mode: ThemeMode) => {
    setTheme(prev => ({ ...prev, mode }));
    setIsOpen(false);
  };

  const changeAccent = (color: AccentColor) => {
    setTheme(prev => ({ ...prev, accentColor: color }));
  };

  const currentAccent = ACCENT_COLORS[theme.accentColor];

  return (
    <div className="theme-switcher-wrapper">
      <button
        className="theme-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="主题设置"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '1px solid var(--border-color, var(--border))',
          background: 'transparent',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          padding: 0,
          fontSize: '18px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--sidebar-hover, rgba(255,255,255,0.05))';
          e.currentTarget.style.borderColor = 'var(--accent, #7c7cff)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border-color, var(--border))';
        }}
      >
        {theme.mode === 'dark' ? '🌙' : theme.mode === 'light' ? '☀️' : '💻'}
      </button>

      {isOpen && (
        <>
          <div
            className="theme-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998
            }}
          />

          <div
            className="theme-panel"
            role="menu"
            aria-label="主题选择面板"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '280px',
              background: 'var(--glass-bg, rgba(30,30,35,0.98))',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
              borderRadius: '16px',
              padding: '20px',
              zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <h3
              style={{
                margin: '0 0 16px',
                fontSize: 'var(--text-base, 16px)',
                fontWeight: 600,
                fontFamily: 'var(--font-display, sans-serif)',
                color: 'var(--text-primary, var(--text))',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🎨 主题设置
            </h3>

            <fieldset
              style={{
                border: 'none',
                padding: 0,
                marginBottom: '20px'
              }}
            >
              <legend
                style={{
                  fontSize: 'var(--text-sm, 14px)',
                  fontWeight: 500,
                  color: 'var(--text-secondary, var(--text-dim))',
                  marginBottom: '12px'
                }}
              >
                外观模式
              </legend>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px'
                }}
              >
                {[
                  { value: 'dark' as ThemeMode, icon: '🌙', label: '深色' },
                  { value: 'light' as ThemeMode, icon: '☀️', label: '浅色' },
                  { value: 'system' as ThemeMode, icon: '💻', label: '跟随系统' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleMode(option.value)}
                    role="menuitemradio"
                    aria-checked={theme.mode === option.value}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 8px',
                      borderRadius: '12px',
                      border: theme.mode === option.value
                        ? `2px solid ${currentAccent.primary}`
                        : '1px solid var(--border-color, var(--border))',
                      background: theme.mode === option.value
                        ? `${currentAccent.primary}15`
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '20px'
                    }}
                    onMouseEnter={(e) => {
                      if (theme.mode !== option.value) {
                        e.currentTarget.style.background = 'var(--sidebar-hover, rgba(255,255,255,0.05))';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme.mode !== option.value) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span>{option.icon}</span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs, 12px)',
                        fontWeight: 500,
                        color: 'var(--text-secondary, var(--text-dim))'
                      }}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset
              style={{
                border: 'none',
                padding: 0
              }}
            >
              <legend
                style={{
                  fontSize: 'var(--text-sm, 14px)',
                  fontWeight: 500,
                  color: 'var(--text-secondary, var(--text-dim))',
                  marginBottom: '12px'
                }}
              >
                强调色
              </legend>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((color) => (
                  <button
                    key={color}
                    onClick={() => changeAccent(color)}
                    role="menuitemradio"
                    aria-checked={theme.accentColor === color}
                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: theme.accentColor === color
                        ? `3px solid ${ACCENT_COLORS[color].primary}`
                        : '3px solid transparent',
                      background: ACCENT_COLORS[color].gradient,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: theme.accentColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: theme.accentColor === color
                        ? `0 0 12px ${ACCENT_COLORS[color].primary}40`
                        : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = theme.accentColor === color ? 'scale(1.15)' : 'scale(1)';
                    }}
                  />
                ))}
              </div>
            </fieldset>

            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color, var(--border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 'var(--text-xs, 12px)',
                color: 'var(--text-muted, #555555)'
              }}>
              <span>当前: {theme.mode === 'dark' ? '🌙 深色' : theme.mode === 'light' ? '☀️ 浅色' : '💻 跟随系统'}</span>
              <span
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: currentAccent.gradient
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSwitcher;
export type { ThemeMode, AccentColor, ThemeConfig };
export { ACCENT_COLORS };
