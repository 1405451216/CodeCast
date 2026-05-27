import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useAppStore, SlashCommand, AppState, Attachment, ImageAttachment, ContextReference, Project } from '../../store';
import * as api from '../../api';
import SlashMenu from './SlashMenu';
import Toolbar from './Toolbar';
import ModelSelector from './ModelSelector';
import ContextSelector from './ContextSelector';
import CommandOptimizer from './CommandOptimizer';
import ImageUploader from './ImageUploader';
import TabAutocomplete, { AutocompleteItem } from './TabAutocomplete';
import EnhancedTabAutocomplete from './EnhancedTabAutocomplete';
import CompletionSetupWizard from './CompletionSetupWizard';

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
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextFilter, setContextFilter] = useState('');
  const [optimizerVisible, setOptimizerVisible] = useState(false);
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [selectedAutoIndex, setSelectedAutoIndex] = useState(0);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  
  // Enhanced AI completion states
  const [enhancedCompletionVisible, setEnhancedCompletionVisible] = useState(false);
  const [completionWizardOpen, setCompletionWizardOpen] = useState(false);
  const [aiCompletionConfigured, setAiCompletionConfigured] = useState(false);
  
  // Pre-loaded code snippets cache
  const codeSnippetsRef = useRef<Record<string, { text: string; display: string; description: string }>>({});
  const [snippetsLoaded, setSnippetsLoaded] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const slashCommands = useAppStore((s: AppState) => s.slashCommands);
  const attachments = useAppStore((s: AppState) => s.attachments);
  const images = useAppStore((s: AppState) => s.images);
  const contextRefs = useAppStore((s: AppState) => s.contextReferences);
  const addAttachment = useAppStore((s: AppState) => s.addAttachment);
  const removeAttachment = useAppStore((s: AppState) => s.removeAttachment);
  const addImage = useAppStore((s: AppState) => s.addImage);
  const removeImage = useAppStore((s: AppState) => s.removeImage);
  const addContextRef = useAppStore((s: AppState) => s.addContextRef);
  const clearImages = useAppStore((s: AppState) => s.clearImages);
  const clearContextRefs = useAppStore((s: AppState) => s.clearContextRefs);
  
  // Get current project for AI completion context
  const currentProject = useAppStore((s: AppState) => s.currentProject);

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
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Pre-load code snippets on component mount
  useEffect(() => {
    let isMounted = true;
    
    import('./TabAutocomplete').then(({ CODE_SNIPPETS }) => {
      if (isMounted) {
        codeSnippetsRef.current = CODE_SNIPPETS;
        setSnippetsLoaded(true);
      }
    }).catch((err) => {
      console.warn('⚠️ Failed to load code snippets:', err);
      if (isMounted) {
        setSnippetsLoaded(true); // Mark as loaded even on error to prevent retries
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Check if AI completion is already configured on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('codecast_ai_completion_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config && config.enabled) {
          setAiCompletionConfigured(true);
          console.log('✅ AI Completion: Loaded saved configuration');
        }
      } catch (e) {
        console.warn('⚠️ Failed to parse AI completion config:', e);
      }
    }
  }, []);

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
        setContextMenuVisible(false);
      } else {
        setSlashMenuVisible(false);
        setSlashFilter('');
      }
    } else if (value.includes('@')) {
      const atIndex = value.lastIndexOf('@');
      const afterAt = value.slice(atIndex + 1);
      const hasSpaceAfter = afterAt.includes(' ') || afterAt.includes('\n');
      if (!hasSpaceAfter || afterAt.length < 20) {
        setContextMenuVisible(true);
        setContextFilter(afterAt.split(/[ \n]/)[0]);
        setSlashMenuVisible(false);
      } else {
        setContextMenuVisible(false);
      }
    } else {
      setSlashMenuVisible(false);
      setSlashFilter('');
      setContextMenuVisible(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;

    setInputHistory(prev => {
      const filtered = prev.filter(h => h !== trimmed);
      return [trimmed, ...filtered].slice(0, 50);
    });

    let finalText = trimmed;

    if (contextRefs.length > 0) {
      const contextText = contextRefs.map(ref =>
        `[引用 ${ref.type}: ${ref.title}]\n${ref.content.slice(0, 500)}`
      ).join('\n\n');
      finalText = `${contextText}\n\n${finalText}`;
    }

    onSend(finalText);
    setText('');
    setSlashMenuVisible(false);
    setSlashFilter('');
    setContextMenuVisible(false);
    setOptimizerVisible(false);
    clearImages();
    clearContextRefs();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, images, contextRefs, onSend, clearImages, clearContextRefs]);

  const generateAutocompleteItems = useCallback((currentText: string): AutocompleteItem[] => {
    const items: AutocompleteItem[] = [];
    const trimmed = currentText.trimEnd();
    
    if (!trimmed || trimmed.length < 1) return items;

    const lastWordMatch = trimmed.match(/\b(\w+)$/);
    const lastWord = lastWordMatch ? lastWordMatch[1] : '';
    const lowerWord = lastWord.toLowerCase();

    if (lowerWord.length >= 2) {
      inputHistory.filter(h => h.toLowerCase().includes(lowerWord) && h !== trimmed).slice(0, 3).forEach(h => {
        items.push({ type: 'text', text: h, display: h, icon: '📝', description: '历史输入' });
      });
    }

    slashCommands.forEach(cmd => {
      const cmdName = cmd.name.replace(/^\//, '');
      if (lowerWord && (cmdName.includes(lowerWord) || cmd.description.toLowerCase().includes(lowerWord))) {
        if (!items.some(i => i.text === cmd.name)) {
          items.push({ type: 'command', text: cmd.name, display: cmd.name, icon: '⚡', description: cmd.description });
        }
      }
    });

    if (trimmed.includes('@') && lowerWord) {
      items.push({ type: 'context', text: `@${lastWord}`, display: `@ 引用 "${lastWord}"`, icon: '📎', description: '搜索上下文引用' });
    }

    // Use pre-loaded code snippets from cache
    if (snippetsLoaded && Object.keys(codeSnippetsRef.current).length > 0) {
      Object.entries(codeSnippetsRef.current).forEach(([key, snippet]) => {
        if (key.startsWith(lowerWord) || key.includes(lowerWord)) {
          if (!items.some(i => i.type === 'code' && i.display === snippet.display)) {
            items.push({ type: 'code', text: snippet.text, display: snippet.display, icon: '💻', description: snippet.description });
          }
        }
      });
    }

    return items.slice(0, 10);
  }, [inputHistory, slashCommands]);

  const handleAutocompleteSelect = useCallback((item: AutocompleteItem) => {
    const el = textareaRef.current;
    if (!el) return;

    let newText = text;

    switch (item.type) {
      case 'text':
        setText(item.text);
        break;
      case 'command':
        setText(item.text + ' ');
        break;
      case 'context':
        setContextMenuVisible(true);
        setContextFilter(item.text.replace('@', ''));
        break;
      case 'code': {
        const beforeCursor = text.slice(0, el.selectionStart);
        const afterCursor = text.slice(el.selectionStart);
        setText(beforeCursor + item.text + afterCursor);
        setTimeout(() => {
          if (el) {
            const hasNewline = item.text.indexOf('\n') !== -1;
            const pos = el.selectionStart - item.text.length + (hasNewline ? 
              item.text.indexOf('  \n') + 2 : item.text.length);
            el.setSelectionRange(el.selectionStart, el.selectionStart);
          }
        }, 0);
        break;
      }
    }

    setAutocompleteVisible(false);
    setAutocompleteItems([]);
    setSelectedAutoIndex(0);
    el.focus();
  }, [text]);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
    },
    submit: handleSend,
  }), [handleSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocompleteVisible) {
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAutocompleteVisible(false);
          setAutocompleteItems([]);
          setSelectedAutoIndex(0);
          return;
        }
      }

      if (contextMenuVisible) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setContextMenuVisible(false);
          return;
        }
      }

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

      if (e.key === 'Tab') {
        e.preventDefault();
        
        // Priority: Use Enhanced AI completion if configured
        if (aiCompletionConfigured) {
          setEnhancedCompletionVisible(true);
          return;
        }
        
        // Fallback to basic autocomplete
        const items = generateAutocompleteItems(text);
        if (items.length > 0) {
          setAutocompleteItems(items);
          setAutocompleteVisible(true);
          setSelectedAutoIndex(0);
        } else {
          // Show setup wizard if no basic completions available
          if (!aiCompletionConfigured && text.trim().length > 2) {
            setCompletionWizardOpen(true);
          }
        }
      }
    },
    [slashMenuVisible, filteredSlashCommands, selectedSlashIndex, handleSend, contextMenuVisible, autocompleteVisible, text, generateAutocompleteItems]
  );

  const handleSelectSlashCommand = useCallback((cmd: SlashCommand) => {
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
        window.dispatchEvent(new CustomEvent('clear-session'));
      },
    };

    const handler = builtinHandlers[cmd.name];
    if (handler) {
      handler();
      return;
    }

    const fill = cmd.fill_text || ('/' + cmd.name) || '';
    setText(fill + ' ');
    setSlashMenuVisible(false);
    setSlashFilter('');
    textareaRef.current?.focus();
  }, []);

  const handleSelectContext = useCallback((ref: ContextReference) => {
    addContextRef(ref);
    setContextMenuVisible(false);

    const currentText = text;
    const atIndex = currentText.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = currentText.slice(0, atIndex);
      const newText = `${beforeAt}[${ref.type}:${ref.title}] `;
      setText(newText);
    }

    textareaRef.current?.focus();
  }, [text, addContextRef]);

  const handleApplyOptimization = useCallback((optimizedText: string) => {
    setText(optimizedText);
    setOptimizerVisible(false);
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
      <div className="input-container" ref={inputContainerRef}>
        <SlashMenu
          visible={slashMenuVisible}
          filter={slashFilter}
          commands={filteredSlashCommands}
          selectedIndex={selectedSlashIndex}
          onSelect={handleSelectSlashCommand}
          onHover={setSelectedSlashIndex}
          menuRef={slashMenuRef}
        />

        <ContextSelector
          visible={contextMenuVisible}
          filter={contextFilter}
          onSelect={handleSelectContext}
          onClose={() => setContextMenuVisible(false)}
          menuRef={contextMenuRef}
        />

        <CommandOptimizer
          input={text}
          visible={optimizerVisible}
          onApplySuggestion={handleApplyOptimization}
          onClose={() => setOptimizerVisible(false)}
        />

        {images.length > 0 && (
          <ImageUploader
            images={images}
            onAddImage={addImage}
            onRemoveImage={removeImage}
            disabled={isLoading}
          />
        )}

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

        {contextRefs.length > 0 && (
          <div className="context-ref-chips">
            {contextRefs.map((ref) => (
              <div key={ref.id} className="context-ref-chip">
                <span className={`chip-icon ${ref.type}`}>{ref.type === 'code' ? '</>' : ref.type === 'message' ? '💬' : '📄'}</span>
                <span className="chip-title">{ref.title}</span>
                <button onClick={() => useAppStore.getState().removeContextRef(ref.id)}>×</button>
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

          {autocompleteVisible && !enhancedCompletionVisible && (
            <TabAutocomplete
              visible={autocompleteVisible}
              items={autocompleteItems}
              selectedIndex={selectedAutoIndex}
              onSelect={handleAutocompleteSelect}
              onNavigate={setSelectedAutoIndex}
              onClose={() => {
                setAutocompleteVisible(false);
                setAutocompleteItems([]);
                setSelectedAutoIndex(0);
              }}
              position={{ top: 0, left: 0 }}
              textareaRef={textareaRef}
            />
          )}

          {/* Enhanced AI Tab Completion - Level 5 */}
          <EnhancedTabAutocomplete
            visible={enhancedCompletionVisible}
            position={{ top: 0, left: 0 }}
            textareaRef={textareaRef}
            filePath={currentProject || 'untitled'}
            language="typescript"
            onSelect={(completion) => {
              // Insert completion at cursor position
              const el = textareaRef.current;
              if (el) {
                const beforeCursor = text.slice(0, el.selectionStart);
                const afterCursor = text.slice(el.selectionStart);
                setText(beforeCursor + completion.insertText + afterCursor);
                
                // Move cursor to end of insertion
                setTimeout(() => {
                  const newPos = el.selectionStart + completion.insertText.length;
                  el.setSelectionRange(newPos, newPos);
                  el.focus();
                }, 0);
              }
              
              setEnhancedCompletionVisible(false);
              
              // Record usage for learning
              api.RecordCompletionUsage(
                text.slice(-50), // last 50 chars as context
                completion.insertText,
                'ai',
                'openai', // or configured model
                Date.now() // timestamp as latency proxy
              ).catch((err: unknown) => console.warn('Failed to record completion:', err));
            }}
            onClose={() => setEnhancedCompletionVisible(false)}
          />
        </div>

        {/* AI Completion Setup Wizard */}
        <CompletionSetupWizard
          isOpen={completionWizardOpen}
          onClose={() => setCompletionWizardOpen(false)}
          onComplete={(config) => {
            console.log('✅ AI Completion configured:', config);
            setAiCompletionConfigured(true);
            
            // Save config to localStorage for persistence
            localStorage.setItem('codecast_ai_completion_config', JSON.stringify(config));
          }}
        />

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
            onOptimize={() => setOptimizerVisible(!optimizerVisible)}
            optimizerActive={optimizerVisible}
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
            onOptimize={() => setOptimizerVisible(!optimizerVisible)}
            optimizerActive={optimizerVisible}
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
  onOptimize?: () => void;
  optimizerActive?: boolean;
}> = ({ onAttach, onSend, onStop, isLoading, modelOpen, onModelToggle, onModelClose, modelDropdownRef, onOptimize, optimizerActive }) => {
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
          {onOptimize && (
            <button
              className={`optimizer-toggle ${optimizerActive ? 'active' : ''}`}
              onClick={onOptimize}
              title="优化指令"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              优化
            </button>
          )}
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