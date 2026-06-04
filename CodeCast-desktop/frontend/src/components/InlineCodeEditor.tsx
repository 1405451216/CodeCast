import React, { useState, useRef, useCallback, useEffect } from 'react';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

export interface InlineCodeEditorProps {
  code: string;
  language: string;
  fileName?: string;
  filePath?: string;
  originalCode?: string;
  readOnly?: boolean;
  onAccept?: (code: string) => void;
  onReject?: () => void;
  onChange?: (code: string) => void;
  onApplyToFile?: (filePath: string, content: string) => Promise<void>;
  showDiff?: boolean;
}

const InlineCodeEditor: React.FC<InlineCodeEditorProps> = ({
  code,
  language = 'plaintext',
  fileName,
  filePath,
  originalCode,
  readOnly = false,
  onAccept,
  onReject,
  onChange,
  onApplyToFile,
  showDiff = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [isApplying, setIsApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showDiffView, setShowDiffView] = useState(showDiff);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setEditedCode(code);
  }, [code]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editedCode).then(() => {
      const btn = copyBtnRef.current;
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '✓ 已复制';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
      }
    });
  }, [editedCode]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    if (onChange) {
      onChange(editedCode);
    }
  }, [editedCode, onChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedCode(code);
  }, [code]);

  const handleAccept = useCallback(async () => {
    if (onAccept) {
      onAccept(editedCode);
    }
    
    if (onApplyToFile && filePath) {
      setIsApplying(true);
      try {
        await onApplyToFile(filePath, editedCode);
        setApplyStatus('success');
        setTimeout(() => setApplyStatus('idle'), 3000);
      } catch (error) {
        setApplyStatus('error');
        setTimeout(() => setApplyStatus('idle'), 3000);
      } finally {
        setIsApplying(false);
      }
    }
  }, [editedCode, onAccept, onApplyToFile, filePath]);

  const handleReject = useCallback(() => {
    if (onReject) {
      onReject();
    }
  }, [onReject]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setEditedCode(newValue);

    if (preRef.current) {
      preRef.current.textContent = newValue;
    }

    if (onChange && isEditing) {
      onChange(newValue);
    }
  }, [onChange, isEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = editedCode.substring(0, start) + '  ' + editedCode.substring(end);
      setEditedCode(newCode);
      if (preRef.current) {
        preRef.current.textContent = newCode;
      }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  }, [handleCancel, handleSave, editedCode]);

  const getHighlightedCode = useCallback((text: string): string => {
    const lang = language && hljs.getLanguage(language) ? language : 'plaintext';
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;

      return DOMPurify.sanitize(highlighted, {
        ALLOWED_TAGS: ['span', 'code'], // 只允许代码高亮标签
        ALLOWED_ATTR: ['class'], // 只允许 class 属性（用于语法高亮）
        ALLOW_DATA_ATTR: false, // 禁止 data-* 属性
      });
    } catch {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      return DOMPurify.sanitize(escaped, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    }
  }, [language]);

  const renderDiffLines = useCallback(() => {
    if (!originalCode) return null;

    const originalLines = originalCode.split('\n');
    const editedLines = editedCode.split('\n');
    const maxLines = Math.max(originalLines.length, editedLines.length);
    const diffLines: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const editLine = editedLines[i];

      if (origLine !== editLine) {
        if (origLine !== undefined) {
          diffLines.push({ type: 'removed', content: origLine });
        }
        if (editLine !== undefined) {
          diffLines.push({ type: 'added', content: editLine });
        }
      } else if (editLine !== undefined) {
        diffLines.push({ type: 'unchanged', content: editLine });
      }
    }

    return diffLines;
  }, [originalCode, editedCode]);

  return (
    <div className={`inline-code-editor ${isEditing ? 'editing' : ''} ${readOnly ? 'readonly' : ''}`}>
      <div className="ice-header">
        <div className="ice-info">
          {fileName && (
            <span className="ice-filename" title={filePath}>
              📄 {fileName}
            </span>
          )}
          <span className="ice-language">{language}</span>
        </div>

        {!readOnly && (
          <div className="ice-actions">
            {showDiffView && originalCode && (
              <button
                className="ice-btn ice-toggle-diff"
                onClick={() => setShowDiffView(!showDiffView)}
                title="切换 Diff 视图"
              >
                {showDiffView ? '📝 代码' : '📊 Diff'}
              </button>
            )}
            
            {isEditing ? (
              <>
                <button className="ice-btn ice-save" onClick={handleSave} title="保存 (Ctrl+Enter)">
                  ✓ 保存
                </button>
                <button className="ice-btn ice-cancel" onClick={handleCancel} title="取消 (Esc)">
                  ✕ 取消
                </button>
              </>
            ) : (
              <>
                <button 
                  className="ice-btn ice-edit" 
                  onClick={handleEdit}
                  title="编辑代码"
                >
                  ✏️ 编辑
                </button>
                <button
                  className="ice-btn ice-copy"
                  ref={copyBtnRef}
                  data-inline-copy={filePath || 'default'}
                  onClick={handleCopy}
                  title="复制代码"
                >
                  📋 复制
                </button>
              </>
            )}

            {(onAccept || onApplyToFile) && !isEditing && (
              <>
                <button
                  className={`ice-btn ice-accept ${applyStatus === 'success' ? 'success' : ''}`}
                  onClick={handleAccept}
                  disabled={isApplying}
                  title="接受更改并应用到文件"
                >
                  {isApplying ? '⏳ 应用中...' : applyStatus === 'success' ? '✓ 已应用' : '✅ 接受'}
                </button>
                {onReject && (
                  <button
                    className="ice-btn ice-reject"
                    onClick={handleReject}
                    title="拒绝更改"
                  >
                    ❌ 拒绝
                  </button>
                )}
              </>
            )}
          </div>
        )}
        
        {readOnly && (
          <div className="ice-actions">
            <button
              className="ice-btn ice-copy"
              ref={copyBtnRef}
              data-inline-copy={filePath || 'default'}
              onClick={handleCopy}
              title="复制代码"
            >
              📋 复制
            </button>
          </div>
        )}
      </div>

      <div className="ice-content">
        {showDiffView && originalCode && !isEditing ? (
          <div className="ice-diff-view">
            {renderDiffLines()?.map((line, idx) => (
              <div key={idx} className={`diff-line diff-${line.type}`}>
                <span className="line-number">{idx + 1}</span>
                <span className="line-content" dangerouslySetInnerHTML={{ __html: getHighlightedCode(line.content) }} />
              </div>
            ))}
          </div>
        ) : isEditing ? (
          <div className="ice-editor-wrapper">
            <textarea
              ref={textareaRef}
              className="ice-textarea"
              value={editedCode}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <pre ref={preRef} className="ice-highlight">
              <code dangerouslySetInnerHTML={{ __html: getHighlightedCode(editedCode) }} />
            </pre>
          </div>
        ) : (
          <pre className="ice-display">
            <code dangerouslySetInnerHTML={{ __html: getHighlightedCode(editedCode) }} />
          </pre>
        )}
      </div>

      {isEditing && (
        <div className="ice-footer">
          <span className="ice-hint">
            <kbd>Ctrl+Enter</kbd> 保存 · <kbd>Esc</kbd> 取消 · <kbd>Tab</kbd> 缩进
          </span>
          <span className="ice-stats">
            {editedCode.split('\n').length} 行 · {editedCode.length} 字符
          </span>
        </div>
      )}

      {applyStatus === 'error' && (
        <div className="ice-error">
          ⚠️ 应用到文件失败，请检查文件路径或权限
        </div>
      )}
    </div>
  );
};

export default InlineCodeEditor;
