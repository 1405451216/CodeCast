import React, { useState, useEffect } from 'react';
import { TabProps, renderToggle } from './settingsHelpers';
import { S } from '../../settingsKeys';
import * as api from '../../api';

const ModelTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [context1M, setContext1M] = useState(false);

  useEffect(() => {
    setContext1M(settings.context_1m || false);
  }, [settings.context_1m]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const c = await api.getConfig();
        if (c && c.api_key) setApiKey(c.api_key);
      } catch (e) { /* ignore */ }
    };
    loadConfig();
  }, []);

  const handleContext1MChange = async (key: string, value: any) => {
    setContext1M(!!value);
    await updateAndSave(key, value);
  };

  return (
    <div className="stab-panel">
      <div className="settings-section-title">配置</div>

      <div className="settings-group">
        <div className="settings-group-title">API 配置</div>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="password"
            className="form-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入 API Key"
          />
        </div>
        {renderToggle(S.long_context, context1M, '1M 上下文', handleContext1MChange, '启用 1M token 上下文窗口')}
        <div style={{ marginTop: '12px' }}>
          <button
            className="save-btn"
            onClick={async () => {
              try {
                if (apiKey) await api.setApiKey(apiKey);
                await api.updateSetting(S.long_context, context1M);
                await api.saveSettings({ ...settings, context_1m: context1M } as any);
                alert('配置已保存');
              } catch (e) {
                alert('保存失败: ' + e);
              }
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelTab;
