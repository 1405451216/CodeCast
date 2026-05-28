import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { useCastApiServerStore } from '../../store/useCastApiServerStore';
import { castApiClient } from '../../utils/cast/cast-api-client';
import { castApiServer } from '../../utils/cast/cast-api-server';
import type { ApiRequestLog, CastApiRoute, ApiKeyInfo, ServerStats } from '../../types/cast-api';

const ApiServerPanel: React.FC = memo(() => {
  const {
    isRunning,
    port,
    routeCount,
    apiKeys,
    totalRequests,
    totalErrors,
    uptimeStart,
    startServer,
    stopServer,
    restartServer,
    generateApiKey,
    revokeApiKey,
    getRequestLogs,
    clearLogs,
    getStats,
    refreshFromServer
  } = useCastApiServerStore();

  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [routes, setRoutes] = useState<CastApiRoute[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [activeTab, setActiveTab] = useState<'routes' | 'keys' | 'logs' | 'stats'>('routes');
  const [logFilter, setLogFilter] = useState<string>('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [uptime, setUptime] = useState<string>('00:00:00');

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        if (uptimeStart) {
          const diff = Math.floor((Date.now() - uptimeStart) / 1000);
          const h = Math.floor(diff / 3600).toString().padStart(2, '0');
          const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
          const s = (diff % 60).toString().padStart(2, '0');
          setUptime(`${h}:${m}:${s}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, uptimeStart]);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setLogs(getRequestLogs().slice(0, 50));
        setRoutes(castApiServer.getRoutes());
        setStats(getStats());
      }, 2000);

      setLogs(getRequestLogs().slice(0, 50));
      setRoutes(castApiServer.getRoutes());
      setStats(getStats());

      return () => clearInterval(interval);
    } else {
      setLogs([]);
      setRoutes([]);
      setStats(null);
    }
  }, [isRunning, getRequestLogs, getStats]);

  const handleGenerateKey = useCallback(() => {
    if (!newKeyName.trim()) return;
    generateApiKey(newKeyName.trim());
    setNewKeyName('');
    setShowNewKeyModal(false);
    refreshFromServer();
  }, [newKeyName, generateApiKey, refreshFromServer]);

  const handleRevokeKey = useCallback((key: string) => {
    revokeApiKey(key);
    refreshFromServer();
  }, [revokeApiKey, refreshFromServer]);

  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) return logs;
    return logs.filter(l =>
      l.method.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.path.toLowerCase().includes(logFilter.toLowerCase())
    );
  }, [logs, logFilter]);

  const maskApiKey = (key: string): string => {
    if (key.length <= 12) return '*'.repeat(key.length);
    return key.substring(0, 8) + '*'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
  };

  const formatTimestamp = (ts: number): string => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
  };

  const methodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: '#10b981',
      POST: '#3b82f6',
      PUT: '#f59e0b',
      DELETE: '#ef4444',
      PATCH: '#8b5cf6'
    };
    return colors[method.toUpperCase()] || '#6b7280';
  };

  const statusBadge = (code: number): string => {
    if (code < 300) return 'cast-api-status-ok';
    if (code < 400) return 'cast-api-status-redirect';
    if (code < 500) return 'cast-api-status-client-error';
    return 'cast-api-status-server-error';
  };

  const exportOpenAPI = useCallback(async () => {
    try {
      const { generateOpenAPISpec } = await import(
        /* webpackChunkName: "openapi-spec" */
        '../../utils/cast/cast-openapi-spec'
      );
      const spec = generateOpenAPISpec();
      const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cast-api-openapi-spec.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[ApiServerPanel] Export OpenAPI failed:', e);
    }
  }, []);

  return (
    <div className="cast-api-panel">
      <div className="cast-api-header">
        <div className="cast-api-title-row">
          <span className="cast-api-title-icon">GLOBE</span>
          <h3 className="cast-api-title">Cast API Server</h3>
          <span className={`cast-api-status-dot ${isRunning ? 'running' : 'stopped'}`} />
          <span className="cast-api-status-text">
            {isRunning ? `Running on :${port}` : 'Stopped'}
          </span>
        </div>

        <div className="cast-api-controls">
          {!isRunning ? (
            <button className="cast-api-btn cast-api-btn-start" onClick={startServer}>
              Start Server
            </button>
          ) : (
            <>
              <button className="cast-api-btn cast-api-btn-stop" onClick={stopServer}>
                Stop
              </button>
              <button className="cast-api-btn cast-api-btn-restart" onClick={restartServer}>
                Restart
              </button>
            </>
          )}
          <span className="cast-api-uptime">
            Uptime: {isRunning ? uptime : '--:--:--'}
          </span>
        </div>
      </div>

      {isRunning && stats && (
        <div className="cast-api-stats-bar">
          <div className="cast-api-stat-item">
            <span className="cast-api-stat-label">Requests</span>
            <span className="cast-api-stat-value">{totalRequests.toLocaleString()}</span>
          </div>
          <div className="cast-api-stat-item">
            <span className="cast-api-stat-label">Errors</span>
            <span className="cast-api-stat-value">{totalErrors}</span>
          </div>
          <div className="cast-api-stat-item">
            <span className="cast-api-stat-label">Error Rate</span>
            <span className="cast-api-stat-value">
              {totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="cast-api-stat-item">
            <span className="cast-api-stat-label">QPS</span>
            <span className="cast-api-stat-value">{stats.requestsPerMinute.toFixed(1)}</span>
          </div>
          <div className="cast-api-stat-item">
            <span className="cast-api-stat-label">Routes</span>
            <span className="cast-api-stat-value">{routeCount}</span>
          </div>
        </div>
      )}

      <div className="cast-api-tabs">
        <button
          className={`cast-api-tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          Routes ({routeCount})
        </button>
        <button
          className={`cast-api-tab ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          Keys ({apiKeys.filter(k => k.enabled).length})
        </button>
        <button
          className={`cast-api-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs ({filteredLogs.length})
        </button>
        <button
          className={`cast-api-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
      </div>

      <div className="cast-api-tab-content">
        {activeTab === 'routes' && (
          <div className="cast-api-routes-section">
            <table className="cast-api-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Auth</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route, idx) => (
                  <tr key={`${route.method}-${route.path}-${idx}`}>
                    <td>
                      <span
                        className="cast-api-method-badge"
                        style={{ backgroundColor: methodColor(route.method), color: '#fff' }}
                      >
                        {route.method}
                      </span>
                    </td>
                    <td className="cast-api-path-cell">
                      <code>{route.path}</code>
                    </td>
                    <td>
                      <span className={`cast-api-auth-badge ${route.authRequired ? 'required' : 'public'}`}>
                        {route.authRequired ? 'Required' : 'Public'}
                      </span>
                    </td>
                    <td className="cast-api-desc-cell">{route.description}</td>
                  </tr>
                ))}
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="cast-api-empty">
                      No routes registered. Start the server to load built-in routes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="cast-api-keys-section">
            <div className="cast-api-keys-header">
              <h4>API Keys</h4>
              <button
                className="cast-api-btn cast-api-btn-primary"
                onClick={() => setShowNewKeyModal(true)}
              >
                + Generate Key
              </button>
            </div>

            <div className="cast-api-keys-list">
              {apiKeys.length === 0 && !showNewKeyModal && (
                <p className="cast-api-empty">No API keys generated yet.</p>
              )}

              {apiKeys.map((keyInfo) => (
                <div
                  key={keyInfo.key}
                  className={`cast-api-key-card ${keyInfo.enabled ? '' : 'revoked'}`}
                >
                  <div className="cast-api-key-info">
                    <div className="cast-api-key-name">{keyInfo.name}</div>
                    <code className="cast-api-key-value">{maskApiKey(keyInfo.key)}</code>
                    <div className="cast-api-key-meta">
                      <span>{keyInfo.permissions.join(', ')}</span>
                      <span>Used {keyInfo.usageCount}x</span>
                      {keyInfo.lastUsedAt && (
                        <span>Last: {formatTimestamp(keyInfo.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="cast-api-key-actions">
                    {keyInfo.enabled ? (
                      <button
                        className="cast-api-btn cast-api-btn-danger-sm"
                        onClick={() => handleRevokeKey(keyInfo.key)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="cast-api-key-revoked-badge">Revoked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="cast-api-logs-section">
            <div className="cast-api-logs-toolbar">
              <input
                type="text"
                className="cast-api-filter-input"
                placeholder="Filter by method or path..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
              />
              <button className="cast-api-btn cast-api-btn-sm" onClick={clearLogs}>
                Clear
              </button>
              <button
                className="cast-api-btn cast-api-btn-sm"
                onClick={() => {
                  const logText = logs
                    .map(l =>
                      `[${formatTimestamp(l.timestamp)}] ${l.method} ${l.path} -> ${l.statusCode} (${l.responseTime}ms)`
                    )
                    .join('\n');
                  const blob = new Blob([logText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cast-api-logs-${Date.now()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export
              </button>
            </div>

            <div className="cast-api-logs-list">
              {filteredLogs.length === 0 ? (
                <p className="cast-api-empty">No request logs yet.</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className={`cast-api-log-entry ${statusBadge(log.statusCode)}`}>
                    <span className="cast-api-log-time">{formatTimestamp(log.timestamp)}</span>
                    <span
                      className="cast-api-log-method"
                      style={{ color: methodColor(log.method), fontWeight: 700 }}
                    >
                      {log.method}
                    </span>
                    <span className="cast-api-log-path" title={log.path}>{log.path}</span>
                    <span className={`cast-api-log-status code-${log.statusCode}`}>
                      {log.statusCode}
                    </span>
                    <span className="cast-api-log-time-ms">{log.responseTime}ms</span>
                    {log.error && (
                      <span className="cast-api-log-error" title={log.error}>ERR</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="cast-api-stats-section">
            <div className="cast-api-stats-grid">
              <div className="cast-api-stats-card">
                <h5>Uptime</h5>
                <div className="cast-api-stats-big">{uptime}</div>
              </div>
              <div className="cast-api-stats-card">
                <h5>Requests/min</h5>
                <div className="cast-api-stats-big">{stats.requestsPerMinute.toFixed(1)}</div>
              </div>
              <div className="cast-api-stats-card">
                <h5>Error Rate</h5>
                <div className="cast-api-stats-big" style={{ color: stats.errorRate > 5 ? '#ef4444' : '#10b981' }}>
                  {stats.errorRate.toFixed(1)}%
                </div>
              </div>
              <div className="cast-api-stats-card">
                <h5>Active Keys</h5>
                <div className="cast-api-stats-big">{stats.activeApiKeys}</div>
              </div>
            </div>

            {stats.topEndpoints.length > 0 && (
              <div className="cast-api-top-endpoints">
                <h5>Top Endpoints</h5>
                {stats.topEndpoints.map((ep, i) => (
                  <div key={ep.path} className="cast-api-top-endpoint-row">
                    <span className="cast-api-rank">#{i + 1}</span>
                    <code className="cast-api-endpoint-path">{ep.path}</code>
                    <div className="cast-api-endpoint-bar-wrapper">
                      <div
                        className="cast-api-endpoint-bar"
                        style={{
                          width: `${(ep.count / stats.topEndpoints[0].count) * 100}%`
                        }}
                      />
                    </div>
                    <span className="cast-api-endpoint-count">{ep.count}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="cast-api-memory-usage">
              <h5>Memory Usage</h5>
              <div className="cast-api-mem-row">
                <span>Routes:</span><span>{stats.memoryUsage.routes}</span>
              </div>
              <div className="cast-api-mem-row">
                <span>Logs:</span><span>{stats.memoryUsage.logs}</span>
              </div>
              <div className="cast-api-mem-row">
                <span>Keys:</span><span>{stats.memoryUsage.keys}</span>
              </div>
            </div>

            <div className="cast-api-doc-links">
              <h5>API Documentation</h5>
              <div className="cast-api-doc-buttons">
                <button className="cast-api-btn cast-api-btn-outline" onClick={exportOpenAPI}>
                  OpenAPI Spec (.json)
                </button>
                <button
                  className="cast-api-btn cast-api-btn-outline"
                  onClick={async () => {
                    try {
                      const health = await castApiClient.getHealth();
                      alert(`Health check: ${JSON.stringify(health.data, null, 2)}`);
                    } catch (e) {
                      alert('Connection failed: ' + String(e));
                    }
                  }}
                >
                  Test Connection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="cast-api-footer-hint">
        <strong>TIP:</strong> External apps can send requests via BroadcastChannel{' '}
        <code>'cast-api-server'</code> or call{' '}
        <code>castApiClient.request()</code> directly.
      </div>

      {showNewKeyModal && (
        <div className="cast-api-modal-overlay" onClick={() => setShowNewKeyModal(false)}>
          <div className="cast-api-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Generate New API Key</h4>
            <label htmlFor="apiKeyName">Key Name</label>
            <input
              id="apiKeyName"
              type="text"
              className="cast-api-input"
              placeholder="e.g. my-app-key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateKey()}
              autoFocus
            />
            <div className="cast-api-modal-actions">
              <button className="cast-api-btn cast-api-btn-secondary" onClick={() => setShowNewKeyModal(false)}>
                Cancel
              </button>
              <button
                className="cast-api-btn cast-api-btn-primary"
                onClick={handleGenerateKey}
                disabled={!newKeyName.trim()}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ApiServerPanel.displayName = 'ApiServerPanel';

export default ApiServerPanel;
