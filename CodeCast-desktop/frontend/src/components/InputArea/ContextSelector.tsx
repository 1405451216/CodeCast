import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore, Message, AppState, ContextReference } from '../../store';

interface ContextSelectorProps {
  visible: boolean;
  filter: string;
  onSelect: (ref: ContextReference) => void;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

const ContextSelector: React.FC<ContextSelectorProps> = ({
  visible,
  filter,
  onSelect,
  onClose,
  menuRef,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messages = useAppStore((s: AppState) => s.messages);

  const contextItems = useMemo(() => {
    const items: ContextReference[] = [];

    messages.slice(-20).forEach((msg: Message) => {
      if (msg.role === 'assistant' && msg.content) {
        items.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : ''),
          content: msg.content,
          sourceMessageId: msg.id,
        });

        const codeBlocks = extractCodeBlocks(msg.content);
        codeBlocks.forEach((block, idx) => {
          items.push({
            id: `code-${msg.id}-${idx}`,
            type: 'code',
            title: `${block.language || 'code'}: ${block.code.slice(0, 40)}...`,
            content: block.code,
            sourceMessageId: msg.id,
            language: block.language,
          });
        });
      }
    });

    if (filter) {
      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(filter.toLowerCase()) ||
          item.content.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return items;
  }, [messages, filter]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || contextItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % contextItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + contextItems.length) % contextItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(contextItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, contextItems, selectedIndex, onSelect, onClose]);

  if (!visible) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case 'code':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'message': return '消息';
      case 'code': return '代码';
      case 'file': return '文件';
      default: return type;
    }
  };

  return (
    <div ref={menuRef} className="context-selector">
      <div className="context-header">
        <span className="context-title">引用上下文</span>
        <span className="context-hint">选择要引用的内容</span>
      </div>

      <div className="context-list">
        {contextItems.length === 0 ? (
          <div className="context-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>未找到匹配的上下文</span>
          </div>
        ) : (
          contextItems.map((item, index) => (
            <div
              key={item.id}
              className={`context-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="context-item-icon">{getTypeIcon(item.type)}</div>
              <div className="context-item-content">
                <div className="context-item-header">
                  <span className="context-type-badge">{getTypeLabel(item.type)}</span>
                  <span className="context-item-title">{item.title}</span>
                </div>
                {item.language && (
                  <span className="context-lang-tag">{item.language}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="context-footer">
        <kbd>↑↓</kbd> 选择
        <kbd>Enter</kbd> 确认
        <kbd>Esc</kbd> 关闭
      </div>
    </div>
  );
};

function extractCodeBlocks(content: string): { language?: string; code: string }[] {
  const blocks: { language?: string; code: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || undefined,
      code: match[2].trim(),
    });
  }

  return blocks;
}

export default ContextSelector;