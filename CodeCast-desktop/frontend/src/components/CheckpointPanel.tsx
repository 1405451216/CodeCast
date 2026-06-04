import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getCheckpointManager,
  Checkpoint,
  CheckpointStatus,
  CheckpointRiskLevel,
  CheckpointOperationType,
  CheckpointStatistics
} from '../utils/checkpoint';
import {
  getCheckpoints,
  deleteCheckpoint,
  resumeFromCheckpoint,
} from '../api';
import type { CheckpointInfo } from '../api/types';

interface CheckpointPanelProps {
  visible?: boolean;
  sessionId?: string;
  onCheckpointResolved?: (checkpoint: Checkpoint, approved: boolean) => void;
  onAllApproved?: () => void;
  onAllSkipped?: () => void;
  compact?: boolean;
}

const OPERATION_ICONS: Record<CheckpointOperationType, string> = {
  [CheckpointOperationType.FILE_WRITE]: '📝',
  [CheckpointOperationType.FILE_DELETE]: '🗑️',
  [CheckpointOperationType.FILE_MODIFY]: '✏️',
  [CheckpointOperationType.COMMAND_EXECUTE]: '⚡',
  [CheckpointOperationType.GIT_OPERATION]: '🔀',
  [CheckpointOperationType.NETWORK_REQUEST]: '🌐',
  [CheckpointOperationType.ENVIRONMENT_CHANGE]: '⚙️',
  [CheckpointOperationType.CUSTOM]: '🔧'
};

const RISK_LABELS: Record<CheckpointRiskLevel, { text: string; className: string }> = {
  [CheckpointRiskLevel.INFO]: { text: '信息', className: 'risk-info' },
  [CheckpointRiskLevel.LOW]: { text: '低风险', className: 'risk-low' },
  [CheckpointRiskLevel.MEDIUM]: { text: '中风险', className: 'risk-medium' },
  [CheckpointRiskLevel.HIGH]: { text: '高风险', className: 'risk-high' },
  [CheckpointRiskLevel.CRITICAL]: { text: '严重', className: 'risk-critical' }
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  running:    { text: '运行中', className: 'status-running' },
  paused:     { text: '已暂停', className: 'status-paused' },
  completed:  { text: '已完成', className: 'status-completed' },
  failed:     { text: '已失败', className: 'status-failed' },
  cancelled:  { text: '已取消', className: 'status-cancelled' },
  idle:       { text: '空闲',   className: 'status-idle' },
};

const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
  visible = true,
  sessionId,
  onCheckpointResolved,
  onAllApproved,
  onAllSkipped,
  compact = false
}) => {
  const manager = useMemo(() => getCheckpointManager(), []);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [stats, setStats] = useState<CheckpointStatistics>({
    total: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    skipped: 0,
    timedOut: 0
  });
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // History tab state
  const [showHistory, setShowHistory] = useState(false);
  const [checkpointHistory, setCheckpointHistory] = useState<CheckpointInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    setHistoryLoading(true);
    try {
      const result = await getCheckpoints(sessionId, 20);
      setCheckpointHistory(result ?? []);
    } catch (err) {
      console.warn('Failed to load checkpoint history', err);
      setCheckpointHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory, loadHistory]);

  useEffect(() => {
    const unsubscribe = manager.addListener((checkpoint) => {
      setCheckpoints(() => manager.getPendingCheckpoints());
      setStats(() => manager.getStatistics());

      setAnimatingId(checkpoint.id);
      setTimeout(() => setAnimatingId(null), 500);
    });

    setCheckpoints(() => manager.getPendingCheckpoints());
    setStats(() => manager.getStatistics());

    return unsubscribe;
  }, [manager]);

  useEffect(() => {
    if (containerRef.current && checkpoints.length > 0) {
      containerRef.current.scrollTop = 0;
    }
  }, [checkpoints.length]);

  const handleApprove = useCallback((checkpointId: string) => {
    const checkpoint = manager.getCheckpoint(checkpointId);
    if (checkpoint) {
      manager.approve(checkpointId);
      setCheckpoints(() => manager.getPendingCheckpoints());
      setStats(() => manager.getStatistics());
      onCheckpointResolved?.(checkpoint, true);
    }
  }, [manager, onCheckpointResolved]);

  const handleReject = useCallback((checkpointId: string) => {
    const checkpoint = manager.getCheckpoint(checkpointId);
    if (checkpoint) {
      manager.reject(checkpointId);
      setCheckpoints(() => manager.getPendingCheckpoints());
      setStats(() => manager.getStatistics());
      onCheckpointResolved?.(checkpoint, false);
    }
  }, [manager, onCheckpointResolved]);

  const handleBatchApprove = useCallback(() => {
    const count = manager.batchApprove();
    setCheckpoints(() => manager.getPendingCheckpoints());
    setStats(() => manager.getStatistics());

    if (count > 0) {
      onAllApproved?.();
    }
  }, [manager, onAllApproved]);

  const handleSkipRemaining = useCallback(() => {
    const count = manager.skipRemaining();
    setCheckpoints(() => manager.getPendingCheckpoints());
    setStats(() => manager.getStatistics());

    if (count > 0) {
      onAllSkipped?.();
    }
  }, [manager, onAllSkipped]);

  const toggleDiffView = useCallback((checkpointId: string) => {
    setExpandedDiff(prev => prev === checkpointId ? null : checkpointId);
  }, []);

  const handleDeleteCheckpoint = useCallback(async (id: string) => {
    try {
      await deleteCheckpoint(id);
      setCheckpointHistory(prev => prev.filter(c => c.ID !== id));
    } catch (err) {
      console.warn('Failed to delete checkpoint', id, err);
    }
  }, []);

  const handleResumeFromCheckpoint = useCallback(async (cp: CheckpointInfo) => {
    if (!sessionId) return;
    setResumingId(cp.ID);
    try {
      await resumeFromCheckpoint(sessionId, cp.ID);
      // Refresh history after successful resume
      await loadHistory();
    } catch (err) {
      console.warn('Failed to resume from checkpoint', cp.ID, err);
    } finally {
      setResumingId(null);
    }
  }, [sessionId, loadHistory]);

  const formatTimeAgo = useCallback((timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 5) return '刚刚';
    if (seconds < 60) return `${seconds}秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
    return `${Math.floor(seconds / 3600)}小时前`;
  }, []);

  const getRemainingTime = useCallback((checkpoint: Checkpoint): string => {
    const elapsed = Date.now() - checkpoint.createdAt;
    const remaining = Math.max(0, Math.floor((checkpoint.timeoutMs - elapsed) / 1000));

    if (remaining < 60) return `${remaining}秒`;
    return `${Math.floor(remaining / 60)}分${remaining % 60}秒`;
  }, []);

  const formatCreatedAt = useCallback((isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      const now = Date.now();
      const diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 5) return '刚刚';
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      return d.toLocaleDateString();
    } catch {
      return isoStr;
    }
  }, []);

  if (!visible) return null;

  const pendingCount = stats.pending;

  if (compact) {
    return (
      <div className="checkpoint-panel compact">
        <div className="compact-indicator">
          <span className={`pulse-dot ${pendingCount > 0 ? 'active' : ''}`} />
          <span>{pendingCount > 0 ? `${pendingCount} 个待确认` : '无待确认'}</span>
        </div>
        {pendingCount > 0 && (
          <button className="compact-approve-all" onClick={handleBatchApprove}>
            批准全部
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`checkpoint-panel ${pendingCount > 0 ? 'has-pending' : ''}`}>
      <div className="panel-header">
        <h3 className="panel-title">
          <span className="header-icon">🛡️</span>
          人机协作检查点
        </h3>

        <div className="header-actions">
          <button
            className={`tab-btn ${!showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(false)}
          >
            待确认
          </button>
          <button
            className={`tab-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(true)}
          >
            📋 历史
          </button>
        </div>

        {!showHistory && (
          <div className="header-stats">
            <span className="stat-badge pending">{stats.pending} 待处理</span>
            <span className="stat-badge approved">{stats.approved} 已批准</span>
            <span className="stat-badge rejected">{stats.rejected + stats.timedOut} 已拒绝</span>
          </div>
        )}
      </div>

      {showHistory ? (
        <div className="checkpoint-history">
          <div className="history-toolbar">
            <span className="history-count">{checkpointHistory.length} 个检查点</span>
            <button className="refresh-btn" onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          <div className="history-list" ref={containerRef}>
            {checkpointHistory.length === 0 ? (
              <div className="empty-checkpoints">
                <span className="empty-icon">📂</span>
                <p>暂无检查点历史</p>
                <p className="empty-sub">Agent 运行时保存的检查点会显示在这里</p>
              </div>
            ) : (
              checkpointHistory.map((cp) => {
                const statusInfo = STATUS_LABELS[cp.Status] ?? { text: cp.Status, className: '' };
                const canResume = cp.Status === 'paused' || cp.Status === 'failed' || cp.Status === 'cancelled';
                return (
                  <div key={cp.ID} className={`history-card ${statusInfo.className}`}>
                    <div className="history-card-header">
                      <span className="history-agent-id" title={cp.ID}>
                        {cp.ID.length > 20 ? cp.ID.slice(0, 20) + '...' : cp.ID}
                      </span>
                      <span className={`status-badge ${statusInfo.className}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                    <div className="history-card-body">
                      <span className="history-meta">Turn {cp.Turn}</span>
                      {cp.ToolName && <span className="history-meta">{cp.ToolName}</span>}
                      <span className="history-time">{formatCreatedAt(cp.CreatedAt)}</span>
                    </div>
                    <div className="history-card-actions">
                      {canResume && sessionId && (
                        <button
                          className="action-btn resume"
                          onClick={() => handleResumeFromCheckpoint(cp)}
                          disabled={resumingId === cp.ID}
                        >
                          {resumingId === cp.ID ? '恢复中...' : '▶️ 恢复'}
                        </button>
                      )}
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteCheckpoint(cp.ID)}
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <>
          {pendingCount > 0 && (
            <div className="batch-actions">
              <button className="batch-btn approve-all" onClick={handleBatchApprove}>
                ✅ 批准所有
              </button>
              <button className="batch-btn skip-all" onClick={handleSkipRemaining}>
                ⏭️ 跳过剩余确认
              </button>
            </div>
          )}

          <div className="checkpoint-list" ref={containerRef}>
            {checkpoints.length === 0 ? (
              <div className="empty-checkpoints">
                <span className="empty-icon">✨</span>
                <p>暂无待确认的操作</p>
                <p className="empty-sub">AI 执行高危操作时会在此请求您的确认</p>
              </div>
            ) : (
              checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.id}
                  className={`checkpoint-card ${checkpoint.riskLevel} ${animatingId === checkpoint.id ? 'slide-in' : ''}`}
                >
                  <div className="card-header">
                    <span className="operation-icon">
                      {OPERATION_ICONS[checkpoint.operationType]}
                    </span>

                    <div className="card-info">
                      <span className="tool-name">{checkpoint.toolName}</span>
                      <span className={`risk-badge ${RISK_LABELS[checkpoint.riskLevel].className}`}>
                        {RISK_LABELS[checkpoint.riskLevel].text}
                      </span>
                    </div>

                    <span className="time-ago">{formatTimeAgo(checkpoint.createdAt)}</span>
                  </div>

                  <div className="card-body">
                    <div className="target-path">
                      <span className="path-label">目标:</span>
                      <span className="path-value" title={checkpoint.targetPath}>
                        {checkpoint.targetPath || '(无路径)'}
                      </span>
                    </div>

                    <p className="description">{checkpoint.description}</p>

                    {expandedDiff === checkpoint.id && checkpoint.diff && (
                      <div className="diff-preview">
                        <div className="diff-preview-header">
                          <span>变更预览</span>
                          <span className="diff-stats">
                            {checkpoint.diff.addedLines !== undefined && (
                              <span className="added-count">+{checkpoint.diff.addedLines}
                              </span>
                            )}
                            {checkpoint.diff.removedLines !== undefined && (
                              <span className="removed-count">-{checkpoint.diff.removedLines}
                              </span>
                            )}
                          </span>
                        </div>
                        <pre className="diff-content">
                          {checkpoint.diff.unifiedDiff || (
                            <span className="no-diff">
                              {checkpoint.diff.changeType === 'create' && '新文件创建'}
                              {checkpoint.diff.changeType === 'delete' && '文件将被删除'}
                              {checkpoint.diff.changeType === 'modify' && '文件内容修改'}
                              {checkpoint.diff.changeType === 'move' && '文件移动/重命名'}
                            </span>
                          )}
                        </pre>
                      </div>
                    )}

                    {!checkpoint.requiresApproval && (
                      <div className="auto-approve-note">
                        ℹ️ 此操作已配置为自动通过（低风险）
                      </div>
                    )}

                    <div className="timeout-warning">
                      ⏱️ 剩余时间: {getRemainingTime(checkpoint)}
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      className="action-btn approve"
                      onClick={() => handleApprove(checkpoint.id)}
                      disabled={checkpoint.status !== CheckpointStatus.PENDING}
                    >
                      ✅ 批准
                    </button>
                    <button
                      className="action-btn reject"
                      onClick={() => handleReject(checkpoint.id)}
                      disabled={checkpoint.status !== CheckpointStatus.PENDING}
                    >
                      ❌ 拒绝
                    </button>
                    {(checkpoint.diff || checkpoint.operationType === CheckpointOperationType.FILE_MODIFY ||
                      checkpoint.operationType === CheckpointOperationType.FILE_WRITE) && (
                      <button
                        className="action-btn view-diff"
                        onClick={() => toggleDiffView(checkpoint.id)}
                      >
                        {expandedDiff === checkpoint.id ? '🙈 收起' : '👁 完整 Diff'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="panel-footer">
            <div className="progress-ring-container">
              <svg className="progress-ring" viewBox="0 0 36 36">
                <circle
                  className="ring-bg"
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  strokeWidth="3"
                />
                <circle
                  className="ring-fill"
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray={`${(stats.approved / Math.max(stats.total, 1)) * 100}, 100`}
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="ring-text">
                {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
              </span>
            </div>
            <span className="footer-text">
              总计 {stats.total} | 通过率{' '}
              {stats.total > 0
                ? `${Math.round(((stats.approved + stats.skipped) / stats.total) * 100)}%`
                : '-'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default CheckpointPanel;
