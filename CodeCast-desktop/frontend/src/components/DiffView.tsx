import React, { useState, useMemo, useCallback } from 'react';

interface DiffLine {
  id: string;
  type: 'added' | 'removed' | 'unchanged' | 'context';
  content: string;
  lineNumber?: { old?: number; new?: number };
}

interface DiffViewProps {
  originalContent: string;
  modifiedContent: string;
  fileName?: string;
  language?: string;
  onAccept?: (content: string) => void;
  onReject?: () => void;
  onEdit?: (lineIndex: number, newContent: string) => void;
  showLineNumbers?: boolean;
  readOnly?: boolean;
}

const DiffView: React.FC<DiffViewProps> = ({
  originalContent,
  modifiedContent,
  fileName = '未命名文件',
  language = 'plaintext',
  onAccept,
  onReject,
  onEdit,
  showLineNumbers = true,
  readOnly = false
}) => {
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const diffLines = useMemo(() => {
    return generateDiff(originalContent.split('\n'), modifiedContent.split('\n'));
  }, [originalContent, modifiedContent]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    const unchanged = diffLines.filter(l => l.type === 'unchanged').length;
    return { added, removed, unchanged, total: diffLines.length };
  }, [diffLines]);

  const handleLineClick = useCallback((lineId: string, event: React.MouseEvent | React.KeyboardEvent) => {
    if (readOnly) return;

    if (event.ctrlKey || event.metaKey) {
      setSelectedLines(prev => {
        const next = new Set(prev);
        if (next.has(lineId)) {
          next.delete(lineId);
        } else {
          next.add(lineId);
        }
        return next;
      });
    } else {
      setSelectedLines(new Set([lineId]));
    }
  }, [readOnly]);

  const handleLineKeyDown = useCallback((lineId: string, event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleLineClick(lineId, event);
    }
  }, [handleLineClick]);

  const handleAcceptSelected = useCallback(() => {
    if (!onAccept || selectedLines.size === 0) return;

    const acceptedContent = diffLines
      .filter(line => line.type !== 'removed' || selectedLines.has(line.id))
      .map(line => line.content)
      .join('\n');

    onAccept(acceptedContent);
    setSelectedLines(new Set());
  }, [onAccept, selectedLines, diffLines]);

  const handleAcceptAll = useCallback(() => {
    onAccept?.(modifiedContent);
    setSelectedLines(new Set());
  }, [onAccept, modifiedContent]);

  const getLineClass = useCallback((line: DiffLine) => {
    const baseClass = `diff-line diff-${line.type}`;
    
    if (selectedLines.has(line.id)) {
      return `${baseClass} selected`;
    }

    if (hoveredLine === line.id && !readOnly) {
      return `${baseClass} hovered`;
    }

    return baseClass;
  }, [selectedLines, hoveredLine, readOnly]);

  return (
    <div className="diff-view">
      <div className="diff-header">
        <div className="diff-file-info">
          <span className="file-icon">📄</span>
          <span className="file-name">{fileName}</span>
          <span className="file-language">{language}</span>
        </div>

        <div className="diff-stats-toggle" onClick={() => setShowStats(!showStats)}>
          📊 统计
        </div>

        {!readOnly && (
          <div className="diff-actions">
            <button
              className="diff-btn accept-selected"
              disabled={selectedLines.size === 0}
              onClick={handleAcceptSelected}
              title={`接受选中行 (${selectedLines.size})`}
            >
              ✓ 接受选中 ({selectedLines.size})
            </button>
            <button
              className="diff-btn accept-all"
              onClick={handleAcceptAll}
              title="接受所有更改"
            >
              ✓ 全部接受
            </button>
            <button
              className="diff-btn reject"
              onClick={() => {
                onReject?.();
                setSelectedLines(new Set());
              }}
              title="拒绝所有更改"
            >
              ✗ 拒绝
            </button>
          </div>
        )}
      </div>

      {showStats && (
        <div className="diff-stats-bar">
          <div className="stat-item stat-added">
            <span className="stat-label">+ 添加</span>
            <span className="stat-value">{stats.added}</span>
          </div>
          <div className="stat-item stat-removed">
            <span className="stat-label">- 删除</span>
            <span className="stat-value">{stats.removed}</span>
          </div>
          <div className="stat-item stat-unchanged">
            <span className="stat-label">= 未变</span>
            <span className="stat-value">{stats.unchanged}</span>
          </div>
          <div className="stat-item stat-total">
            <span className="stat-label">总计</span>
            <span className="stat-value">{stats.total} 行</span>
          </div>

          <div className="diff-summary">
            {stats.added === 0 && stats.removed === 0 ? (
              <span className="summary-no-changes">✓ 文件无变化</span>
            ) : (
              <span className="summary-has-changes">
                共修改 {stats.added + stats.removed} 行
                {stats.added > 0 && ` (+${stats.added})`}
                {stats.removed > 0 && ` (-${stats.removed})`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="diff-content">
        <div className="diff-gutter-left">
          {showLineNumbers && diffLines.map((line, idx) => (
            <div
              key={line.id}
              className={`gutter-line ${line.type}`}
              onClick={(e) => handleLineClick(line.id, e)}
              onMouseEnter={() => setHoveredLine(line.id)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              {line.lineNumber?.old ?? ''}
            </div>
          ))}
        </div>

        <div className="diff-gutter-right">
          {showLineNumbers && diffLines.map((line) => (
            <div key={`${line.id}-right`} className={`gutter-line ${line.type}`}>
              {line.lineNumber?.new ?? ''}
            </div>
          ))}
        </div>

        <div className="diff-lines">
          {diffLines.map((line) => (
            <div
              key={line.id}
              className={getLineClass(line)}
              onClick={(e) => handleLineClick(line.id, e)}
              onMouseEnter={() => setHoveredLine(line.id)}
              onMouseLeave={() => setHoveredLine(null)}
              role="option"
              aria-selected={selectedLines.has(line.id)}
              aria-label={`Line ${line.lineNumber?.new ?? line.lineNumber?.old ?? ''}: ${line.type} ${line.content.slice(0, 50)}`}
              tabIndex={readOnly ? undefined : 0}
              onKeyDown={(e) => handleLineKeyDown(line.id, e)}
            >
              <span className="line-prefix">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <code className="line-content">
                {line.content || '\u00A0'}
              </code>
              {!readOnly && (
                <div className="line-actions">
                  {(line.type === 'added' || line.type === 'removed') && (
                    <>
                      <button
                        className="line-action-btn accept"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (line.type === 'added') {
                            onAccept?.(modifiedContent);
                          }
                        }}
                        title="接受此行"
                      >
                        ✓
                      </button>
                      <button
                        className="line-action-btn reject"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject?.();
                        }}
                        title="拒绝此行"
                      >
                        ✗
                      </button>
                    </>
                  )}
                  {onEdit && (
                    <button
                      className="line-action-btn edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLineIndex(diffLines.indexOf(line));
                        setEditValue(line.content);
                      }}
                      title="编辑此行"
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && selectedLines.size > 0 && (
        <div className="diff-selection-bar">
          <span>已选择 {selectedLines.size} 行</span>
          <button onClick={() => setSelectedLines(new Set())}>清除选择</button>
        </div>
      )}

      {editingLineIndex !== null && (
        <div className="diff-edit-bar" style={{
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          borderTop: '1px solid var(--border-color, #e5e5e5)',
          backgroundColor: 'var(--bg-secondary, #f8f9fa)'
        }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid var(--border-color, #e5e5e5)',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'var(--font-mono, monospace)'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onEdit) {
                onEdit(editingLineIndex, editValue);
                setEditingLineIndex(null);
              } else if (e.key === 'Escape') {
                setEditingLineIndex(null);
              }
            }}
          />
          <button
            onClick={() => {
              if (onEdit) {
                onEdit(editingLineIndex, editValue);
              }
              setEditingLineIndex(null);
            }}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            确定
          </button>
          <button
            onClick={() => setEditingLineIndex(null)}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
};

// TODO: This naive line-by-line diff does not detect moves or block-level changes.
// Consider replacing with a proper diff algorithm (e.g., Myers diff via `diff` npm package)
// for accurate moved-block detection and better performance on large files.
function generateDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      lines.push({
        id: `add-${newIdx}`,
        type: 'added',
        content: newLines[newIdx],
        lineNumber: { new: newIdx + 1 }
      });
      newIdx++;
      continue;
    }

    if (newIdx >= newLines.length) {
      lines.push({
        id: `remove-${oldIdx}`,
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumber: { old: oldIdx + 1 }
      });
      oldIdx++;
      continue;
    }

    if (oldLines[oldIdx] === newLines[newIdx]) {
      lines.push({
        id: `unchanged-${oldIdx}-${newIdx}`,
        type: 'unchanged',
        content: oldLines[oldIdx],
        lineNumber: { old: oldIdx + 1, new: newIdx + 1 }
      });
      oldIdx++;
      newIdx++;
    } else {
      lines.push({
        id: `remove-${oldIdx}`,
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumber: { old: oldIdx + 1 }
      });
      oldIdx++;

      if (newIdx < newLines.length) {
        lines.push({
          id: `add-${newIdx}`,
          type: 'added',
          content: newLines[newIdx],
          lineNumber: { new: newIdx + 1 }
        });
        newIdx++;
      }
    }
  }

  return lines;
}

export default DiffView;
