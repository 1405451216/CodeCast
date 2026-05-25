import React, { useState, useEffect } from 'react';
import { useAppStore, AppState } from '../../store';
import type { AvailableModel } from '../../store/types';
import { getModelConfigs, getProviders, ModelConfigItem, ProviderPreset } from '../../api';

interface ModelSelectorProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ open, onToggle, onClose, dropdownRef }) => {
  const selectedModel = useAppStore((s: AppState) => s.selectedModel);
  const setSelectedModel = useAppStore((s: AppState) => s.setSelectedModel);

  const [configs, setConfigs] = useState<ModelConfigItem[]>([]);
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载用户配置的模型和 Provider 列表
  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        getModelConfigs().then((items) => (items || []).filter(item => item.enabled)),
        getProviders().then((list) => list || []),
      ]).then(([enabledConfigs, providerList]) => {
        setConfigs(enabledConfigs);
        setProviders(providerList);
        setLoading(false);
      }).catch(() => {
        setConfigs([]);
        setProviders([]);
        setLoading(false);
      });
    }
  }, [open]);

  // 按 provider 分组
  const groupedByProvider = configs.reduce<Record<string, ModelConfigItem[]>>((acc, item) => {
    if (!acc[item.provider]) acc[item.provider] = [];
    acc[item.provider].push(item);
    return acc;
  }, {});

  const providerIds = Object.keys(groupedByProvider);

  // 根据当前选中模型确定当前 provider tab
  const getProviderForModel = (model: string) => {
    for (const item of configs) {
      if (item.model === model) return item.provider;
    }
    return providerIds[0] || '';
  };

  const [activeProvider, setActiveProvider] = useState('');

  // 当 configs 加载完成后初始化 activeProvider
  useEffect(() => {
    if (configs.length > 0) {
      const provider = getProviderForModel(selectedModel);
      setActiveProvider(provider || providerIds[0] || '');
    }
  }, [configs, selectedModel]);

  const handleSelect = (model: string) => {
    setSelectedModel(model as AvailableModel);
    onClose();
  };

  const handleProviderClick = (providerId: string) => {
    setActiveProvider(providerId);
  };

  // 当前选中 provider 下的已配置模型
  const currentModels = groupedByProvider[activeProvider] || [];

  // 获取 provider 显示名称
  const getProviderName = (providerId: string) => {
    const preset = providers.find(p => p.id === providerId);
    return preset?.name || providerId;
  };

  return (
    <div className="model-dropdown-wrap" ref={dropdownRef}>
      <div className="model-selector" onClick={onToggle}>
        <span>{selectedModel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div className="model-dropdown-menu show">
          {loading ? (
            <div className="model-list-empty">加载中...</div>
          ) : configs.length === 0 ? (
            <div className="model-list-empty">
              <div className="model-list-empty-text">暂无可用模型</div>
              <div className="model-list-empty-hint">请前往 设置 → 配置 → 模型管理 添加模型</div>
            </div>
          ) : (
            <>
              {/* Provider tabs */}
              <div className="model-provider-tabs">
                {providerIds.map((providerId) => (
                  <div
                    key={providerId}
                    className={`model-provider-tab${activeProvider === providerId ? ' active' : ''}`}
                    onClick={() => handleProviderClick(providerId)}
                  >
                    {getProviderName(providerId)}
                  </div>
                ))}
              </div>
              {/* Model list for selected provider */}
              <div className="model-list">
                {currentModels.map((item) => (
                  <div
                    key={item.id}
                    className={`model-option${item.model === selectedModel ? ' selected' : ''}`}
                    onClick={() => handleSelect(item.model)}
                  >
                    <span className="model-name">{item.model}</span>
                    <span className="model-desc">{item.name || ''}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
