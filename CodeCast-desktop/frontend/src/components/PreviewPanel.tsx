import React, { useState, useRef, useCallback } from 'react';
import { useAppStore, PreviewTab, AppState } from '../store';
import * as api from '../api';

const PreviewPanel: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const previewPanelVisible = useAppStore((s: AppState) => s.previewPanelVisible);
  const togglePreviewPanel = useAppStore((s: AppState) => s.togglePreviewPanel);
  const previewTab = useAppStore((s: AppState) => s.previewTab);
  const setPreviewTab = useAppStore((s: AppState) => s.setPreviewTab);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const historyStack = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Editor state
  const [editorFilePath, setEditorFilePath] = useState('');
  const [editorContent, setEditorContent] = useState('选择文件以预览内容');
  const [editorLoading, setEditorLoading] = useState(false);

  // ─── Browser navigation ────────────────────────────────────────

  const navigateTo = useCallback((url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl) return;

    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    // Update history - separate ref mutation from state setter
    if (historyIndex < historyStack.current.length - 1) {
      historyStack.current = historyStack.current.slice(0, historyIndex + 1);
    }
    historyStack.current.push(finalUrl);
    setHistoryIndex(historyStack.current.length - 1);

    setCurrentUrl(finalUrl);
    setBrowserUrl(finalUrl);
  }, []);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        navigateTo(browserUrl);
      }
    },
    [browserUrl, navigateTo]
  );

  const handleBack = useCallback(() => {
    setHistoryIndex((prevIdx) => {
      if (prevIdx > 0) {
        const newIdx = prevIdx - 1;
        const url = historyStack.current[newIdx];
        setCurrentUrl(url);
        setBrowserUrl(url);
        return newIdx;
      }
      return prevIdx;
    });
  }, []);

  const handleForward = useCallback(() => {
    setHistoryIndex((prevIdx) => {
      if (prevIdx < historyStack.current.length - 1) {
        const newIdx = prevIdx + 1;
        const url = historyStack.current[newIdx];
        setCurrentUrl(url);
        setBrowserUrl(url);
        return newIdx;
      }
      return prevIdx;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && currentUrl) {
      // Reload iframe by reassigning src
      iframeRef.current.src = currentUrl;
    }
  }, [currentUrl]);

  // ─── Editor file loading ───────────────────────────────────────

  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await api.selectFile();
      if (!selected) return;

      const filePath = String(selected);
      setEditorFilePath(filePath);
      setEditorLoading(true);

      const content = await api.readFileContent(filePath);
      setEditorContent(content ?? '');
    } catch {
      setEditorContent('无法读取文件内容');
    } finally {
      setEditorLoading(false);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────

  if (!previewPanelVisible) return null;

  return (
    <div className="preview-panel" id="previewPanel" style={style}>
      {/* Header */}
      <div className="preview-panel-header">
        <div className="preview-tabs" id="previewTabs">
          <button
            className={`preview-tab${previewTab === 'browser' ? ' active' : ''}`}
            data-tab="browser"
            onClick={() => setPreviewTab('browser')}
          >
            浏览器
          </button>
          <button
            className={`preview-tab${previewTab === 'editor' ? ' active' : ''}`}
            data-tab="editor"
            onClick={() => setPreviewTab('editor')}
          >
            编辑器
          </button>
        </div>
        <div className="preview-actions">
          <button className="icon-btn icon-btn-sm" title="关闭" onClick={togglePreviewPanel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Browser tab */}
      {previewTab === 'browser' && (
        <div className="preview-content" id="previewBrowser">
          <div className="browser-toolbar">
            <button title="后退" onClick={handleBack} disabled={historyIndex <= 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button title="前进" onClick={handleForward} disabled={historyIndex >= historyStack.current.length - 1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button title="刷新" onClick={handleRefresh} disabled={!currentUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <input
              className="browser-url-input"
              placeholder="输入 URL..."
              value={browserUrl}
              onChange={(e) => setBrowserUrl(e.target.value)}
              onKeyDown={handleUrlKeyDown}
            />
          </div>
          <div className="browser-viewport" id="browserViewport">
            {currentUrl ? (
              <iframe
                ref={iframeRef}
                src={currentUrl}
                title="浏览器预览"
                sandbox="allow-scripts allow-forms allow-popups"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div className="browser-placeholder">在此处预览网页内容</div>
            )}
          </div>
        </div>
      )}

      {/* Editor tab */}
      {previewTab === 'editor' && (
        <div className="preview-content" id="previewEditor">
          <div className="editor-file-header">
            <span className="editor-filename">
              {editorFilePath
                ? editorFilePath.split(/[\\/]/).pop()
                : '未打开文件'}
            </span>
            <button
              className="icon-btn icon-btn-sm"
              title="打开文件"
              onClick={handleOpenFile}
              style={{ marginLeft: 'auto' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </button>
          </div>
          <pre className="editor-code-area">
            <code>{editorLoading ? '加载中...' : editorContent}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default React.memo(PreviewPanel);
