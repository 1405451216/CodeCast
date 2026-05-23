import React, { useEffect, useState, useRef } from 'react';
import { useAppStore, AppState } from '../store';
import * as api from '../api';

interface Skill {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  type?: string;
  enabled?: boolean;
  icon?: string;
}

interface BuiltinPlugin {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const BUILTIN_PLUGINS: BuiltinPlugin[] = [
  {
    id: 'pdf',
    name: 'PDF',
    description: 'PDF处理工具：文本提取、合并拆分、表单填写',
    icon: '📄',
    enabled: true,
  },
  {
    id: 'pptx',
    name: 'PPTX',
    description: '演示文稿创建与编辑，支持布局、批注和演讲备注',
    icon: '📊',
    enabled: true,
  },
  {
    id: 'docx',
    name: 'DOCX',
    description: '文档创建、编辑与分析，支持修订、批注和格式保留',
    icon: '📝',
    enabled: true,
  },
  {
    id: 'xlsx',
    name: 'XLSX',
    description: '电子表格处理，支持公式、格式化和数据分析',
    icon: '📈',
    enabled: true,
  },
  {
    id: 'skill-creator',
    name: 'Skill Creator',
    description: '创建或更新自定义Skills，扩展AI能力',
    icon: '🛠️',
    enabled: true,
  },
  {
    id: 'using-superpowers',
    name: 'Using Superpowers',
    description: '超级能力模式，增强代码生成与任务执行',
    icon: '⚡',
    enabled: true,
  },
];

const PluginsPanel: React.FC = () => {
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [builtins, setBuiltins] = useState<BuiltinPlugin[]>(() => {
    try {
      const saved = localStorage.getItem('codecast_builtin_plugins');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        return BUILTIN_PLUGINS.map((p) => ({
          ...p,
          enabled: parsed[p.id] !== undefined ? parsed[p.id] : p.enabled,
        }));
      }
    } catch {}
    return BUILTIN_PLUGINS;
  });

  // Create-skill form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');

  useEffect(() => {
    if (activePanel !== 'plugins') return;
    loadSkills();
  }, [activePanel]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const data = await api.getSkills();
      let loaded: Skill[] = Array.isArray(data) ? data : [];
      // Restore persisted toggle state from localStorage
      try {
        const saved = localStorage.getItem('codecast_custom_plugins');
        if (saved) {
          const state = JSON.parse(saved) as Record<string, boolean>;
          loaded = loaded.map((s) => ({
            ...s,
            enabled: state[s.id] !== undefined ? state[s.id] : s.enabled,
          }));
        }
      } catch {}
      setSkills(loaded);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const handleToggle = (skill: Skill) => {
    setSkills((prev) => {
      const updated = prev.map((s) =>
        s.id === skill.id ? { ...s, enabled: !s.enabled } : s
      );
      // Persist custom plugin toggle state to localStorage
      try {
        const state: Record<string, boolean> = {};
        updated.forEach((s) => { state[s.id] = s.enabled !== false; });
        localStorage.setItem('codecast_custom_plugins', JSON.stringify(state));
      } catch {}
      return updated;
    });
  };

  const handleBuiltinToggle = (id: string) => {
    setBuiltins((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      );
      // Persist to localStorage
      const state: Record<string, boolean> = {};
      updated.forEach((p) => { state[p.id] = p.enabled; });
      localStorage.setItem('codecast_builtin_plugins', JSON.stringify(state));
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      await api.createSkill(formName.trim(), formDesc.trim(), formPrompt.trim());
      setFormName('');
      setFormDesc('');
      setFormPrompt('');
      setShowForm(false);
      loadSkills();
    } catch {
      // ignore
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const plugin = JSON.parse(text);
      if (plugin.name) {
        await api.createSkill(
          plugin.name,
          plugin.description || '',
          plugin.prompt || ''
        );
        loadSkills();
      }
    } catch (err) {
      console.error('Upload plugin failed:', err);
      alert('插件文件解析失败，请确保为有效的 JSON 格式');
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (activePanel !== 'plugins') return null;

  return (
    <div className="panel-overlay">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">插件</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="plugin-upload-btn"
            onClick={handleUploadClick}
            title="上传插件"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            上传插件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,.js,.ts"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
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

      {/* Content */}
      <div className="plugins-wrap">
        {/* Built-in Plugins Section */}
        <div className="plugins-section">
          <div className="plugins-section-title">内置插件</div>
          <div className="builtin-plugins-list">
            {builtins.map((plugin) => (
              <div className="builtin-plugin-item" key={plugin.id}>
                <div className="builtin-plugin-left">
                  <span className="builtin-plugin-icon">{plugin.icon}</span>
                  <div className="builtin-plugin-info">
                    <span className="builtin-plugin-name">{plugin.name}</span>
                    <span className="builtin-plugin-desc">{plugin.description}</span>
                  </div>
                </div>
                <button
                  className={`toggle ${plugin.enabled ? 'active' : ''}`}
                  onClick={() => handleBuiltinToggle(plugin.id)}
                  title={plugin.enabled ? '禁用' : '启用'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* User Plugins Section */}
        <div className="plugins-section">
          <div className="plugins-section-title">自定义插件</div>
          {loading ? (
            <div className="empty-hint">加载中...</div>
          ) : skills.length === 0 ? (
            <div className="empty-hint">暂无自定义插件</div>
          ) : (
            <div className="plugins-grid">
              {skills.map((skill) => (
                <div className="plugin-card" key={skill.id}>
                  <div className="plugin-card-header">
                    <span className="plugin-card-name">
                      <span style={{ marginRight: 6, opacity: 0.6 }}>
                        {skill.icon ? (
                          <span>{skill.icon}</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}>
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                          </svg>
                        )}
                      </span>
                      {skill.name || '未命名'}
                    </span>
                    <button
                      className={`toggle ${skill.enabled !== false ? 'active' : ''}`}
                      onClick={() => handleToggle(skill)}
                      title={skill.enabled !== false ? '禁用' : '启用'}
                    />
                  </div>
                  <div className="plugin-card-desc">{skill.description || '无描述'}</div>
                  <div className="plugin-card-actions">
                    <button
                      className="btn-remove"
                      onClick={() => handleDelete(skill.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add skill form */}
          {showForm ? (
            <div className="plugin-form-card" style={{ marginTop: 16 }}>
              <h3>新建插件</h3>
              <div className="form-group">
                <label className="form-label">名称</label>
                <input
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="插件名称"
                />
              </div>
              <div className="form-group">
                <label className="form-label">描述</label>
                <input
                  className="form-input"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="插件描述"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Prompt</label>
                <input
                  className="form-input"
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="系统提示词"
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="save-btn" onClick={handleCreate}>添加</button>
                <button
                  className="save-btn"
                  style={{ background: 'var(--tag-bg)', color: 'var(--text-dim)' }}
                  onClick={() => setShowForm(false)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              className="settings-add-btn"
              style={{ marginTop: 16 }}
              onClick={() => setShowForm(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加插件
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginsPanel;
