import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, AVAILABLE_MODELS } from '../store';
import * as api from '../api';

const MODEL_DESCRIPTIONS: Record<string, string> = {
  'deepseek-v4-flash': '快速响应',
  'deepseek-v4-pro': '高质量推理',
};

const ChatInput: React.FC<{ onSend: (text: string) => void }> = ({ onSend }) => {
  const [text, setText] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);

  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const thinkingMode = useAppStore((s) => s.thinkingMode);
  const toggleThinkingMode = useAppStore((s) => s.toggleThinkingMode);
  const slashCommands = useAppStore((s) => s.slashCommands);
  const attachments = useAppStore((s) => s.attachments);
  const addAttachment = useAppStore((s) => s.addAttachment);
  const removeAttachment = useAppStore((s) => s.removeAttachment);

  // ── Filtered slash commands ──────────────────────────────────
  const filteredCommands = slashCommands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // ── Auto-resize textarea ────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';

    // Slash command detection
    if (value.startsWith('/')) {
      const afterSlash = value.slice(1);
      if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
        setSlashFilter(afterSlash);
        setSlashMenuOpen(true);
        setSlashSelectedIndex(0);
      } else {
        setSlashMenuOpen(false);
      }
    } else {
      setSlashMenuOpen(false);
    }
  };

  // ── Keyboard handling ───────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash menu navigation
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredCommands[slashSelectedIndex];
        if (cmd) {
          selectSlashCommand(cmd);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    // Enter sends, Shift+Enter newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Select slash command ────────────────────────────────────
  const selectSlashCommand = (cmd: { id: string; name: string; fill_text?: string }) => {
    const fill = cmd.fill_text || ('/' + cmd.name);
    setText(fill + ' ');
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  };

  // ── Send ────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSlashMenuOpen(false);
  };

  // ── Attach ──────────────────────────────────────────────────
  const handleAttach = async () => {
    try {
      const result = await api.selectMultipleFiles();
      if (result && result.length > 0) {
        result.forEach((path) => {
          const name = path.split(/[\\/]/).pop() || 'file';
          addAttachment({ name, path });
        });
      }
    } catch (e) {
      console.error('Attach file failed:', e);
    }
  };

  // ── Click outside to close dropdowns ────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ── Load slash commands & focus on mount ───────────────────
  useEffect(() => {
    textareaRef.current?.focus();
    // Ensure slash commands are loaded
    const loadCommands = async () => {
      try {
        const cmds = await api.getSlashCommands();
        if (cmds && cmds.length > 0) {
          useAppStore.getState().setSlashCommands(cmds);
        }
      } catch (e) {
        console.error('Failed to load slash commands:', e);
      }
    };
    // Only load if store is empty
    if (slashCommands.length === 0) {
      loadCommands();
    }
  }, [slashCommands.length]);

  return (
    <div className="input-area">
      <div className="input-container">
        {/* Slash command menu */}
        <div
          className={`slash-menu ${slashMenuOpen && filteredCommands.length > 0 ? 'visible' : ''}`}
          id="slashMenuChat"
          ref={slashRef}
        >
          {filteredCommands.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={`slash-menu-item ${idx === slashSelectedIndex ? 'selected' : ''}`}
              onClick={() => selectSlashCommand(cmd)}
              onMouseEnter={() => setSlashSelectedIndex(idx)}
            >
              <div className="slash-menu-item-icon">{cmd.icon || '⚡'}</div>
              <div className="slash-menu-item-content">
                <div className="slash-menu-item-name">/{cmd.name}</div>
                <div className="slash-menu-item-desc">{cmd.description}</div>
              </div>
            </div>
          ))}
          {slashMenuOpen && filteredCommands.length === 0 && (
            <div className="slash-menu-empty">没有匹配的命令</div>
          )}
        </div>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div id="attachmentArea" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px 12px 0' }}>
            {attachments.map((att, idx) => (
              <div key={idx} className="attachment-chip">
                <span>{att.name || att.path || 'file'}</span>
                <button onClick={() => removeAttachment(idx)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Input row: textarea only */}
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="main-input"
            placeholder="继续对话..."
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Input toolbar */}
        <div className="input-toolbar">
          <div className="toolbar-left">
            <button className="attach-btn" onClick={handleAttach} title="添加附件">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <div className="toolbar-right">
            <div className="model-dropdown-wrap" ref={modelRef}>
              <div
                className="model-selector"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              >
                <span>{selectedModel}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {modelDropdownOpen && (
                <div className="model-dropdown-menu show">
                  {AVAILABLE_MODELS.map((m) => (
                    <div
                      key={m}
                      className={`model-option ${m === selectedModel ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedModel(m);
                        setModelDropdownOpen(false);
                      }}
                    >
                      <span>{m}</span>
                      <span className="model-desc">{MODEL_DESCRIPTIONS[m] || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`thinking-toggle ${thinkingMode ? 'active' : ''}`}
              onClick={toggleThinkingMode}
              title="深度思考模式"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
              </svg>
              思考
            </button>

            {/* Send button */}
            <button className="send-btn-round" onClick={handleSend} title="发送">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
