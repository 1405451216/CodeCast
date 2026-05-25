import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  shortcut?: string[];
  category: 'navigation' | 'actions' | 'settings' | 'ai' | 'view';
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

interface CommandItemProps {
  cmd: Command;
  globalIndex: number;
  isSelected: boolean;
  isDark: boolean;
  onSelect: (index: number) => void;
  onExecute: (cmd: Command) => void;
}

const CommandItem = memo<CommandItemProps>(({
  cmd,
  globalIndex,
  isSelected,
  isDark,
  onSelect,
  onExecute
}) => (
  <button
    id={`command-item-${globalIndex}`}
    data-index={globalIndex}
    role="option"
    aria-selected={isSelected}
    onClick={() => onExecute(cmd)}
    onMouseEnter={() => onSelect(globalIndex)}
    className="command-item"
    data-selected={isSelected}
    data-theme={isDark ? 'dark' : 'light'}
  >
    <span className="command-item-icon" data-selected={isSelected}>
      {cmd.icon || '📄'}
    </span>

    <div className="command-item-content">
      <div className="command-item-title">
        {cmd.title}
      </div>
      {cmd.description && (
        <div className="command-item-description">
          {cmd.description}
        </div>
      )}
    </div>

    {cmd.shortcut && (
      <div className="command-item-shortcuts" data-selected={isSelected}>
        {cmd.shortcut.map((key, i) => (
          <kbd key={i} className="command-item-kbd" data-selected={isSelected}>
            {key}
          </kbd>
        ))}
      </div>
    )}
  </button>
));

CommandItem.displayName = 'CommandItem';

const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  isOpen,
  onClose,
  theme = 'dark'
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const MAX_HISTORY_SIZE = 50;
  const HISTORY_STORAGE_KEY = 'command-palette-history';

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setCommandHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.warn('Failed to load command history:', error);
    }
  }, []);

  const addToHistory = useCallback((commandId: string) => {
    setCommandHistory(prev => {
      const newHistory = [commandId, ...prev.filter(id => id !== commandId)];
      const trimmedHistory = newHistory.slice(0, MAX_HISTORY_SIZE);

      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmedHistory));
      } catch (error) {
        console.warn('Failed to save command history:', error);
      }

      return trimmedHistory;
    });
  }, []);

  const filteredCommands = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  );

  const commandsRef = useRef(filteredCommands);
  const selectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    commandsRef.current = filteredCommands;
    selectedIndexRef.current = selectedIndex;
  });

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    history: { label: '最近使用', icon: '🕐' },
    navigation: { label: '导航', icon: '🧭' },
    actions: { label: '操作', icon: '⚡' },
    settings: { label: '设置', icon: '⚙️' },
    ai: { label: 'AI 功能', icon: '🤖' },
    view: { label: '视图', icon: '👁️' }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentCommands = commandsRef.current;
      const currentIndex = selectedIndexRef.current;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < currentCommands.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : currentCommands.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (currentCommands[currentIndex]) {
            const executedCommand = currentCommands[currentIndex];
            addToHistory(executedCommand.id);
            executedCommand.action();
            onClose();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (listRef.current && filteredCommands[selectedIndex]) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <>
      <div
        className="command-palette-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        aria-activedescendant={`command-item-${selectedIndex}`}
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(600px, calc(100vw - 32px))',
          maxHeight: '60vh',
          background: isDark 
            ? 'linear-gradient(180deg, rgba(30,30,35,0.98), rgba(25,25,30,0.98))'
            : '#ffffff',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '16px',
          boxShadow: isDark
            ? '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 24px 48px rgba(0,0,0,0.15)',
          zIndex: 10001,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'commandSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div
          className="command-input-wrapper"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
          }}
        >
          <span style={{ fontSize: '20px', opacity: 0.5 }}>⌘</span>

          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入命令搜索..."
            className="command-search-input"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--text-base, 16px)',
              color: isDark ? '#fff' : '#000',
              fontFamily: 'var(--font-body, sans-serif)'
            }}
            role="combobox"
            aria-expanded={filteredCommands.length > 0}
            aria-controls="command-list"
            aria-autocomplete="list"
          />

          <kbd
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-mono, monospace)',
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`
            }}
          >
            ESC
          </kbd>
        </div>

        <ul
          ref={listRef}
          id="command-list"
          role="listbox"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '8px',
            overflowY: 'auto',
            maxHeight: 'calc(60vh - 80px)'
          }}
        >
          {search === '' && commandHistory.length > 0 && (
            <li key="history">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px 4px',
                  fontSize: 'var(--text-xs, 12px)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
                }}
              >
                <span>🕐</span>
                <span>最近使用</span>
                <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
                  ({Math.min(commandHistory.length, 10)})
                </span>
              </div>

              {commandHistory.slice(0, 10).map((historyCommandId, idx) => {
                const historyCmd = commands.find(cmd => cmd.id === historyCommandId);
                if (!historyCmd) return null;

                const globalIndex = filteredCommands.indexOf(historyCmd);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <li key={`history-${historyCommandId}`}>
                    <CommandItem
                      cmd={historyCmd}
                      globalIndex={globalIndex}
                      isSelected={isSelected}
                      isDark={isDark}
                      onSelect={setSelectedIndex}
                      onExecute={(executedCmd) => {
                        addToHistory(executedCmd.id);
                        executedCmd.action();
                        onClose();
                      }}
                    />
                  </li>
                );
              })}
            </li>
          )}

          {Object.entries(groupedCommands).map(([category, cmds], groupIdx) => (
            <li key={category}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px 4px',
                  fontSize: 'var(--text-xs, 12px)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                  ...(groupIdx > 0 && { borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` })
                }}
              >
                <span>{categoryLabels[category]?.icon || '📋'}</span>
                <span>{categoryLabels[category]?.label || category}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
                  ({cmds.length})
                </span>
              </div>

              {cmds.map((cmd, idx) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <li key={cmd.id}>
                    <CommandItem
                      cmd={cmd}
                      globalIndex={globalIndex}
                      isSelected={isSelected}
                      isDark={isDark}
                      onSelect={setSelectedIndex}
                      onExecute={(executedCmd) => {
                        addToHistory(executedCmd.id);
                        executedCmd.action();
                        onClose();
                      }}
                    />
                  </li>
                );
              })}
            </li>
          ))}

          {filteredCommands.length === 0 && (
            <li
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                fontSize: 'var(--text-sm, 14px)'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
              未找到匹配的命令
            </li>
          )}
        </ul>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            fontSize: 'var(--text-xs, 12px)',
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
          }}
        >
          <span>↑↓ 导航 · ↵ 执行</span>
          <span>共 {filteredCommands.length} 条结果</span>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
export type { Command, CommandPaletteProps };
