import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import {
  useCastSandboxStore,
  type SandboxedScript,
  type SandboxPolicy,
  type SandboxExecutionResult,
  type ExecutionLog
} from '../../store/useCastSandboxStore';
import {
  castSandbox,
  SANDBOX_POLICIES,
  type DangerousPattern
} from '../../utils/cast/cast-sandbox';
import '../../styles/sandbox.css';

type ResultTab = 'stdout' | 'stderr';

interface CustomPolicyModalProps {
  isOpen: boolean;
  currentPolicy: SandboxPolicy;
  onClose: () => void;
  onSave: (policy: Partial<SandboxPolicy>) => void;
}

const CustomPolicyModal: React.FC<CustomPolicyModalProps> = memo(({
  isOpen,
  currentPolicy,
  onClose,
  onSave
}) => {
  const [localPolicy, setLocalPolicy] = useState<SandboxPolicy>(currentPolicy);

  useEffect(() => {
    if (isOpen) {
      setLocalPolicy(currentPolicy);
    }
  }, [isOpen, currentPolicy]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localPolicy);
    onClose();
  };

  return (
    <div className="cast-sandbox-modal-overlay" onClick={onClose}>
      <div className="cast-sandbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cast-sandbox-modal-header">
          <h3>自定义安全策略</h3>
          <button className="cast-sandbox-btn-close" onClick={onClose}>x</button>
        </div>
        <div className="cast-sandbox-modal-body">
          <div className="cast-sandbox-policy-grid">
            <label className="cast-sandbox-policy-label">
              <span>安全级别</span>
              <select
                value={localPolicy.level}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({
                    ...prev,
                    level: e.target.value as SandboxPolicy['level']
                  }))
                }
              >
                <option value="sandboxed">沙箱隔离</option>
                <option value="restricted">受限模式</option>
                <option value="full_access">完全访问</option>
              </select>
            </label>

            <label className="cast-sandbox-policy-label">
              <span>最大执行时间 (ms)</span>
              <input
                type="number"
                value={localPolicy.maxExecutionTime}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({
                    ...prev,
                    maxExecutionTime: Math.max(1000, parseInt(e.target.value) || 30000)
                  }))
                }
                min={1000}
                max={300000}
                step={1000}
              />
            </label>

            <label className="cast-sandbox-policy-label">
              <span>内存上限 (MB)</span>
              <input
                type="number"
                value={localPolicy.maxMemoryMB}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({
                    ...prev,
                    maxMemoryMB: Math.max(16, parseInt(e.target.value) || 128)
                  }))
                }
                min={16}
                max={2048}
              />
            </label>

            <label className="cast-sandbox-policy-label">
              <span>输出大小限制 (bytes)</span>
              <input
                type="number"
                value={localPolicy.maxOutputSize}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({
                    ...prev,
                    maxOutputSize: Math.max(1024, parseInt(e.target.value) || 1048576)
                  }))
                }
                min={1024}
                max={10485760}
              />
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowNetwork}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowNetwork: e.target.checked }))
                }
              />
              <span>允许网络请求</span>
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowFileRead}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowFileRead: e.target.checked }))
                }
              />
              <span>允许读取文件</span>
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowFileWrite}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowFileWrite: e.target.checked }))
                }
              />
              <span>允许写入文件</span>
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowExecute}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowExecute: e.target.checked }))
                }
              />
              <span>允许执行命令</span>
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowEnvAccess}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowEnvAccess: e.target.checked }))
                }
              />
              <span>允许环境变量访问</span>
            </label>

            <label className="cast-sandbox-policy-toggle">
              <input
                type="checkbox"
                checked={localPolicy.allowClipboard}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({ ...prev, allowClipboard: e.target.checked }))
                }
              />
              <span>允许剪贴板访问</span>
            </label>

            <label className="cast-sandbox-policy-label full-width">
              <span>网络白名单 (逗号分隔)</span>
              <input
                type="text"
                value={localPolicy.allowedDomains.join(', ')}
                onChange={(e) =>
                  setLocalPolicy((prev: SandboxPolicy) => ({
                    ...prev,
                    allowedDomains: e.target.value
                      .split(',')
                      .map((d) => d.trim())
                      .filter(Boolean)
                  }))
                }
                placeholder="example.com, api.example.com"
              />
            </label>
          </div>
        </div>
        <div className="cast-sandbox-modal-footer">
          <button className="cast-sandbox-btn-secondary" onClick={onClose}>取消</button>
          <button className="cast-sandbox-btn-primary" onClick={handleSave}>保存策略</button>
        </div>
      </div>
    </div>
  );
});

CustomPolicyModal.displayName = 'CustomPolicyModal';

const SandboxPanel: React.FC = () => {
  const {
    scripts,
    currentScriptId,
    currentPolicy,
    executionHistory,
    isExecuting,
    lastResult,
    saveScript,
    updateScript,
    deleteScript,
    selectScript,
    executeCurrentScript,
    stopExecution,
    updatePolicy,
    setPresetPolicy,
    getHistory,
    clearHistory,
    exportHistory,
    loadFromStorage
  } = useCastSandboxStore();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<SandboxedScript['language']>('javascript');
  const [scriptName, setScriptName] = useState('未命名脚本');
  const [contextInput, setContextInput] = useState('{}');
  const [resultTab, setResultTab] = useState<ResultTab>('stdout');
  const [showCustomPolicy, setShowCustomPolicy] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [dangerPatterns, setDangerPatterns] = useState<DangerousPattern[]>([]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (currentScriptId) {
      const script = scripts.find((s) => s.id === currentScriptId);
      if (script) {
        setCode(script.code);
        setLanguage(script.language);
        setScriptName(script.name);
      }
    }
  }, [currentScriptId, scripts]);

  const detectCodeIssues = useCallback((codeText: string) => {
    const patterns = castSandbox.detectDangerousPatterns(codeText);
    setDangerPatterns(patterns);
    return patterns;
  }, []);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      detectCodeIssues(newCode);

      if (currentScriptId) {
        updateScript(currentScriptId, { code: newCode });
      }
    },
    [currentScriptId, updateScript, detectCodeIssues]
  );

  const handleExecute = useCallback(async () => {
    let scriptId = currentScriptId;

    if (!scriptId) {
      scriptId = saveScript({
        name: scriptName,
        language,
        code,
        permissions: []
      });
      selectScript(scriptId);
    } else {
      updateScript(scriptId, { name: scriptName, language, code });
    }

    try {
      const contextData = JSON.parse(contextInput || '{}');
      await executeCurrentScript(contextData);
    } catch {
      await executeCurrentScript({});
    }
  }, [
    code,
    contextInput,
    currentScriptId,
    executeCurrentScript,
    language,
    saveScript,
    scriptName,
    selectScript,
    updateScript
  ]);

  const handleStop = useCallback(() => {
    stopExecution();
  }, [stopExecution]);

  const handleCopyOutput = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const handlePresetChange = useCallback(
    (preset: 'strict' | 'balanced' | 'permissive') => {
      setPresetPolicy(preset);
    },
    [setPresetPolicy]
  );

  const formatTime = useCallback((ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }, []);

  const totalExecutions = useMemo(
    () => scripts.reduce((sum, s) => sum + s.executionCount, 0),
    [scripts]
  );

  const recentHistory = useMemo(() => getHistory(10), [getHistory]);

  const dangerWarnings = useMemo(
    () => dangerPatterns.filter((p) => p.severity === 'warning'),
    [dangerPatterns]
  );
  const dangerErrors = useMemo(
    () => dangerPatterns.filter((p) => p.severity === 'danger'),
    [dangerPatterns]
  );

  const isBackendRequired = language !== 'javascript';

  return (
    <div className="cast-sandbox-container">
      <div className="cast-sandbox-header">
        <div className="cast-sandbox-title-row">
          <span className="cast-sandbox-icon">lock</span>
          <h2>Cast 沙箱执行环境</h2>
        </div>

        <div className="cast-sandbox-controls-row">
          <div className="cast-sandbox-control-group">
            <label className="cast-sandbox-label">安全级别:</label>
            <select
              className="cast-sandbox-select"
              value={
                Object.entries(SANDBOX_POLICIES).find(
                  ([, p]) =>
                    p.level === currentPolicy.level &&
                    p.maxExecutionTime === currentPolicy.maxExecutionTime
                )?.[0] || 'custom'
              }
              onChange={(e) => handlePresetChange(e.target.value as 'strict' | 'balanced' | 'permissive')}
            >
              <option value="strict">严格</option>
              <option value="balanced">均衡</option>
              <option value="permissive">宽松</option>
              <option value="custom" disabled>自定义</option>
            </select>

            <button
              className="cast-sandbox-btn-outline"
              onClick={() => setShowCustomPolicy(true)}
            >
              自定义策略+
            </button>
          </div>
        </div>
      </div>

      <div className="cast-sandbox-toolbar">
        <div className="cast-sandbox-toolbar-left">
          <label className="cast-sandbox-label">语言:</label>
          <select
            className="cast-sandbox-select"
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value as SandboxedScript['language'])
            }
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python (需后端)</option>
            <option value="shell">Shell (需后端)</option>
            <option value="sql">SQL (需后端)</option>
            <option value="custom">Custom (需后端)</option>
          </select>

          {isBackendRequired && (
            <span className="cast-sandbox-badge-warning">需 Go 后端支持</span>
          )}
        </div>

        <div className="cast-sandbox-toolbar-right">
          <input
            type="text"
            className="cast-sandbox-input-name"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            placeholder="脚本名称"
          />
        </div>
      </div>

      <div className="cast-sandbox-editor-section">
        <div className="cast-sandbox-editor-header">
          <span>代码编辑器</span>
          <span className="cast-sandbox-line-count">
            {code.split('\n').length} 行
          </span>
        </div>
        <textarea
          className="cast-sandbox-code-editor"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="// 在此输入代码...
// 可用变量: console, Math, Date, JSON 等
function example() {
  console.log('Hello from sandbox!');
  return { result: true };
}"
          spellCheck={false}
        />
      </div>

      <div className="cast-sandbox-context-section">
        <label className="cast-sandbox-label">上下文数据 (JSON):</label>
        <div className="cast-sandbox-context-row">
          <textarea
            className="cast-sandbox-context-input"
            value={contextInput}
            onChange={(e) => setContextInput(e.target.value)}
            placeholder='{"key": "value"}'
            rows={1}
            spellCheck={false}
          />

          <button
            className={`cast-sandbox-btn-execute ${isExecuting ? 'running' : ''}`}
            onClick={handleExecute}
            disabled={isExecuting}
          >
            {isExecuting ? '执行中...' : '执行'}
          </button>

          <button
            className="cast-sandbox-btn-stop"
            onClick={handleStop}
            disabled={!isExecuting}
          >
            停止
          </button>
        </div>
      </div>

      {(dangerPatterns.length > 0 || lastResult) && (
        <div className="cast-sandbox-result-section">
          {lastResult && (
            <>
              <div className="cast-sandbox-result-header">
                <span className={`cast-sandbox-result-status ${lastResult.success ? 'success' : 'error'}`}>
                  {lastResult.success ? 'ok' : 'x'}{' '}
                  {lastResult.success ? '执行成功' : '执行失败'}
                </span>
                <span className="cast-sandbox-result-meta">
                  用时 {formatTime(lastResult.executionTime)}
                  {lastResult.memoryUsed && ` · 内存 ${(lastResult.memoryUsed / 1024 / 1024).toFixed(1)}MB`}
                  {lastResult.timedOut && ' · 超时'}
                  {lastResult.killed && ' · 已终止'}
                </span>
              </div>

              <div className="cast-sandbox-tabs">
                <button
                  className={`cast-sandbox-tab ${resultTab === 'stdout' ? 'active' : ''}`}
                  onClick={() => setResultTab('stdout')}
                >
                  stdout {lastResult.stdout ? `(${lastResult.stdout.length})` : ''}
                </button>
                <button
                  className={`cast-sandbox-tab ${resultTab === 'stderr' ? 'active' : ''}`}
                  onClick={() => setResultTab('stderr')}
                >
                  stderr {lastResult.stderr ? `(${lastResult.stderr.length})` : ''}
                </button>
                <button
                  className="cast-sandbox-tab-copy"
                  onClick={() =>
                    handleCopyOutput(resultTab === 'stdout' ? lastResult.stdout : lastResult.stderr)
                  }
                >
                  复制
                </button>
              </div>

              <pre className="cast-sandbox-output">
                {resultTab === 'stdout'
                  ? lastResult.stdout || '(空)'
                  : lastResult.stderr || '(空)'}
              </pre>

              {lastResult.warnings && lastResult.warnings.length > 0 && (
                <div className="cast-sandbox-warnings">
                  <strong>警告:</strong>
                  <ul>
                    {lastResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {dangerPatterns.length > 0 && (
            <div className="cast-sandbox-security-warnings">
              <div className="cast-sandbox-security-header">
                <span className={`cast-sandbox-security-icon ${dangerErrors.length > 0 ? 'danger' : 'warning'}`}>
                  {dangerErrors.length > 0 ? '!' : '!'}
                </span>
                <span>
                  安全检测: 发现 {dangerPatterns.length} 个问题 (
                  {dangerErrors.length > 0 ? `${dangerErrors.length} 危险` : '无危险'},{' '}
                  {dangerWarnings.length} 警告)
                </span>
              </div>
              <ul className="cast-ssecurity-pattern-list">
                {dangerPatterns.map((pattern, idx) => (
                  <li
                    key={idx}
                    className={`cast-ssecurity-pattern-item ${pattern.severity}`}
                  >
                    <span className="pattern-type">[{pattern.type}]</span>
                    <span className="pattern-desc">{pattern.description}</span>
                    <span className="pattern-line">行 {pattern.line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="cast-sandbox-history-section">
        <div
          className="cast-sandbox-history-header"
          onClick={() => setShowHistory(!showHistory)}
        >
          <span>{showHistory ? '-' : '+'} 执行历史</span>
          <div className="cast-sandbox-history-actions">
            <span className="cast-sandbox-history-count">
              最近 {Math.min(recentHistory.length, 10)} 次
            </span>
            <button
              className="cast-sandbox-btn-small"
              onClick={(e) => {
                e.stopPropagation();
                clearHistory();
              }}
            >
              清空
            </button>
            <button
              className="cast-sandbox-btn-small"
              onClick={(e) => {
                e.stopPropagation();
                exportHistory();
              }}
            >
              导出日志
            </button>
          </div>
        </div>

        {showHistory && recentHistory.length > 0 && (
          <div className="cast-sandbox-history-list">
            {recentHistory.slice(0, 10).map((log) => (
              <div key={log.id} className="cast-sandbox-history-item">
                <div className="cast-sandbox-history-main">
                  <span
                    className={`cast-sandbox-status-dot ${log.result.success ? 'success' : 'error'}`}
                  />
                  <span className="cast-sandbox-history-name">{log.scriptName}</span>
                  <span className="cast-sandbox-history-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <span className="cast-sandbox-history-meta">
                  {formatTime(log.result.executionTime)} ·{' '}
                  {log.triggeredBy}
                </span>
              </div>
            ))}
          </div>
        )}

        {showHistory && recentHistory.length === 0 && (
          <div className="cast-sandbox-history-empty">暂无执行记录</div>
        )}
      </div>

      <div className="cast-sandbox-footer">
        <div className="cast-sandbox-stats">
          <span>当前活跃执行: {isExecuting ? 1 : 0}</span>
          <span className="cast-sandbox-sep">|</span>
          <span>总执行次数: {totalExecutions}</span>
          <span className="cast-sandbox-sep">|</span>
          <span>已保存脚本: {scripts.length}</span>
        </div>
      </div>

      <CustomPolicyModal
        isOpen={showCustomPolicy}
        currentPolicy={currentPolicy}
        onClose={() => setShowCustomPolicy(false)}
        onSave={(updates) => {
          updatePolicy(updates);
        }}
      />
    </div>
  );
};

export default memo(SandboxPanel);
