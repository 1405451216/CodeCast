import React, { useState, useEffect } from 'react';
import { TabProps, renderSelect } from './settingsHelpers';
import { S } from '../../settingsKeys';
import * as api from '../../api';

const BrowserTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [newAllowedDomain, setNewAllowedDomain] = useState('');

  useEffect(() => {
    setBlockedDomains(settings.blocked_domains || []);
    setAllowedDomains(settings.allowed_domains || []);
  }, [settings.blocked_domains, settings.allowed_domains]);

  return (
    <div className="stab-panel">
      <div className="settings-section-title">浏览器使用</div>

      <div className="settings-group">
        <div className="settings-group-title">插件</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">Selenium IDE</div>
            <div className="settings-row-desc">用于录制和回放浏览器操作的插件</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {settings.selenium_installed ? '已安装' : '未安装'}
          </span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">浏览器</div>
        {renderSelect(S.browser_clear_data, settings.browser_clear_data || 'never', [
          { value: 'never', label: '从不' },
          { value: 'onClose', label: '关闭时' },
          { value: 'onStart', label: '启动时' },
        ], '清除浏览数据', updateAndSave)}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">权限</div>
        {renderSelect(S.browser_approval, settings.browser_approval || 'ask', [
          { value: 'ask', label: '每次询问' },
          { value: 'allow', label: '自动允许' },
          { value: 'deny', label: '自动拒绝' },
        ], '审批', updateAndSave)}
        {renderSelect(S.browser_history, settings.browser_history || 'keep', [
          { value: 'keep', label: '保留' },
          { value: 'clear', label: '清除' },
        ], '历史记录', updateAndSave)}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">已屏蔽的域名</div>
        <div className="domain-list">
          {blockedDomains.length === 0 ? (
            <div className="empty-hint">暂无屏蔽域名</div>
          ) : (
            blockedDomains.map((d) => (
              <div className="domain-item" key={d}>
                <span>{d}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeBlockedDomain(d);
                      setBlockedDomains((prev) => prev.filter((x) => x !== d));
                    } catch (e) {
                      console.error('Remove blocked domain failed:', e);
                    }
                  }}
                  title="删除"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="域名"
            value={newBlockedDomain}
            onChange={(e) => setNewBlockedDomain(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newBlockedDomain.trim()) {
                api.addBlockedDomain(newBlockedDomain.trim()).then(() => {
                  setBlockedDomains((prev) => [...prev, newBlockedDomain.trim()]);
                  setNewBlockedDomain('');
                }).catch(() => {});
              }
            }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!newBlockedDomain.trim()) return;
              try {
                await api.addBlockedDomain(newBlockedDomain.trim());
                setBlockedDomains((prev) => [...prev, newBlockedDomain.trim()]);
                setNewBlockedDomain('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">允许的域名</div>
        <div className="domain-list">
          {allowedDomains.length === 0 ? (
            <div className="empty-hint">暂无允许域名</div>
          ) : (
            allowedDomains.map((d) => (
              <div className="domain-item" key={d}>
                <span>{d}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.removeAllowedDomain(d);
                      setAllowedDomains((prev) => prev.filter((x) => x !== d));
                    } catch (e) {
                      console.error('Remove allowed domain failed:', e);
                    }
                  }}
                  title="删除"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="域名"
            value={newAllowedDomain}
            onChange={(e) => setNewAllowedDomain(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newAllowedDomain.trim()) {
                api.addAllowedDomain(newAllowedDomain.trim()).then(() => {
                  setAllowedDomains((prev) => [...prev, newAllowedDomain.trim()]);
                  setNewAllowedDomain('');
                }).catch(() => {});
              }
            }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!newAllowedDomain.trim()) return;
              try {
                await api.addAllowedDomain(newAllowedDomain.trim());
                setAllowedDomains((prev) => [...prev, newAllowedDomain.trim()]);
                setNewAllowedDomain('');
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

export default BrowserTab;
