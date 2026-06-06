// frontend/src/v2/design/theme.ts
import { light, dark } from './tokens';

const KEY = 'codecast.v2.theme';
type Theme = 'light' | 'dark' | 'system';

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  return theme;
}

export function applyTheme(theme: Theme) {
  const actual = resolve(theme);
  const c = actual === 'light' ? light : dark;
  const root = document.documentElement;
  root.setAttribute('data-theme', actual);
  root.setAttribute('data-theme-pref', theme);
  Object.entries(c).forEach(([k, v]) => root.style.setProperty(`--c-${k}`, v));
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function getStoredTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) || 'light';
}
