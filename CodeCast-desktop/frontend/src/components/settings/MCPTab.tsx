import React, { useState, useEffect } from 'react';
import { MCPServerItem } from './settingsHelpers';
import * as api from '../../api';

const MCPTab: React.FC = () => {
  const [mcpServers, setMcpServers] = useState<MCPServerItem[]>([]);
  const [mcpType, setMcpType] = useState<'stdio' | 'websocket'>('stdio');
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpCmd, setMcpCmd] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');

  const loadMCPServers = async () => {
    try {
      const s = await api.getSettings();
      if (s && Array.isArray(s.mcp_servers)) {
        setMcpServers(s.mcp_servers as unknown as MCPServerItem[]);
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    loadMCPServers();
  }, []);

  return (
    <div className="stab-panel">
      <div className="settings-section-title">MCP 服务器</div>

      <div className="settings-group">
        <div className="settings-group-title">服务器列表</div>
        {mcpServers.length === 0 ? (
          <div className="domain-list">
            <div className="empty-hint">暂无 MCP 服务器</div>
          </div>
        ) : (
          <div className="domain-list">
            {mcpServers.map((server) => (
              <div className="domain-item" key={server.id}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className={`toggle${server.enabled ? ' active' : ''}`}
                    style={{ width: '32px', height: '18px' }}
                    onClick={async () => {
                      try {
                        await api.toggleMCPServer(server.id, !server.enabled);
                        setMcpServers((prev) =>
                          prev.map((s) => (s.id === server.id ? { ...s, enabled: !s.enabled } : s)),
                        );
                      } catch (e) {
                        console.error('Toggle MCP server failed:', e);
                      }
                    }}
                  />
                  <span>{server.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({server.type})</span>
                </span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeMCPServer(server.id);
                      setMcpServers((prev) => prev.filter((s) => s.id !== server.id));
                    } catch (e) {
                      console.error('Remove MCP server failed:', e);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">添加服务器</div>
        <div className="form-group">
          <label className="form-label">类型</label>
          <select
            className="settings-select"
            value={mcpType}
            onChange={(e) => setMcpType(e.target.value as 'stdio' | 'websocket')}
            style={{ width: '100%' }}
          >
            <option value="stdio">stdio</option>
            <option value="websocket">websocket</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">名称</label>
          <input
            className="form-input"
            value={mcpName}
            onChange={(e) => setMcpName(e.target.value)}
            placeholder="服务器名称"
          />
        </div>
        {mcpType === 'websocket' ? (
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              className="form-input"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="ws://localhost:8080"
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">命令</label>
              <input
                className="form-input"
                value={mcpCmd}
                onChange={(e) => setMcpCmd(e.target.value)}
                placeholder="npx"
              />
            </div>
            <div className="form-group">
              <label className="form-label">参数（空格分隔）</label>
              <input
                className="form-input"
                value={mcpArgs}
                onChange={(e) => setMcpArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server"
              />
            </div>
          </>
        )}
        <button
          className="settings-add-btn"
          onClick={async () => {
            if (!mcpName) return;
            try {
              if (mcpType === 'websocket') {
                await api.addMCPServer(mcpName, mcpUrl);
              } else {
                const args = mcpArgs ? mcpArgs.split(' ').filter(Boolean) : [];
                await api.addMCPServerStdio(mcpName, mcpCmd, args);
              }
              await loadMCPServers();
              setMcpName('');
              setMcpUrl('');
              setMcpCmd('');
              setMcpArgs('');
            } catch (e) {
              alert('添加失败: ' + e);
            }
          }}
        >
          添加
        </button>
      </div>
    </div>
  );
};

export default MCPTab;
