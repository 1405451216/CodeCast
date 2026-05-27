import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as api from '../api';

export interface TerminalSession {
  id: string;
  title: string;
  cwd?: string;
  history: TerminalLine[];
  running: boolean;
  exitCode?: number;
  createdAt: number;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'success';
  content: string;
  timestamp: number;
}

export interface TerminalHandle {
  executeCommand: (command: string) => void;
  clearTerminal: () => void;
  getSessionInfo: () => TerminalSession | null;
}

interface TerminalPanelProps {
  visible?: boolean;
  onCommandComplete?: (result: { command: string; output: string; success: boolean }) => void;
  initialCwd?: string;
  height?: string;
  theme?: 'light' | 'dark';
}

const TerminalPanel = forwardRef<TerminalHandle, TerminalPanelProps>(({
  visible = true,
  onCommandComplete,
  initialCwd,
  height = '300px',
  theme = 'dark'
}, ref) => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (visible && activeSessionId) {
      createNewSession();
    }
  }, [visible]);

  useImperativeHandle(ref, () => ({
    executeCommand: (command: string) => {
      if (command.trim()) {
        setCurrentInput(command);
        setTimeout(() => handleExecute(command), 0);
      }
    },
    clearTerminal: () => {
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, history: [] } : s
        ));
      }
    },
    getSessionInfo: () => {
      return sessions.find(s => s.id === activeSessionId) || null;
    }
  }), [activeSessionId]);

  const createNewSession = useCallback(() => {
    const newSession: TerminalSession = {
      id: `terminal-${Date.now()}`,
      title: `终端 #${sessions.length + 1}`,
      cwd: initialCwd,
      history: [],
      running: false,
      createdAt: Date.now()
    };

    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);

    addSystemLine(newSession.id, `🚀 新终端会话已创建${initialCwd ? ` (工作目录: ${initialCwd})` : ''}`);
  }, [initialCwd, sessions.length]);

  const addSystemLine = useCallback((sessionId: string, content: string) => {
    const line: TerminalLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      type: 'system',
      content,
      timestamp: Date.now()
    };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, history: [...s.history, line] } : s
    ));
  }, []);

  const addOutputLine = useCallback((sessionId: string, type: 'output' | 'error' | 'success', content: string) => {
    const line: TerminalLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      type,
      content,
      timestamp: Date.now()
    };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, history: [...s.history, line] } : s
    ));
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const handleExecute = useCallback(async (command: string) => {
    if (!command.trim() || !activeSessionId || isExecuting) return;

    const inputLine: TerminalLine = {
      id: `line-${Date.now()}-input`,
      type: 'input',
      content: command,
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, history: [...s.history, inputLine], running: true }
        : s
    ));

    setCurrentInput('');
    setIsExecuting(true);
    scrollToBottom();

    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    try {
      addSystemLine(activeSessionId, '⏳ 执行中...');

      const result = await api.executeCommand(command, 30);

      setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;

        const filteredHistory = s.history.filter(line => line.content !== '⏳ 执行中...');

        if (result.includes('Error') || result.includes('error') || result.includes('Exception')) {
          return {
            ...s,
            history: [...filteredHistory, {
              id: `line-${Date.now()}-error`,
              type: 'error' as const,
              content: result,
              timestamp: Date.now()
            }],
            running: false
          };
        }

        return {
          ...s,
          history: [...filteredHistory, {
            id: `line-${Date.now()}-output`,
            type: 'output' as const,
            content: result || '(无输出)',
            timestamp: Date.now()
          }],
          running: false
        };
      }));

      onCommandComplete?.({
        command,
        output: result,
        success: !result.toLowerCase().includes('error')
      });

      addSystemLine(activeSessionId, '✅ 执行完成');

    } catch (error: any) {
      const errorMsg = error?.message || '命令执行失败';
      
      setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId) return s;
        
        const filteredHistory = s.history.filter(line => line.content !== '⏳ 执行中...');
        
        return {
          ...s,
          history: [...filteredHistory, {
            id: `line-${Date.now()}-error`,
            type: 'error' as const,
            content: `❌ ${errorMsg}`,
            timestamp: Date.now()
          }],
          running: false
        };
      }));

      onCommandComplete?.({
        command,
        output: errorMsg,
        success: false
      });
    } finally {
      setIsExecuting(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [activeSessionId, isExecuting, onCommandComplete, scrollToBottom, addSystemLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute(currentInput);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
      return;
    }

    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, history: [] } : s
        ));
        addSystemLine(activeSessionId, '🧹 终端已清空');
      }
      return;
    }

    if (e.key === 'c' && e.ctrlKey && currentInput === '') {
      e.preventDefault();
      addSystemLine(activeSessionId, '^C');
      setIsExecuting(false);
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, running: false } : s
      ));
      return;
    }
  }, [currentInput, handleExecute, commandHistory, historyIndex, activeSessionId, addSystemLine]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  if (!visible) return null;

  return (
    <div className={`terminal-panel ${theme}`} style={{ height }}>
      <div className="terminal-header">
        <div className="terminal-tabs">
          {sessions.map(session => (
            <button
              key={session.id}
              className={`terminal-tab ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span className={`tab-indicator ${session.running ? 'running' : ''}`} />
              <span className="tab-title">{session.title}</span>
              {sessions.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessions(prev => prev.filter(s => s.id !== session.id));
                    if (session.id === activeSessionId && sessions.length > 1) {
                      const remaining = sessions.filter(s => s.id !== session.id);
                      setActiveSessionId(remaining[remaining.length - 1].id);
                    }
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="terminal-tab new-tab" onClick={createNewSession}>
            +
          </button>
        </div>

        <div className="terminal-actions">
          <button
            className={`terminal-btn ${isExecuting ? 'executing' : ''}`}
            disabled={isExecuting}
            onClick={() => activeSessionId && setSessions(prev => prev.map(s =>
              s.id === activeSessionId ? { ...s, history: [] } : s
            ))}
            title="清空终端 (Ctrl+L)"
          >
            🗑️
          </button>
          <button
            className="terminal-btn"
            onClick={() => {
              navigator.clipboard.writeText(
                activeSession?.history
                  .filter(l => l.type !== 'system')
                  .map(l => l.content)
                  .join('\n') || ''
              );
            }}
            title="复制全部输出"
          >
            📋
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {activeSession?.history.map((line) => (
          <div key={line.id} className={`terminal-line terminal-${line.type}`}>
            {line.type === 'input' && (
              <>
                <span className="prompt">$ </span>
                <span className="line-content">{line.content}</span>
              </>
            )}
            {line.type !== 'input' && (
              <pre className="line-content">{line.content}</pre>
            )}
          </div>
        ))}

        {!activeSession && (
          <div className="terminal-line terminal-system">
            点击 + 号或输入命令开始...
          </div>
        )}
      </div>

      <div className="terminal-input-container">
        <span className="prompt-symbol">$</span>
        <textarea
          ref={inputRef}
          className="terminal-input"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isExecuting ? '执行中...' : '输入命令...'}
          disabled={isExecuting}
          rows={1}
          spellCheck={false}
          autoFocus
        />
        {isExecuting && <span className="executing-indicator">⏳</span>}
      </div>

      <div className="terminal-statusbar">
        <span className="status-item">
          {activeSession?.running ? '🔄 运行中' : '✅ 就绪'}
        </span>
        <span className="status-item">
          会话: {sessions.length}
        </span>
        <span className="status-item">
          历史命令: {commandHistory.length}
        </span>
      </div>
    </div>
  );
});

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
