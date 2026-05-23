import React, { useEffect } from 'react';
import { useAppStore, AppState, Project } from '../store';
import * as api from '../api';

const ProjectsPanel: React.FC = () => {
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const projects = useAppStore((s: AppState) => s.projects);
  const setProjects = useAppStore((s: AppState) => s.setProjects);
  const currentProject = useAppStore((s: AppState) => s.currentProject);
  const setCurrentProject = useAppStore((s: AppState) => s.setCurrentProject);

  useEffect(() => {
    if (activePanel !== 'projects') return;
    loadProjects();
  }, [activePanel]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  const handleOpenInEditor = async (path: string) => {
    try {
      await api.openInEditor(path);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await api.removeProject(path);
      const current = useAppStore.getState().projects;
      setProjects(current.filter((p: Project) => p.path !== path));
      if (useAppStore.getState().currentProject === path || current.some((p: Project) => p.path === path && p.id === useAppStore.getState().currentProject)) {
        setCurrentProject(null);
        try { await api.setCurrentProject(''); } catch (_) { /* ignore */ }
      }
    } catch (e) {
      console.error('Delete project failed:', e);
    }
  };

  const handleAddProject = async () => {
    try {
      const folder = await api.selectFolder();
      if (!folder) return;
      await api.addProject(folder);
      loadProjects();
    } catch {
      // ignore
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
        {projects.length === 0 ? (
          <div className="empty-hint">暂无项目</div>
        ) : (
          projects.map((project: Project) => (
            <div className="plugin-item" key={project.id || project.path}>
              <div className="plugin-info">
                {/* Folder icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ flexShrink: 0, color: 'var(--accent)' }}
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="plugin-name">{project.name}</div>
                  <div className="plugin-desc" title={project.path}>{project.path}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="plugin-card-actions btn-enable"
                  style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'white' }}
                  onClick={() => handleOpenInEditor(project.path)}
                >
                  在编辑器中打开
                </button>
                <button
                  className="btn-delete"
                  style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }}
                  onClick={() => handleDelete(project.path)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
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
