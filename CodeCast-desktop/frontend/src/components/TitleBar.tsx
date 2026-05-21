import React, { useEffect, useRef, useState } from 'react';
import { useAppStore, ActiveMenu } from '../store';
import * as api from '../api';

interface EditorInfo {
  id: string;
  name: string;
  path?: string;
}

const TitleBar: React.FC = () => {
  const activeMenu = useAppStore((s) => s.activeMenu);
  const setActiveMenu = useAppStore((s) => s.setActiveMenu);
  const closeMenus = useAppStore((s) => s.closeMenus);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleSettings = useAppStore((s) => s.toggleSettings);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const popoutMode = useAppStore((s) => s.popoutMode);
  const togglePopout = useAppStore((s) => s.togglePopout);
  const previewPanelVisible = useAppStore((s) => s.previewPanelVisible);
  const togglePreviewPanel = useAppStore((s) => s.togglePreviewPanel);
  const filesPanelVisible = useAppStore((s) => s.filesPanelVisible);
  const toggleFilesPanel = useAppStore((s) => s.toggleFilesPanel);
  const currentProject = useAppStore((s) => s.currentProject);
  const projects = useAppStore((s) => s.projects);

  const titlebarRef = useRef<HTMLDivElement>(null);
  const editorBtnRef = useRef<HTMLDivElement>(null);
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [editors, setEditors] = useState<EditorInfo[]>([]);

  const projectPath = projects.find((p) => p.id === currentProject)?.path ?? currentProject ?? '';

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
    <div className="titlebar" ref={titlebarRef}>
      <div className="titlebar-left">
        {/* Sidebar toggle */}
        <button className="tb-nav-btn" onClick={toggleSidebar} title="切换侧边栏">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        <div className="tb-separator" />

        {/* File menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('file')}
            style={activeMenu === 'file' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
          >
            文件
          </button>
          <div className={`tb-dropdown${activeMenu === 'file' ? ' show' : ''}`}>
            <button className="tb-dropdown-item" onClick={closeMenus}>
              新建对话 <span className="shortcut">Ctrl+N</span>
            </button>
            <div className="tb-dropdown-sep" />
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); api.windowClose(); }}>
              退出 <span className="shortcut">Alt+F4</span>
            </button>
          </div>
        </div>

        {/* Edit menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('edit')}
            style={activeMenu === 'edit' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
          >
            编辑
          </button>
          <div className={`tb-dropdown${activeMenu === 'edit' ? ' show' : ''}`}>
            <button className="tb-dropdown-item" onClick={closeMenus}>
              撤销 <span className="shortcut">Ctrl+Z</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus}>
              重做 <span className="shortcut">Ctrl+Y</span>
            </button>
            <div className="tb-dropdown-sep" />
            <button className="tb-dropdown-item" onClick={closeMenus}>
              剪切 <span className="shortcut">Ctrl+X</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus}>
              复制 <span className="shortcut">Ctrl+C</span>
            </button>
            <button className="tb-dropdown-item" onClick={closeMenus}>
              粘贴 <span className="shortcut">Ctrl+V</span>
            </button>
            <div className="tb-dropdown-sep" />
            <button className="tb-dropdown-item" onClick={closeMenus}>
              全选 <span className="shortcut">Ctrl+A</span>
            </button>
          </div>
        </div>

        {/* View menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="tb-menu-btn"
            onClick={() => toggleMenu('view')}
            style={activeMenu === 'view' ? { background: 'var(--sidebar-hover)', color: 'var(--text)' } : undefined}
          >
            查看
          </button>
          <div className={`tb-dropdown${activeMenu === 'view' ? ' show' : ''}`}>
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); toggleSidebar(); }}>
              切换侧边栏
            </button>
            <div className="tb-dropdown-sep" />
            <button className="tb-dropdown-item" onClick={() => { closeMenus(); toggleSettings(); }}>
              设置
            </button>
          </div>
        </div>
      </div>

      {/* Center title */}
      <div className="titlebar-title">CodeCast</div>

      <div className="titlebar-right">
        {/* Tool buttons */}
        <div className="tb-tools">
          {/* 在编辑器中打开 */}
          <div ref={editorBtnRef} style={{ position: 'relative' }}>
            <button
              className="tb-nav-btn"
              title="在编辑器中打开"
              onClick={() => setEditorDropdownOpen(!editorDropdownOpen)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
            {editorDropdownOpen && (
              <div className="tb-dropdown show" style={{ left: 'auto', right: 0 }}>
                {editors.length === 0 && (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    未检测到编辑器
                  </div>
                )}
                {editors.map((editor) => (
                  <button
                    key={editor.id}
                    className="tb-dropdown-item"
                    onClick={() => handleOpenInEditor(editor.id)}
                  >
                    {editor.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 弹出窗口 */}
          <button className="tb-nav-btn" title="弹出窗口" onClick={handlePopout}>
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
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* 清空对话 */}
          <button className="tb-nav-btn" title="清空对话" onClick={() => window.dispatchEvent(new CustomEvent('clear-session'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>

        <div className="tb-separator" />

        {/* Minimize */}
        <button className="tb-btn" onClick={() => api.windowMinimise()} title="最小化">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Maximize */}
        <button className="tb-btn" onClick={() => api.windowMaximise()} title="最大化">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="1" />
          </svg>
        </button>

        {/* Close */}
        <button className="tb-btn-close" onClick={() => api.windowClose()} title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
