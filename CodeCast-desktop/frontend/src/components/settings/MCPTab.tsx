import React, { useState, useEffect } from 'react';
import { MCPServerItem } from './settingsHelpers';
import * as api from '../../api';

interface MCPStatusEntry {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
}

const MCPTab: React.FC = () => {
  const [mcpServers, setMcpServers] = useState<MCPServerItem[]>([]);
  const [mcpType, setMcpType] = useState<'stdio' | 'websocket'>('stdio');
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpCmd, setMcpCmd] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');
  const [serverTools, setServerTools] = useState<Record<string, string[]>>({});
  const [mcpStatus, setMcpStatus] = useState<Record<string, MCPStatusEntry>>({});
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  // Telemetry
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [telemetryEndpoint, setTelemetryEndpoint] = useState('http://localhost:4318');

  // Guardrail
  const [sanitizerEnabled, setSanitizerEnabled] = useState(false);
  const [sanitizerStrategy, setSanitizerStrategy] = useState('Mask');
  const [topicConstraints, setTopicConstraints] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');

  const loadMCPServers = async () => {
    try {
      const s = await api.getSettings();
      if (s && Array.isArray(s.mcp_servers)) {
        setMcpServers(s.mcp_servers as unknown as MCPServerItem[]);
      }
    } catch (e) { /* ignore */ }
  };

  const loadMCPStatus = async () => {
    try {
      const statuses = await api.getMCPStatus();
      const statusMap: Record<string, MCPStatusEntry> = {};
      statuses.forEach((status) => {
        statusMap[status.id] = status;
      });
      setMcpStatus(statusMap);
    } catch (e) {
      console.error('Failed to load MCP status:', e);
    }
  };

  const loadServerTools = async (serverId: string) => {
    try {
      const tools = await api.getMCPServerTools(serverId);
      setServerTools((prev) => ({ ...prev, [serverId]: tools }));
    } catch (e) {
      setServerTools((prev) => ({ ...prev, [serverId]: [] }));
    }
  };

  const handleToggleExpand = async (serverId: string) => {
    if (expandedServer === serverId) {
      setExpandedServer(null);
    } else {
      setExpandedServer(serverId);
      if (!serverTools[serverId]) {
        await loadServerTools(serverId);
      }
    }
  };

  useEffect(() => {
    loadMCPServers();
    loadMCPStatus();
    (async () => {
      try {
        const ts = await api.getTelemetryStatus();
        setTelemetryEnabled(ts.enabled);
        setTelemetryEndpoint(ts.endpoint || 'http://localhost:4318');
      } catch (e) { /* ignore */ }
      try {
        const gs = await api.getGuardrailStatus();
        setSanitizerEnabled(gs.sanitizerEnabled);
        setSanitizerStrategy(gs.sanitizerStrategy || 'Mask');
        setTopicConstraints(gs.topicConstraints || []);
      } catch (e) { /* ignore */ }
    })();
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
              <div key={server.id}>
                <div className="domain-item">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <button
                      className={`toggle${server.enabled ? ' active' : ''}`}
                      style={{ width: '32px', height: '18px' }}
                      onClick={async () => {
                        try {
                          await api.toggleMCPServer(server.id, !server.enabled);
                          setMcpServers((prev) =>
                            prev.map((s) => (s.id === server.id ? { ...s, enabled: !s.enabled } : s)),
                          );
                          await loadMCPStatus();
                        } catch (e) {
                          console.error('Toggle MCP server failed:', e);
                        }
                      }}
                    />
                    {server.enabled && mcpStatus[server.id] && !mcpStatus[server.id].connected && (
                      <span
                        style={{
                          color: '#d63030',
                          fontSize: '14px',
                          fontWeight: 'bold',
                        }}
                        title={mcpStatus[server.id].error || '未连接'}
                      >
                        ⚠
                      </span>
                    )}
                    <span
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleToggleExpand(server.id)}
                    >
                      {server.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({server.type})</span>
                    {server.enabled && serverTools[server.id] && serverTools[server.id].length > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {serverTools[server.id].length} tools
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={async () => {
                        try {
                          const result = await api.testMCPConnection(server.id);
                          if (result.success) {
                            await loadServerTools(server.id);
                            setExpandedServer(server.id);
                            await loadMCPStatus();
                            alert('连接成功! ' + (result.message || ''));
                          } else {
                            await loadMCPStatus();
                            alert('连接失败: ' + (result.message || '未知错误'));
                          }
                        } catch (e) {
                          await loadMCPStatus();
                          alert('测试失败: ' + e);
                        }
                      }}
                    >
                      测试
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.removeMCPServer(server.id);
                          setMcpServers((prev) => prev.filter((s) => s.id !== server.id));
                          setServerTools((prev) => {
                            const next = { ...prev };
                            delete next[server.id];
                            return next;
                          });
                          if (expandedServer === server.id) {
                            setExpandedServer(null);
                          }
                        } catch (e) {
                          console.error('Remove MCP server failed:', e);
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                </div>
                {expandedServer === server.id && (
                  <div style={{ paddingLeft: '40px', paddingBottom: '8px' }}>
                    {serverTools[server.id] && serverTools[server.id].length > 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div style={{ marginBottom: '4px', fontWeight: 500 }}>可用工具:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {serverTools[server.id].map((tool) => (
                            <span
                              key={tool}
                              style={{
                                background: 'var(--bg-tertiary)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {server.enabled ? '点击"测试"按钮查看可用工具' : '服务器已禁用'}
                      </div>
                    )}
                  </div>
                )}
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

      {/* Telemetry Section */}
      <div className="settings-group" style={{ marginTop: 16 }}>
        <div className="settings-group-title">OTLP 遥测</div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`toggle${telemetryEnabled ? ' active' : ''}`}
              style={{ width: '32px', height: '18px' }}
              onClick={async () => {
                try {
                  await api.toggleTelemetry(!telemetryEnabled);
                  setTelemetryEnabled(!telemetryEnabled);
                } catch (e) {
                  console.error('Toggle telemetry failed:', e);
                }
              }}
            />
            启用 OTLP 遥测
          </label>
        </div>
        {telemetryEnabled && (
          <div className="form-group">
            <label className="form-label">Endpoint</label>
            <input
              className="form-input"
              value={telemetryEndpoint}
              onChange={(e) => setTelemetryEndpoint(e.target.value)}
              onBlur={async () => {
                if (!telemetryEndpoint) return;
                try {
                  await api.setTelemetryEndpoint(telemetryEndpoint);
                } catch (e) {
                  console.error('Set telemetry endpoint failed:', e);
                }
              }}
              placeholder="http://localhost:4318"
            />
          </div>
        )}
      </div>

      {/* Guardrail Section */}
      <div className="settings-group" style={{ marginTop: 16 }}>
        <div className="settings-group-title">安全防护</div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`toggle${sanitizerEnabled ? ' active' : ''}`}
              style={{ width: '32px', height: '18px' }}
              onClick={async () => {
                try {
                  await api.toggleSanitizer(!sanitizerEnabled);
                  setSanitizerEnabled(!sanitizerEnabled);
                } catch (e) {
                  console.error('Toggle sanitizer failed:', e);
                }
              }}
            />
            输出脱敏 (Sanitizer)
          </label>
        </div>

        {sanitizerEnabled && (
          <div className="form-group">
            <label className="form-label">脱敏策略</label>
            <select
              className="settings-select"
              value={sanitizerStrategy}
              onChange={async (e) => {
                const val = e.target.value;
                try {
                  await api.setSanitizerStrategy(val);
                  setSanitizerStrategy(val);
                } catch (err) {
                  console.error('Set sanitizer strategy failed:', err);
                }
              }}
              style={{ width: '100%' }}
            >
              <option value="Mask">Mask (部分遮盖)</option>
              <option value="Redact">Redact (完全移除)</option>
              <option value="Replace">Replace (替换为占位符)</option>
              <option value="Hash">Hash (哈希替换)</option>
            </select>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">话题约束 (留空则不限制)</label>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              className="form-input"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="添加允许的话题"
              style={{ flex: 1 }}
            />
            <button
              className="settings-add-btn"
              onClick={async () => {
                const t = newTopic.trim();
                if (!t) return;
                const updated = [...topicConstraints, t];
                try {
                  await api.updateTopicConstraints(updated);
                  setTopicConstraints(updated);
                  setNewTopic('');
                } catch (e) {
                  console.error('Update topic constraints failed:', e);
                }
              }}
            >
              +
            </button>
          </div>
          {topicConstraints.length > 0 && (
            <div className="domain-list">
              {topicConstraints.map((topic, idx) => (
                <div className="domain-item" key={idx}>
                  <span>{topic}</span>
                  <button
                    onClick={async () => {
                      const updated = topicConstraints.filter((_, i) => i !== idx);
                      try {
                        await api.updateTopicConstraints(updated);
                        setTopicConstraints(updated);
                      } catch (e) {
                        console.error('Remove topic constraint failed:', e);
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
      </div>
    </div>
  );
};

export default MCPTab;
