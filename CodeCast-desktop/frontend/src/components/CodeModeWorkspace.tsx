import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../store';
import TerminalPanel, { TerminalHandle } from './TerminalPanel';
import DiffView from './DiffView';
import AgentLoopEngine from './AgentLoopEngine';
import GitWorkflow from './GitWorkflow';
import TestVisualizer from './TestVisualizer';
import AutoFixPipeline from './AutoFixPipeline';
import * as api from '../api';

type WorkspaceTab = 'terminal' | 'diff' | 'agent' | 'files' | 'git' | 'tests' | 'autofix';

interface CodeModeWorkspaceProps {
  visible?: boolean;
  mode?: 'coding' | 'daily';
}

const isWindows = navigator.userAgent.includes('Windows');

const CodeModeWorkspace: React.FC<CodeModeWorkspaceProps> = ({
  visible = true,
  mode = 'coding'
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('terminal');
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [showWorkspace, setShowWorkspace] = useState(true);
  
  const terminalRef = useRef<TerminalHandle>(null);
  const agentLoopRef = useRef<{
    startLoop: (task: string) => Promise<void>;
    stopLoop: () => void;
    getState: () => any;
  }>(null);

  const [diffData, setDiffData] = useState({
    original: '',
    modified: '',
    fileName: '',
    language: ''
  });

  const currentProject = useAppStore((s) => s.currentProject);

  useEffect(() => {
    if (mode === 'coding') {
      setActiveTab('terminal');
      setShowWorkspace(true);
    }
  }, [mode]);

  const handleCommandComplete = useCallback((result: {
    command: string;
    output: string;
    success: boolean;
  }) => {
    console.log('[CodeMode] Command completed:', result.command, result.success ? '✓' : '✗');

    if (result.command.includes('git diff') || result.command.includes('diff')) {
      loadFileDiff();
    }

    if (result.command.includes('npm test') && !result.success) {
      if (agentLoopRef.current) {
        agentLoopRef.current.startLoop(`修复测试失败: ${result.output.slice(0, 200)}`);
      }
    }
  }, []);

  const loadFileDiff = useCallback(async () => {
    try {
      const gitStatus = await api.getGitStatus();
      
      if (gitStatus && gitStatus.files && gitStatus.files.length > 0) {
        const changedFile = gitStatus.files[0];
        
        try {
          const originalContent = await api.readFileContent(changedFile.path);
          setDiffData(prev => ({
            ...prev,
            original: originalContent,
            modified: originalContent + '\n// 新增代码',
            fileName: changedFile.path,
            language: getLanguageFromFileName(changedFile.path)
          }));
          setActiveTab('diff');
        } catch (error) {
          console.error('Failed to load file for diff:', error);
        }
      }
    } catch (error) {
      console.error('Failed to get git status:', error);
    }
  }, []);

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      css: 'css',
      html: 'html',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash'
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const handleAcceptDiff = useCallback((content: string) => {
    console.log('[CodeMode] Accepting diff changes');

    if (terminalRef.current && diffData.fileName) {
      terminalRef.current.executeCommand(`echo "已接受 ${diffData.fileName} 的更改"`);
    }
  }, [diffData.fileName]);

  const handleRejectDiff = useCallback(() => {
    console.log('[CodeMode] Rejecting diff changes');
    
    if (terminalRef.current && diffData.fileName) {
      terminalRef.current.executeCommand(`echo "已拒绝 ${diffData.fileName} 的更改"`);
      terminalRef.current.executeCommand(`git checkout -- "${diffData.fileName}"`);
    }
  }, [diffData.fileName]);

  const quickCommands = [
    { icon: '🔨', label: '构建', command: 'npm run build' },
    { icon: '🧪', label: '测试', command: isWindows ? 'npm test -- --watchAll=false' : 'npm test' },
    { icon: '✨', label: 'Lint', command: isWindows ? 'npx eslint . --ext .ts,.tsx' : 'npx eslint .' },
    { icon: '📦', label: '安装依赖', command: 'npm install' },
    { icon: '�', label: 'Git 状态', action: () => setActiveTab('git') },
    { icon: '📊', label: 'Diff', action: () => { loadFileDiff(); setActiveTab('diff'); } },
    { icon: '🧪', label: '测试面板', action: () => setActiveTab('tests') },
    { icon: '🤖', label: '自动修复', action: () => setActiveTab('autofix') },
    { icon: '⚡', label: '启动 Agent', action: () => setActiveTab('agent') },
    { icon: '🔍', label: '查看变更', action: () => { loadFileDiff(); setActiveTab('diff'); } }
  ];

  if (!visible || mode !== 'coding') return null;

  return (
    <div className={`code-mode-workspace ${showWorkspace ? 'visible' : 'collapsed'}`}>
      <div className="workspace-header">
        <div className="workspace-title">
          <span className="title-icon">⚡</span>
          <h3>Code 工作台</h3>
          {currentProject && (
            <span className="project-badge">
              📁 {currentProject}
            </span>
          )}
        </div>

        <div className="workspace-tabs">
          {([
            { key: 'terminal' as WorkspaceTab, icon: '💻', label: '终端' },
            { key: 'git' as WorkspaceTab, icon: '🔀', label: 'Git' },
            { key: 'tests' as WorkspaceTab, icon: '🧪', label: '测试' },
            { key: 'autofix' as WorkspaceTab, icon: '🤖', label: '修复' },
            { key: 'diff' as WorkspaceTab, icon: '📝', label: 'Diff' },
            { key: 'agent' as WorkspaceTab, icon: '⚡', label: 'Agent' },
            { key: 'files' as WorkspaceTab, icon: '📂', label: '文件' }
          ]).map(tab => (
            <button
              key={tab.key}
              className={`workspace-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          className="toggle-workspace"
          onClick={() => setShowWorkspace(!showWorkspace)}
          title={showWorkspace ? '收起工作台' : '展开工作台'}
        >
          {showWorkspace ? '▼' : '▲'}
        </button>
      </div>

      {showWorkspace && (
        <>
          <div className="quick-actions">
            {quickCommands.map((cmd, idx) => (
              <button
                key={idx}
                className="quick-action-btn"
                onClick={() => {
                  if (cmd.command && terminalRef.current) {
                    terminalRef.current.executeCommand(cmd.command);
                    setActiveTab('terminal');
                  }
                  if (cmd.action) {
                    cmd.action();
                  }
                }}
                title={cmd.label}
              >
                <span className="action-icon">{cmd.icon}</span>
                <span className="action-label">{cmd.label}</span>
              </button>
            ))}
          </div>

          <div 
            className="workspace-content"
            style={{ height: `${terminalHeight}px` }}
          >
            {activeTab === 'terminal' && (
              <TerminalPanel
                ref={terminalRef}
                onCommandComplete={handleCommandComplete}
                initialCwd={undefined}
                height="100%"
              />
            )}

            {activeTab === 'git' && (
              <div className="git-container" style={{ height: '100%', overflow: 'auto' }}>
                <GitWorkflow
                  onCommandExecute={(cmd) => terminalRef.current?.executeCommand(cmd)}
                  onFileChange={(filePath) => {
                    console.log('[CodeMode] Git file changed:', filePath);
                    if (terminalRef.current) {
                      terminalRef.current.executeCommand(`echo "文件已更新: ${filePath}"`);
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="tests-container" style={{ height: '100%', overflow: 'auto' }}>
                <TestVisualizer
                  onCommandExecute={(cmd) => terminalRef.current?.executeCommand(cmd)}
                  onFileOpen={(filePath, line) => {
                    console.log('[CodeMode] Open test file:', filePath, line);
                  }}
                />
              </div>
            )}

            {activeTab === 'autofix' && (
              <div className="autofix-container" style={{ height: '100%', overflow: 'auto' }}>
                <AutoFixPipeline
                  onCommandExecute={(cmd) => terminalRef.current?.executeCommand(cmd)}
                  onFileChange={(filePath) => {
                    console.log('[CodeMode] Auto-fix file changed:', filePath);
                    loadFileDiff();
                  }}
                />
              </div>
            )}

            {activeTab === 'diff' && (
              <div className="diff-container" style={{ height: '100%', overflow: 'auto' }}>
                {diffData.original && diffData.modified ? (
                  <DiffView
                    originalContent={diffData.original}
                    modifiedContent={diffData.modified}
                    fileName={diffData.fileName}
                    language={diffData.language}
                    onAccept={handleAcceptDiff}
                    onReject={handleRejectDiff}
                  />
                ) : (
                  <div className="empty-diff">
                    <div className="empty-icon">📝</div>
                    <p>暂无文件变更</p>
                    <p className="hint">执行 Git 操作或修改文件后，变更将在此显示</p>
                    <button onClick={loadFileDiff}>
                      刷新变更状态
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'agent' && (
              <div className="agent-container" style={{ height: '100%', overflow: 'auto' }}>
                <AgentLoopEngine
                  ref={agentLoopRef}
                  terminalRef={terminalRef}
                  config={{
                    maxTurns: 10,
                    autoFixErrors: true,
                    runTests: true,
                    runLint: true,
                    verificationSteps: ['check_lint', 'run_tests']
                  }}
                  onLoopComplete={(state) => {
                    console.log('[CodeMode] Agent loop completed:', state);
                    
                    if (state.status === 'completed') {
                      setTimeout(() => {
                        loadFileDiff();
                        setActiveTab('diff');
                      }, 1000);
                    }
                  }}
                  onTurnComplete={(result) => {
                    console.log(`[CodeMode] Turn #${result.turnNumber}:`, result.action, result.success ? '✓' : '✗');
                  }}
                  onError={(error) => {
                    console.error('[CodeMode] Agent error:', error);
                  }}
                />
              </div>
            )}

            {activeTab === 'files' && (
              <div className="files-container" style={{ height: '100%', padding: '16px' }}>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>
                  📂 文件浏览器功能开发中...
                </p>
              </div>
            )}
          </div>

          <div
            className="resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = terminalHeight;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const delta = startY - moveEvent.clientY;
                const newHeight = Math.max(200, Math.min(600, startHeight + delta));
                setTerminalHeight(newHeight);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        </>
      )}
    </div>
  );
};

export default CodeModeWorkspace;
