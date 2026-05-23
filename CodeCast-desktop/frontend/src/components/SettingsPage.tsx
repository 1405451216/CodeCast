import React, { useState, useEffect } from 'react';
import { useAppStore, AppState } from '../store';
import * as api from '../api';
import { S } from '../settingsKeys';
import { SettingsData } from './settings/settingsHelpers';

// Tab components
import GeneralTab from './settings/GeneralTab';
import AppearanceTab from './settings/AppearanceTab';
import ModelTab from './settings/ModelTab';
import PersonalizeTab from './settings/PersonalizeTab';
import MCPTab from './settings/MCPTab';
import GitTab from './settings/GitTab';
import EnvTab from './settings/EnvTab';
import WorktreeTab from './settings/WorktreeTab';
import BrowserTab from './settings/BrowserTab';
import ComputerTab from './settings/ComputerTab';
import ArchivedTab from './settings/ArchivedTab';
import SlashCmdTab from './settings/SlashCmdTab';

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

// ─── Component ─────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const settingsOpen = useAppStore((s: AppState) => s.settingsOpen);
  const closeSettings = useAppStore((s: AppState) => s.closeSettings);
  const platform = useAppStore((s: AppState) => s.platform);
  const isDarwin = platform === 'darwin';
  const modKey = isDarwin ? '\u2318' : 'Ctrl';

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Settings data
  const [settings, setSettings] = useState<SettingsData>({});

  // ─── Load data on open ─────────────────────────────────────

  useEffect(() => {
    if (!settingsOpen) return;

    const loadData = async () => {
      try {
        const s = await api.getSettings();
        if (s) {
          setSettings(s);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };

    loadData();
  }, [settingsOpen]);

  // ─── Helpers ───────────────────────────────────────────────────

  const updateAndSave = async (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

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

  // ─── Tab routing ───────────────────────────────────────────────

  const renderTab = () => {
    const tabProps = { settings, updateAndSave, isDarwin, modKey };

    switch (activeTab) {
      case 'general':
        return <GeneralTab {...tabProps} />;
      case 'appearance':
        return <AppearanceTab {...tabProps} />;
      case 'model':
        return <ModelTab {...tabProps} />;
      case 'personalize':
        return <PersonalizeTab {...tabProps} setSettings={setSettings} />;
      case 'mcp':
        return <MCPTab />;
      case 'git':
        return <GitTab {...tabProps} />;
      case 'env':
        return <EnvTab />;
      case 'worktree':
        return <WorktreeTab {...tabProps} />;
      case 'browser':
        return <BrowserTab {...tabProps} />;
      case 'computer':
        return <ComputerTab {...tabProps} />;
      case 'archived':
        return <ArchivedTab />;
      case 'slashcmd':
        return <SlashCmdTab />;
      default:
        return null;
    }
  };

  // ─── Main render ───────────────────────────────────────────────

  if (!settingsOpen) return null;

  return (
    <div className="settings-page open">
      <div className="settings-page-header">
        <button className="settings-back-btn" onClick={closeSettings}>
          &larr; 返回
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

export default React.memo(SettingsPage);
