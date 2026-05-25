import { useEffect } from 'react';
import { useAppStore, AppState } from '../store';
import * as api from '../api';
import { toSession } from '../api/types';
import { EventsOn } from '../../wailsjs/runtime/runtime';

export function useAppInit() {
  const setPlatform = useAppStore((s: AppState) => s.setPlatform);
  const setSessions = useAppStore((s: AppState) => s.setSessions);
  const setProjects = useAppStore((s: AppState) => s.setProjects);

  useEffect(() => {
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

    const savedTheme = localStorage.getItem('codecast_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    try {
      const settings = await api.getSettings();
      if (settings) {
        if (settings.theme) {
          document.documentElement.setAttribute('data-theme', settings.theme);
          localStorage.setItem('codecast_theme', settings.theme);
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
