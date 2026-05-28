import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { FileSystemEntry } from '../../utils/cast/cast-fs-api';
import { castFS } from '../../utils/cast/cast-fs-api';
import { useCastFileSystemStore } from '../../store/useCastFileSystemStore';

interface FileExplorerPanelProps {
  initialPath?: string;
  height?: string | number;
  onFileSelect?: (entry: FileSystemEntry) => void;
  onFileDoubleClick?: (entry: FileSystemEntry) => void;
  compact?: boolean;
}

const FileExplorerPanel: React.FC<FileExplorerPanelProps> = React.memo(({
  initialPath = '.',
  height = '100%',
  onFileSelect,
  onFileDoubleClick,
  compact = false
}) => {
  const {
    currentPath, currentEntries, selectedFiles, clipboard,
    bookmarks, recentFiles, isLoading, error,
    navigateTo, goBack, goForward, goToParent,
    selectFile, deselectFile, clearSelection, selectAll,
    copyFiles, cutFiles, paste,
    addBookmark, removeBookmark,
    addRecentFile, setError, loadFromStorage
  } = useCastFileSystemStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileSystemEntry } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFromStorage();
    navigateTo(initialPath);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panelRef.current?.contains(document.activeElement)) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'Delete') {
        handleDelete();
      } else if (e.key === 'Escape') {
        clearSelection();
        setContextMenu(null);
        setRenameTarget(null);
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'x') {
          e.preventDefault();
          handleCut();
        } else if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        } else if (e.key === 'a') {
          e.preventDefault();
          selectAll(currentEntries.map(e => e.path));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentEntries, selectedFiles]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }, []);

  const formatDate = useCallback((ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}-${day}`;
  }, []);

  const getFileIcon = useCallback((entry: FileSystemEntry): string => {
    if (entry.isDirectory) return '\u{1F4C1}';
    const ext = entry.extension?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      md: '\u{1F4D4}', txt: '\u{1F4DD}', pdf: '\u{1F4CE}',
      doc: '\u{1F4C4}', docx: '\u{1F4C4}',
      xls: '\u{1F4CA}', xlsx: '\u{1F4CA}',
      json: '\u{1F516}', js: '\u{1F4BE}', ts: '\u{1F4BE}',
      py: '\u{1F4BE}', go: '\u{1F4BE}', rs: '\u{1F4BE}',
      html: '\u{1F310}', css: '\u{1F3A8}', png: '\u{1F5BC}',
      jpg: '\u{1F5BC}', gif: '\u{1F381}', mp3: '\u{1F3B5}',
      mp4: '\u{1F3AC}', zip: '\u{1F4E6}'
    };
    return iconMap[ext] || '\u{1F4C4}';
  }, []);

  const handleEntryClick = useCallback((entry: FileSystemEntry, e: React.MouseEvent) => {
    if (renameTarget) return;
    const isMulti = e.ctrlKey || e.metaKey;
    selectFile(entry.path, isMulti);
    onFileSelect?.(entry);
  }, [selectFile, onFileSelect, renameTarget]);

  const handleEntryDoubleClick = useCallback(async (entry: FileSystemEntry) => {
    if (entry.isDirectory) {
      await navigateTo(entry.path);
    } else {
      addRecentFile({ path: entry.path, name: entry.name, size: entry.size });
      onFileDoubleClick?.(entry);
    }
  }, [navigateTo, addRecentFile, onFileDoubleClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileSystemEntry) => {
    e.preventDefault();
    e.stopPropagation();
    selectFile(entry.path);
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, [selectFile]);

  const handleCopy = useCallback(() => {
    copyFiles(Array.from(selectedFiles));
  }, [selectedFiles, copyFiles]);

  const handleCut = useCallback(() => {
    cutFiles(Array.from(selectedFiles));
  }, [selectedFiles, cutFiles]);

  const handlePaste = useCallback(async () => {
    await paste(currentPath);
  }, [paste, currentPath]);

  const handleDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    for (const path of selectedFiles) {
      await castFS.deleteFile(path);
    }
    clearSelection();
    await navigateTo(currentPath);
  }, [selectedFiles, clearSelection, navigateTo, currentPath]);

  const handleRename = useCallback((entry: FileSystemEntry) => {
    setRenameTarget(entry.path);
    setRenameValue(entry.name);
    setContextMenu(null);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) {
      setRenameTarget(null);
      return;
    }
    const parts = renameTarget.replace(/\\/g, '/').split('/');
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join('/');
    try {
      await castFS.renameFile(renameTarget, newPath);
      await navigateTo(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
    setRenameTarget(null);
  }, [renameTarget, renameValue, navigateTo, currentPath, setError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      await castFS.writeFile(`${currentPath}/${file.name}`, content);
    }
    await navigateTo(currentPath);
  }, [currentPath, navigateTo]);

  const handlePickDirectory = useCallback(async () => {
    const dir = await castFS.pickDirectory();
    if (dir) {
      await navigateTo(dir);
    }
  }, [navigateTo]);

  const handleShowInFileManager = useCallback(async (path?: string) => {
    const target = path || Array.from(selectedFiles)[0] || currentPath;
    await castFS.showInFileManager(target);
  }, [selectedFiles, currentPath]);

  const totalSelectedSize = useMemo(() => {
    let total = 0;
    selectedFiles.forEach(path => {
      const entry = currentEntries.find(e => e.path === path);
      if (entry) total += entry.size;
    });
    return total;
  }, [selectedFiles, currentEntries]);

  const sortedEntries = useMemo(() => {
    return [...currentEntries].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentEntries]);

  const toolbarStyle: React.CSSProperties = compact
    ? { padding: '4px 8px', gap: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }
    : { padding: '6px 12px', gap: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' };

  const btnStyle: React.CSSProperties = compact
    ? { padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border-color, #333)', background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary, #e0e0e0)', cursor: 'pointer' }
    : { padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color, #333)', background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary, #e0e0e0)', cursor: 'pointer' };

  return (
    <div
      ref={panelRef}
      className="cast-fs-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height,
        fontSize: compact ? 11 : 13,
        fontFamily: 'inherit',
        position: 'relative'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="cast-fs-toolbar" style={toolbarStyle}>
        <button style={{ ...btnStyle, opacity: 0.6 }} onClick={goBack} title="后退">
          {'<'}
        </button>
        <button style={{ ...btnStyle, opacity: 0.6 }} onClick={goForward} title="前进">
          {'>'}
        </button>
        <button style={{ ...btnStyle, opacity: 0.6 }} onClick={goToParent} title="上级目录">
          {'^'}
        </button>
        <input
          className="cast-fs-path-input"
          value={currentPath}
          onChange={(e) => {}}
          onKeyDown={(e) => { if (e.key === 'Enter') navigateTo((e.target as HTMLInputElement).value); }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: compact ? '2px 6px' : '3px 8px',
            fontSize: compact ? 11 : 12,
            borderRadius: 4,
            border: '1px solid var(--border-color, #333)',
            background: 'var(--bg-primary, #0f0f23)',
            color: 'var(--text-primary, #e0e0e0)',
            outline: 'none'
          }}
        />
        <button style={btnStyle} onClick={handlePickDirectory} title="选择目录">
          ...
        </button>
      </div>

      {/* File List */}
      <div
        className="cast-fs-file-list"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative'
        }}
      >
        {isLoading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
            Loading...
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 12px', color: '#ef4444', fontSize: 11 }}>
            Error: {error}
          </div>
        )}

        {!isLoading && sortedEntries.length === 0 && !error && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
            Empty directory
          </div>
        )}

        {dragOver && (
          <div style={{
            position: 'absolute',
            inset: 4,
            border: '2px dashed #8b5cf6',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(139, 92, 252, 0.05)',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            Drop files here
          </div>
        )}

        {sortedEntries.map((entry) => (
          <div
            key={entry.path}
            className={`cast-fs-entry ${selectedFiles.has(entry.path) ? 'cast-fs-selected' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: compact ? '3px 8px' : '4px 12px',
              cursor: 'pointer',
              background: selectedFiles.has(entry.path)
                ? 'rgba(139, 92, 252, 0.15)'
                : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              gap: 8
            }}
            onClick={(e) => handleEntryClick(entry, e)}
            onDoubleClick={() => handleEntryDoubleClick(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            <span style={{ fontSize: compact ? 12 : 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
              {getFileIcon(entry)}
            </span>

            {renameTarget === entry.path ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenameTarget(null); }}
                style={{
                  flex: 1,
                  padding: '1px 4px',
                  fontSize: 12,
                  border: '1px solid #8b5cf6',
                  borderRadius: 2,
                  background: 'var(--bg-primary, #0f0f23)',
                  color: 'var(--text-primary, #e0e0e0)',
                  outline: 'none'
                }}
              />
            ) : (
              <>
                <span
                  className="cast-fs-entry-name"
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: entry.isDirectory ? 600 : 400,
                    color: entry.isDirectory ? '#c084fc' : 'var(--text-primary, #e0e0e0)'
                  }}
                >
                  {entry.name}
                </span>
                {!compact && !entry.isDirectory && (
                  <span className="cast-fs-entry-size" style={{ color: 'var(--text-muted, #888)', fontSize: 10, width: 60, textAlign: 'right', flexShrink: 0 }}>
                    {formatSize(entry.size)}
                  </span>
                )}
                {!compact && (
                  <span className="cast-fs-entry-date" style={{ color: 'var(--text-muted, #888)', fontSize: 10, width: 40, textAlign: 'right', flexShrink: 0 }}>
                    {formatDate(entry.modifiedAt)}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="cast-fs-actions" style={toolbarStyle}>
        <button style={btnStyle} onClick={handleCopy} disabled={selectedFiles.size === 0} title="Copy (Ctrl+C)">
          Copy
        </button>
        <button style={btnStyle} onClick={handleCut} disabled={selectedFiles.size === 0} title="Cut (Ctrl+X)">
          Cut
        </button>
        <button style={btnStyle} onClick={handlePaste} disabled={!clipboard} title="Paste (Ctrl+V)">
          Paste
        </button>
        <button style={{ ...btnStyle, color: '#ef4444' }} onClick={handleDelete} disabled={selectedFiles.size === 0} title="Delete (Del)">
          Del
        </button>
        <span style={{ width: 1, height: 16, background: 'var(--border-color, #333)' }} />
        <button style={btnStyle} onClick={() => fileInputRef.current?.click()} title="Import">
          In
        </button>
        <button style={btnStyle} onClick={() => handleShowInFileManager()} title="Open in Explorer">
          Finder
        </button>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={async (e) => {
          const files = e.target.files;
          if (!files) return;
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            await castFS.writeFile(`${currentPath}/${f.name}`, await f.text());
          }
          await navigateTo(currentPath);
          e.target.value = '';
        }} />
      </div>

      {/* Bookmarks Bar */}
      <div className="cast-fs-bookmarks" style={{
        padding: compact ? '2px 8px' : '3px 12px',
        borderTop: '1px solid var(--border-color, #333)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-muted, #888)', marginRight: 4 }}>{'\u{1F4CC}'}</span>
        {bookmarks.slice(0, 5).map(bm => (
          <button
            key={bm}
            className="cast-fs-bookmark-tag"
            style={{
              padding: '1px 6px',
              fontSize: 10,
              borderRadius: 3,
              border: '1px solid #8b5cf6',
              background: 'transparent',
              color: '#c084fc',
              cursor: 'pointer',
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            onClick={() => navigateTo(bm)}
            onContextMenu={(e) => { e.preventDefault(); removeBookmark(bm); }}
            title={`${bm} (right-click to remove)`}
          >
            {bm.split('/').pop() || bm}
          </button>
        ))}
        <button
          style={{ padding: '1px 6px', fontSize: 10, border: '1px dashed var(--border-color, #444)', background: 'transparent', color: 'var(--text-muted, #888)', cursor: 'pointer', borderRadius: 3 }}
          onClick={() => addBookmark(currentPath)}
          title="Add bookmark"
        >
          +
        </button>
      </div>

      {/* Recent Files */}
      <div className="cast-fs-recent" style={{
        padding: compact ? '2px 8px' : '3px 12px',
        borderTop: '1px solid var(--border-color, #333)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-muted, #888)', marginRight: 4 }}>{'\u{1F552}'}</span>
        {showRecent ? (
          <>
            {recentFiles.slice(0, 6).map(rf => (
              <button
                key={rf.path}
                className="cast-fs-recent-item"
                style={{
                  padding: '1px 6px',
                  fontSize: 10,
                  borderRadius: 3,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-secondary, #aaa)',
                  cursor: 'pointer',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => addRecentFile(rf)}
                title={rf.path}
              >
                {rf.name}
              </button>
            ))}
            <button style={{ padding: '1px 6px', fontSize: 10, border: 'none', background: 'transparent', color: 'var(--text-muted, #888)', cursor: 'pointer' }} onClick={() => setShowRecent(false)}>
              Hide
            </button>
          </>
        ) : recentFiles.length > 0 && (
          <button style={{ padding: '1px 6px', fontSize: 10, border: 'none', background: 'transparent', color: 'var(--text-muted, #888)', cursor: 'pointer' }} onClick={() => setShowRecent(true)}>
            {recentFiles.length} recent
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div className="cast-fs-statusbar" style={{
        padding: '2px 12px',
        borderTop: '1px solid var(--border-color, #333)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'var(--text-muted, #888)',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <span>{selectedFiles.size > 0 ? `${selectedFiles.size} item(s) selected` : `${sortedEntries.length} items`}</span>
        <span>{selectedFiles.size > 1 ? formatSize(totalSelectedSize) : ''}</span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="cast-fs-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: 6,
            padding: 4,
            minWidth: 140,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}
        >
          {[
            { label: 'Copy', action: () => handleCopy(), shortcut: 'Ctrl+C' },
            { label: 'Cut', action: () => handleCut(), shortcut: 'Ctrl+X' },
            { divider: true },
            { label: 'Rename', action: () => handleRename(contextMenu.entry), shortcut: 'F2' },
            { label: 'Delete', action: () => handleDelete(), shortcut: 'Del' },
            { divider: true },
            { label: 'Open in Explorer', action: () => handleShowInFileManager(contextMenu.entry.path) },
            { label: 'Add Bookmark', action: () => addBookmark(contextMenu.entry.path) },
          ].map((item, idx) =>
            'divider' in item ? (
              <div key={`d-${idx}`} style={{ height: 1, background: 'var(--border-color, #333)', margin: '2px 4px' }} />
            ) : (
              <button
                key={idx}
                className="cast-fs-context-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '5px 10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary, #e0e0e0)',
                  cursor: 'pointer',
                  borderRadius: 3,
                  fontSize: 11,
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,252,0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { item.action(); setContextMenu(null); }}
              >
                <span>{item.label}</span>
                <span style={{ color: 'var(--text-muted, #666)', fontSize: 9 }}>{item.shortcut}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
});

FileExplorerPanel.displayName = 'FileExplorerPanel';
export default FileExplorerPanel;
