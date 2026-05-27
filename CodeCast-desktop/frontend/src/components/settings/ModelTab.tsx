import React, { useState, useEffect, useCallback } from 'react';
import { TabProps } from './settingsHelpers';
import { useAppStore, AppState } from '../../store';
import type { ModelProvider, ModelConfig, ProviderConfig } from '../../types/models';
import { BUILTIN_PROVIDERS } from '../../types/builtin-providers';
import { EventsEmit } from '../../../wailsjs/runtime/runtime';

function showToast(title: string, body: string, type: 'success' | 'error' | 'info' = 'info') {
  EventsEmit('notification', { title, body, type });
}

const USE_CASE_LABELS: Record<string, string> = {
  daily_chat: '日常对话',
  coding_assistant: '编程助手',
  deep_reasoning: '深度推理',
  fast_completion: '快速完成',
  creative_writing: '创意写作',
  data_analysis: '数据分析',
};

interface ModelTabProps extends TabProps {}

const ModelTab: React.FC<ModelTabProps> = () => {
  const providers = useAppStore((s: AppState) => s.providers);
  const providerConfigs = useAppStore((s: AppState) => s.providerConfigs);
  const selectedProviderId = useAppStore((s: AppState) => s.selectedProviderId);
  const connectionStatuses = useAppStore((s: AppState) => s.connectionStatuses);
  const testingConnection = useAppStore((s: AppState) => s.testingConnection);

  const updateProviderConfig = useAppStore((s: AppState) => s.updateProviderConfig);
  const setDefaultProvider = useAppStore((s: AppState) => s.setDefaultProvider);
  const removeProviderConfig = useAppStore((s: AppState) => s.removeProviderConfig);
  const testConnection = useAppStore((s: AppState) => s.testConnection);

  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<string, boolean>>({});
  const [editingApiKeys, setEditingApiKeys] = useState<Record<string, string>>({});
  const [editingBaseUrls, setEditingBaseUrls] = useState<Record<string, string>>({});
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({ open: false, message: '', onConfirm: () => {}, onCancel: () => {} });

  useEffect(() => {
    const store = useAppStore.getState();
    if (!store.initialized) {
      store.initFromStorage();
    }
  }, []);

  useEffect(() => {
    const keys: Record<string, string> = {};
    const urls: Record<string, string> = {};
    for (const [id, cfg] of Object.entries(providerConfigs)) {
      keys[id] = cfg.apiKey || '';
      urls[id] = cfg.baseUrl || '';
    }
    setEditingApiKeys(keys);
    setEditingBaseUrls(urls);
  }, [providerConfigs]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        message,
        onConfirm: () => { setConfirmState(s => ({ ...s, open: false })); resolve(true); },
        onCancel: () => { setConfirmState(s => ({ ...s, open: false })); resolve(false); },
      });
    });
  }, []);

  const getProviderStatus = (provider: ModelProvider): 'connected' | 'configured' | 'not_configured' | 'local' => {
    if (provider.authType === 'local' || provider.authType === 'none') return 'local';
    const cfg = providerConfigs[provider.id];
    if (!cfg || !cfg.apiKey) return 'not_configured';
    const status = connectionStatuses[provider.id];
    if (status?.connected) return 'connected';
    return 'configured';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="provider-status-badge connected">● 已连接</span>;
      case 'configured':
        return <span className="provider-status-badge configured">● 已配置</span>;
      case 'not_configured':
        return <span className="provider-status-badge not-configured">○ 未配置</span>;
      case 'local':
        return <span className="provider-status-badge local">🏠 本地</span>;
      default:
        return null;
    }
  };

  const handleToggleExpand = (providerId: string) => {
    setExpandedProvider(prev => prev === providerId ? null : providerId);
  };

  const handleApiKeyChange = (providerId: string, value: string) => {
    setEditingApiKeys(prev => ({ ...prev, [providerId]: value }));
  };

  const handleBaseUrlChange = (providerId: string, value: string) => {
    setEditingBaseUrls(prev => ({ ...prev, [providerId]: value }));
  };

  const handleSaveApiKey = (providerId: string) => {
    updateProviderConfig(providerId, { apiKey: editingApiKeys[providerId] || '' });
    showToast('成功', 'API Key 已保存', 'success');
  };

  const handleSaveBaseUrl = (providerId: string) => {
    updateProviderConfig(providerId, { baseUrl: editingBaseUrls[providerId] || '' });
    showToast('成功', 'Base URL 已保存', 'success');
  };

  const handleTestConnection = async (providerId: string) => {
    await testConnection(providerId);
    const status = useAppStore.getState().connectionStatuses[providerId];
    if (status?.connected) {
      showToast('连接成功', `${status.latencyMs}ms`, 'success');
    } else {
      showToast('连接失败', status?.error || '未知错误', 'error');
    }
  };

  const handleSetDefault = async (providerId: string) => {
    setDefaultProvider(providerId);
    showToast('已设置', `默认 Provider 已更改为 ${getProviderName(providerId)}`, 'success');
  };

  const handleClearConfig = async (providerId: string) => {
    const confirmed = await showConfirm(`确定要清除 ${getProviderName(providerId)} 的配置吗？`);
    if (!confirmed) return;
    removeProviderConfig(providerId);
    showToast('已清除', 'Provider 配置已移除', 'success');
  };

  const getProviderName = (providerId: string): string => {
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || providerId;
  };

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKeyMap(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const formatContextWindow = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return String(tokens);
  };

  const getPricingDisplay = (model: ModelConfig): string => {
    if (!model.pricing || model.pricing.input === 0) return '免费';
    return `¥${model.pricing.input}/${model.pricing.unit === 'per_million_tokens' ? '1M' : ''}`;
  };

  return (
    <div className="stab-panel">
      <div className="settings-section-title">模型管理</div>
      <p className="settings-section-desc">管理多模型服务商配置，支持同时使用多个 AI 提供商</p>

      <div className="provider-cards-grid">
        {providers.map((provider) => {
          const status = getProviderStatus(provider);
          const isExpanded = expandedProvider === provider.id;
          const cfg = providerConfigs[provider.id];
          const connStatus = connectionStatuses[provider.id];
          const isTesting = testingConnection === provider.id;
          const isDefault = selectedProviderId === provider.id;

          return (
            <div
              key={provider.id}
              className={`provider-card${isExpanded ? ' expanded' : ''}${isDefault ? ' is-default' : ''}`}
            >
              <div className="provider-card-header" onClick={() => handleToggleExpand(provider.id)}>
                <div className="provider-card-icon-name">
                  <span className="provider-card-icon">{provider.icon}</span>
                  <div className="provider-card-name-wrap">
                    <span className="provider-card-name">{provider.name}</span>
                    {getStatusBadge(status)}
                    {isDefault && <span className="default-badge">默认</span>}
                  </div>
                </div>
                <div className="provider-card-actions-top">
                  {connStatus?.latencyMs && (
                    <span className="latency-badge">{connStatus.latencyMs}ms</span>
                  )}
                  <svg
                    className={`expand-icon${isExpanded ? ' rotated' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              <p className="provider-card-desc">{provider.description}</p>

              {isExpanded && (
                <div className="provider-card-body">
                  {provider.authType === 'api_key' && (
                    <div className="config-row">
                      <label className="config-label">API Key</label>
                      <div className="api-key-input-wrap">
                        <input
                          type={showApiKeyMap[provider.id] ? 'text' : 'password'}
                          className="form-input api-key-input"
                          value={editingApiKeys[provider.id] || ''}
                          onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                          placeholder="输入 API Key..."
                        />
                        <button
                          className="api-key-toggle-btn"
                          onClick={() => toggleApiKeyVisibility(provider.id)}
                          type="button"
                        >
                          {showApiKeyMap[provider.id] ? '🙈' : '👁️'}
                        </button>
                        <button
                          className="api-key-save-btn"
                          onClick={() => handleSaveApiKey(provider.id)}
                          type="button"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="config-row">
                    <label className="config-label">Base URL</label>
                    <div className="base-url-input-wrap">
                      <input
                        type="text"
                        className="form-input base-url-input"
                        value={editingBaseUrls[provider.id] || ''}
                        onChange={(e) => handleBaseUrlChange(provider.id, e.target.value)}
                        placeholder={provider.baseUrl || 'https://...'}
                      />
                      <button
                        className="base-url-save-btn"
                        onClick={() => handleSaveBaseUrl(provider.id)}
                        type="button"
                      >
                        保存
                      </button>
                    </div>
                    {!editingBaseUrls[provider.id] && (
                      <span className="config-hint">默认: {provider.baseUrl}</span>
                    )}
                  </div>

                  <div className="config-row config-actions-row">
                    <button
                      className={`test-conn-btn${isTesting ? ' testing' : ''}${connStatus?.connected ? ' success' : ''}`}
                      onClick={() => handleTestConnection(provider.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? '⏳ 测试中...' : connStatus?.connected ? '✅ 已连接' : '🔌 测试连接'}
                    </button>

                    {!isDefault && cfg?.apiKey && (
                      <button
                        className="set-default-btn"
                        onClick={() => handleSetDefault(provider.id)}
                      >
                        ⭐ 设为默认
                      </button>
                    )}

                    {cfg && (cfg.apiKey || cfg.baseUrl) && (
                      <button
                        className="clear-config-btn"
                        onClick={() => handleClearConfig(provider.id)}
                      >
                        🗑️ 清除
                      </button>
                    )}
                  </div>

                  {connStatus?.error && !connStatus.connected && (
                    <div className="connection-error-msg">❌ {connStatus.error}</div>
                  )}

                  <div className="models-list-section">
                    <div className="models-list-title">可用模型 ({provider.models.length})</div>
                    <div className="models-grid">
                      {provider.models.map((model) => (
                        <div key={model.id} className="model-chip">
                          <div className="model-chip-header">
                            <span className="model-chip-name">{model.displayName || model.name}</span>
                            {model.tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="model-tag">{tag}</span>
                            ))}
                          </div>
                          <div className="model-chip-meta">
                            <span title="上下文窗口">📐 {formatContextWindow(model.contextWindow)}</span>
                            <span title="价格">{getPricingDisplay(model)}</span>
                            <span title="推荐用途">{USE_CASE_LABELS[model.recommendedUse] || model.recommendedUse}</span>
                          </div>
                          <div className="model-chip-caps">
                            {model.capabilities.coding && <span className="cap-badge" title="代码">💻</span>}
                            {model.capabilities.vision && <span className="cap-badge" title="视觉">👁️</span>}
                            {model.capabilities.reasoning && <span className="cap-badge" title="推理">🧠</span>}
                            {model.capabilities.streaming && <span className="cap-badge" title="流式">📡</span>}
                            {model.capabilities.functionCalling && <span className="cap-badge" title="函数调用">⚡</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmState.open && (
        <div className="model-dialog-overlay" onClick={confirmState.onCancel}>
          <div className="model-dialog confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="model-dialog-title">确认操作</div>
            <div className="model-dialog-body" style={{ padding: '16px 0' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{confirmState.message}</p>
            </div>
            <div className="model-dialog-footer">
              <button className="model-dialog-cancel" onClick={confirmState.onCancel}>取消</button>
              <button className="save-btn danger" onClick={confirmState.onConfirm}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelTab;
