import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  type ScheduledTask,
  type ScheduledTaskType,
  type ScheduleFrequency,
  type TaskStatus,
  CastSchedulerEngine,
  TASK_TYPE_LABELS,
  TASK_TYPE_ICONS,
  FREQUENCY_LABELS,
  formatNextRunTime,
  formatTimestamp,
  BUILTIN_TASK_TEMPLATES
} from '../../utils/cast/cast-scheduler-engine';
import { useCastSchedulerStore } from '../../store/useCastSchedulerStore';
import '../../styles/cast-workspace.css';

const SCHEDULED_TASK_TYPES: { key: ScheduledTaskType; label: string; icon: string }[] = [
  { key: 'ai_generate', label: 'AI生成', icon: '🤖' },
  { key: 'notification', label: '通知', icon: '🔔' },
  { key: 'data_sync', label: '数据同步', icon: '🔄' },
  { key: 'memory_cleanup', label: '记忆清理', icon: '🧹' },
  { key: 'reminder', label: '提醒', icon: '⏰' },
  { key: 'custom', label: '自定义', icon: '⚙️' }
];

const FREQUENCY_OPTIONS: { key: ScheduleFrequency; label: string; desc: string }[] = [
  { key: 'once', label: '一次', desc: '仅执行一次' },
  { key: 'minute', label: '每分钟', desc: '每隔1分钟执行' },
  { key: 'hourly', label: '每小时', desc: '每隔1小时执行' },
  { key: 'daily', label: '每天', desc: '每天定时执行' },
  { key: 'weekly', label: '每周', desc: '每周定时执行' },
  { key: 'monthly', label: '每月', desc: '每月定时执行' },
  { key: 'cron', label: 'Cron表达式', desc: '自定义Cron表达式' }
];

interface NewTaskForm {
  name: string;
  description: string;
  type: ScheduledTaskType;
  frequency: ScheduleFrequency;
  cronExpression: string;
  intervalMs: number;
  enabled: boolean;
  configJson: string;
}

const EMPTY_FORM: NewTaskForm = {
  name: '',
  description: '',
  type: 'notification',
  frequency: 'daily',
  cronExpression: '0 9 * * *',
  intervalMs: 0,
  enabled: true,
  configJson: '{}'
};

function statusBadge(status: TaskStatus): { text: string; cls: string } {
  switch (status) {
    case 'idle': return { text: '待执行', cls: 'cast-tag-blue' };
    case 'running': return { text: '运行中', cls: 'cast-tag-yellow' };
    case 'success': return { text: '成功', cls: 'cast-tag-green' };
    case 'failed': return { text: '失败', cls: 'cast-tag-red' };
    case 'disabled': return { text: '已禁用', cls: '' };
    case 'paused': return { text: '已暂停', cls: '' };
    default: return { text: status, cls: '' };
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

const SchedulerPanel: React.FC = () => {
  const {
    tasks, stats, isRunning, isPaused, selectedTaskId, executionLog,
    addTask, updateTask, removeTask, toggleTask, runTaskNow, duplicateTask,
    startScheduler, stopScheduler, pauseScheduler, resumeScheduler,
    getActiveTasks, getExecutionLogs,
    selectTask, loadFromStorage, clearLogs, exportLogs, refreshStats,
    addBuiltinTemplate
  } = useCastSchedulerStore();

  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [form, setForm] = useState<NewTaskForm>({ ...EMPTY_FORM });
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning && !isPaused) {
        refreshStats();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, refreshStats]);

  const activeTasks = useMemo(() => getActiveTasks(), [tasks, getActiveTasks]);
  const filteredLogs = useMemo(() =>
    getExecutionLogs(logFilter || undefined, 100),
    [executionLog, logFilter, getExecutionLogs]
  );

  const handleAddTask = useCallback(() => {
    if (!form.name.trim()) return;

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(form.configJson || '{}');
    } catch {
      config = {};
    }

    addTask({
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      frequency: form.frequency,
      cronExpression: form.frequency === 'cron' ? form.cronExpression : form.cronExpression || undefined,
      intervalMs: form.intervalMs > 0 ? form.intervalMs : undefined,
      enabled: form.enabled,
      config
    });

    setForm({ ...EMPTY_FORM });
    setShowNewTaskForm(false);
  }, [form, addTask]);

  const handleEditSave = useCallback(() => {
    if (!editingTaskId || !form.name.trim()) return;

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(form.configJson || '{}');
    } catch {
      config = {};
    }

    updateTask(editingTaskId, {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      frequency: form.frequency,
      cronExpression: form.frequency === 'cron' ? form.cronExpression : form.cronExpression || undefined,
      intervalMs: form.intervalMs > 0 ? form.intervalMs : undefined,
      enabled: form.enabled,
      config
    });

    setEditingTaskId(null);
    setForm({ ...EMPTY_FORM });
    setShowNewTaskForm(false);
  }, [editingTaskId, form, updateTask]);

  const startEdit = useCallback((task: ScheduledTask) => {
    setForm({
      name: task.name,
      description: task.description,
      type: task.type,
      frequency: task.frequency,
      cronExpression: task.cronExpression || '',
      intervalMs: task.intervalMs || 0,
      enabled: task.enabled,
      configJson: JSON.stringify(task.config, null, 2)
    });
    setEditingTaskId(task.id);
    setShowNewTaskForm(true);
  }, []);

  const handleAddTemplate = useCallback((idx: number) => {
    addBuiltinTemplate(idx);
  }, [addBuiltinTemplate]);

  const statusIndicator = () => {
    if (!isRunning) return { dot: '#9ca3af', text: '已停止' };
    if (isPaused) return { dot: '#f59e0b', text: '已暂停' };
    return { dot: '#10b981', text: '运行中' };
  };

  const indicator = statusIndicator();

  return (
    <div className="cast-panel-container">
      <div className="cast-toolbar">
        <div className="cast-toolbar-group" style={{ alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: indicator.dot,
              display: 'inline-block',
              boxShadow: isRunning && !isPaused ? `0 0 6px ${indicator.dot}` : 'none'
            }} />
            调度器 {indicator.text}
          </span>

          {isRunning && (
            <>
              <span className="cast-stat-item cast-tag-blue">
                ⏱ 运行时长: <span className="cast-stat-value">{formatUptime(stats.uptimeSeconds)}</span>
              </span>
              <span className="cast-stat-item cast-tag-green">
                ✅ 活跃任务: <span className="cast-stat-value">{stats.activeTasks}</span>
              </span>
              <span className="cast-stat-item cast-tag-yellow">
                📊 今日执行: <span className="cast-stat-value">{stats.todayRuns}</span>
              </span>
            </>
          )}
        </div>

        <div className="cast-toolbar-divider" />

        <div className="cast-toolbar-group">
          {!isRunning ? (
            <button className="cast-toolbar-btn active" onClick={startScheduler}>
              ▶️ 启动
            </button>
          ) : (
            <>
              {!isPaused ? (
                <button className="cast-toolbar-btn" onClick={pauseScheduler}>
                  ⏸️ 暂停
                </button>
              ) : (
                <button className="cast-toolbar-btn active" onClick={resumeScheduler}>
                  ▶️ 继续
                </button>
              )}
              <button className="cast-toolbar-btn" onClick={stopScheduler}
                style={{ color: '#ef4444' }}>
                ⏹️ 停止
              </button>
            </>
          )}

          <button className="cast-toolbar-btn active" onClick={() => {
            setForm({ ...EMPTY_FORM });
            setEditingTaskId(null);
            setShowNewTaskForm(!showNewTaskForm);
          }}>
            + 新建任务
          </button>

          <button
            className={`cast-toolbar-btn ${showLogs ? 'active' : ''}`}
            onClick={() => setShowLogs(!showLogs)}
          >
            📋 执行日志{executionLog.length > 0 ? `(${executionLog.length})` : ''}
          </button>
        </div>
      </div>

      {showNewTaskForm && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(139,92,246,0.05)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {editingTaskId ? '✏️ 编辑任务' : '➕ 新建调度任务'}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="任务名称 *"
              style={inputStyle(220)}
              autoFocus={!editingTaskId}
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="描述（可选）"
              style={inputStyle(200)}
            />
            <select
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value as ScheduledTaskType }))}
              style={selectStyle(120)}
            >
              {SCHEDULED_TASK_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={form.frequency}
              onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value as ScheduleFrequency }))}
              style={selectStyle(110)}
            >
              {FREQUENCY_OPTIONS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {(form.frequency === 'cron' || form.frequency === 'daily' || form.frequency === 'weekly' || form.frequency === 'monthly') && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Cron 表达式:
              </label>
              <input
                type="text"
                value={form.cronExpression}
                onChange={(e) => setForm(f => ({ ...f, cronExpression: e.target.value }))}
                placeholder="例: 0 9 * * * (每天9点)"
                style={{ ...inputStyle(260), fontFamily: 'monospace', fontSize: 12 }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                格式: 分 时 日 月 周
              </span>
            </div>
          )}

          {(form.frequency === 'minute' || form.frequency === 'hourly') && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                自定义间隔(ms):
              </label>
              <input
                type="number"
                value={form.intervalMs || ''}
                onChange={(e) => setForm(f => ({ ...f, intervalMs: parseInt(e.target.value) || 0 }))}
                placeholder="默认"
                style={inputStyle(120)}
              />
            </div>
          )}

          {form.type === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>任务配置 (JSON):</label>
              <textarea
                value={form.configJson}
                onChange={(e) => setForm(f => ({ ...f, configJson: e.target.value }))}
                placeholder='{"key": "value"}'
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm(f => ({ ...f, enabled: e.target.checked }))}
              />
              启用
            </label>

            <button className="cast-toolbar-btn" onClick={() => {
              setShowNewTaskForm(false);
              setEditingTaskId(null);
              setForm({ ...EMPTY_FORM });
            }}>
              取消
            </button>
            <button
              className="cast-toolbar-btn active"
              onClick={editingTaskId ? handleEditSave : handleAddTask}
              disabled={!form.name.trim()}
            >
              {editingTaskId ? '💾 保存修改' : '✅ 创建任务'}
            </button>
          </div>
        </div>
      )}

      <div style={{
        padding: '10px 16px',
        background: 'rgba(59,130,246,0.04)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>快速添加:</span>
        {BUILTIN_TASK_TEMPLATES.map((tmpl, idx) => {
          const typeInfo = SCHEDULED_TASK_TYPES.find(t => t.key === tmpl.type);
          return (
            <button
              key={idx}
              className="cast-toolbar-btn"
              onClick={() => handleAddTemplate(idx)}
              style={{ fontSize: 11, padding: '3px 8px' }}
              title={`${tmpl.description}\n频率: ${FREQUENCY_LABELS[tmpl.frequency]} ${tmpl.cronExpression || ''}`}
            >
              {typeInfo?.icon || '📋'} {tmpl.name}
            </button>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="cast-empty-state">
          <div className="cast-empty-icon">⏱️</div>
          <h4>暂无调度任务</h4>
          <p className="hint">点击 "新建任务" 或使用上方 "快速添加" 预置模板</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {tasks.map(task => {
            const badge = statusBadge(task.status);
            const isSelected = selectedTaskId === task.id;
            const isExpanded = expandedTaskId === task.id;

            return (
              <div key={task.id}>
                <div
                  className={`cast-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectTask(isSelected ? null : task.id)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    flex: 1
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {TASK_TYPE_ICONS[task.type] || '📋'}
                    </span>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="cast-list-item-title" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: !task.enabled ? 0.5 : 1
                      }}>
                        {task.name}
                        <span className={`cast-tag ${badge.cls}`} style={{
                          fontSize: 9,
                          padding: '1px 5px',
                          flexShrink: 0
                        }}>
                          {badge.text}
                        </span>
                      </div>
                      <div className="cast-list-item-subtitle">
                        <span>{TASK_TYPE_LABELS[task.type]}</span>
                        <span style={{ margin: '0 4px' }}>·</span>
                        <span>{FREQUENCY_LABELS[task.frequency]}</span>
                        {task.cronExpression && task.frequency !== 'once' && (
                          <>
                            <span style={{ margin: '0 4px' }}>·</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{task.cronExpression}</span>
                          </>
                        )}
                        {task.lastRunAt && (
                          <>
                            <span style={{ margin: '0 4px' }}>·</span>
                            <span>上次: {formatTimestamp(task.lastRunAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0
                  }}>
                    {task.nextRunAt && task.enabled && (
                      <span style={{
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap'
                      }}>
                        下次: {formatNextRunTime(task.nextRunAt)}
                      </span>
                    )}

                    <span style={{
                      fontSize: 10,
                      color: task.failCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                      marginRight: 4,
                      whiteSpace: 'nowrap'
                    }}>
                      ✅{task.runCount} ❌{task.failCount}
                    </span>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={(e) => { e.stopPropagation(); setExpandedTaskId(isExpanded ? null : task.id); }}
                      title="展开详情"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={(e) => { e.stopPropagation(); runTaskNow(task.id); }}
                      title="立即执行"
                      disabled={task.status === 'running' || !task.enabled}
                    >
                      ▶️
                    </button>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                      title={task.enabled ? '禁用' : '启用'}
                    >
                      {task.enabled ? '⏸️' : '▶️'}
                    </button>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                      title="编辑"
                    >
                      ✏️
                    </button>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={(e) => { e.stopPropagation(); duplicateTask(task.id); }}
                      title="复制"
                    >
                      📄
                    </button>

                    <button
                      className="cast-toolbar-btn"
                      style={{ padding: '2px 6px', fontSize: 10, color: '#ef4444' }}
                      onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '12px 16px 12px 44px',
                    background: 'rgba(0,0,0,0.02)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: 11,
                    lineHeight: 1.7
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                      <div><strong>ID:</strong> <code style={{ fontSize: 10 }}>{task.id}</code></div>
                      <div><strong>类型:</strong> {TASK_TYPE_ICONS[task.type]} {TASK_TYPE_LABELS[task.type]}</div>
                      <div><strong>频率:</strong> {FREQUENCY_LABELS[task.frequency]}</div>
                      <div><strong>Cron:</strong> <code style={{ fontSize: 10 }}>{task.cronExpression || '-'}</code></div>
                      <div><strong>状态:</strong> <span className={`cast-tag ${badge.cls}`}>{badge.text}</span></div>
                      <div><strong>启用:</strong> {task.enabled ? '是' : '否'}</div>
                      <div><strong>创建时间:</strong> {formatTimestamp(task.createdAt)}</div>
                      <div><strong>更新时间:</strong> {formatTimestamp(task.updatedAt)}</div>
                      <div><strong>执行次数:</strong> {task.runCount} 成功 / {task.failCount} 失败</div>
                      <div><strong>下次执行:</strong> {task.nextRunAt ? formatNextRunTime(task.nextRunAt) : '未计划'}</div>
                    </div>

                    {Object.keys(task.config).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>配置:</strong>
                        <pre style={{
                          marginTop: 4,
                          padding: '6px 10px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 4,
                          fontSize: 10,
                          overflow: 'auto',
                          maxHeight: 120
                        }}>
                          {JSON.stringify(task.config, null, 2)}
                        </pre>
                      </div>
                    )}

                    {task.lastResult && (
                      <div style={{ marginTop: 6 }}>
                        <strong style={{ color: '#10b981' }}>上次结果:</strong>
                        <div style={{
                          marginTop: 2,
                          padding: '6px 10px',
                          background: 'rgba(16,185,129,0.06)',
                          borderRadius: 4,
                          fontSize: 10,
                          wordBreak: 'break-word'
                        }}>
                          {task.lastResult}
                        </div>
                      </div>
                    )}

                    {task.lastError && (
                      <div style={{ marginTop: 6 }}>
                        <strong style={{ color: '#ef4444' }}>上次错误:</strong>
                        <div style={{
                          marginTop: 2,
                          padding: '6px 10px',
                          background: 'rgba(239,68,68,0.06)',
                          borderRadius: 4,
                          fontSize: 10,
                          wordBreak: 'break-word',
                          color: '#ef4444'
                        }}>
                          {task.lastError}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showLogs && (
        <div style={{
          borderTop: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>📋 执行日志</span>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                style={selectStyle(140)}
              >
                <option value="">全部任务</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                共 {filteredLogs.length} 条记录
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="cast-toolbar-btn" onClick={exportLogs} disabled={filteredLogs.length === 0}>
                📥 导出CSV
              </button>
              <button
                className="cast-toolbar-btn"
                onClick={clearLogs}
                style={{ color: '#ef4444' }}
                disabled={filteredLogs.length === 0}
              >
                🗑 清空日志
              </button>
              <button className="cast-toolbar-btn" onClick={() => setShowLogs(false)}>收起</button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              暂无执行日志
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11
              }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <th style={thStyle}>时间</th>
                    <th style={thStyle}>任务名</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>结果/错误</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => {
                    const logBadge = statusBadge(log.status);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                        <td style={tdStyle}>
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </td>
                        <td style={tdStyle}>{log.taskName}</td>
                        <td style={tdStyle}>
                          <span className={`cast-tag ${logBadge.cls}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                            {logBadge.text}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.result || log.error || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function inputStyle(width: number): React.CSSProperties {
  return {
    padding: '6px 10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    width,
    boxSizing: 'border-box'
  };
}

function selectStyle(width: number): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    width,
    boxSizing: 'border-box',
    cursor: 'pointer'
  };
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap'
};

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap'
};

export default React.memo(SchedulerPanel);
