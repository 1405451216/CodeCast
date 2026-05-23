import React, { useState, useEffect } from 'react';
import { EnvVarItem } from './settingsHelpers';
import * as api from '../../api';

const EnvTab: React.FC = () => {
  const [envVars, setEnvVars] = useState<EnvVarItem[]>([]);
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');

  const loadEnvVars = async () => {
    try {
      const envs = await api.getEnvVars();
      if (Array.isArray(envs)) setEnvVars(envs);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    loadEnvVars();
  }, []);

  return (
    <div className="stab-panel">
      <div className="settings-section-title">环境变量</div>

      <div className="settings-group">
        <div className="settings-group-title">环境变量列表</div>
        {envVars.length === 0 ? (
          <div className="domain-list">
            <div className="empty-hint">暂无环境变量</div>
          </div>
        ) : (
          <div className="domain-list">
            {envVars.map((ev) => (
              <div className="domain-item" key={ev.key}>
                <span>
                  <strong>{ev.key}</strong>={ev.value}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeEnvVar(ev.key);
                      await loadEnvVars();
                    } catch (e) {
                      console.error('Remove env var failed:', e);
                    }
                  }}
                  title="删除"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">添加环境变量</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="KEY"
            value={envKey}
            onChange={(e) => setEnvKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            className="form-input"
            placeholder="VALUE"
            value={envValue}
            onChange={(e) => setEnvValue(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!envKey) return;
              try {
                await api.addEnvVar(envKey, envValue);
                await loadEnvVars();
                setEnvKey('');
                setEnvValue('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnvTab;
