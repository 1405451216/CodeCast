import React, { useState, useEffect } from 'react';
import { pluginLoader, type LoadedPlugin, type PluginEvent, PluginPermission } from '../plugins';

interface PluginManagerPanelProps {
  className?: string;
}

const PluginManagerPanel: React.FC<PluginManagerPanelProps> = ({ className = '' }) => {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [events, setEvents] = useState<PluginEvent[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'error'>('all');

  useEffect(() => {
    refreshPlugins();

    const unsubscribe = pluginLoader.on('plugin:loaded', (event: PluginEvent) => {
      addEvent(event);
      refreshPlugins();
    });

    pluginLoader.on('plugin:unloaded', (event: PluginEvent) => {
      addEvent(event);
      refreshPlugins();
    });

    pluginLoader.on('plugin:activated', (event: PluginEvent) => {
      addEvent(event);
      refreshPlugins();
    });

    pluginLoader.on('plugin:deactivated', (event: PluginEvent) => {
      addEvent(event);
      refreshPlugins();
    });

    pluginLoader.on('plugin:error', (event: PluginEvent) => {
      addEvent(event);
      refreshPlugins();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshPlugins = () => {
    setPlugins(pluginLoader.getAllPlugins());
  };

  const addEvent = (event: PluginEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 50));
  };

  const handleActivate = async (pluginId: string) => {
    try {
      await pluginLoader.activatePlugin(pluginId);
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginId}:`, error);
      alert(`激活失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDeactivate = async (pluginId: string) => {
    try {
      await pluginLoader.deactivatePlugin(pluginId);
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error);
      alert(`停用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUnload = async (pluginId: string) => {
    if (!confirm('确定要卸载此插件吗？')) return;

    try {
      await pluginLoader.unloadPlugin(pluginId);
      setSelectedPlugin(null);
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      alert(`卸载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleInstall = async () => {
    if (!installUrl.trim()) {
      alert('请输入插件 URL 或路径');
      return;
    }

    setLoading(true);
    try {
      const loaded = await pluginLoader.loadPlugin(installUrl.trim());
      await pluginLoader.activatePlugin(loaded.manifest.id);
      setShowInstallDialog(false);
      setInstallUrl('');
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert(`安装失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: LoadedPlugin['status']) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'inactive': return '#9ca3af';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: LoadedPlugin['status']) => {
    switch (status) {
      case 'active': return '运行中';
      case 'inactive': return '已停止';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  const getPermissionLabel = (perm: PluginPermission) => {
    const labels: Record<PluginPermission, string> = {
      [PluginPermission.READ_FILES]: '读取文件',
      [PluginPermission.WRITE_FILES]: '写入文件',
      [PluginPermission.EXECUTE_COMMANDS]: '执行命令',
      [PluginPermission.ACCESS_GIT]: '访问 Git',
      [PluginPermission.MODIFY_UI]: '修改界面',
      [PluginPermission.NETWORK_ACCESS]: '网络访问',
      [PluginPermission.READ_SETTINGS]: '读取设置',
      [PluginPermission.WRITE_SETTINGS]: '写入设置'
    };
    return labels[perm] || perm;
  };

  const filteredPlugins = plugins.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const selectedPluginData = selectedPlugin
    ? plugins.find(p => p.manifest.id === selectedPlugin)
    : null;

  return (
    <div className={`plugin-manager ${className}`}>
      <style>{`
        .plugin-manager {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .plugin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .plugin-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-danger {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .btn-danger:hover {
          background: #fee2e2;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .filter-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0;
        }

        .filter-tab {
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          color: #6b7280;
          font-weight: 500;
          transition: all 0.2s;
        }

        .filter-tab:hover {
          color: #374151;
        }

        .filter-tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .plugin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 16px;
        }

        .plugin-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .plugin-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border-color: #d1d5db;
        }

        .plugin-card.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .plugin-card-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 12px;
        }

        .plugin-name {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .plugin-version {
          font-size: 12px;
          color: #9ca3af;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .plugin-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .plugin-meta {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 12px;
        }

        .plugin-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .plugin-actions {
          display: flex;
          gap: 8px;
        }

        .detail-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 480px;
          height: 100vh;
          background: white;
          box-shadow: -4px 0 24px rgba(0,0,0,0.12);
          z-index: 1000;
          overflow-y: auto;
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .detail-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          background: white;
          z-index: 1;
        }

        .detail-content {
          padding: 20px;
        }

        .detail-section {
          margin-bottom: 24px;
        }

        .detail-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .permission-tag {
          display: inline-block;
          padding: 4px 10px;
          background: #eff6ff;
          color: #3b82f6;
          border-radius: 4px;
          font-size: 12px;
          margin: 4px;
        }

        .event-log {
          max-height: 200px;
          overflow-y: auto;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          font-family: monospace;
          font-size: 12px;
        }

        .event-item {
          padding: 4px 0;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          gap: 8px;
        }

        .event-time {
          color: #9ca3af;
        }

        .event-type {
          font-weight: 500;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }

        .modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .input-field {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .input-field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .empty-state {
          text-align: center;
          padding: 48px 20px;
          color: #9ca3af;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
      `}</style>

      <div className="plugin-header">
        <h2 className="plugin-title">🔌 插件管理</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowInstallDialog(true)}
        >
          + 安装插件
        </button>
      </div>

      <div className="filter-tabs">
        <div
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部 ({plugins.length})
        </div>
        <div
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          运行中 ({plugins.filter(p => p.status === 'active').length})
        </div>
        <div
          className={`filter-tab ${filter === 'inactive' ? 'active' : ''}`}
          onClick={() => setFilter('inactive')}
        >
          已停止 ({plugins.filter(p => p.status === 'inactive').length})
        </div>
        <div
          className={`filter-tab ${filter === 'error' ? 'active' : ''}`}
          onClick={() => setFilter('error')}
        >
          错误 ({plugins.filter(p => p.status === 'error').length})
        </div>
      </div>

      {filteredPlugins.length > 0 ? (
        <div className="plugin-grid">
          {filteredPlugins.map((plugin) => (
            <div
              key={plugin.manifest.id}
              className={`plugin-card ${selectedPlugin === plugin.manifest.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlugin(
                selectedPlugin === plugin.manifest.id ? null : plugin.manifest.id
              )}
            >
              <div className="plugin-card-header">
                <div>
                  <div className="plugin-name">{plugin.manifest.name}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    by {plugin.manifest.author}
                  </div>
                </div>
                <span className="plugin-version">v{plugin.manifest.version}</span>
              </div>

              <div className="plugin-description">{plugin.manifest.description}</div>

              <div className="plugin-meta">
                <span>ID: {plugin.manifest.id}</span>
                <span>权限: {plugin.manifest.permissions.length}项</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  className="plugin-status-badge"
                  style={{
                    color: getStatusColor(plugin.status),
                    background: `${getStatusColor(plugin.status)}15`
                  }}
                >
                  <span className="status-dot" />
                  {getStatusLabel(plugin.status)}
                </span>

                <div className="plugin-actions" onClick={(e) => e.stopPropagation()}>
                  {plugin.status === 'active' ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeactivate(plugin.manifest.id)}
                    >
                      停用
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleActivate(plugin.manifest.id)}
                    >
                      启用
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleUnload(plugin.manifest.id)}
                  >
                    卸载
                  </button>
                </div>
              </div>

              {plugin.error && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#fef2f2',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#dc2626'
                }}>
                  ⚠️ {plugin.error}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div>暂无插件</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            点击"安装插件"添加新插件
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            📋 事件日志
          </h3>
          <div className="event-log">
            {events.slice(0, 20).map((event, index) => (
              <div key={index} className="event-item">
                <span className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="event-type">{event.type.replace('plugin:', '')}</span>
                <span>{event.pluginId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPluginData && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999
            }}
            onClick={() => setSelectedPlugin(null)}
          />
          <div className="detail-panel">
            <div className="detail-header">
              <h3>{selectedPluginData.manifest.name}</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPlugin(null)}
              >
                ✕ 关闭
              </button>
            </div>

            <div className="detail-content">
              <div className="detail-section">
                <div className="detail-section-title">基本信息</div>
                <table style={{ width: '100%', fontSize: '14px' }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#6b7280', padding: '8px 0' }}>ID</td>
                      <td style={{ padding: '8px 0' }}>{selectedPluginData.manifest.id}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#6b7280', padding: '8px 0' }}>版本</td>
                      <td style={{ padding: '8px 0' }}>v{selectedPluginData.manifest.version}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#6b7280', padding: '8px 0' }}>作者</td>
                      <td style={{ padding: '8px 0' }}>{selectedPluginData.manifest.author}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#6b7280', padding: '8px 0' }}>状态</td>
                      <td style={{ padding: '8px 0' }}>
                        <span
                          className="plugin-status-badge"
                          style={{
                            color: getStatusColor(selectedPluginData.status),
                            background: `${getStatusColor(selectedPluginData.status)}15`
                          }}
                        >
                          <span className="status-dot" />
                          {getStatusLabel(selectedPluginData.status)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: '#6b7280', padding: '8px 0' }}>加载时间</td>
                      <td style={{ padding: '8px 0' }}>
                        {new Date(selectedPluginData.loadedAt).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">描述</div>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
                  {selectedPluginData.manifest.description}
                </p>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">
                  所需权限 ({selectedPluginData.manifest.permissions.length})
                </div>
                <div>
                  {selectedPluginData.manifest.permissions.map((perm) => (
                    <span key={perm} className="permission-tag">
                      {getPermissionLabel(perm)}
                    </span>
                  ))}
                </div>
              </div>

              {selectedPluginData.manifest.homepage && (
                <div className="detail-section">
                  <div className="detail-section-title">链接</div>
                  <a
                    href={selectedPluginData.manifest.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                  >
                    访问主页 →
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showInstallDialog && (
        <div className="modal-overlay" onClick={() => setShowInstallDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">安装插件</h3>
            <input
              type="text"
              className="input-field"
              placeholder="输入插件 URL 或本地 manifest.json 路径"
              value={installUrl}
              onChange={(e) => setInstallUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              autoFocus
            />
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              支持 URL（http/https）或相对路径（./plugins/my-plugin/manifest.json）
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowInstallDialog(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleInstall}
                disabled={loading || !installUrl.trim()}
              >
                {loading ? '安装中...' : '确认安装'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginManagerPanel;
