import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore, AVAILABLE_MODELS, AvailableModel, SlashCommand } from '../store';
import * as api from '../api';

// ─── Model descriptions ────────────────────────────────────────
const MODEL_DESCRIPTIONS: Record<string, string> = {
  'deepseek-v4-flash': '快速响应',
  'deepseek-v4-pro': '高质量推理',
};

// ─── Props ─────────────────────────────────────────────────────
interface WelcomeViewProps {
  onSend: (text: string) => void;
}

// ─── Component ─────────────────────────────────────────────────
const WelcomeView: React.FC<WelcomeViewProps> = ({ onSend }) => {
  // Store state
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const thinkingMode = useAppStore((s) => s.thinkingMode);
  const toggleThinkingMode = useAppStore((s) => s.toggleThinkingMode);
  const projects = useAppStore((s) => s.projects);
  const currentProject = useAppStore((s) => s.currentProject);
  const noProjectMode = useAppStore((s) => s.noProjectMode);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const setNoProjectMode = useAppStore((s) => s.setNoProjectMode);
  const slashCommands = useAppStore((s) => s.slashCommands);
  const attachments = useAppStore((s) => s.attachments);
  const addAttachment = useAppStore((s) => s.addAttachment);
  const removeAttachment = useAppStore((s) => s.removeAttachment);

  // Local state
  const [text, setText] = useState('');
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Filtered slash commands ────────────────────────────────
  const filteredSlashCommands = slashCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // ─── Filtered projects ─────────────────────────────────────
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.path.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // ─── Current project object ────────────────────────────────
  const currentProjectObj = projects.find((p) => p.id === currentProject);

  // ─── Click-outside handling ────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Auto-focus textarea ───────────────────────────────────
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ─── Load slash commands on mount ──────────────────────────
  useEffect(() => {
    const loadCommands = async () => {
      try {
        const cmds = await api.getSlashCommands();
        if (cmds) {
          useAppStore.getState().setSlashCommands(cmds);
        }
      } catch (e) {
        console.error('Failed to load slash commands:', e);
      }
    };
    loadCommands();
  }, []);

  // ─── Reset slash selection when filter changes ─────────────
  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashFilter]);

  // ─── Textarea input handler ────────────────────────────────
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';

    // Slash menu detection — only show if no space or newline after /
    if (value.startsWith('/')) {
      const afterSlash = value.slice(1);
      if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
        setSlashMenuVisible(true);
        setSlashFilter(afterSlash);
      } else {
        setSlashMenuVisible(false);
        setSlashFilter('');
      }
    } else {
      setSlashMenuVisible(false);
      setSlashFilter('');
    }
  }, []);

  // ─── Send handler ──────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    setSlashMenuVisible(false);
    setSlashFilter('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  // ─── Keyboard handler ──────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash menu navigation
      if (slashMenuVisible && filteredSlashCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const cmd = filteredSlashCommands[selectedSlashIndex];
          if (cmd) {
            handleSelectSlashCommand(cmd);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSlashMenuVisible(false);
          return;
        }
      }

      // Enter to send (Shift+Enter for newline)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [slashMenuVisible, filteredSlashCommands, selectedSlashIndex, handleSend]
  );

  // ─── Select slash command ──────────────────────────────────
  const handleSelectSlashCommand = useCallback((cmd: SlashCommand) => {
    const fill = cmd.fill_text || ('/' + cmd.name) || '';
    setText(fill + ' ');
    setSlashMenuVisible(false);
    setSlashFilter('');
    textareaRef.current?.focus();
  }, []);

  // ─── Attach files ─────────────────────────────────────────
  const handleAttach = useCallback(async () => {
    try {
      const result = await api.selectMultipleFiles();
      if (result && result.length > 0) {
        result.forEach((path: string) => {
          const name = path.split(/[\\/]/).pop() || 'file';
          addAttachment({ name, path });
        });
      }
    } catch (e) {
      console.error('Attach file failed:', e);
    }
  }, [addAttachment]);

  // ─── Add new project ──────────────────────────────────────
  const handleAddProject = useCallback(async () => {
    try {
      const path = await api.selectFolder();
      if (path) {
        await api.addProject(path);
        const updated = await api.getProjects();
        if (updated) {
          useAppStore.getState().setProjects(updated);
        }
      }
    } catch (e) {
      console.error('Add project failed:', e);
    }
    setProjectDropdownOpen(false);
    setProjectSearch('');
  }, []);

  // ─── Model select ─────────────────────────────────────────
  const handleSelectModel = useCallback(
    (model: AvailableModel) => {
      setSelectedModel(model);
      setModelDropdownOpen(false);
    },
    [setSelectedModel]
  );

  // ─── Project select ───────────────────────────────────────
  const handleSelectProject = useCallback(
    async (id: string | null) => {
      if (id === null) {
        setNoProjectMode(true);
        try { await api.setNoProjectMode(true); } catch (e) { console.error('Failed to set no-project mode:', e); }
      } else {
        setCurrentProject(id);
        setNoProjectMode(false);
        try { await api.setNoProjectMode(false); } catch (e) { console.error('Failed to disable no-project mode:', e); }
      }
      setProjectDropdownOpen(false);
      setProjectSearch('');
    },
    [setCurrentProject, setNoProjectMode]
  );

  return (
    <div className="welcome-view">
      <div className="welcome-title">我能帮你做什么？</div>

      <div className="welcome-input-area">
        <div className="input-container">
          {/* Slash command menu */}
          {slashMenuVisible && (
            <div className="slash-menu visible" id="slashMenuWelcome" ref={slashMenuRef}>
              {filteredSlashCommands.length > 0 ? (
                filteredSlashCommands.map((cmd, idx) => (
                  <div
                    key={cmd.id}
                    className={`slash-menu-item ${idx === selectedSlashIndex ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedSlashIndex(idx)}
                    onClick={() => handleSelectSlashCommand(cmd)}
                  >
                    <div className="slash-menu-item-icon">
                      {cmd.icon || '/'}
                    </div>
                    <div className="slash-menu-item-content">
                      <div className="slash-menu-item-name">/{cmd.name}</div>
                      <div className="slash-menu-item-desc">{cmd.description}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="slash-menu-empty">没有匹配的命令</div>
              )}
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px 0' }}>
              {attachments.map((att, idx) => (
                <div key={idx} className="attachment-chip">
                  <span>{att.name || att.path}</span>
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
              placeholder="可向 CodeCast 询问任何事。输入 / 调用命令"
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <div className="toolbar-right">
              {/* Send button */}
              <button className="send-btn-round" onClick={handleSend} title="发送">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Project bar */}
        <div className="project-bar">
          <div className="model-dropdown-wrap" ref={projectDropdownRef}>
            <button
              className="project-selector"
              onClick={() => {
                setProjectDropdownOpen(!projectDropdownOpen);
                setProjectSearch('');
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>{noProjectMode ? '不使用项目' : (currentProjectObj ? currentProjectObj.name : '选择项目')}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {projectDropdownOpen && (
              <div className="project-dropdown">
                <input
                  className="project-dropdown-search"
                  type="text"
                  placeholder="搜索项目..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  autoFocus
                />
                <div className="project-dropdown-list">
                  {filteredProjects.map((p) => (
                    <div
                      key={p.id}
                      className={`project-dropdown-item ${p.id === currentProject ? 'active' : ''}`}
                      onClick={() => handleSelectProject(p.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.path}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="project-dropdown-item" onClick={handleAddProject}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>添加新项目</span>
                  </div>
                  <div className="project-dropdown-item" onClick={() => handleSelectProject(null)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>不使用项目</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model selector + Thinking toggle on the right side of project bar */}
          <div className="project-bar-right">
            <div className="model-dropdown-wrap" ref={modelDropdownRef}>
              <div className="model-selector" onClick={() => setModelDropdownOpen(!modelDropdownOpen)}>
                <span>{selectedModel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {modelDropdownOpen && (
                <div className="model-dropdown-menu show">
                  {AVAILABLE_MODELS.map((m) => (
                    <div
                      key={m}
                      className={`model-option ${m === selectedModel ? 'selected' : ''}`}
                      onClick={() => handleSelectModel(m)}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
