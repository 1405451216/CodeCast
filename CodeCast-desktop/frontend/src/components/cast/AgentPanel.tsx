import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useCastAgentStore } from '../../store/useCastAgentStore';
import { CAST_AGENT_TEMPLATES } from '../../utils/cast/cast-agent-planner';
import type {
  CastAgentTask,
  CastAgentStep,
  CastAgentStepStatus,
  CastAgentTemplateKey,
  CastAgentExecutionEvent
} from '../../types/cast-agent';
import '../../styles/cast-workspace.css';

const AgentPanel: React.FC = () => {
  const [goalInput, setGoalInput] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingApprovalStep, setPendingApprovalStep] = useState<CastAgentStep | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<CastAgentTask | null>(null);

  const currentTask = useCastAgentStore(s => s.currentTask);
  const isPlanning = useCastAgentStore(s => s.isPlanning);
  const isExecuting = useCastAgentStore(s => s.isExecuting);
  const isPaused = useCastAgentStore(s => s.isPaused);
  const events = useCastAgentStore(s => s.events);
  const taskHistory = useCastAgentStore(s => s.taskHistory);

  const submitGoal = useCastAgentStore(s => s.submitGoal);
  const approveStep = useCastAgentStore(s => s.approveStep);
  const rejectStep = useCastAgentStore(s => s.rejectStep);
  const pauseExecution = useCastAgentStore(s => s.pauseExecution);
  const resumeExecution = useCastAgentStore(s => s.resumeExecution);
  const cancelTask = useCastAgentStore(s => s.cancelTask);
  const retryStep = useCastAgentStore(s => s.retryStep);

  useEffect(() => {
    if (currentTask) {
      const waitingStep = currentTask.steps.find(
        s => s.status === 'waiting_approval' && !s.approvedByUser
      );
      if (waitingStep && !showApprovalDialog) {
        setPendingApprovalStep(waitingStep);
        setShowApprovalDialog(true);
      }
    }
  }, [currentTask?.steps, showApprovalDialog]);

  useEffect(() => {
    const approvalEvents = events.filter(e => e.type === 'step_waiting_approval');
    if (approvalEvents.length > 0 && currentTask) {
      const latestEvent = approvalEvents[approvalEvents.length - 1];
      const step = currentTask.steps.find(s => s.id === latestEvent.stepId);
      if (step && step.status === 'waiting_approval') {
        setPendingApprovalStep(step);
        setShowApprovalDialog(true);
      }
    }
  }, [events, currentTask]);

  const handleSubmit = useCallback(async (templateKey?: CastAgentTemplateKey) => {
    const goal = goalInput.trim();
    if (!goal) return;

    setSubmitError(null);

    try {
      await submitGoal(goal, templateKey);
      setGoalInput('');
    } catch (error: any) {
      setSubmitError(error.message || '提交失败，请重试');
      console.error('[AgentPanel] Submit failed:', error);
    }
  }, [goalInput, submitGoal]);

  const handleTemplateClick = useCallback((templateKey: CastAgentTemplateKey) => {
    const template = CAST_AGENT_TEMPLATES[templateKey];
    if (template) {
      setGoalInput(template.exampleInput);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!pendingApprovalStep) return;

    try {
      await approveStep(pendingApprovalStep.id);
      setShowApprovalDialog(false);
      setPendingApprovalStep(null);
    } catch (error: any) {
      console.error('[AgentPanel] Approve failed:', error);
    }
  }, [pendingApprovalStep, approveStep]);

  const handleReject = useCallback(() => {
    if (!pendingApprovalStep) return;

    rejectStep(pendingApprovalStep.id, '用户拒绝执行此步骤');
    setShowApprovalDialog(false);
    setPendingApprovalStep(null);
  }, [pendingApprovalStep, rejectStep]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resumeExecution();
    } else {
      pauseExecution();
    }
  }, [isPaused, pauseExecution, resumeExecution]);

  const handleCancel = useCallback(() => {
    cancelTask();
    setShowApprovalDialog(false);
    setPendingApprovalStep(null);
  }, [cancelTask]);

  const handleRetry = useCallback(async (stepId: string) => {
    try {
      await retryStep(stepId);
    } catch (error: any) {
      console.error('[AgentPanel] Retry failed:', error);
    }
  }, [retryStep]);

  const progressInfo = useMemo(() => {
    if (!currentTask) return { current: 0, total: 0, percent: 0 };
    const total = currentTask.totalSteps;
    const completed = currentTask.completedSteps;
    return {
      current: completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [currentTask]);

  const latestCompletedStep = useMemo(() => {
    if (!currentTask) return null;
    return [...currentTask.steps]
      .reverse()
      .find(s => s.status === 'completed' && s.outputResult);
  }, [currentTask]);

  const templateEntries = useMemo(
    () => Object.entries(CAST_AGENT_TEMPLATES).filter(([key]) => key !== 'custom') as Array<[CastAgentTemplateKey, typeof CAST_AGENT_TEMPLATES[CastAgentTemplateKey]]>,
    []
  );

  const hasActiveTask = currentTask && (isPlanning || isExecuting || currentTask.status === 'running');

  return (
    <div className="cast-agent-panel">
      <div className="cast-agent-header">
        <div className="cast-agent-header-title">
          <span className="cast-agent-header-icon">🤖</span>
          <h3>Cast Agent 智能助手</h3>
        </div>
        {(isPlanning || isExecuting) && (
          <div className={`cast-agent-status-badge ${isPlanning ? 'planning' : 'executing'}`}>
            {isPlanning ? '📋 规划中...' : isPaused ? '⏸️ 已暂停' : '⚡ 执行中...'}
          </div>
        )}
      </div>

      <div className="cast-agent-goal-section">
        <div className="cast-agent-input-row">
          <input
            type="text"
            className="cast-agent-goal-input"
            placeholder="告诉我你想做什么，我来帮你规划和执行..."
            value={goalInput}
            onChange={e => setGoalInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !hasActiveTask && handleSubmit()}
            disabled={hasActiveTask ?? undefined}
          />
          <button
            className="cast-agent-submit-btn"
            onClick={() => handleSubmit()}
            disabled={(!goalInput.trim() || hasActiveTask) ?? undefined}
          >
            ▶️
          </button>
        </div>
        {submitError && (
          <div className="cast-agent-error-msg">{submitError}</div>
        )}

        <div className="cast-agent-templates-section">
          <span className="cast-agent-templates-label">⚡ 快捷模板：</span>
          <div className="cast-agent-templates-grid">
            {templateEntries.map(([key, template]) => (
              <button
                key={key}
                className="cast-agent-template-btn"
                onClick={() => handleTemplateClick(key)}
                disabled={hasActiveTask ?? undefined}
                title={template.description}
              >
                <span className="cast-agent-template-icon">{template.icon}</span>
                <span className="cast-agent-template-name">{template.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {currentTask && (
        <div className="cast-agent-task-card">
          <div className="cast-agent-task-header">
            <div className="cast-agent-task-goal">
              <span className="cast-agent-task-goal-label">🎯 目标:</span>
              <span className="cast-agent-task-goal-text">{currentTask.userGoal}</span>
            </div>
            <div className="cast-agent-progress-info">
              <span className="cast-agent-progress-label">📊 进度:</span>
              <div className="cast-agent-progress-bar-container">
                <div
                  className="cast-agent-progress-bar-fill"
                  style={{ width: `${progressInfo.percent}%` }}
                />
              </div>
              <span className="cast-agent-progress-text">
                {progressInfo.current}/{progressInfo.total} 步骤 ({progressInfo.percent}%)
              </span>
            </div>
          </div>

          <div className="cast-agent-steps-list">
            {currentTask.steps.map(step => (
              <StepItem
                key={step.id}
                step={step}
                onRetry={handleRetry}
                isCurrent={currentTask.currentStepIndex === step.order - 1}
              />
            ))}
          </div>

          {(isExecuting || isPaused) && (
            <div className="cast-agent-controls">
              <button
                className={`cast-agent-control-btn ${isPaused ? 'resume' : 'pause'}`}
                onClick={handlePauseResume}
              >
                {isPaused ? '▶️ 继续' : '⏸️ 暂停'}
              </button>
              <button
                className="cast-agent-control-btn cancel"
                onClick={handleCancel}
              >
                ❌ 取消
              </button>
            </div>
          )}
        </div>
      )}

      {latestCompletedStep && (
        <div className="cast-agent-result-preview">
          <div className="cast-agent-result-header">
            <span>📄 执行结果预览</span>
          </div>
          <div className="cast-agent-result-content">
            <pre className="cast-agent-result-text">
              {latestCompletedStep.outputResult}
            </pre>
          </div>
        </div>
      )}

      {!currentTask && !isPlanning && !isExecuting && (
        <div className="cast-empty-state">
          <div className="cast-empty-icon">🤖</div>
          <h4>Cast Agent 智能助手</h4>
          <p>告诉我你想做什么，我来帮你规划和执行</p>
          <p className="hint">支持写作、翻译、数据分析、邮件、日程等多种任务</p>
        </div>
      )}

      {taskHistory.length > 0 && (
        <div className="cast-agent-history-section">
          <button
            className="cast-agent-history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            📜 历史任务 ({taskHistory.length})
            <span className={`cast-agent-history-arrow ${showHistory ? 'open' : ''}`}>▶</span>
          </button>

          {showHistory && (
            <div className="cast-agent-history-list">
              {taskHistory.slice(0, 10).map(task => (
                <div
                  key={task.id}
                  className={`cast-agent-history-item ${selectedHistoryTask?.id === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedHistoryTask(selectedHistoryTask?.id === task.id ? null : task)}
                >
                  <div className="cast-agent-history-item-header">
                    <span className={`cast-agent-history-status ${task.status}`}>
                      {task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏳'}
                    </span>
                    <span className="cast-agent-history-goal">
                      {task.userGoal.slice(0, 50)}{task.userGoal.length > 50 ? '...' : ''}
                    </span>
                    <span className="cast-agent-history-time">
                      {new Date(task.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedHistoryTask?.id === task.id && (
                    <div className="cast-agent-history-detail">
                      <div className="cast-agent-history-steps">
                        {task.steps.map(step => (
                          <div key={step.id} className="cast-agent-history-step">
                            <span>{getStepStatusIcon(step.status)}</span>
                            <span>{step.title}</span>
                            {step.duration && <span>({(step.duration / 1000).toFixed(1)}s)</span>}
                          </div>
                        ))}
                      </div>
                      {task.finalSummary && (
                        <div className="cast-agent-history-summary">
                          <strong>总结:</strong> {task.finalSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showApprovalDialog && pendingApprovalStep && (
        <div className="cast-agent-approval-overlay" onClick={(e) => e.target === e.currentTarget && handleReject()}>
          <div className="cast-agent-approval-dialog">
            <div className="cast-agent-approval-header">
              <span className="cast-agent-approval-icon">⚠️</span>
              <h4>需要确认</h4>
            </div>
            <div className="cast-agent-approval-body">
              <p>即将执行以下步骤，是否继续？</p>
              <div className="cast-agent-approval-step-info">
                <strong>{pendingApprovalStep.title}</strong>
                <span className="cast-agent-approval-tool-id">
                  工具: {pendingApprovalStep.toolId}
                </span>
                <p className="cast-agent-approval-desc">{pendingApprovalStep.description}</p>
              </div>
            </div>
            <div className="cast-agent-approval-actions">
              <button
                className="cast-agent-approval-btn confirm"
                onClick={handleApprove}
              >
                ✅ 确认执行
              </button>
              <button
                className="cast-agent-approval-btn reject"
                onClick={handleReject}
              >
                ❌ 拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StepItemProps {
  step: CastAgentStep;
  onRetry: (stepId: string) => void;
  isCurrent: boolean;
}

const StepItem: React.FC<StepItemProps> = React.memo(({ step, onRetry, isCurrent }) => {
  const statusIcon = getStepStatusIcon(step.status);
  const statusText = getStepStatusText(step.status);

  return (
    <div className={`cast-agent-step-item ${step.status} ${isCurrent ? 'current' : ''}`}>
      <div className="cast-agent-step-main">
        <span className="cast-agent-step-status">{statusIcon}</span>
        <div className="cast-agent-step-content">
          <span className="cast-agent-step-title">
            Step {step.order}: {step.title} ({step.toolId})
          </span>
          <span className={`cast-agent-step-status-text ${step.status}`}>
            {statusText}
          </span>
        </div>
      </div>
      <div className="cast-agent-step-meta">
        {step.duration !== undefined && step.status === 'completed' && (
          <span className="cast-agent-step-duration">
            完成 · 用时 {(step.duration / 1000).toFixed(1)}s
          </span>
        )}
        {step.status === 'running' && (
          <span className="cast-agent-step-running-indicator">执行中...</span>
        )}
        {step.status === 'waiting_approval' && (
          <span className="cast-agent-step-waiting">等待确认...</span>
        )}
        {step.status === 'failed' && (
          <button
            className="cast-agent-retry-btn"
            onClick={() => onRetry(step.id)}
            title="重试此步骤"
          >
            🔄 重试
          </button>
        )}
        {step.status === 'pending' && (
          <span className="cast-agent-step-pending">待执行</span>
        )}
      </div>
      {step.error && step.status === 'failed' && (
        <div className="cast-agent-step-error">
          错误: {step.error}
        </div>
      )}
    </div>
  );
});

StepItem.displayName = 'StepItem';

function getStepStatusIcon(status: CastAgentStepStatus): string {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '⏳';
    case 'failed': return '❌';
    case 'skipped': return '⏭️';
    case 'waiting_approval': return '⏸️';
    default: return '⬜';
  }
}

function getStepStatusText(status: CastAgentStepStatus): string {
  switch (status) {
    case 'completed': return '完成';
    case 'running': return '执行中';
    case 'failed': return '失败';
    case 'skipped': return '已跳过';
    case 'waiting_approval': return '等待审批';
    default: return '待执行';
  }
}

export default React.memo(AgentPanel);
