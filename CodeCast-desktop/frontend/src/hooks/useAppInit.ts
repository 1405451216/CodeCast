import { useEffect } from 'react';
import { useAppStore, AppState } from '../store';
import * as api from '../api';
import { toSession } from '../api/types';
import { EventsOn } from '../../wailsjs/runtime/runtime';

const isWailsEnvironment = typeof window !== 'undefined' && 'go' in window;

export function useAppInit() {
  const setPlatform = useAppStore((s: AppState) => s.setPlatform);
  const setSessions = useAppStore((s: AppState) => s.setSessions);
  const setProjects = useAppStore((s: AppState) => s.setProjects);

  useEffect(() => {
    if (!isWailsEnvironment) {
      console.log('[useAppInit] 非 Wails 环境，跳过初始化');
      return;
    }

    initApp();

    const cleanupAgentEvent = EventsOn('agent:event', (event: any) => {
      useAppStore.getState().handleAgentEvent(event);
    });

    return () => {
      cleanupAgentEvent();
    };
  }, []);

  async function initApp() {
    try {
      const p = await api.getPlatform();
      if (p === 'darwin' || p === 'linux' || p === 'windows') {
        setPlatform(p);
      }
    } catch (e) {
      console.error('Failed to detect platform:', e);
    }

    // 统一使用 ThemeSwitcher 的存储格式 (codecast-theme)
    const savedThemeRaw = localStorage.getItem('codecast-theme');
    let initialMode: string = 'dark';
    if (savedThemeRaw) {
      try {
        const parsed = JSON.parse(savedThemeRaw);
        if (parsed && typeof parsed.mode === 'string') {
          initialMode = parsed.mode;
        }
      } catch {
        // 旧格式兼容: codecast_theme 存的是纯字符串
        const legacyTheme = localStorage.getItem('codecast_theme');
        if (legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'system') {
          initialMode = legacyTheme;
        }
      }
    }
    document.documentElement.setAttribute('data-theme', initialMode);
    document.documentElement.classList.toggle('dark', initialMode === 'dark');

    try {
      const settings = await api.getSettings();
      if (settings) {
        if (settings.theme) {
          document.documentElement.setAttribute('data-theme', settings.theme);
          document.documentElement.classList.toggle('dark', settings.theme === 'dark');
          // 同步到新格式
          const existing = localStorage.getItem('codecast-theme');
          let themeConfig = { mode: settings.theme, accentColor: 'purple', fontSize: 'medium' };
          if (existing) {
            try {
              const parsed = JSON.parse(existing);
              themeConfig = { ...parsed, mode: settings.theme };
            } catch { /* ignore */ }
          }
          localStorage.setItem('codecast-theme', JSON.stringify(themeConfig));
        }
        if (settings.font_size) {
          document.documentElement.style.setProperty(
            '--font-size-base',
            settings.font_size === 'small' ? '12px' : settings.font_size === 'large' ? '16px' : '14px'
          );
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }

    try {
      const data = await api.getSessions();
      setSessions((data || []).map(toSession));
    } catch (e) {
      console.error('[useAppInit] 加载会话列表失败，使用空列表:', e);
      setSessions([]);
    }

    try {
      const data = await api.getProjects();
      if (data) {
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('[useAppInit] 加载项目列表失败:', e);
    }
  }
}
