import React, { useEffect, useState } from 'react';
import { useAppStore, AppState, Project } from '../store';
import * as api from '../api';

// 格式化时间戳为可读字符串
function formatTimestamp(ts?: number): string {
  if (!ts || ts <= 0) return '';
  const date = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN');
}

const ProjectsPanel: React.FC = () => {
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const projects = useAppStore((s: AppState) => s.projects);
  const setProjects = useAppStore((s: AppState) => s.setProjects);
  const currentProject = useAppStore((s: AppState) => s.currentProject);
  const setCurrentProject = useAppStore((s: AppState) => s.setCurrentProject);

  const [loadError, setLoadError] = useState<string>('');
  // 记录哪个项目正在展开编辑指令
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState<string>('');

  useEffect(() => {
    if (activePanel !== 'projects') return;
    loadProjects();
  }, [activePanel]);

  const loadProjects = async () => {
    setLoadError('');
    try {
      const data = await api.getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[ProjectsPanel] 加载项目列表失败:', e);
      setLoadError(e instanceof Error ? e.message : '加载项目失败');
    }
  };

  // 点击切换当前项目
  const handleSelectProject = async (project: Project) => {
    const newId = currentProject === project.id ? null : project.id;
    setCurrentProject(newId);
    try {
      await api.setCurrentProject(newId || '');
    } catch (e) {
      console.error('[ProjectsPanel] 切换项目失败:', e);
    }
  };

  // 开始编辑指令
  const handleStartEdit = (project: Project) => {
    setEditingId(project.id);
    setEditInstructions(project.custom_instructions || '');
  };

  // 保存指令
  const handleSaveInstructions = async (projectId: string) => {
    try {
      await api.updateProjectInstructions(projectId, editInstructions);
      // 更新本地状态
      const updated = projects.map((p: Project) =>
        p.id === projectId ? { ...p, custom_instructions: editInstructions } : p
      );
      setProjects(updated);
      setEditingId(null);
      setEditInstructions('');
    } catch (e) {
      console.error('[ProjectsPanel] 保存项目指令失败:', e);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditInstructions('');
  };

  const handleOpenInEditor = async (path: string) => {
    try {
      await api.openInEditor(path);
    } catch (e) {
      console.error('[ProjectsPanel] 在编辑器中打开失败:', path, e);
    }
  };

  const handleDelete = async (path: string, projectId: string) => {
    try {
      await api.removeProject(path);
      const current = useAppStore.getState().projects;
      setProjects(current.filter((p: Project) => p.path !== path));
      if (useAppStore.getState().currentProject === projectId) {
        setCurrentProject(null);
        try { await api.setCurrentProject(''); } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.error('[ProjectsPanel] 删除项目失败:', e);
    }
  };

  const handleAddProject = async () => {
    try {
      const folder = await api.selectFolder();
      if (!folder) return;
      await api.addProject(folder);
      loadProjects();
    } catch (e) {
      console.error('[ProjectsPanel] 添加项目失败:', e);
    }
  };

  if (activePanel !== 'projects') return null;

  return (
    <div className="panel-overlay">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">项目</span>
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

      {/* List */}
      <div className="plugins-wrap">
        {loadError ? (
          <div className="empty-hint" style={{ color: 'var(--error, #f44)' }}>
            ⚠ {loadError}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-hint">暂无项目，点击下方按钮添加</div>
        ) : (
          projects.map((project: Project) => {
            const isActive = currentProject === project.id;
            const isEditing = editingId === project.id;

            return (
              <div
                className={`plugin-item${isActive ? ' active-project' : ''}`}
                key={project.id || project.path}
                style={{
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  background: isActive ? 'rgba(var(--accent-rgb, 74, 144, 226), 0.08)' : undefined,
                }}
              >
                <div className="plugin-info" style={{ cursor: 'pointer' }} onClick={() => handleSelectProject(project)}>
                  {/* Folder icon */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={isActive ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="plugin-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {project.name}
                      {isActive && (
                        <span style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--accent)',
                          color: 'white',
                          fontWeight: 500,
                        }}>
                          当前
                        </span>
                      )}
                    </div>
                    <div className="plugin-desc" title={project.path}>{project.path}</div>
                    {project.last_accessed_at && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        最近访问: {formatTimestamp(project.last_accessed_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 操作按钮区 */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* 编辑/保存指令按钮 */}
                  {!isEditing ? (
                    <button
                      className="btn-delete"
                      style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(project); }}
                      title="设置项目级自定义指令"
                    >
                      指令
                    </button>
                  ) : null}

                  <button
                    className="plugin-card-actions btn-enable"
                    style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'white' }}
                    onClick={(e) => { e.stopPropagation(); handleOpenInEditor(project.path); }}
                  >
                    打开
                  </button>
                  <button
                    className="btn-delete"
                    style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(project.path, project.id); }}
                  >
                    删除
                  </button>
                </div>

                {/* 指令编辑展开区 */}
                {isEditing && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.15)',
                      border: '1px solid var(--border)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      项目级自定义指令（AI 处理此项目时将自动附加）
                    </div>
                    <textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder="例如：这是一个 React + TypeScript 项目，使用 Tailwind CSS..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text)',
                        fontSize: 12,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '4px 14px',
                          borderRadius: 4,
                          fontSize: 12,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                        }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleSaveInstructions(project.id)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: 4,
                          fontSize: 12,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'var(--accent)',
                          color: 'white',
                        }}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Add project button */}
        <button
          className="settings-add-btn"
          style={{ marginTop: 16 }}
          onClick={handleAddProject}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          添加项目
        </button>
      </div>
    </div>
  );
};

export default ProjectsPanel;
