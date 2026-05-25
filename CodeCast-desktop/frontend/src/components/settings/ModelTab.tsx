import React, { useState, useEffect, useCallback } from 'react';
import { TabProps } from './settingsHelpers';
import * as api from '../../api';
import { ModelConfigItem, ProviderPreset } from '../../api';
import { EventsEmit } from '../../../wailsjs/runtime/runtime';

// ─── 轻量 toast & confirm 工具 ─────────────────────────────────
function showToast(title: string, body: string, type: 'success' | 'error' | 'info' = 'info') {
  EventsEmit('notification', { title, body, type });
}

// ─── 添加/编辑模型弹窗 ─────────────────────────────────────────

interface ModelFormData {
  name: string;
  provider: string;
  models: string[];   // 多选模型
  apiKey: string;
  apiURL: string;
  maxContext: number;
  toolRounds: number;
  multimodal: boolean;
}

const defaultFormData: ModelFormData = {
  name: '',
  provider: '',
  models: [],
  apiKey: '',
  apiURL: '',
  maxContext: 0,
  toolRounds: 0,
  multimodal: false,
};

const ModelTab: React.FC<TabProps> = () => {
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState<'provider' | 'config'>('provider');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(defaultFormData);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ─── 内置确认弹窗状态 ─────────────────────────────────
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({ open: false, message: '', onConfirm: () => {}, onCancel: () => {} });

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

  // 加载模型配置
  const loadModels = async () => {
    try {
      const configs = await api.getModelConfigs();
      setModels(configs || []);
    } catch (e) {
      console.error('Failed to load model configs:', e);
    }
  };

  // 加载 Provider 列表（从后端 API 获取，避免前后端数据重复）
  const loadProviders = async () => {
    try {
      const list = await api.getProviders();
      setProviders(list || []);
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  };

  useEffect(() => {
    loadModels();
    loadProviders();
  }, []);

  // 打开添加模型弹窗
  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setDialogStep('provider');
    setShowAdvanced(false);
    setShowDialog(true);
  };

  // 打开编辑模型弹窗（编辑时只能改单个模型）
  const handleEdit = (item: ModelConfigItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      provider: item.provider,
      models: [item.model],
      apiKey: item.api_key,
      apiURL: item.api_url,
      maxContext: item.max_context,
      toolRounds: item.tool_rounds,
      multimodal: item.multimodal,
    });
    setDialogStep('config');
    setShowAdvanced(false);
    setShowDialog(true);
  };

  // 选择 Provider
  const handleSelectProvider = (providerId: string) => {
    setFormData({
      ...defaultFormData,
      provider: providerId,
      models: [],
      name: '',
    });
    setDialogStep('config');
  };

  // 切换模型选中状态
  const toggleModelSelection = (model: string) => {
    setFormData(prev => {
      const selected = prev.models.includes(model)
        ? prev.models.filter(m => m !== model)
        : [...prev.models, model];
      return { ...prev, models: selected };
    });
  };

  // 移除已选模型标签
  const removeModelTag = (model: string) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.filter(m => m !== model),
    }));
  };

  // 保存（新建或编辑）
  const handleSave = async () => {
    if (!editingId && formData.models.length === 0) {
      showToast('提示', '请至少选择一个模型', 'error');
      return;
    }

    try {
      if (editingId) {
        // 编辑模式：只更新单个
        await api.updateModelConfig(
          editingId, formData.name, formData.provider, formData.models[0],
          formData.apiKey, formData.apiURL, formData.maxContext, formData.toolRounds, formData.multimodal
        );
      } else {
        // 新建模式：为每个选中的模型创建配置
        const providerPreset = providers.find(p => p.id === formData.provider);
        for (const model of formData.models) {
          const name = formData.name || `${providerPreset?.name || formData.provider} - ${model}`;
          await api.addModelConfig(
            name, formData.provider, model,
            formData.apiKey, formData.apiURL, formData.maxContext, formData.toolRounds, formData.multimodal
          );
        }
      }
      setShowDialog(false);
      await loadModels();
      showToast('成功', editingId ? '模型配置已更新' : '模型已添加', 'success');
    } catch (e: any) {
      showToast('保存失败', e?.message || String(e), 'error');
    }
  };

  // 删除模型
  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('确定删除该模型配置？');
    if (!confirmed) return;
    try {
      await api.removeModelConfig(id);
      await loadModels();
      showToast('已删除', '模型配置已移除', 'success');
    } catch (e: any) {
      showToast('删除失败', e?.message || String(e), 'error');
    }
  };

  // 切换启用状态
  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await api.toggleModelConfig(id, !enabled);
      await loadModels();
    } catch (e: any) {
      showToast('切换失败', e?.message || String(e), 'error');
    }
  };

  // 获取当前 provider 对应的模型列表
  const currentPreset = providers.find(p => p.id === formData.provider);
  const availableModels = currentPreset?.models || [];

  return (
    <div className="stab-panel">
      <div className="settings-section-title">模型管理</div>

      {/* ─── 模型列表表格 ───────────────────────── */}
      <div className="model-table-container">
        <div className="model-table-header">
          <span className="model-table-col-name">模型名称</span>
          <span className="model-table-col-provider">服务商</span>
          <span className="model-table-col-model">模型</span>
          <span className="model-table-col-actions">操作</span>
        </div>

        {models.length === 0 ? (
          <div className="model-table-empty">
            暂无模型配置，点击下方按钮添加
          </div>
        ) : (
          models.map((item) => {
            const providerInfo = providers.find(p => p.id === item.provider);
            return (
              <div key={item.id} className={`model-table-row${!item.enabled ? ' disabled' : ''}`}>
                <span className="model-table-col-name">
                  {item.name || item.model}
                </span>
                <span className="model-table-col-provider">
                  <span className="provider-badge">{providerInfo?.name || item.provider}</span>
                </span>
                <span className="model-table-col-model">{item.model}</span>
                <span className="model-table-col-actions">
                  <button className="model-action-btn" onClick={() => handleEdit(item)} title="编辑">
                    ✏️
                  </button>
                  <button className="model-action-btn" onClick={() => handleDelete(item.id)} title="删除">
                    🗑️
                  </button>
                  <button
                    className={`toggle${item.enabled ? ' active' : ''}`}
                    onClick={() => handleToggle(item.id, item.enabled)}
                    title={item.enabled ? '禁用' : '启用'}
                  />
                </span>
              </div>
            );
          })
        )}
      </div>

      <button className="model-add-btn" onClick={handleAdd}>
        + 添加模型
      </button>

      {/* ─── 弹窗 ───────────────────────── */}
      {showDialog && (
        <div className="model-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="model-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Step 1: 选择 Provider */}
            {dialogStep === 'provider' && (
              <>
                <div className="model-dialog-title">选择模型服务商</div>
                <div className="provider-grid">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="provider-card"
                      onClick={() => handleSelectProvider(p.id)}
                    >
                      <div className="provider-card-name">{p.name}</div>
                      <div className="provider-card-url">{p.api_url}</div>
                    </div>
                  ))}
                </div>
                <div className="model-dialog-footer">
                  <button className="model-dialog-cancel" onClick={() => setShowDialog(false)}>
                    取消
                  </button>
                </div>
              </>
            )}

            {/* Step 2: 配置详情 */}
            {dialogStep === 'config' && (
              <>
                <div className="model-dialog-title">
                  {editingId ? '编辑模型配置' : '配置模型'}
                  {currentPreset && <span className="model-dialog-subtitle">{currentPreset.name}</span>}
                </div>

                <div className="model-dialog-body">
                  {/* 模型多选区域 */}
                  <div className="form-group">
                    <label className="form-label">模型 {!editingId && <span className="form-hint-inline">（可多选）</span>}</label>

                    {editingId ? (
                      // 编辑模式：单选下拉
                      availableModels.length > 0 ? (
                        <select
                          className="form-input"
                          value={formData.models[0] || ''}
                          onChange={(e) => setFormData({ ...formData, models: [e.target.value] })}
                        >
                          {availableModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          value={formData.models[0] || ''}
                          onChange={(e) => setFormData({ ...formData, models: [e.target.value] })}
                          placeholder="输入模型名称"
                        />
                      )
                    ) : (
                      // 新建模式：多选标签式
                      <div className="model-multi-select">
                        {/* 已选标签 */}
                        {formData.models.length > 0 && (
                          <div className="model-tags">
                            {formData.models.map(m => (
                              <span key={m} className="model-tag">
                                {m}
                                <button className="model-tag-remove" onClick={() => removeModelTag(m)}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* 可选模型列表 */}
                        <div className="model-options-grid">
                          {availableModels.map((m) => (
                            <div
                              key={m}
                              className={`model-option-chip${formData.models.includes(m) ? ' selected' : ''}`}
                              onClick={() => toggleModelSelection(m)}
                            >
                              <span className="model-option-check">
                                {formData.models.includes(m) ? '✓' : ''}
                              </span>
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!editingId && (
                    <div className="form-group">
                      <label className="form-label">配置名称 <span className="form-hint-inline">（可选）</span></label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="留空则自动生成"
                      />
                    </div>
                  )}

                  {editingId && (
                    <div className="form-group">
                      <label className="form-label">配置名称</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="如：我的 DeepSeek"
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">API 密钥</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="输入 API Key"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">自定义请求地址</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.apiURL}
                      onChange={(e) => setFormData({ ...formData, apiURL: e.target.value })}
                      placeholder={currentPreset?.api_url || '输入 API 地址'}
                    />
                    {currentPreset && !formData.apiURL && (
                      <span className="form-hint">默认: {currentPreset.api_url}</span>
                    )}
                  </div>

                  {/* 高级配置折叠区 */}
                  <div className="model-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                    <span>{showAdvanced ? '▾' : '▸'} 高级配置</span>
                  </div>

                  {showAdvanced && (
                    <div className="model-advanced-section">
                      <div className="form-group">
                        <label className="form-label">上下文窗口 (tokens)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.maxContext || ''}
                          onChange={(e) => setFormData({ ...formData, maxContext: parseInt(e.target.value) || 0 })}
                          placeholder="0 表示使用默认值"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">工具调用最大轮数</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.toolRounds || ''}
                          onChange={(e) => setFormData({ ...formData, toolRounds: parseInt(e.target.value) || 0 })}
                          placeholder="0 表示使用默认值"
                        />
                      </div>

                      <div className="settings-row" style={{ borderBottom: 'none', padding: '8px 0' }}>
                        <div className="settings-row-left">
                          <div className="settings-row-title">多模态支持</div>
                          <div className="settings-row-desc">启用图片/音频等多模态能力</div>
                        </div>
                        <button
                          className={`toggle${formData.multimodal ? ' active' : ''}`}
                          onClick={() => setFormData({ ...formData, multimodal: !formData.multimodal })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="model-dialog-footer">
                  <button
                    className="model-dialog-cancel"
                    onClick={() => {
                      if (editingId) {
                        setShowDialog(false);
                      } else {
                        setDialogStep('provider');
                      }
                    }}
                  >
                    {editingId ? '取消' : '返回'}
                  </button>
                  <button className="save-btn" onClick={handleSave}>
                    {editingId ? '保存修改' : `添加${formData.models.length > 1 ? ` (${formData.models.length})` : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ─── 确认弹窗 ───────────────────────── */}
      {confirmState.open && (
        <div className="model-dialog-overlay" onClick={confirmState.onCancel}>
          <div className="model-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="model-dialog-title">确认</div>
            <div className="model-dialog-body" style={{ padding: '16px 0' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{confirmState.message}</p>
            </div>
            <div className="model-dialog-footer">
              <button className="model-dialog-cancel" onClick={confirmState.onCancel}>取消</button>
              <button className="save-btn" onClick={confirmState.onConfirm}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelTab;
