import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, AppState } from '../../store';
import type { AvailableModel } from '../../store/types';
import type { ModelConfig, ModelProvider, ModelUseCase, TokenUsage } from '../../types/models';

interface ModelSelectorProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const USE_CASE_LABELS: Record<string, string> = {
  daily_chat: '日常对话',
  coding_assistant: '编程助手',
  deep_reasoning: '深度推理',
  fast_completion: '快速完成',
  creative_writing: '创意写作',
  data_analysis: '数据分析',
};

const USE_CASE_COLORS: Record<string, string> = {
  daily_chat: '#4CAF50',
  coding_assistant: '#2196F3',
  deep_reasoning: '#9C27B0',
  fast_completion: '#FF9800',
  creative_writing: '#E91E63',
  data_analysis: '#00BCD4',
};

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ open, onToggle, onClose, dropdownRef }) => {
  const selectedModel = useAppStore((s: AppState) => s.selectedModel);
  const setSelectedModel = useAppStore((s: AppState) => s.setSelectedModel);
  const getAvailableModels = useAppStore((s: AppState) => s.getAvailableModels);
  const getCurrentModelInfo = useAppStore((s: AppState) => s.getCurrentModelInfo);
  const tokenUsage = useAppStore((s: AppState) => s.tokenUsage);

  const [searchQuery, setSearchQuery] = useState('');
  const [animatingModel, setAnimatingModel] = useState<string | null>(null);
  const [prevSelectedModel, setPrevSelectedModel] = useState(selectedModel);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedModel !== prevSelectedModel) {
      setAnimatingModel(selectedModel);
      setTimeout(() => setAnimatingModel(null), 300);
      setPrevSelectedModel(selectedModel);
    }
  }, [selectedModel, prevSelectedModel]);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
    }
  }, [open]);

  const availableModels = useMemo(() => {
    try {
      return getAvailableModels();
    } catch {
      return [];
    }
  }, [open, getAvailableModels]);

  const currentModelInfo = useMemo(() => {
    try {
      return getCurrentModelInfo();
    } catch {
      return { provider: null, model: null };
    }
  }, [selectedModel, getCurrentModelInfo]);

  const groupedByProvider = useMemo(() => {
    const groups: Record<string, { provider: ModelProvider; models: Array<{ model: ModelConfig; providerId: string }> }> = {};

    for (const item of availableModels) {
      if (!groups[item.providerId]) {
        groups[item.providerId] = { provider: item.provider, models: [] };
      }

      const modelLower = item.model.id.toLowerCase();
      const nameLower = (item.model.displayName || item.model.name).toLowerCase();
      if (!searchQuery || modelLower.includes(searchQuery.toLowerCase()) || nameLower.includes(searchQuery.toLowerCase())) {
        groups[item.providerId].models.push({ model: item.model, providerId: item.providerId });
      }
    }

    return groups;
  }, [availableModels, searchQuery]);

  const handleSelect = (modelId: string) => {
    setSelectedModel(modelId as AvailableModel);
    onClose();
  };

  const getModelDisplayName = (model: ModelConfig): string => {
    return model.displayName || model.name;
  };

  const renderTokenUsage = () => {
    if (!tokenUsage) return null;

    const usagePercent = tokenUsage.totalTokens > 0
      ? Math.min(100, (tokenUsage.totalTokens / (currentModelInfo.model?.contextWindow || 128000)) * 100)
      : 0;

    return (
      <div className="model-token-usage">
        <div className="token-usage-bar">
          <div
            className="token-usage-fill"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <span className="token-usage-text">
          {formatContextWindow(tokenUsage.totalTokens)} / {currentModelInfo.model ? formatContextWindow(currentModelInfo.model.contextWindow) : '-'}
        </span>
      </div>
    );
  };

  return (
    <div className="model-dropdown-wrap" ref={dropdownRef}>
      <div
        className={`model-selector${animatingModel ? ' animating' : ''}`}
        onClick={onToggle}
        title={`当前模型: ${getModelDisplayName(currentModelInfo.model || { name: selectedModel, displayName: '' } as ModelConfig)}`}
      >
        <div className="model-selector-content">
          {currentModelInfo.provider && (
            <span className="model-provider-icon">{currentModelInfo.provider.icon}</span>
          )}
          <span className={`model-selected-name${animatingModel ? ' fade-switch' : ''}`}>
            {getModelDisplayName(currentModelInfo.model || { name: selectedModel, displayName: '' } as ModelConfig)}
          </span>
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={open ? ' rotated' : ''}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div className="model-dropdown-menu show enhanced" ref={menuRef}>
          <div className="model-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="model-search-input"
              placeholder="搜索模型..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="model-search-clear" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>

          {currentModelInfo.model && (
            <div className="current-model-info">
              <div className="current-model-header">
                <span className="current-model-icon">{currentModelInfo.provider?.icon || '🤖'}</span>
                <div className="current-model-details">
                  <span className="current-model-name">{getModelDisplayName(currentModelInfo.model)}</span>
                  <span className="current-model-provider">{currentModelInfo.provider?.name || ''}</span>
                </div>
                {currentModelInfo.model.recommendedUse && (
                  <span
                    className="current-model-use-case"
                    style={{ backgroundColor: USE_CASE_COLORS[currentModelInfo.model.recommendedUse] + '20', color: USE_CASE_COLORS[currentModelInfo.model.recommendedUse] }}
                  >
                    {USE_CASE_LABELS[currentModelInfo.model.recommendedUse] || currentModelInfo.model.recommendedUse}
                  </span>
                )}
              </div>
              <div className="current-model-meta">
                <span title="上下文窗口">📐 {formatContextWindow(currentModelInfo.model.contextWindow)}</span>
                {currentModelInfo.model.pricing?.input !== undefined && (
                  <span title="输入价格">
                    💰 {currentModelInfo.model.pricing.input === 0 ? '免费' : `¥${currentModelInfo.model.pricing.input}/1M`}
                  </span>
                )}
              </div>
              {renderTokenUsage()}
            </div>
          )}

          <div className="model-groups-container">
            {Object.keys(groupedByProvider).length === 0 ? (
              <div className="model-list-empty">
                <div className="model-list-empty-text">
                  {searchQuery ? `未找到匹配 "${searchQuery}" 的模型` : '暂无可用模型'}
                </div>
                {!searchQuery && (
                  <div className="model-list-empty-hint">请前往 设置 → 模型管理 配置 API Key</div>
                )}
              </div>
            ) : (
              Object.entries(groupedByProvider).map(([providerId, group]) => (
                <div key={providerId} className="model-group">
                  <div className="model-group-header">
                    <span className="model-group-icon">{group.provider.icon}</span>
                    <span className="model-group-name">{group.provider.name}</span>
                    <span className="model-group-count">{group.models.length}</span>
                  </div>
                  <div className="model-group-list">
                    {group.models.map(({ model }) => {
                      const isSelected = model.id === selectedModel || model.name === selectedModel;

                      return (
                        <div
                          key={model.id}
                          className={`model-option-enhanced${isSelected ? ' selected' : ''}`}
                          onClick={() => handleSelect(model.id)}
                        >
                          <div className="model-option-main">
                            <div className="model-option-left">
                              <span className="model-option-name">{model.displayName || model.name}</span>
                              <div className="model-option-tags">
                                {model.tags?.slice(0, 2).map(tag => (
                                  <span key={tag} className="model-option-tag">{tag}</span>
                                ))}
                                {model.recommendedUse && (
                                  <span
                                    className="model-option-use-case"
                                    style={{
                                      backgroundColor: USE_CASE_COLORS[model.recommendedUse] + '18',
                                      color: USE_CASE_COLORS[model.recommendedUse],
                                      borderColor: USE_CASE_COLORS[model.recommendedUse] + '40'
                                    }}
                                  >
                                    {USE_CASE_LABELS[model.recommendedUse]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="model-option-right">
                              <span className="model-option-context" title="上下文窗口">
                                📐 {formatContextWindow(model.contextWindow)}
                              </span>
                            </div>
                          </div>
                          <div className="model-option-caps">
                            {model.capabilities.coding && <span className="cap-dot" title="代码能力" style={{ background: '#2196F3' }}>💻</span>}
                            {model.capabilities.vision && <span className="cap-dot" title="视觉能力" style={{ background: '#4CAF50' }}>👁️</span>}
                            {model.capabilities.reasoning && <span className="cap-dot" title="推理能力" style={{ background: '#9C27B0' }}>🧠</span>}
                            {model.capabilities.streaming && <span className="cap-dot" title="流式输出" style={{ background: '#FF9800' }}>📡</span>}
                            {model.capabilities.functionCalling && <span className="cap-dot" title="函数调用" style={{ background: '#E91E63' }}>⚡</span>}
                            {model.capabilities.jsonMode && <span className="cap-dot" title="JSON模式" style={{ background: '#00BCD4' }}>{ }</span>}
                          </div>
                          {isSelected && (
                            <svg className="model-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="model-dropdown-footer">
            <span className="model-footer-hint">
              按 ↑↓ 快速切换 · Enter 确认 · Esc 关闭
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
