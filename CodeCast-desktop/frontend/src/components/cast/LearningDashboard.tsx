import React, { useState, useEffect, useCallback, memo } from 'react';
import { useCastLearningStore } from '../../store/useCastLearningStore';
import type { CompositeSkill, OperationLogEntry, PatternMatch } from '../../types/cast-learning';

interface LearningDashboardProps {
  className?: string;
}

const LearningDashboard: React.FC<LearningDashboardProps> = memo(({ className = '' }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [executingSkillId, setExecutingSkillId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [importText, setImportText] = useState('');

  const {
    isLearningEnabled,
    stats,
    insights,
    patterns,
    compositeSkills,
    selectedSkillId,
    operationLogs,
    toggleLearning,
    runPatternDetection,
    autoGenerateSkills,
    enableSkill,
    disableSkill,
    approveSkill,
    rejectSkill,
    deleteSkill,
    executeSkill,
    selectSkill,
    recordFeedback,
    refreshStats,
    getInsights,
    exportData,
    importData,
    clearAll,
    loadFromStorage
  } = useCastLearningStore();

  useEffect(() => {
    loadFromStorage();
    getInsights();
  }, [loadFromStorage, getInsights]);

  const handleDetectPatterns = useCallback(() => {
    runPatternDetection();
    getInsights();
  }, [runPatternDetection, getInsights]);

  const handleGenerateSkills = useCallback(() => {
    autoGenerateSkills();
    refreshStats();
  }, [autoGenerateSkills, refreshStats]);

  const handleExecuteSkill = useCallback(async (skillId: string) => {
    if (!testInput.trim()) {
      setExecutionResult('请输入测试内容');
      return;
    }

    setExecutingSkillId(skillId);
    setExecutionResult(null);

    try {
      const result = await executeSkill(skillId, testInput);
      setExecutionResult(Array.isArray(result) ? result.join('\n---\n') : JSON.stringify(result, null, 2));
    } catch (error: any) {
      setExecutionResult(`执行失败: ${error.message}`);
    } finally {
      setExecutingSkillId(null);
    }
  }, [testInput, executeSkill]);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cast-learning-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  }, [exportData]);

  const handleImport = useCallback(() => {
    if (importText.trim()) {
      const result = importData(importText);
      alert(`导入完成: ${result.logsImported} 条日志, ${result.skillsImported} 个技能`);
      setImportText('');
      setShowExportDialog(false);
    }
  }, [importText, importData]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('确定要清空所有学习数据吗？此操作不可恢复。')) {
      clearAll();
    }
  }, [clearAll]);

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const learningProgress = Math.min(100, Math.round(
    ((stats.totalPatternsDetected * 10 + stats.totalSkillsGenerated * 20 + stats.activeSkillsCount * 15) /
    Math.max(1, stats.totalOperationsLogged / 100)) * 100
  ));

  return (
    <div className={`cast-learning-dashboard ${className}`}>
      <div className="cast-learning-header">
        <h2 className="cast-learning-title">Cast Learning Center</h2>
        <div className="cast-learning-controls">
          <button
            className={`cast-learning-toggle ${isLearningEnabled ? 'enabled' : 'disabled'}`}
            onClick={toggleLearning}
          >
            {isLearningEnabled ? 'ON' : 'OFF'}
          </button>
          <button className="cast-learning-btn primary" onClick={handleDetectPatterns}>
            Detect Patterns
          </button>
          <button className="cast-learning-btn secondary" onClick={handleGenerateSkills}>
            Generate Skills
          </button>
          <button className="cast-learning-btn outline" onClick={() => setShowExportDialog(true)}>
            Export/Import
          </button>
          <button className="cast-learning-btn danger" onClick={handleClearAll}>
            Clear All
          </button>
        </div>
      </div>

      <div className="cast-learning-overview">
        <div className="cast-learning-stat-card">
          <span className="cast-learning-stat-value">{stats.totalOperationsLogged.toLocaleString()}</span>
          <span className="cast-learning-stat-label">Total Operations</span>
        </div>
        <div className="cast-learning-stat-card">
          <span className="cast-learning-stat-value">{stats.totalPatternsDetected}</span>
          <span className="cast-learning-stat-label">Patterns Found</span>
        </div>
        <div className="cast-learning-stat-card">
          <span className="cast-learning-stat-value">{stats.totalSkillsGenerated}</span>
          <span className="cast-learning-stat-label">Skills Generated</span>
          <span className="cast-learning-stat-sub">{stats.activeSkillsCount} active</span>
        </div>
        <div className="cast-learning-stat-card">
          <span className="cast-learning-stat-value">+{stats.efficiencyGain.toFixed(0)}%</span>
          <span className="cast-learning-stat-label">Efficiency Gain</span>
        </div>
        <div className="cast-learning-stat-card">
          <span className="cast-learning-stat-value">{stats.dataCoverageDays}d</span>
          <span className="cast-learning-stat-label">Data Coverage</span>
        </div>
      </div>

      <div className="cast-learning-insights">
        <h3 className="cast-learning-section-title">AI Insights</h3>
        <ul className="cast-learning-insight-list">
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <li key={idx} className="cast-learning-insight-item">
                <span className="cast-learning-insight-bullet"></span>
                {insight}
              </li>
            ))
          ) : (
            <li className="cast-learning-insight-item empty">
              Collect more operations to generate insights...
            </li>
          )}
        </ul>
      </div>

      <div className="cast-learning-skills">
        <h3 className="cast-learning-section-title">
          Generated Skills
          <button className="cast-learning-small-btn" onClick={handleGenerateSkills}>
            + New Detection
          </button>
        </h3>

        <div className="cast-learning-skills-list">
          {compositeSkills.length === 0 ? (
            <div className="cast-learning-empty-state">
              No skills generated yet. Run pattern detection first.
            </div>
          ) : (
            compositeSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isSelected={selectedSkillId === skill.id}
                isExecuting={executingSkillId === skill.id}
                onSelect={() => selectSkill(selectedSkillId === skill.id ? null : skill.id)}
                onEnable={() => enableSkill(skill.id)}
                onDisable={() => disableSkill(skill.id)}
                onApprove={() => approveSkill(skill.id)}
                onReject={() => rejectSkill(skill.id)}
                onDelete={() => deleteSkill(skill.id)}
                onExecute={(input) => handleExecuteSkill(skill.id)}
                testInput={testInput}
                onTestInputChange={setTestInput}
                executionResult={selectedSkillId === skill.id ? executionResult : null}
              />
            ))
          )}
        </div>
      </div>

      <div className="cast-learning-logs-section">
        <h3 className="cast-learning-section-title">
          Recent Operations
          <button
            className="cast-learning-small-btn"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? 'Collapse' : `Show (${operationLogs.slice(0, 20).length})`}
          </button>
        </h3>

        {showLogs && (
          <div className="cast-learning-logs-list">
            {operationLogs.length === 0 ? (
              <div className="cast-learning-empty-state">No operations logged yet.</div>
            ) : (
              operationLogs.slice(-20).reverse().map((log) => (
                <LogEntry
                  key={log.id}
                  log={log}
                  onFeedback={(feedback) => recordFeedback(log.id, feedback)}
                  formatTime={formatTime}
                  formatDuration={formatDuration}
                />
              ))
            )}
          </div>
        )}
      </div>

      <div className="cast-learning-progress">
        <div className="cast-learning-progress-header">
          <span>Learning Progress</span>
          <span>{learningProgress}%</span>
        </div>
        <div className="cast-learning-progress-bar">
          <div
            className="cast-learning-progress-fill"
            style={{ width: `${learningProgress}%` }}
          ></div>
        </div>
        <span className="cast-learning-progress-hint">
          {learningProgress < 30 ? 'Initial learning phase...' :
           learningProgress < 60 ? 'Building patterns...' :
           learningProgress < 85 ? 'Generating skills...' :
           'Continuously evolving...'}
        </span>
      </div>

      {showExportDialog && (
        <div className="cast-learning-dialog-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="cast-learning-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Export / Import Data</h3>
            <div className="cast-learning-dialog-actions">
              <button className="cast-learning-btn primary" onClick={handleExport}>
                Export Learning Data
              </button>
            </div>
            <div className="cast-learning-import-section">
              <label>Paste JSON data to import:</label>
              <textarea
                className="cast-learning-import-textarea"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste exported JSON here..."
                rows={6}
              />
              <button
                className="cast-learning-btn secondary"
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                Import Data
              </button>
            </div>
            <button
              className="cast-learning-btn outline"
              onClick={() => setShowExportDialog(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

LearningDashboard.displayName = 'LearningDashboard';

interface SkillCardProps {
  skill: CompositeSkill;
  isSelected: boolean;
  isExecuting: boolean;
  onSelect: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onExecute: (input: string) => void;
  testInput: string;
  onTestInputChange: (value: string) => void;
  executionResult: string | null;
}

const SkillCard: React.FC<SkillCardProps> = memo(({
  skill,
  isSelected,
  isExecuting,
  onSelect,
  onEnable,
  onDisable,
  onApprove,
  onReject,
  onDelete,
  onExecute,
  testInput,
  onTestInputChange,
  executionResult
}) => {
  const statusIcon = skill.userApproved
    ? (skill.enabled ? 'active' : 'disabled')
    : 'pending';

  return (
    <div className={`cast-learning-skill-card ${statusIcon} ${isSelected ? 'selected' : ''}`}>
      <div className="cast-learning-skill-header" onClick={onSelect}>
        <span className={`cast-learning-skill-status ${statusIcon}`}></span>
        <div className="cast-learning-skill-info">
          <h4 className="cast-learning-skill-name">{skill.name}</h4>
          <p className="cast-learning-skill-description">{skill.description}</p>
          <div className="cast-learning-skill-sequence">
            {skill.triggerConditions.toolSequence.map((toolId, idx) => (
              <span key={toolId} className="cast-learning-tool-tag">
                {toolId}
                {idx < skill.triggerConditions.toolSequence.length - 1 && ' -> '}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cast-learning-skill-stats">
        <span>Used {skill.stats.timesUsed} times</span>
        <span>Saved ~{Math.round(skill.stats.avgTimeSaved / 1000)}s/use</span>
        <span>Success rate {Math.round(skill.stats.successRate * 100)}%</span>
      </div>

      <div className="cast-learning-skill-actions">
        {skill.userApproved ? (
          <>
            <button
              className={`cast-learning-action-btn ${skill.enabled ? 'running' : ''}`}
              onClick={skill.enabled ? onDisable : onEnable}
              title={skill.enabled ? 'Disable' : 'Enable'}
            >
              {skill.enabled ? 'Pause' : 'Start'}
            </button>
            <button
              className="cast-learning-action-btn edit"
              onClick={onDelete}
              title="Delete"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              className="cast-learning-action-btn approve"
              onClick={onApprove}
              title="Approve"
            >
              Approve
            </button>
            <button
              className="cast-learning-action-btn reject"
              onClick={onReject}
              title="Reject"
            >
              Reject
            </button>
          </>
        )}

        {skill.userApproved && skill.enabled && isSelected && (
          <div className="cast-learning-test-section">
            <input
              type="text"
              className="cast-learning-test-input"
              placeholder="Enter test input..."
              value={testInput}
              onChange={(e) => onTestInputChange(e.target.value)}
            />
            <button
              className={`cast-learning-action-btn execute ${isExecuting ? 'loading' : ''}`}
              onClick={() => onExecute(testInput)}
              disabled={isExecuting || !testInput.trim()}
            >
              {isExecuting ? 'Running...' : 'Test Run'}
            </button>
          </div>
        )}
      </div>

      {executionResult && isSelected && (
        <div className="cast-learning-execution-result">
          <pre>{executionResult}</pre>
        </div>
      )}
    </div>
  );
});

SkillCard.displayName = 'SkillCard';

interface LogEntryProps {
  log: OperationLogEntry;
  onFeedback: (feedback: 'positive' | 'negative') => void;
  formatTime: (ts: number) => string;
  formatDuration: (ms: number) => string;
}

const LogEntry: React.FC<LogEntryProps> = memo(({ log, onFeedback, formatTime, formatDuration }) => {
  return (
    <div className={`cast-learning-log-entry ${log.success ? 'success' : 'failed'}`}>
      <span className="cast-learning-log-time">[{formatTime(log.timestamp)}]</span>
      <span className={`cast-learning-log-status ${log.success ? 'success' : 'failed'}`}>
        {log.success ? 'OK' : 'FAIL'}
      </span>
      <span className="cast-learning-log-tool">{log.toolName}</span>
      <span className="cast-learning-log-panel">({log.sourcePanel})</span>
      <span className="cast-learning-log-duration">{formatDuration(log.executionTime)}</span>
      <div className="cast-learning-log-feedback">
        <button
          className={`cast-learning-feedback-btn ${log.userFeedback === 'positive' ? 'active' : ''}`}
          onClick={() => onFeedback('positive')}
          title="Good"
        >
          +
        </button>
        <button
          className={`cast-learning-feedback-btn negative ${log.userFeedback === 'negative' ? 'active' : ''}`}
          onClick={() => onFeedback('negative')}
          title="Bad"
        >
          -
        </button>
      </div>
      {log.error && (
        <span className="cast-learning-log-error">{log.error}</span>
      )}
    </div>
  );
});

LogEntry.displayName = 'LogEntry';

export default LearningDashboard;
