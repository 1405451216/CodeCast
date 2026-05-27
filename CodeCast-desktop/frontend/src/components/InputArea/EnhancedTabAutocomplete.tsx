import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CompletionOrchestrator,
  OrchestratorResult,
  CacheLevel
} from '../../utils/autocomplete/CompletionOrchestrator';
import { CompletionItem, CompletionContext, CompletionType } from '../../utils/autocomplete/SmartCompletionEngine';
import { logger } from '../../utils/logger';

const orchestratorInstance = new CompletionOrchestrator({
  debounceMs: 200,
  enableL1: true,
  enableL2: true,
  enableL3: true,
  l2MinPrefixLength: 2,
  maxResults: 20
});

export { orchestratorInstance };

function getTypeIcon(type: CompletionType): string {
  const iconMap: Record<CompletionType, string> = {
    'snippet': '📋',
    'symbol': '🔣',
    'keyword': '🔑',
    'import': '📥',
    'ai-suggestion': '🤖',
    'variable': '📦',
    'function': '⚡',
    'class': '🏛️',
    'method': '⚙️',
    'comment': '💬'
  };
  return iconMap[type] || '📄';
}

function getLevelBadge(level: CacheLevel): { text: string; color: string; bg: string } {
  const badges: Record<CacheLevel, { text: string; color: string; bg: string }> = {
    'L1': { text: '本地', color: '#10b981', bg: '#d1fae5' },
    'L2': { text: 'AI', color: '#9333ea', bg: '#ede9fe' },
    'L3': { text: '项目', color: '#0284c7', bg: '#e0f2fe' },
    'merged': { text: '混合', color: '#f59e0b', bg: '#fef3c7' }
  };
  return badges[level];
}

function getQualityDots(confidence: number): { dots: string; color: string } {
  if (confidence >= 0.9) return { dots: '●●●', color: '#10b981' };
  if (confidence >= 0.7) return { dots: '●●○', color: '#f59e0b' };
  if (confidence >= 0.5) return { dots: '●○○', color: '#6b7280' };
  return { dots: '○○○', color: '#d1d5db' };
}

interface FIMContext {
  prefix: string;
  suffix: string;
  lineContent: string;
  cursorColumn: number;
  isMiddleMode: boolean;
}

interface EnhancedTabAutocompleteProps {
  visible: boolean;
  position: { top: number; left: number };
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  filePath?: string;
  language?: string;
  onSelect: (item: CompletionItem) => void;
  onClose: () => void;
  onInlineComplete?: (text: string) => void;
  forceTrigger?: boolean;
}

const EnhancedTabAutocomplete: React.FC<EnhancedTabAutocompleteProps> = ({
  visible,
  position,
  textareaRef,
  filePath = '',
  language = 'typescript',
  onSelect,
  onClose,
  onInlineComplete,
  forceTrigger = false
}) => {
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<CacheLevel>('merged');
  const [latencyMs, setLatencyMs] = useState(0);
  const [fimContext, setFimContext] = useState<FIMContext | null>(null);
  const [inlinePreview, setInlinePreview] = useState('');

  const debounceCleanupRef = useRef<(() => void) | null>(null);
  const lastContextRef = useRef<string>('');
  const isForceTriggeredRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setCompletions([]);
      setSelectedIndex(0);
      setQuery('');
      setShowDetail(false);
      setCurrentLevel('merged');
      setLatencyMs(0);
      setFimContext(null);
      setInlinePreview('');
      if (debounceCleanupRef.current) {
        debounceCleanupRef.current();
        debounceCleanupRef.current = null;
      }
      return;
    }

    const updateCompletions = async () => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const lines = text.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1] || '';
      const lineNum = lines.length;
      const col = currentLine.length + 1;

      const prefixMatch = currentLine.match(/[\w.-]*$/);
      const prefix = prefixMatch ? prefixMatch[0] : '';

      let fim: FIMContext | null = null;
      if (start !== end || col < currentLine.trimEnd().length + 1) {
        const afterCursor = currentLine.slice(col - 1);
        if (afterCursor.trim().length > 0) {
          fim = {
            prefix,
            suffix: afterCursor,
            lineContent: currentLine,
            cursorColumn: col - 1,
            isMiddleMode: true
          };
          setFimContext(fim);
        }
      } else {
        setFimContext(null);
        setInlinePreview('');
      }

      const contextKey = `${prefix}:${lineNum}:${col}`;
      if (!forceTrigger && !isForceTriggeredRef.current && contextKey === lastContextRef.current && completions.length > 0) {
        return;
      }

      lastContextRef.current = contextKey;
      setQuery(prefix);
      setIsLoading(true);

      try {
        const completionContext: CompletionContext = {
          filePath,
          language,
          line: lineNum,
          column: col,
          lineContent: currentLine,
          prefix,
          fullText: text
        };

        logger.debug('TabAutocomplete', '🔍 请求补全 (三级缓存)', {
          prefix,
          line: lineNum,
          col,
          fimEnabled: !!fim,
          level: currentLevel
        });

        if (debounceCleanupRef.current) {
          debounceCleanupRef.current();
        }

        const cleanup = orchestratorInstance.getDebouncedCompletions(
          completionContext,
          (result: OrchestratorResult) => {
            setIsLoading(false);
            setCompletions(result.items);
            setSelectedIndex(0);
            setCurrentLevel(result.level);
            setLatencyMs(Math.round(result.latencyMs));

            if (result.items.length > 0 && onInlineComplete && !fim?.isMiddleMode) {
              const topResult = result.items[0];
              if (topResult.source === 'ai' && topResult.confidence > 0.75) {
                onInlineComplete(topResult.insertText.split('\n')[0]);
              }
            }

            if (fim?.isMiddleMode && result.items.length > 0) {
              const topFIM = result.items[0];
              if (topFIM.insertText.includes('\n')) {
                setInlinePreview(topFIM.insertText);
              }
            }

            logger.info('TabAutocomplete', `✅ 收到 ${result.items.length} 条结果 [${result.level}] (${result.latencyMs.toFixed(0)}ms)`, {
              l1: result.l1Hit,
              l2: result.l2Hit,
              l3: result.l3Hit,
              top3: result.items.slice(0, 3).map(r => ({ label: r.label, src: r.source, conf: r.confidence.toFixed(2) }))
            });
          },
          { debounceMs: forceTrigger || isForceTriggeredRef.current ? 0 : undefined }
        );

        debounceCleanupRef.current = cleanup;

      } catch (error) {
        logger.error('TabAutocomplete', '❌ 补全请求异常', error);
        setCompletions([]);
        setIsLoading(false);
      }
    };

    updateCompletions();

    return () => {
      if (debounceCleanupRef.current) {
        debounceCleanupRef.current();
        debounceCleanupRef.current = null;
      }
    };
  }, [visible, filePath, language, forceTrigger]);

  const handleSelect = useCallback((item: CompletionItem) => {
    logger.info('TabAutocomplete', '✅ 选择补全项', {
      label: item.label,
      type: item.type,
      source: item.source,
      confidence: item.confidence
    });

    orchestratorInstance.recordUsage(item);

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const text = textarea.value;

      let insertPos = start;
      if (query && !fimContext?.isMiddleMode) {
        const beforeCursor = text.substring(0, start);
        const prefixMatch = beforeCursor.match(/[\w.-]*$/);
        if (prefixMatch) {
          insertPos = start - prefixMatch[0].length;
        }
      }

      let finalInsertText = item.insertText;
      if (fimContext?.isMiddleMode && fimContext.suffix) {
        const suffixTrimmed = fimContext.suffix.trimStart();
        const insertLines = finalInsertText.split('\n');
        if (insertLines.length > 1) {
          const lastLine = insertLines[insertLines.length - 1];
          if (suffixTrimmed.startsWith(lastLine.trim())) {
            finalInsertText = insertLines.slice(0, -1).join('\n');
          }
        }
      }

      const newText = text.substring(0, insertPos) + finalInsertText + text.substring(start);

      textarea.value = newText;
      textarea.focus();

      const cursorPos = insertPos + finalInsertText.indexOf('$0');
      const finalPos = cursorPos >= 0 ? cursorPos : insertPos + finalInsertText.length;

      textarea.setSelectionRange(finalPos, finalPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onSelect(item);
    onClose();
  }, [onSelect, onClose, query, textareaRef, fimContext]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible) {
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        isForceTriggeredRef.current = true;
        setTimeout(() => { isForceTriggeredRef.current = false; }, 500);
        logger.debug('TabAutocomplete', '⌨️ Ctrl+Space 强制触发');
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, completions.length - 1));
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;

      case 'PageDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 8, completions.length - 1));
        break;

      case 'PageUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 8, 0));
        break;

      case 'Home':
        if (completions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(0);
        }
        break;

      case 'End':
        if (completions.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(completions.length - 1);
        }
        break;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (completions.length > 0) {
          handleSelect(completions[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;

      default:
        break;
    }
  }, [visible, completions, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedItem = completions[selectedIndex];
  const levelBadge = getLevelBadge(currentLevel);

  return (
    <div
      className="enhanced-autocomplete-popup"
      style={{
        display: visible ? 'block' : 'none',
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
        maxHeight: '480px',
        width: '520px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255,255,255,0.05)',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}
    >
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="spinner" style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid var(--border-color)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
              三级缓存查询中...
            </span>
          ) : (
            <>🎯 {completions.length} 个建议</>
          )}
          {query && <span style={{ opacity: 0.7 }}>"{query}"</span>}
          {fimContext?.isMiddleMode && (
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>FIM 模式</span>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.7 }}>
          {latencyMs > 0 && (
            <span style={{
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              background: latencyMs <= 50 ? '#d1fae5' : latencyMs <= 200 ? '#fef3c7' : '#fee2e2',
              color: latencyMs <= 50 ? '#059669' : latencyMs <= 200 ? '#d97706' : '#dc2626'
            }}>
              {latencyMs}ms
            </span>
          )}
          <span style={{
            padding: '1px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            background: levelBadge.bg,
            color: levelBadge.color,
            fontWeight: 600
          }}>
            {levelBadge.text}
          </span>
          <span>↑↓ Navigate · Enter Confirm</span>
        </span>
      </div>

      <div style={{ maxHeight: fimContext?.isMiddleMode ? '280px' : '340px', overflowY: 'auto' }}>
        {completions.map((item, index) => {
          const quality = getQualityDots(item.confidence);
          const isSelected = index === selectedIndex;

          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                background: isSelected ? 'var(--bg-hover)' : 'transparent',
                borderBottom: index < completions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                transition: 'background 0.12s ease',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent'
              }}
            >
              <span style={{
                fontSize: '18px',
                width: '26px',
                textAlign: 'center',
                flexShrink: 0,
                lineHeight: '1.4'
              }}>
                {item.icon || getTypeIcon(item.type)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '8px'
                }}>
                  <span style={{
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono, monospace)'
                  }}>
                    {item.label}
                  </span>

                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {item.source === 'ai' && (
                      <span title="AI 建议" style={{ color: '#9333ea' }}>🤖</span>
                    )}
                    {item.source === 'indexed' && (
                      <span title="项目符号" style={{ color: '#0284c7' }}>📂</span>
                    )}
                    {item.detail}
                    <span style={{
                      color: quality.color,
                      fontSize: '10px',
                      letterSpacing: '1px'
                    }} title={`置信度: ${(item.confidence * 100).toFixed(0)}%`}>
                      {quality.dots}
                    </span>
                  </span>
                </div>

                {item.documentation && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.documentation}
                  </div>
                )}

                {isSelected && showDetail && item.insertText !== item.label && (
                  <div style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-secondary)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: fimContext?.isMiddleMode ? '120px' : '80px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {item.insertText}
                  </div>
                )}
              </div>

              <span style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                flexShrink: 0,
                marginTop: '2px',
                opacity: isSelected ? 1 : 0.5
              }}>
                {(item.confidence * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}

        {isLoading && completions.length === 0 && (
          <div style={{
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--text-tertiary)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>三级缓存智能分析中...</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              L1 本地缓存 → L3 项目符号 → L2 AI 补全
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              marginTop: '14px',
              fontSize: '11px'
            }}>
              <span style={{ color: '#10b981' }}>● L1 本地 &lt;50ms</span>
              <span style={{ color: '#0284c7' }}>● L3 符号 &lt;10ms</span>
              <span style={{ color: '#9333ea' }}>● L2 AI &lt;500ms</span>
            </div>
          </div>
        )}

        {!isLoading && completions.length === 0 && query && (
          <div style={{
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--text-tertiary)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: "10px" }}>😕</div>
            <div>未找到匹配的补全项</div>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              尝试输入更多字符或按 Ctrl+Space 强制刷新
            </div>
          </div>
        )}
      </div>

      {fimContext?.isMiddleMode && inlinePreview && selectedItem && (
        <div style={{
          padding: '10px 14px',
          borderTop: '2px solid #f59e0b',
          background: '#fffbeb',
          fontSize: '12px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: '11px',
            color: '#92400e',
            fontWeight: 600
          }}>
            <span>🔄 FIM 多行预览 (Fill-in-Middle)</span>
            <span>{inlinePreview.split('\n').length} 行</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            color: '#78350f',
            background: 'var(--bg-primary)',
            padding: '8px',
            borderRadius: '6px',
            maxHeight: '100px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            border: '1px solid #fde68a'
          }}>
            {inlinePreview}
          </div>
        </div>
      )}

      {selectedItem && !fimContext?.isMiddleMode && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px'
          }}
          onClick={() => setShowDetail(!showDetail)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
              {selectedItem.label}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '3px',
              lineHeight: 1.4
            }}>
              {selectedItem.documentation || selectedItem.detail}
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
            flexShrink: 0
          }}>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: selectedItem.source === 'ai' ? '#ede9fe' :
                        selectedItem.source === 'indexed' ? '#e0f2fe' :
                        'var(--bg-tertiary)',
              color: selectedItem.source === 'ai' ? '#7c3aed' :
                     selectedItem.source === 'indexed' ? '#0369a1' :
                     'var(--text-secondary)',
              fontWeight: 600
            }}>
              {selectedItem.source === 'ai' ? 'AI' :
               selectedItem.source === 'indexed' ? '项目符号' : '本地'}
            </span>
            <span style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)'
            }}>
              置信度: {(selectedItem.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTabAutocomplete;
