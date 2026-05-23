import React from 'react';
import { useAppStore, TodoItem, ChangedFile, AppState } from '../store';
import { shallow } from 'zustand/shallow';

// ─── Status helpers ─────────────────────────────────────────────

const statusIcon = (status: TodoItem['status']) => {
  switch (status) {
    case 'completed':
      return (
        <svg className="todo-status-icon completed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'in_progress':
      return (
        <svg className="todo-status-icon in-progress" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    default:
      return (
        <svg className="todo-status-icon pending" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

const fileStatusLabel = (status: ChangedFile['status']): string => {
  switch (status) {
    case 'added': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
    default: return '?';
  }
};

const fileStatusClass = (status: ChangedFile['status']): string => {
  switch (status) {
    case 'added': return 'file-status-added';
    case 'modified': return 'file-status-modified';
    case 'deleted': return 'file-status-deleted';
    default: return '';
  }
};

// ─── Component ─────────────────────────────────────────────────

const FilesPanel: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const filesPanelVisible = useAppStore((s: AppState) => s.filesPanelVisible);
  const todoItems = useAppStore((s: AppState) => s.todoItems, shallow);
  const contextCompression = useAppStore((s: AppState) => s.contextCompression);
  const changedFiles = useAppStore((s: AppState) => s.changedFiles, shallow);

  if (!filesPanelVisible) {
    return null;
  }

  // Calculate TODO progress
  const totalTodos = todoItems.length;
  const completedTodos = todoItems.filter((t: TodoItem) => t.status === 'completed').length;
  const progressPercent = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

  return (
    <div className="files-panel" id="filesPanel" style={style}>
      {/* ─── Section 1: TODO Progress ─── */}
      <div className="fp-section fp-section-todo">
        <div className="fp-section-header">
          <span className="fp-section-title">任务进度</span>
          {totalTodos > 0 && (
            <span className="fp-section-badge">{completedTodos}/{totalTodos}</span>
          )}
        </div>
        <div className="fp-section-body">
          {totalTodos === 0 ? (
            <div className="fp-empty">暂无任务</div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="fp-progress-bar">
                <div
                  className="fp-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="fp-progress-label">{progressPercent}% 完成</div>

              {/* Task list */}
              <div className="fp-todo-list">
                {todoItems.map((item: TodoItem) => (
                  <div key={item.id} className={`fp-todo-item ${item.status}`}>
                    {statusIcon(item.status)}
                    <span className="fp-todo-text">{item.content}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Section 2: Context Compression ─── */}
      <div className="fp-section fp-section-context">
        <div className="fp-section-header">
          <span className="fp-section-title">上下文</span>
          <span className="fp-section-badge">{contextCompression}%</span>
        </div>
        <div className="fp-section-body">
          <div className="fp-context-bar">
            <div
              className="fp-context-fill"
              style={{ width: `${contextCompression}%` }}
            />
          </div>
          <div className="fp-context-label">
            {contextCompression === 0
              ? '未压缩'
              : contextCompression < 50
                ? '轻度压缩'
                : contextCompression < 80
                  ? '中度压缩'
                  : '高度压缩'}
          </div>
        </div>
      </div>

      {/* ─── Section 3: Changed Files ─── */}
      <div className="fp-section fp-section-files">
        <div className="fp-section-header">
          <span className="fp-section-title">更改的文件</span>
          {changedFiles.length > 0 && (
            <span className="fp-section-badge">{changedFiles.length}</span>
          )}
        </div>
        <div className="fp-section-body fp-files-list">
          {changedFiles.length === 0 ? (
            <div className="fp-empty">暂无更改</div>
          ) : (
            changedFiles.map((file: ChangedFile, index: number) => (
              <div key={`${file.name}-${index}`} className="fp-file-item" title={file.name}>
                <span className={`fp-file-status ${fileStatusClass(file.status)}`}>
                  {fileStatusLabel(file.status)}
                </span>
                <span className="fp-file-name">{file.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FilesPanel);
