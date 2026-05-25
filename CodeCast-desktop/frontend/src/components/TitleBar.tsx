import React, { useEffect, useRef, useState } from 'react';
import { useAppStore, ActiveMenu, AppState, Project } from '../store';
import * as api from '../api';
import ThemeSwitcher from './ThemeSwitcher';

const modKey = () => (useAppStore.getState().platform === 'darwin' ? '⌘' : 'Ctrl');

interface EditorInfo {
  id: string;
  name: string;
  path?: string;
}

interface TitleBarProps {
  onMobileMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ onMobileMenuToggle, mobileMenuOpen }) => {
  const activeMenu = useAppStore((s: AppState) => s.activeMenu);
  const setActiveMenu = useAppStore((s: AppState) => s.setActiveMenu);
  const closeMenus = useAppStore((s: AppState) => s.closeMenus);
  const toggleSidebar = useAppStore((s: AppState) => s.toggleSidebar);
  const toggleSettings = useAppStore((s: AppState) => s.toggleSettings);
  const settingsOpen = useAppStore((s: AppState) => s.settingsOpen);
  const popoutMode = useAppStore((s: AppState) => s.popoutMode);
  const togglePopout = useAppStore((s: AppState) => s.togglePopout);
  const previewPanelVisible = useAppStore((s: AppState) => s.previewPanelVisible);
  const togglePreviewPanel = useAppStore((s: AppState) => s.togglePreviewPanel);
  const filesPanelVisible = useAppStore((s: AppState) => s.filesPanelVisible);
  const toggleFilesPanel = useAppStore((s: AppState) => s.toggleFilesPanel);
  const currentProject = useAppStore((s: AppState) => s.currentProject);
  const projects = useAppStore((s: AppState) => s.projects);
  const platform = useAppStore((s: AppState) => s.platform);
  const isDarwin = platform === 'darwin';

  const titlebarRef = useRef<HTMLDivElement>(null);
  const editorBtnRef = useRef<HTMLDivElement>(null);
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [editors, setEditors] = useState<EditorInfo[]>([]);

  const projectPath = projects.find((p: Project) => p.id === currentProject)?.path ?? currentProject ?? '';

  // Load available editors
  useEffect(() => {
    let cancelled = false;
    api.getAvailableEditors().then((result: any) => {
      if (cancelled) return;
      if (Array.isArray(result)) {
        setEditors(result);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (titlebarRef.current && !titlebarRef.current.contains(e.target as Node)) {
        closeMenus();
      }
      if (editorBtnRef.current && !editorBtnRef.current.contains(e.target as Node)) {
        setEditorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [closeMenus]);

  const toggleMenu = (menu: ActiveMenu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleOpenInEditor = async (editorId: string) => {
    try {
      await api.setPreferredEditor(editorId);
      if (projectPath) {
        await api.openInEditor(projectPath);
      }
    } catch (e) {
      console.error('Open in editor failed:', e);
    }
    setEditorDropdownOpen(false);
  };

  const handlePopout = () => {
    api.popoutWindow();
    togglePopout();
  };

  return (
    <div className="titlebar" ref={titlebarRef} role="banner">
      <div className="titlebar-left">
        {/* Mobile menu button - only visible on small screens */}
        {onMobileMenuToggle && (
          <button 
            className="tb-nav-btn mobile-menu-btn" 
            onClick={onMobileMenuToggle}
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileMenuOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* Sidebar toggle - hidden on mobile */}
        <button 
          className="tb-nav-btn sidebar-toggle-btn" 
          onClick={toggleSidebar} 
          title="切换侧边栏"
          aria-label="切换侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        <div className="tb-separator" role="separator" />

        {/* File menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('file')}
            style={activeMenu === 'file' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
            aria-expanded={activeMenu === 'file'}
            aria-haspopup="true"
          >
            文件
          </button>
          <div 
            className={`tb-dropdown${activeMenu === 'file' ? ' show' : ''}`}
            role="menu"
            aria-label="文件菜单"
          >
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              新建对话 <span className="shortcut">{modKey()}+N</span>
            </button>
            <div className="tb-dropdown-sep" role="separator" />
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); api.windowClose(); }} role="menuitem">
              退出 <span className="shortcut">{isDarwin ? '⌘+Q' : 'Alt+F4'}</span>
            </button>
          </div>
        </div>

        {/* Edit menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('edit')}
            style={activeMenu === 'edit' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
            aria-expanded={activeMenu === 'edit'}
            aria-haspopup="true"
          >
            编辑
          </button>
          <div 
            className={`tb-dropdown${activeMenu === 'edit' ? ' show' : ''}`}
            role="menu"
            aria-label="编辑菜单"
          >
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              撤销 <span className="shortcut">{modKey()}+Z</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              重做 <span className="shortcut">{modKey()}+{isDarwin ? 'Shift+Z' : 'Y'}</span>
            </button>
            <div className="tb-dropdown-sep" role="separator" />
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              剪切 <span className="shortcut">{modKey()}+X</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              复制 <span className="shortcut">{modKey()}+C</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              粘贴 <span className="shortcut">{modKey()}+V</span>
            </button>
            <div className="tb-dropdown-sep" role="separator" />
            <button className="tb-dropdown-item" onClick={closeMenus} role="menuitem">
              全选 <span className="shortcut">{modKey()}+A</span>
            </button>
          </div>
        </div>

        {/* View menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('view')}
            style={activeMenu === 'view' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
            aria-expanded={activeMenu === 'view'}
            aria-haspopup="true"
          >
            查看
          </button>
          <div 
            className={`tb-dropdown${activeMenu === 'view' ? ' show' : ''}`}
            role="menu"
            aria-label="查看菜单"
          >
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); toggleSidebar(); }} role="menuitem">
              切换侧边栏
            </button>
            <div className="tb-dropdown-sep" role="separator" />
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); toggleSettings(); }} role="menuitem">
              设置
            </button>
          </div>
        </div>
      </div>

      {/* Center title */}
      <div className="titlebar-title" role="heading" aria-level={1}>
        ✦ CodeCast
      </div>

      <div className="titlebar-right">
        {/* Tool buttons */}
        <div className="tb-tools" role="toolbar" aria-label="工具栏">
          {/* 在编辑器中打开 */}
          <div ref={editorBtnRef} style={{ position: 'relative' }}>
            <button
              className="tb-nav-btn"
              title="在编辑器中打开"
              onClick={() => setEditorDropdownOpen(!editorDropdownOpen)}
              aria-label="在编辑器中打开"
              aria-expanded={editorDropdownOpen}
              aria-haspopup="listbox"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
            {editorDropdownOpen && (
              <div 
                className="tb-dropdown show" 
                style={{ left: 'auto', right: 0 }}
                role="listbox"
                aria-label="选择编辑器"
              >
                {editors.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }} role="status">
                    未检测到编辑器
                  </div>
                )}
                {editors.map((editor) => (
                  <button
                    key={editor.id}
                    className="tb-dropdown-item"
                    onClick={() => handleOpenInEditor(editor.id)}
                    role="option"
                    aria-selected={false}
                  >
                    {editor.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 弹出窗口 */}
          <button 
            className="tb-nav-btn" 
            title="弹出窗口" 
            onClick={handlePopout}
            aria-label="弹出窗口"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>

          {/* 切换预览面板 */}
          <button
            className={`tb-nav-btn${previewPanelVisible ? ' active' : ''}`}
            title="切换预览面板"
            onClick={togglePreviewPanel}
            aria-label={`预览面板 ${previewPanelVisible ? '已开启' : '已关闭'}`}
            aria-pressed={previewPanelVisible}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          {/* 切换文件面板 */}
          <button
            className={`tb-nav-btn${filesPanelVisible ? ' active' : ''}`}
            title="切换文件面板"
            onClick={toggleFilesPanel}
            aria-label={`文件面板 ${filesPanelVisible ? '已开启' : '已关闭'}`}
            aria-pressed={filesPanelVisible}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* 清空对话 */}
          <button 
            className="tb-nav-btn" 
            title="清空对话" 
            onClick={() => window.dispatchEvent(new CustomEvent('clear-session'))}
            aria-label="清空当前对话"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          {/* Theme Switcher */}
          <div className="tb-separator" role="separator" />
          <ThemeSwitcher />

          {/* Command Palette Hint */}
          <button
            className="tb-nav-btn"
            title="命令面板 (Ctrl+K)"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            aria-label="打开命令面板"
          >
            <kbd
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 5px',
                borderRadius: '4px',
                background: 'rgba(124, 124, 255, 0.15)',
                color: 'var(--accent, #7c7cff)',
                border: '1px solid rgba(124, 124, 255, 0.25)'
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Window controls - hidden on macOS (native traffic lights) and on mobile */}
        {!isDarwin && (
          <>
            <div className="tb-separator" role="separator" />

            {/* Minimize */}
            <button 
              className="tb-btn" 
              onClick={() => api.windowMinimise()} 
              title="最小化"
              aria-label="最小化窗口"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Maximize */}
            <button 
              className="tb-btn" 
              onClick={() => api.windowMaximise()} 
              title="最大化"
              aria-label="最大化窗口"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="1" />
              </svg>
            </button>

            {/* Close */}
            <button 
              className="tb-btn-close" 
              onClick={() => api.windowClose()} 
              title="关闭"
              aria-label="关闭应用"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(TitleBar);
