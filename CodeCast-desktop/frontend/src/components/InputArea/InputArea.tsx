import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useAppStore, SlashCommand, AppState, Attachment, Project } from '../../store';
import * as api from '../../api';
import SlashMenu from './SlashMenu';
import Toolbar from './Toolbar';
import ModelSelector from './ModelSelector';

export interface InputAreaHandle {
  setText: (text: string) => void;
  submit: () => void;
}

interface InputAreaProps {
  onSend: (text: string) => void;
  placeholder: string;
  showProjectBar?: boolean;
  autoFocus?: boolean;
  isLoading?: boolean;
  onStop?: () => void;
}

const InputArea = forwardRef<InputAreaHandle, InputAreaProps>(({ onSend, placeholder, showProjectBar = false, autoFocus = true, isLoading = false, onStop }, ref) => {
  const [text, setText] = useState('');
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const slashCommands = useAppStore((s: AppState) => s.slashCommands);
  const attachments = useAppStore((s: AppState) => s.attachments);
  const addAttachment = useAppStore((s: AppState) => s.addAttachment);
  const removeAttachment = useAppStore((s: AppState) => s.removeAttachment);

  const filteredSlashCommands = slashCommands.filter((cmd: SlashCommand) =>
    cmd.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
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
    if (slashCommands.length === 0) {
      loadCommands();
    }
  }, [slashCommands.length]);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashFilter]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
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

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
    },
    submit: handleSend,
  }), [handleSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [slashMenuVisible, filteredSlashCommands, selectedSlashIndex, handleSend]
  );

  const handleSelectSlashCommand = useCallback((cmd: SlashCommand) => {
    // 处理内置斜杠命令
    const builtinHandlers: Record<string, () => void> = {
      '/theme': () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('codecast_theme', next);
        api.updateSetting('theme', next).catch((e) => console.error('[slash] 切换主题失败:', e));
      },
      '/clear': () => {
        setText('');
        setSlashMenuVisible(false);
        // 触发清空对话
        window.dispatchEvent(new CustomEvent('clear-session'));
      },
    };

    const handler = builtinHandlers[cmd.name];
    if (handler) {
      handler();
      return;
    }

    // 自定义命令：填充 fillText 到输入框
    const fill = cmd.fill_text || ('/' + cmd.name) || '';
    setText(fill + ' ');
    setSlashMenuVisible(false);
    setSlashFilter('');
    textareaRef.current?.focus();
  }, []);

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

  return (
    <div className={showProjectBar ? 'welcome-input-area' : 'input-area'}>
      <div className="input-container">
        <SlashMenu
          visible={slashMenuVisible}
          filter={slashFilter}
          commands={filteredSlashCommands}
          selectedIndex={selectedSlashIndex}
          onSelect={handleSelectSlashCommand}
          onHover={setSelectedSlashIndex}
          menuRef={slashMenuRef}
        />

        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px 0' }}>
            {attachments.map((att: Attachment, idx: number) => (
              <div key={idx} className="attachment-chip">
                <span>{att.name || att.path}</span>
                <button onClick={() => removeAttachment(idx)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="main-input"
            placeholder={placeholder}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
        </div>

        {showProjectBar ? (
          <ToolbarWithProjectBar
            onAttach={handleAttach}
            onSend={handleSend}
            onStop={onStop}
            isLoading={isLoading}
            modelOpen={modelDropdownOpen}
            onModelToggle={() => setModelDropdownOpen(!modelDropdownOpen)}
            onModelClose={() => setModelDropdownOpen(false)}
            modelDropdownRef={modelDropdownRef}
          />
        ) : (
          <Toolbar
            onAttach={handleAttach}
            onSend={handleSend}
            onStop={onStop}
            isLoading={isLoading}
            modelOpen={modelDropdownOpen}
            onModelToggle={() => setModelDropdownOpen(!modelDropdownOpen)}
            onModelClose={() => setModelDropdownOpen(false)}
            modelDropdownRef={modelDropdownRef}
          />
        )}
      </div>
    </div>
  );
});

const ToolbarWithProjectBar: React.FC<{
  onAttach: () => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading?: boolean;
  modelOpen: boolean;
  onModelToggle: () => void;
  onModelClose: () => void;
  modelDropdownRef: React.RefObject<HTMLDivElement>;
}> = ({ onAttach, onSend, onStop, isLoading, modelOpen, onModelToggle, onModelClose, modelDropdownRef }) => {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = useAppStore((s: AppState) => s.currentProject);
  const noProjectMode = useAppStore((s: AppState) => s.noProjectMode);
  const setCurrentProject = useAppStore((s: AppState) => s.setCurrentProject);
  const setNoProjectMode = useAppStore((s: AppState) => s.setNoProjectMode);

  const projects = useAppStore((s: AppState) => s.projects);
  const currentProjectObj = projects.find((p: Project) => p.id === currentProject);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectProject = useCallback(
    async (id: string | null) => {
      if (id === null) {
        setNoProjectMode(true);
        setCurrentProject(null);
        try { await api.setNoProjectMode(true); } catch (e) { console.error('Failed to set no-project mode:', e); }
        try { await api.setCurrentProject(''); } catch (e) { console.error('Failed to clear current project:', e); }
      } else {
        setCurrentProject(id);
        setNoProjectMode(false);
        try { await api.setCurrentProject(id); } catch (e) { console.error('Failed to set current project:', e); }
        try { await api.setNoProjectMode(false); } catch (e) { console.error('Failed to disable no-project mode:', e); }
      }
      setProjectDropdownOpen(false);
    },
    [setCurrentProject, setNoProjectMode]
  );

  const handleAddProject = useCallback(async () => {
    try {
      const path = await api.selectFolder();
      if (path) {
        const newProj = await api.addProject(path);
        const updated = await api.getProjects();
        if (updated) {
          useAppStore.getState().setProjects(updated);
          if (newProj && newProj.id) {
            useAppStore.getState().setCurrentProject(newProj.id);
            useAppStore.getState().setNoProjectMode(false);
            try { await api.setNoProjectMode(false); } catch (_) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      console.error('Add project failed:', e);
    }
    setProjectDropdownOpen(false);
  }, []);

  return (
    <>
      <Toolbar
        onAttach={onAttach}
        onSend={onSend}
        onStop={onStop}
        isLoading={isLoading}
        modelOpen={modelOpen}
        onModelToggle={onModelToggle}
        onModelClose={onModelClose}
        modelDropdownRef={modelDropdownRef}
        showRightSide={false}
      />
      <div className="project-bar">
        <div className="model-dropdown-wrap" ref={projectDropdownRef}>
          <button
            className="project-selector"
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
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
              <div className="project-dropdown-list">
                <div className="project-dropdown-item" onClick={handleAddProject}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>选择文件夹</span>
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

        <div className="project-bar-right">
          <ModelSelector
            open={modelOpen}
            onToggle={onModelToggle}
            onClose={onModelClose}
            dropdownRef={modelDropdownRef}
          />
          <ThinkingToggle />
        </div>
      </div>
    </>
  );
};

const ThinkingToggle: React.FC = () => {
  const thinkingMode = useAppStore((s: AppState) => s.thinkingMode);
  const toggleThinkingMode = useAppStore((s: AppState) => s.toggleThinkingMode);

  return (
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
  );
};

export default InputArea;
