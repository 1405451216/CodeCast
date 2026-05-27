import React, { useState, useMemo, useCallback } from 'react';
import { useMemoryStore } from '../store/useMemoryStore';

interface MemoryHighlightProps {
  content: string;
  messageId?: string;
}

interface MemoryMatch {
  id: string;
  text: string;
  memory: ReturnType<typeof useMemoryStore.getState>['memories'][0];
  startIndex: number;
  endIndex: number;
  relevance: number;
}

const MemoryHighlight: React.FC<MemoryHighlightProps> = ({ content, messageId }) => {
  const [hoveredMemoryId, setHoveredMemoryId] = useState<string | null>(null);
  const memories = useMemoryStore(state => state.memories);

  const memoryMatches = useMemo((): MemoryMatch[] => {
    if (!content || !memories.length) return [];

    const matches: MemoryMatch[] = [];
    const minMatchLength = 10;
    const threshold = 0.6;

    memories.forEach(memory => {
      if (!memory.content) return;

      const memoryText = memory.content.toLowerCase();
      const contentLower = content.toLowerCase();

      let searchStart = 0;
      while (searchStart < contentLower.length) {
        const index = contentLower.indexOf(memoryText.slice(0, Math.min(30, memoryText.length)), searchStart);

        if (index === -1) break;

        const matchLength = Math.min(
          memoryText.length,
          content.length - index
        );

        if (matchLength >= minMatchLength) {
          let similarity = 0;
          const sampleLength = Math.min(matchLength, 50);
          let matchingChars = 0;

          for (let i = 0; i < sampleLength; i++) {
            if (content[index + i] === memory.content[i]) {
              matchingChars++;
            }
          }

          similarity = matchingChars / sampleLength;

          if (similarity >= threshold) {
            matches.push({
              id: `${messageId || 'unknown'}-${memory.id}-${index}`,
              text: content.slice(index, index + matchLength),
              memory,
              startIndex: index,
              endIndex: index + matchLength,
              relevance: similarity * memory.relevance
            });
          }
        }

        searchStart = index + 1;
      }
    });

    return matches.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  }, [content, memories, messageId]);

  const renderHighlightedContent = useCallback((): React.ReactNode[] => {
    if (!memoryMatches.length) {
      return [<span key="content">{content}</span>];
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    const sortedMatches = [...memoryMatches].sort((a, b) => a.startIndex - b.startIndex);

    sortedMatches.forEach((match, matchIndex) => {
      if (match.startIndex > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, match.startIndex)}
          </span>
        );
      }

      elements.push(
        <span
          key={`memory-${match.id}-${matchIndex}`}
          className="memory-highlight"
          style={{
            backgroundColor: 'var(--accent-light, rgba(124, 124, 255, 0.15))',
            borderBottom: `2px solid var(--accent, #7c7cff)`,
            borderRadius: '3px',
            padding: '1px 4px',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            setHoveredMemoryId(match.id);
            e.currentTarget.style.backgroundColor = 'rgba(124, 124, 255, 0.25)';
            e.currentTarget.style.borderBottomColor = '#6b6bef';
          }}
          onMouseLeave={(e) => {
            setHoveredMemoryId(null);
            e.currentTarget.style.backgroundColor = 'rgba(124, 124, 255, 0.15)';
            e.currentTarget.style.borderBottomColor = 'var(--accent, #7c7cff)';
          }}
          onClick={() => {
            if (match.memory.sessionId) {
              window.open(`#session-${match.memory.sessionId}`, '_blank');
            }
          }}
        >
          {match.text}
          {hoveredMemoryId === match.id && (
            <div
              className="memory-tooltip"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                padding: '12px',
                backgroundColor: 'var(--bg-primary, #ffffff)',
                border: '1px solid var(--border-color, #e5e5e5)',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                zIndex: 10000,
                width: '300px',
                fontSize: '13px',
                color: 'var(--text-primary, #1a1a1a)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                fontWeight: 600,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🧠 历史记忆
                <span style={{
                  fontSize: '11px',
                  fontWeight: 400,
                  color: 'var(--text-secondary, #666)',
                  marginLeft: 'auto'
                }}>
                  相关度: {Math.round(match.relevance)}%
                </span>
              </div>
              <div style={{
                marginBottom: '8px',
                lineHeight: '1.4',
                maxHeight: '80px',
                overflowY: 'auto',
                color: 'var(--text-primary, #1a1a1a)'
              }}>
                {match.memory.content}
              </div>
              <div style={{
                borderTop: '1px solid var(--border-color, #e5e5e5)',
                paddingTop: '8px',
                fontSize: '11px',
                color: 'var(--text-dim, #999)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>
                  来源: {match.memory.source}
                </span>
                <span>
                  {new Date(match.memory.timestamp).toLocaleDateString()}
                </span>
              </div>
              {match.memory.sessionId && (
                <button
                  onClick={() => window.open(`#session-${match.memory.sessionId}`, '_blank')}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--accent, #7c7cff)',
                    backgroundColor: 'transparent',
                    color: 'var(--accent, #7c7cff)',
                  borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(124, 124, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  跳转到原始对话 →
                </button>
              )}
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `6px solid var(--border-color, #e5e5e5)`
                }}
              />
            </div>
          )}
        </span>
      );

      lastIndex = match.endIndex;
    });

    if (lastIndex < content.length) {
      elements.push(
        <span key={`text-end-${lastIndex}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  }, [content, memoryMatches, hoveredMemoryId]);

  if (!content) return null;

  return (
    <span className="memory-highlight-wrapper">
      {renderHighlightedContent()}
    </span>
  );
};

export default React.memo(MemoryHighlight);