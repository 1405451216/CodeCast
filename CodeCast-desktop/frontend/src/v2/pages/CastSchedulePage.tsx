import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store';
import { useI18n } from '../lib/useI18n';

/* ====================================================================
 *  Types
 * ==================================================================== */

interface ScheduleTask {
  id?: string;
  title: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'done';
  dueDate?: string;
  [key: string]: unknown;
}

/* ====================================================================
 *  Status helpers
 * ==================================================================== */

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  pending:     { label: '待处理',  bg: 'rgba(234, 179, 8, 0.10)',  fg: '#b45309', border: 'rgba(234, 179, 8, 0.30)' },
  in_progress: { label: '进行中',  bg: 'rgba(59, 130, 246, 0.10)', fg: '#1d4ed8', border: 'rgba(59, 130, 246, 0.30)' },
  done:        { label: '已完成',  bg: 'rgba(34, 197, 94, 0.10)',  fg: '#15803d', border: 'rgba(34, 197, 94, 0.30)' },
};

function getStatusConfig(status: string | undefined) {
  return STATUS_CONFIG[status || 'pending'] || STATUS_CONFIG.pending;
}

/* ====================================================================
 *  CastSchedulePage — Schedule Management
 * ==================================================================== */

export function CastSchedulePage() {
  const t = useI18n();
  const {
    loadCastTools,
    castToolByCategory,
    castToolLoading,
    invokeCastTool,
    castToolInvoking,
    castToolResult,
  } = useAppStore();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  // Task list state
  const [taskListResult, setTaskListResult] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load catalog on mount
  useEffect(() => {
    loadCastTools();
  }, [loadCastTools]);

  // CastSchedule has two specialized tools (add + list); the generic
  // useFirstTool hook only returns one. We keep the regex-based discovery
  // here because it is schedule-specific.
  const scheduleTools = useMemo(() => castToolByCategory['schedule'] || [], [castToolByCategory]);

  // Find specific tool types by name pattern
  const addTool = useMemo(
    () => scheduleTools.find((t) => /add|create|insert/i.test(t.name)) || scheduleTools[0],
    [scheduleTools],
  );
  const listTool = useMemo(
    () => scheduleTools.find((t) => /list|get|fetch|query/i.test(t.name)),
    [scheduleTools],
  );

  /* ---------- Parse tasks from JSON result ---------- */

  const parsedTasks: ScheduleTask[] = useMemo(() => {
    const raw = taskListResult || castToolResult;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ScheduleTask[];
      if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
      if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
      if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
      // Single object — wrap in array
      if (typeof parsed === 'object') return [parsed as ScheduleTask];
    } catch {
      // Not valid JSON, ignore
    }
    return [];
  }, [taskListResult, castToolResult]);

  /* ---------- Handlers ---------- */

  const handleAddTask = useCallback(async () => {
    if (!title.trim()) return;
    if (!addTool) return;
    setAddError(null);
    setAddSuccess(false);
    try {
      const args = JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        status: 'pending',
      });
      const result = await invokeCastTool(addTool.name, args);
      setAddSuccess(true);
      // Refresh the task list if a list tool is available
      if (listTool) {
        setLoadingTasks(true);
        try {
          const listResult = await invokeCastTool(listTool.name, JSON.stringify({}));
          setTaskListResult(listResult);
        } catch {
          // Ignore list refresh errors
        } finally {
          setLoadingTasks(false);
        }
      }
      // Clear form
      setTitle('');
      setDescription('');
      setDueDate('');
      // Auto-dismiss success message
      setTimeout(() => setAddSuccess(false), 3000);
      // Suppress unused var warning
      void result;
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  }, [title, description, dueDate, addTool, listTool, invokeCastTool]);

  const handleLoadTasks = useCallback(async () => {
    if (!listTool) return;
    setLoadingTasks(true);
    try {
      const result = await invokeCastTool(listTool.name, JSON.stringify({}));
      setTaskListResult(result);
    } catch (err: unknown) {
      setTaskListResult(null);
      void err;
    } finally {
      setLoadingTasks(false);
    }
  }, [listTool, invokeCastTool]);

  // Find update/delete tools by name pattern
  const updateTool = useMemo(
    () => scheduleTools.find((t) => /update|edit|modify|status/i.test(t.name)),
    [scheduleTools],
  );
  const deleteTool = useMemo(
    () => scheduleTools.find((t) => /delete|remove/i.test(t.name)),
    [scheduleTools],
  );

  const handleToggleStatus = useCallback(async (task: ScheduleTask, idx: number) => {
    if (!updateTool) return;
    setActionError(null);
    const statusOrder: string[] = ['pending', 'in_progress', 'done'];
    const curIdx = statusOrder.indexOf(task.status || 'pending');
    const nextStatus = statusOrder[(curIdx + 1) % statusOrder.length];
    try {
      const id = task.id || idx;
      await invokeCastTool(updateTool.name, JSON.stringify({ id, index: idx, status: nextStatus, ...task }));
      if (listTool) await handleLoadTasks();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [updateTool, listTool, invokeCastTool, handleLoadTasks]);

  const handleDeleteTask = useCallback(async (task: ScheduleTask, idx: number) => {
    if (!deleteTool) return;
    setActionError(null);
    try {
      const id = task.id || idx;
      await invokeCastTool(deleteTool.name, JSON.stringify({ id, index: idx, ...task }));
      if (listTool) await handleLoadTasks();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [deleteTool, listTool, invokeCastTool, handleLoadTasks]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleAddTask();
      }
    },
    [handleAddTask],
  );

  /* ---------- Render ---------- */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <div style={{ padding: '24px 32px', maxWidth: 'var(--page-max-width)', width: '100%', margin: '0 auto' }}>
        {/* Title */}
        <h2
          style={{
            fontFamily: 'var(--font-serif, serif)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.7 }}>&#x1F4C5;</span>
          {t.schedule.title}
        </h2>

        {/* Available schedule tools indicator */}
        {scheduleTools.length > 0 && (
          <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--c-textMute)' }}>
            {t.schedule.availableTools}: {scheduleTools.map((tool) => tool.name).join(', ')}
          </div>
        )}

        {/* ---- Create Task Form ---- */}
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-lg)',
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--c-text)',
              margin: '0 0 14px',
            }}
          >
            {t.schedule.newTask}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Title field */}
            <div>
              <label
                htmlFor="task-title"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--c-textSub)',
                  marginBottom: 4,
                }}
              >
                {t.schedule.taskTitle}
              </label>
              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.schedule.taskTitlePlaceholder}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--c-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color var(--dur-fast) var(--ease)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
              />
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="task-desc"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--c-textSub)',
                  marginBottom: 4,
                }}
              >
                {t.schedule.taskDesc}
              </label>
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.schedule.taskDescPlaceholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--c-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 60,
                  transition: 'border-color var(--dur-fast) var(--ease)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
              />
            </div>

            {/* Due date field */}
            <div>
              <label
                htmlFor="task-due"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--c-textSub)',
                  marginBottom: 4,
                }}
              >
                {t.schedule.dueDate}
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--c-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color var(--dur-fast) var(--ease)',
                  boxSizing: 'border-box',
                  maxWidth: 220,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
              />
            </div>

            {/* Feedback messages */}
            {addError && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(220, 38, 38, 0.05)',
                  border: '1px solid var(--c-danger, #dc2626)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 12,
                  color: 'var(--c-danger, #dc2626)',
                }}
              >
                {t.schedule.addFailed(addError)}
              </div>
            )}
            {addSuccess && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(34, 197, 94, 0.05)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 12,
                  color: '#15803d',
                }}
              >
                {t.schedule.taskAdded}
              </div>
            )}
            {actionError && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(220, 38, 38, 0.05)',
                  border: '1px solid var(--c-danger, #dc2626)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 12,
                  color: 'var(--c-danger, #dc2626)',
                }}
              >
                {actionError}
              </div>
            )}

            {/* Submit button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleAddTask}
                disabled={!title.trim() || castToolInvoking || !addTool}
                style={{
                  padding: '9px 20px',
                  background: 'var(--c-accent)',
                  border: '1px solid var(--c-accent)',
                  borderRadius: 'var(--r-md)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: !title.trim() || castToolInvoking || !addTool ? 'not-allowed' : 'pointer',
                  opacity: !title.trim() || castToolInvoking || !addTool ? 0.5 : 1,
                  transition: 'all var(--dur-fast) var(--ease)',
                  whiteSpace: 'nowrap',
                }}
              >
                {castToolInvoking ? t.schedule.adding : t.schedule.addTask}
              </button>

              {listTool && (
                <button
                  onClick={handleLoadTasks}
                  disabled={loadingTasks}
                  style={{
                    padding: '9px 16px',
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--c-text)',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: loadingTasks ? 'not-allowed' : 'pointer',
                    opacity: loadingTasks ? 0.6 : 1,
                    transition: 'all var(--dur-fast) var(--ease)',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingTasks) {
                      e.currentTarget.style.background = 'var(--c-surface-hover)';
                      e.currentTarget.style.borderColor = 'var(--c-borderStrong)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--c-surface)';
                    e.currentTarget.style.borderColor = 'var(--c-border)';
                  }}
                >
                  {loadingTasks ? t.schedule.loading : t.schedule.refreshList}
                </button>
              )}

              <span
                style={{
                  fontSize: 11,
                  color: 'var(--c-textMute)',
                  marginLeft: 4,
                }}
              >
                {t.schedule.quickSubmit}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Task List ---- */}
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--c-text)',
                margin: 0,
              }}
            >
              {t.schedule.taskList}
              {parsedTasks.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--c-textMute)',
                  }}
                >
                  ({parsedTasks.length})
                </span>
              )}
            </h3>
          </div>

          {/* Loading state */}
          {(loadingTasks || castToolLoading) && parsedTasks.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                color: 'var(--c-textMute)',
                fontSize: 13,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid var(--c-border)',
                  borderTopColor: 'var(--c-accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  marginRight: 8,
                }}
              />
              {t.schedule.loading}
            </div>
          )}

          {/* Empty state */}
          {!loadingTasks && !castToolLoading && parsedTasks.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                color: 'var(--c-textMute)',
                fontSize: 13,
                textAlign: 'center',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                style={{ marginBottom: 10, opacity: 0.35 }}
              >
                <rect x="4" y="6" width="28" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 12h28" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 18h10M10 24h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="26" cy="21" r="4" stroke="currentColor" strokeWidth="1.3" />
                <path d="M26 19v4M24 21h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span>{t.schedule.noTasks}</span>
              <span style={{ fontSize: 12, marginTop: 4 }}>
                {t.schedule.noTasksHint}
              </span>
            </div>
          )}

          {/* Task cards */}
          {parsedTasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parsedTasks.map((task, idx) => {
                const statusCfg = getStatusConfig(task.status);
                return (
                  <div
                    key={task.id || `${task.title}-${task.dueDate || ''}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 18px',
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 'var(--r-lg)',
                      transition: 'all var(--dur-fast) var(--ease)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--c-surface-hover)';
                      e.currentTarget.style.borderColor = 'var(--c-borderStrong)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--c-surface)';
                      e.currentTarget.style.borderColor = 'var(--c-border)';
                    }}
                  >
                    {/* Task info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--c-text)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title || 'Untitled'}
                      </div>
                      {task.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--c-textSub)',
                            marginTop: 2,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {task.description}
                        </div>
                      )}
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--c-textMute)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {task.dueDate}
                      </div>
                    )}

                    {/* Status badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        background: statusCfg.bg,
                        border: `1px solid ${statusCfg.border}`,
                        borderRadius: 'var(--r-md)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: statusCfg.fg,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {statusCfg.label}
                    </span>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {updateTool && (
                        <button
                          onClick={() => void handleToggleStatus(task, idx)}
                          title={t.schedule.toggleStatus}
                          style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid var(--c-border)',
                            borderRadius: 'var(--r-md)',
                            color: 'var(--c-textSub)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {t.schedule.switch}
                        </button>
                      )}
                      {deleteTool && (
                        <button
                          onClick={() => {
                            if (window.confirm(t.schedule.deleteConfirm(String(task.title || task.name || '未命名')))) {
                              void handleDeleteTask(task, idx);
                            }
                          }}
                          title={t.schedule.deleteTask}
                          style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid var(--c-danger, #e55)',
                            borderRadius: 'var(--r-md)',
                            color: 'var(--c-danger, #e55)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          {t.schedule.delete}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Raw result display (collapsible) */}
          {(taskListResult || castToolResult) && (
            <details
              style={{
                marginTop: 16,
                paddingTop: 0,
              }}
            >
              <summary
                style={{
                  fontSize: 11,
                  color: 'var(--c-textMute)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '4px 0',
                }}
              >
                {t.schedule.rawData}
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--c-textSub)',
                  overflow: 'auto',
                  maxHeight: 200,
                  margin: '8px 0 0',
                }}
              >
                {taskListResult || castToolResult}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
