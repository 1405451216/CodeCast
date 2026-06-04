import React, { useEffect, useState } from 'react';
import { useAppStore, AppState } from '../store';
import * as api from '../api';

// ─── Task Templates ─────────────────────────────────────────────

interface TaskTemplate {
  id: string;
  icon: string;
  title: string;
  description: string;
  defaultSchedule: string;
  defaultCommand: string;
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'daily-report',
    icon: '📋',
    title: '整理今日工作日志',
    description: '生成日报摘要',
    defaultSchedule: '0 18 * * *',
    defaultCommand: 'generate-daily-report',
  },
  {
    id: 'meeting-notes',
    icon: '📝',
    title: '整理会议记录',
    description: '提取关键决议和待办事项',
    defaultSchedule: '0 17 * * *',
    defaultCommand: 'summarize-meetings',
  },
  {
    id: 'weekly-report',
    icon: '📊',
    title: '汇总本周工作进度',
    description: '生成周报',
    defaultSchedule: '0 17 * * 5',
    defaultCommand: 'generate-weekly-report',
  },
  {
    id: 'ai-news',
    icon: '🤖',
    title: '统计AI相关新闻',
    description: '每天9点汇总最新AI动态',
    defaultSchedule: '0 9 * * *',
    defaultCommand: 'ai-news-digest',
  },
  {
    id: 'task-reminder',
    icon: '✅',
    title: '检查待办任务状态',
    description: '发送提醒',
    defaultSchedule: '0 10 * * *',
    defaultCommand: 'check-tasks',
  },
  {
    id: 'file-cleanup',
    icon: '📁',
    title: '整理文档目录',
    description: '清理过期文件',
    defaultSchedule: '0 2 * * 0',
    defaultCommand: 'cleanup-files',
  },
  {
    id: 'calendar-check',
    icon: '📅',
    title: '检查日程安排',
    description: '发送日程提醒',
    defaultSchedule: '0 8 * * *',
    defaultCommand: 'calendar-reminder',
  },
  {
    id: 'code-review',
    icon: '🔍',
    title: '检查代码提交记录',
    description: '生成代码审查报告',
    defaultSchedule: '0 9 * * 1-5',
    defaultCommand: 'code-review-report',
  },
  {
    id: 'project-status',
    icon: '📈',
    title: '汇总项目进度',
    description: '生成项目状态报告',
    defaultSchedule: '0 16 * * 5',
    defaultCommand: 'project-status-report',
  },
  {
    id: 'learning-notes',
    icon: '💡',
    title: '整理学习笔记',
    description: '生成知识摘要',
    defaultSchedule: '0 21 * * *',
    defaultCommand: 'learning-summary',
  },
  {
    id: 'team-updates',
    icon: '👥',
    title: '整理团队动态',
    description: '生成团队周刊',
    defaultSchedule: '0 10 * * 1',
    defaultCommand: 'team-weekly',
  },
  {
    id: 'data-backup',
    icon: '💾',
    title: '检查重要数据',
    description: '执行备份任务',
    defaultSchedule: '0 3 * * *',
    defaultCommand: 'data-backup',
  },
];

// ─── Task interface ─────────────────────────────────────────────

interface Task {
  id: string;
  name: string;
  description: string;
  command: string;
  schedule: string;
  enabled: boolean;
  last_run?: number;
  next_run?: number;
  status?: string;
}

// ─── Views ──────────────────────────────────────────────────────

type PanelView = 'list' | 'create' | 'workflows';

// ─── Component ──────────────────────────────────────────────────

const AutomationPanel: React.FC = () => {
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PanelView>('list');
  const [workflowRuns, setWorkflowRuns] = useState<any[]>([]);

  // Create form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formSchedule, setFormSchedule] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePanel !== 'automation') return;
    let cancelled = false;
    loadTasks().then(() => {
      if (cancelled) return;
    });
    loadWorkflowRuns();
    return () => { cancelled = true; };
  }, [activePanel]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowRuns = async () => {
    try {
      const runs = await api.listWorkflowRuns();
      setWorkflowRuns(Array.isArray(runs) ? runs : []);
    } catch {
      setWorkflowRuns([]);
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      setError(null);
      await api.runTaskNow(id);
    } catch (e: any) {
      setError('运行任务失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      setError(null);
      await api.toggleTask(task.id, !task.enabled);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, enabled: !t.enabled } : t
        )
      );
    } catch (e: any) {
      setError('切换状态失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError('删除失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      setError(null);
      await api.createTask(
        formName.trim(),
        formDesc.trim(),
        formCommand.trim(),
        formSchedule.trim()
      );
      setFormName('');
      setFormDesc('');
      setFormCommand('');
      setFormSchedule('');
      setView('list');
      loadTasks();
    } catch (e: any) {
      setError('创建任务失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleTemplateClick = (template: TaskTemplate) => {
    setFormName(template.title);
    setFormDesc(template.description);
    setFormCommand(template.defaultCommand);
    setFormSchedule(template.defaultSchedule);
    setView('create');
  };

  const handleCodeReview = async () => {
    try {
      setError(null);
      const currentSessionId = useAppStore.getState().currentSessionId;
      if (!currentSessionId) {
        setError('请先选择一个会话');
        return;
      }
      await api.runCodeReviewWorkflow(currentSessionId, 'current-file');
      loadWorkflowRuns();
    } catch (e: any) {
      setError('代码审查失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleRefactoring = async () => {
    try {
      setError(null);
      const currentSessionId = useAppStore.getState().currentSessionId;
      if (!currentSessionId) {
        setError('请先选择一个会话');
        return;
      }
      await api.runRefactoringWorkflow(currentSessionId, 'current-file');
      loadWorkflowRuns();
    } catch (e: any) {
      setError('重构工作流失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleTestPipeline = async () => {
    try {
      setError(null);
      const currentSessionId = useAppStore.getState().currentSessionId;
      if (!currentSessionId) {
        setError('请先选择一个会话');
        return;
      }
      await api.runTestPipelineWorkflow(currentSessionId, 'current-file');
      loadWorkflowRuns();
    } catch (e: any) {
      setError('测试生成失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleParallelAnalysis = async () => {
    try {
      setError(null);
      const currentSessionId = useAppStore.getState().currentSessionId;
      if (!currentSessionId) {
        setError('请先选择一个会话');
        return;
      }
      await api.runParallelAnalysis(currentSessionId, 'analyze current context');
      loadWorkflowRuns();
    } catch (e: any) {
      setError('并行分析失败: ' + (e?.message || '未知错误'));
    }
  };

  const handleCancelWorkflow = async (runId: string) => {
    try {
      setError(null);
      await api.cancelWorkflowRun(runId);
      loadWorkflowRuns();
    } catch (e: any) {
      setError('取消工作流失败: ' + (e?.message || '未知错误'));
    }
  };

  if (activePanel !== 'automation') return null;

  return (
    <div className="panel-overlay">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">定时任务</span>
        <div className="panel-header-actions">
          {view === 'create' && (
            <button
              className="atm-back-btn"
              onClick={() => setView('list')}
              title="返回列表"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              返回
            </button>
          )}
          {view === 'list' && (
            <button
              className="atm-create-btn"
              onClick={() => setView('create')}
            >
              + 创建定时任务
            </button>
          )}
          <div className="panel-header-tabs" style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
            <button
              className={`panel-tab ${view === 'list' || view === 'create' ? 'active' : ''}`}
              onClick={() => setView('list')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: (view === 'list' || view === 'create') ? 'var(--accent-bg, rgba(139,92,246,0.15))' : 'transparent',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              定时任务
            </button>
            <button
              className={`panel-tab ${view === 'workflows' ? 'active' : ''}`}
              onClick={() => setView('workflows')}
              style={{
                padding: '4px 12px',
                border: 'none',
                background: view === 'workflows' ? 'var(--accent-bg, rgba(139,92,246,0.15))' : 'transparent',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              工作流
            </button>
          </div>
          <button
            className="panel-close-btn"
            onClick={() => setActivePanel(null)}
            title="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error feedback */}
      {error && (
        <div className="atm-error" style={{ padding: '8px 16px', background: 'var(--error-bg, #ff4d4f22)', color: 'var(--error-text, #ff4d4f)', fontSize: '12px', borderBottom: '1px solid var(--border)' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Content */}
      <div className="atm-wrap">
        {view === 'list' && (
          <>
            {/* Description */}
            <div className="atm-desc">
              通过设置定时任务自动化日常工作，确保完成以下设置：
            </div>
            <ul className="atm-tips">
              <li>已开启"阻止系统休眠"</li>
              <li>如需笔记本关上盖子时仍能运行，参考设置：控制面板\硬件和声音\电源选项\系统设置，将"关闭盖子时"的操作设置为"不采取任何操作"</li>
              <li>内网可达（连接公司网络或开启 VPN）</li>
              <li>连接电源线，防止电脑强制休眠</li>
            </ul>

            {/* Existing tasks */}
            {!loading && tasks.length > 0 && (
              <div className="atm-existing">
                <div className="atm-existing-title">已创建的任务</div>
                {tasks.map((task) => (
                  <div className="atm-task-card" key={task.id}>
                    <div className="atm-task-card-left">
                      <div className="atm-task-card-name">{task.name || '未命名'}</div>
                      <div className="atm-task-card-meta">
                        {task.schedule} · {task.enabled ? '已启用' : '已禁用'}
                      </div>
                    </div>
                    <div className="atm-task-card-actions">
                      <button
                        className={`atm-toggle ${task.enabled ? 'active' : ''}`}
                        onClick={() => handleToggle(task)}
                        title={task.enabled ? '禁用' : '启用'}
                      />
                      <button className="atm-action-btn" onClick={() => handleRunNow(task.id)} title="立即运行">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                      <button className="atm-action-btn atm-action-delete" onClick={() => handleDelete(task.id)} title="删除">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Templates */}
            <div className="atm-templates-section">
              <div className="atm-templates-title">从模板开始</div>
              <div className="atm-templates-grid">
                {TASK_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="atm-template-card"
                    onClick={() => handleTemplateClick(template)}
                  >
                    <span className="atm-template-icon">{template.icon}</span>
                    <span className="atm-template-text">
                      {template.title}，{template.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'create' && (
          <div className="atm-create-form">
            <h3 className="atm-form-title">创建定时任务</h3>
            <div className="form-group">
              <label className="form-label">任务名称</label>
              <input
                className="form-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：整理今日工作日志"
              />
            </div>
            <div className="form-group">
              <label className="form-label">任务描述</label>
              <input
                className="form-input"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="简要描述任务目标"
              />
            </div>
            <div className="form-group">
              <label className="form-label">执行命令</label>
              <input
                className="form-input"
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
                placeholder="要执行的命令或脚本"
              />
            </div>
            <div className="form-group">
              <label className="form-label">执行计划 (Cron 表达式)</label>
              <input
                className="form-input"
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                placeholder="如: 0 18 * * * (每天18点)"
              />
              <div className="form-hint">
                常用: 0 9 * * * (每天9点) | 0 */6 * * * (每6小时) | 0 17 * * 5 (每周五17点)
              </div>
            </div>
            <div className="atm-form-actions">
              <button className="atm-cancel-btn" onClick={() => setView('list')}>取消</button>
              <button className="atm-submit-btn" onClick={handleCreate}>创建任务</button>
            </div>
          </div>
        )}

        {view === 'workflows' && (
          <div className="atm-workflows">
            <div className="atm-desc">
              使用 AI 工作流自动化代码审查、重构和测试生成
            </div>

            {/* Pre-built workflow buttons */}
            <div className="atm-workflow-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
              <div className="atm-workflow-card" onClick={handleCodeReview} style={{
                padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
                background: 'var(--card-bg)', transition: 'background 0.15s',
              }}>
                <div style={{ fontSize: '18px' }}>&#128269;</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>代码审查</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>自动分析安全、风格、性能</div>
              </div>
              <div className="atm-workflow-card" onClick={handleRefactoring} style={{
                padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
                background: 'var(--card-bg)', transition: 'background 0.15s',
              }}>
                <div style={{ fontSize: '18px' }}>&#9851;</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>智能重构</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>评估-重构-验证三步流程</div>
              </div>
              <div className="atm-workflow-card" onClick={handleTestPipeline} style={{
                padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
                background: 'var(--card-bg)', transition: 'background 0.15s',
              }}>
                <div style={{ fontSize: '18px' }}>&#129514;</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>测试生成</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>自动识别目标并生成测试</div>
              </div>
              <div className="atm-workflow-card" onClick={handleParallelAnalysis} style={{
                padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
                background: 'var(--card-bg)', transition: 'background 0.15s',
              }}>
                <div style={{ fontSize: '18px' }}>&#9889;</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>并行分析</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>多视角同时分析代码</div>
              </div>
            </div>

            {/* Running/recent workflows */}
            {workflowRuns.length > 0 && (
              <div className="atm-existing" style={{ marginTop: '16px' }}>
                <div className="atm-existing-title">工作流运行记录</div>
                {workflowRuns.map((run) => (
                  <div className="atm-task-card" key={run.id}>
                    <div className="atm-task-card-left">
                      <div className="atm-task-card-name">
                        {run.type === 'code_review' && '&#128269; 代码审查'}
                        {run.type === 'refactoring' && '&#9851; 智能重构'}
                        {run.type === 'test_pipeline' && '&#129514; 测试生成'}
                        {run.type === 'handoff' && '&#129309; 专家接力'}
                        {run.type === 'parallel' && '&#9889; 并行分析'}
                      </div>
                      <div className="atm-task-card-meta">
                        {run.status === 'running' && '运行中...'}
                        {run.status === 'completed' && '已完成'}
                        {run.status === 'failed' && `失败: ${run.error || '未知'}`}
                        {run.status === 'cancelled' && '已取消'}
                        {' \u00B7 '}
                        {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : ''}
                      </div>
                    </div>
                    <div className="atm-task-card-actions">
                      {run.status === 'running' && (
                        <button
                          className="atm-action-btn atm-action-delete"
                          onClick={() => handleCancelWorkflow(run.id)}
                          title="取消"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationPanel;
