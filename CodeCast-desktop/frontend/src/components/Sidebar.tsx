import React, { useState, useEffect } from 'react';
import { useAppStore, AppState, Session } from '../store';
import { shallow } from 'zustand/shallow';

interface SidebarProps {
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  style?: React.CSSProperties;
  className?: string;
  onCloseMobile?: () => void;
  isMobileMenuOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewSession, 
  onSelectSession, 
  onDeleteSession, 
  style,
  className = '',
  onCloseMobile,
  isMobileMenuOpen = false
}) => {
  const sessions = useAppStore((s: AppState) => s.sessions, shallow);
  const currentSessionId = useAppStore((s: AppState) => s.currentSessionId);
  const sidebarVisible = useAppStore((s: AppState) => s.sidebarVisible);
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const toggleSettings = useAppStore((s: AppState) => s.toggleSettings);
  const filesPanelVisible = useAppStore((s: AppState) => s.filesPanelVisible);
  const toggleFilesPanel = useAppStore((s: AppState) => s.toggleFilesPanel);
  const [filter, setFilter] = useState('');
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsNarrowScreen(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!sidebarVisible) return null;

  const filtered = filter
    ? sessions.filter((s: Session) => s.Name.toLowerCase().includes(filter.toLowerCase()))
    : sessions;

  const handlePanelClick = (panel: 'plugins' | 'automation' | 'projects' | 'agents') => {
    setActivePanel(activePanel === panel ? null : panel);
    // Close mobile menu after selection
    if (isMobileMenuOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleSessionSelect = (id: string) => {
    onSelectSession(id);
    // Close mobile menu after selection
    if (isMobileMenuOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <nav 
      className={`sidebar ${className}`} 
      style={style}
      role="navigation"
      aria-label="主导航菜单"
      aria-hidden={!isMobileMenuOpen && isNarrowScreen}
    >
      <div className="sidebar-top">
        <button 
          className="new-task-btn" 
          onClick={onNewSession}
          aria-label="新建对话"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建对话
        </button>
        <div className="search-box" role="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索对话..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="搜索对话"
            autoComplete="off"
          />
        </div>
        
        {/* Mobile close button */}
        {isMobileMenuOpen && onCloseMobile && (
          <button 
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="关闭菜单"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick access panels */}
      <div style={{ padding: '0 12px' }} role="menubar" aria-label="快捷面板">
        <div
          className={`sidebar-item ${activePanel === 'plugins' ? 'active' : ''}`}
          data-panel="plugins"
          onClick={() => handlePanelClick('plugins')}
          role="menuitem"
          tabIndex={0}
          aria-current={activePanel === 'plugins' ? 'page' : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span className="item-label">插件</span>
        </div>
        <div
          className={`sidebar-item ${activePanel === 'automation' ? 'active' : ''}`}
          data-panel="automation"
          onClick={() => handlePanelClick('automation')}
          role="menuitem"
          tabIndex={0}
          aria-current={activePanel === 'automation' ? 'page' : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="item-label">自动化</span>
        </div>
        <div
          className={`sidebar-item ${activePanel === 'projects' ? 'active' : ''}`}
          data-panel="projects"
          onClick={() => handlePanelClick('projects')}
          role="menuitem"
          tabIndex={0}
          aria-current={activePanel === 'projects' ? 'page' : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="item-label">项目</span>
        </div>
        <div
          className={`sidebar-item ${filesPanelVisible ? 'active' : ''}`}
          data-panel="agents"
          onClick={() => toggleFilesPanel()}
          role="menuitem"
          tabIndex={0}
          aria-pressed={filesPanelVisible}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a7 7 0 0 1-12.46 0H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
            <circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" />
          </svg>
          <span className="item-label">子任务</span>
        </div>
      </div>

      <div className="sidebar-divider" role="separator" />

      {/* Session history */}
      <div className="sidebar-section">
        <span className="sidebar-section-title">对话历史</span>
      </div>

      <div 
        className="sidebar-list" 
        role="listbox" 
        aria-label="历史对话列表"
        aria-describedby="session-count"
      >
        {filtered.length === 0 ? (
          <div className="empty-hint" role="status">暂无对话</div>
        ) : (
          [...filtered].reverse().map((s, index) => (
            <div
              key={s.ID}
              className={`sidebar-item ${s.ID === currentSessionId ? 'active' : ''}`}
              onClick={() => handleSessionSelect(s.ID)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSessionSelect(s.ID);
                }
              }}
              role="option"
              tabIndex={0}
              aria-selected={s.ID === currentSessionId}
              aria-posinset={index + 1}
              aria-setsize={filtered.length}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }} aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span className="item-label">
                {s.Mode === 'coding' ? '💻 ' : s.Mode === 'daily' ? '💬 ' : ''}
                {s.Name}
              </span>
              <button
                className="item-del"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(s.ID);
                }}
                title="删除此对话"
                aria-label={`删除对话: ${s.Name}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Hidden count for screen readers */}
      <span id="session-count" className="sr-only">
        共 {filtered.length} 个对话
      </span>

      <div className="sidebar-divider" role="separator" />

      {/* Settings button */}
      <div style={{ padding: '4px 12px' }}>
        <div
          className="sidebar-item"
          onClick={() => toggleSettings()}
          role="menuitem"
          tabIndex={0}
          aria-label="打开设置"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="item-label">设置</span>
        </div>
      </div>
    </nav>
  );
};

export default React.memo(Sidebar);
