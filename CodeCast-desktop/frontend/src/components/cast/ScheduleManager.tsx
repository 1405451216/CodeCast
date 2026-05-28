import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { TodoItem, TodoPriority, TodoStatus, CalendarView } from '../../types/cast-types';
import { TODO_PRIORITIES } from '../../types/cast-types';
import { useScheduleStore } from '../../store/useScheduleStore';

const ScheduleManager: React.FC = () => {
  const {
    todos, events, filterStatus, calendarView,
    addTodo, updateTodo, deleteTodo, toggleTodo, toggleAllComplete,
    setFilterStatus, setCalendarView, getStats, getTodayTodos, getOverdueTodos,
    aiSuggestSchedule, clearCompleted, loadFromStorage
  } = useScheduleStore();

  const [showNewTodoForm, setShowNewTodoForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>('normal');
  const [newTodoTags, setNewTodoTags] = useState('');
  const [showAiSuggest, setShowAiSuggest] = useState(false);
  const [aiSuggestInput, setAiSuggestInput] = useState('');
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const filteredTodos = useMemo(() => {
    if (filterStatus === 'all') return todos;
    return todos.filter(t => t.status === filterStatus);
  }, [todos, filterStatus]);

  const stats = useMemo(() => getStats(), [todos, getStats]);
  const todayTodos = useMemo(() => getTodayTodos(), [todos, getTodayTodos]);
  const overdueTodos = useMemo(() => getOverdueTodos(), [todos, getOverdueTodos]);

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  const handleAddTodo = useCallback(() => {
    if (!newTodoTitle.trim()) return;

    addTodo({
      title: newTodoTitle.trim(),
      priority: newTodoPriority,
      status: 'pending',
      tags: newTodoTags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    });

    setNewTodoTitle('');
    setNewTodoTags('');
    setNewTodoPriority('normal');
    setShowNewTodoForm(false);
  }, [newTodoTitle, newTodoPriority, newTodoTags, addTodo]);

  const handleAiSuggest = useCallback(async () => {
    if (!aiSuggestInput.trim()) return;
    setIsAiSuggesting(true);

    try {
      const taskList = aiSuggestInput.split(/[,\n、]/).map(t => t.trim()).filter(Boolean);
      const suggestedEvents = await aiSuggestSchedule(taskList, {
        start: Date.now(),
        end: Date.now() + 86400000
      });

      if (suggestedEvents.length > 0) {
        suggestedEvents.forEach((evt: any) => {
          addTodo({
            title: evt.taskIndex !== undefined ? taskList[evt.taskIndex as number] || evt.reason : evt.reason || 'AI建议任务',
            priority: 'important',
            status: 'pending',
            tags: ['AI排期']
          });
        });
      } else {
        const lines = aiSuggestInput.split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => {
          if (line.trim()) {
            addTodo({ title: line.trim(), priority: 'normal', status: 'pending', tags: ['AI排期'] });
          }
        });
      }
    } catch (error) {
      console.error('[ScheduleManager] AI suggest failed:', error);
    } finally {
      setIsAiSuggesting(false);
      setShowAiSuggest(false);
      setAiSuggestInput('');
    }
  }, [aiSuggestInput, aiSuggestSchedule, addTodo]);

  return (
    <div className="cast-panel-container">
      <div className="cast-toolbar">
        <div className="cast-toolbar-group">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map(status => (
            <button key={status} className={`cast-toolbar-btn ${filterStatus === status ? 'active' : ''}`} onClick={() => setFilterStatus(status)}>
              {status === 'all' ? `📊 全部(${stats.total})` :
               status === 'pending' ? `📋 待办(${todos.filter(t => t.status === 'pending').length})` :
               status === 'in_progress' ? `🔹 进行中(${todos.filter(t => t.status === 'in_progress').length})` :
               `✅ 已完成(${stats.completed})`}
            </button>
          ))}
        </div>

        <div className="cast-toolbar-divider" />

        <div className="cast-toolbar-group">
          <button className="cast-toolbar-btn active" onClick={() => setShowNewTodoForm(!showNewTodoForm)}>+ 新建待办</button>
          <button className="cast-toolbar-btn" onClick={() => setShowAiSuggest(true)}>🔍 AI 排期</button>
          {stats.completed > 0 && (
            <button className="cast-toolbar-btn" onClick={clearCompleted}>🗑 清理已完成</button>
          )}
        </div>
      </div>

      {showNewTodoForm && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(59,130,246,0.05)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="待办事项..."
            style={{
              flex: 1,
              padding: '6px 12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              fontSize: 12,
              outline: 'none'
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            autoFocus
          />
          <select value={newTodoPriority} onChange={(e) => setNewTodoPriority(e.target.value as TodoPriority)} className="cast-toolbar-select" style={{ width: '80px' }}>
            {TODO_PRIORITIES.map(p => (<option key={p.key} value={p.key}>{p.icon} {p.label}</option>))}
          </select>
          <input
            type="text"
            value={newTodoTags}
            onChange={(e) => setNewTodoTags(e.target.value)}
            placeholder="标签（逗号分隔）"
            style={{
              padding: '6px 10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderRadius: 6,
              fontSize: 11,
              outline: 'none',
              width: '120px'
            }}
          />
          <button className="cast-toolbar-btn active" onClick={handleAddTodo}>添加</button>
          <button className="cast-toolbar-btn" onClick={() => setShowNewTodoForm(false)}>取消</button>
        </div>
      )}

      {showAiSuggest && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(139,92,246,0.06)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>🤖 AI 智能排期</div>
          <textarea
            value={aiSuggestInput}
            onChange={(e) => setAiSuggestInput(e.target.value)}
            placeholder={"输入任务列表，每行一个，例如：\n完成代码审查\n写周报\n准备会议PPT\n回复客户邮件"}
            style={{
              width: '100%',
              height: '80px',
              padding: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              fontSize: 12,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="cast-toolbar-btn" onClick={() => { setShowAiSuggest(false); setAiSuggestInput(''); }}>取消</button>
            <button className="cast-toolbar-btn active" onClick={handleAiSuggest} disabled={isAiSuggesting || !aiSuggestInput.trim()}>
              {isAiSuggesting ? '⏳ 分析中...' : '✨ AI 排期并创建'}
            </button>
          </div>
        </div>
      )}

      <div className="cast-stat-bar">
        <span className="cast-stat-item cast-tag-red">🔴 紧急: <span className="cast-stat-value">{stats.urgent}</span></span>
        <span className="cast-stat-item cast-tag-yellow">🟡 重要: <span className="cast-stat-value">{todos.filter(t => t.priority === 'important' && t.status !== 'completed').length}</span></span>
        <span className="cast-stat-item cast-tag-green">✅ 完成: <span className="cast-stat-value">{stats.completed}/{stats.total}</span></span>
        {todayTodos.length > 0 && (
          <span className="cast-stat-item cast-tag-blue">📅 今日: <span className="cast-stat-value">{todayTodos.length}</span></span>
        )}
        {overdueTodos.length > 0 && (
          <span className="cast-stat-item cast-tag-red" style={{ marginLeft: 'auto' }}>⚠️ 逾期: <span className="cast-stat-value">{overdueTodos.length}</span></span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {filteredTodos.map(todo => {
          const pri = TODO_PRIORITIES.find(p => p.key === todo.priority);
          return (
            <div
              key={todo.id}
              className="cast-list-item"
              onClick={() => toggleTodo(todo.id)}
              style={{ opacity: todo.status === 'completed' ? 0.55 : 1 }}
            >
              <div className={`cast-checkbox ${todo.status === 'completed' ? 'checked' : ''}`} />
              <div className="cast-priority-dot" style={{ backgroundColor: pri?.color }} />
              <div className="cast-list-item-content">
                <div className="cast-list-item-title" style={{
                  textDecoration: todo.status === 'completed' ? 'line-through' : 'none'
                }}>
                  {todo.title}
                  {todo.tags.includes('AI排期') && (
                    <span className="cast-tag" style={{ marginLeft: 6, fontSize: '9px', padding: '1px 5px' }}>🤖</span>
                  )}
                </div>
                <div className="cast-list-item-subtitle">
                  {todo.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="cast-tag" style={{ marginRight: 4 }}>{tag}</span>
                  ))}
                  {todo.dueDate && <span> 截止 {formatDate(todo.dueDate)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="cast-toolbar-btn"
                  style={{ padding: '2px 6px', fontSize: 10 }}
                  onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }}
                  title="删除"
                >🗑</button>
                <div className="cast-list-item-meta">{formatRelativeTime(todo.updatedAt)}</div>
              </div>
            </div>
          );
        })}

        {filteredTodos.length === 0 && (
          <div className="cast-empty-state">
            <div className="cast-empty-icon">📋</div>
            <h4>{filterStatus === 'all' ? '暂无待办事项' : `没有${filterStatus === 'completed' ? '已完成' : filterStatus === 'in_progress' ? '进行中' : '待处理'}的任务`}</h4>
            <p className="hint">点击 "+ 新建待办" 或使用 "AI 排期" 批量创建</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ScheduleManager);
