import React, { useState, useEffect } from 'react';
import { TabProps, renderToggle, renderSelect, renderRadioGroup } from './settingsHelpers';
import { S } from '../../settingsKeys';
import * as api from '../../api';
import { UpdateInfo, UpdateProgress } from '../../api';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

const GeneralTab: React.FC<TabProps> = ({ settings, updateAndSave, isDarwin, modKey }) => {
  const [version, setVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    api.getCurrentVersion().then(setVersion).catch(() => {});
    const unsub = EventsOn('update-progress', (data: UpdateProgress) => {
      setProgress(data);
    });
    return unsub;
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateInfo(null);
    try {
      const info = await api.checkForUpdate();
      setUpdateInfo(info);
    } catch (e: any) {
      setProgress({ phase: 'error', percent: 0, message: e?.message || '检查失败' });
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    if (!updateInfo?.download_url) return;
    setDownloading(true);
    try {
      const filePath = await api.downloadUpdate(updateInfo.download_url);
      await api.openDownloadedFile(filePath);
    } catch (e: any) {
      setProgress({ phase: 'error', percent: 0, message: e?.message || '下载失败' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="stab-panel">
      <div className="settings-section-title">常规</div>

      <div className="settings-group">
        <div className="settings-group-title">权限</div>
        {renderToggle(S.default_perm, settings.default_permission ?? true, '默认权限', updateAndSave, '允许基本文件操作')}
        {renderToggle(S.auto_review, settings.auto_review ?? false, '自动审核', updateAndSave, '自动审核代码变更')}
        {renderToggle(S.full_access, settings.full_access ?? false, '完全访问权限', updateAndSave, '允许所有文件和系统操作')}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">常规</div>
        {renderSelect(S.open_target, settings.default_target || 'editor', [
          { value: 'editor', label: '编辑器' },
          { value: 'terminal', label: '终端' },
          { value: 'browser', label: '浏览器' },
        ], '默认打开目标', updateAndSave)}
        {renderSelect(S.shell, settings.shell || (isDarwin ? 'zsh' : 'powershell'),
          isDarwin
            ? [
                { value: 'zsh', label: 'Zsh' },
                { value: 'bash', label: 'Bash' },
              ]
            : [
                { value: 'powershell', label: 'PowerShell' },
                { value: 'cmd', label: 'CMD' },
                { value: 'bash', label: 'Bash' },
                { value: 'zsh', label: 'Zsh' },
              ],
          'Shell', updateAndSave)}
        {renderSelect(S.language, settings.language || 'zh-CN', [
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en', label: 'English' },
          { value: 'ja', label: '日本語' },
        ], '语言', updateAndSave)}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">快捷键</div>
          </div>
          <button
            className="settings-add-btn"
            onClick={() => alert('请按下新的快捷键组合')}
          >
            {settings.hotkey || (isDarwin ? '⌘+Shift+K' : 'Ctrl+Shift+K')}
          </button>
        </div>
        {renderToggle(S.ctrl_enter_send, settings.ctrl_enter ?? false, `${modKey}+Enter 发送`, updateAndSave, `使用 ${modKey}+Enter 替代 Enter 发送消息`)}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">后续模式</div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['auto', 'manual', 'off'] as const).map((mode) => (
              <button
                key={mode}
                className="settings-add-btn"
                style={
                  (settings.followup_mode || 'auto') === mode
                    ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                    : {}
                }
                onClick={() => updateAndSave('followup_mode', mode)}
              >
                {mode === 'auto' ? '自动' : mode === 'manual' ? '手动' : '关闭'}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">审核模式</div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['normal', 'strict', 'off'] as const).map((mode) => (
              <button
                key={mode}
                className="settings-add-btn"
                style={
                  (settings.review_mode || 'normal') === mode
                    ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                    : {}
                }
                onClick={() => updateAndSave('review_mode', mode)}
              >
                {mode === 'normal' ? '标准' : mode === 'strict' ? '严格' : '关闭'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">通知</div>
        {renderSelect(S.notification_turn, settings.notification_turn || 'all', [
          { value: 'all', label: '所有轮次' },
          { value: 'last', label: '仅最后一轮' },
          { value: 'off', label: '关闭' },
        ], '轮次完成通知', updateAndSave)}
        {renderToggle(S.notification_permission, settings.notification_permission ?? true, '权限通知', updateAndSave, '权限请求时发送通知')}
        {renderToggle(S.notification_question, settings.notification_question ?? true, '问题通知', updateAndSave, '需要用户输入时发送通知')}
      </div>

      {/* ─── 软件更新 ───────────────────────── */}
      <div className="settings-group">
        <div className="settings-group-title">软件更新</div>
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-title">当前版本</div>
            <div className="settings-row-desc">v{version || '...'}</div>
          </div>
          <button
            className="settings-add-btn"
            onClick={handleCheckUpdate}
            disabled={checking}
          >
            {checking ? '检查中...' : '检查更新'}
          </button>
        </div>

        {/* 更新进度 */}
        {progress && progress.phase !== 'done' && (
          <div className="settings-row" style={{ borderBottom: 'none' }}>
            <div className="settings-row-left" style={{ width: '100%' }}>
              <div className="settings-row-desc" style={{ color: progress.phase === 'error' ? 'var(--error)' : 'var(--text-dim)' }}>
                {progress.message}
              </div>
              {progress.phase === 'downloading' && progress.percent > 0 && (
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress.percent}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 发现新版本 */}
        {updateInfo?.has_update && (
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-title">新版本 v{updateInfo.latest_version}</div>
              <div className="settings-row-desc">
                {updateInfo.release_notes?.slice(0, 100) || '新版本已发布'}
                {updateInfo.file_size > 0 && ` (${(updateInfo.file_size / 1048576).toFixed(1)} MB)`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="settings-add-btn"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? '下载中...' : '下载更新'}
              </button>
              <button
                className="settings-add-btn"
                onClick={() => api.openReleasePage()}
              >
                查看
              </button>
            </div>
          </div>
        )}

        {/* 已是最新 */}
        {updateInfo && !updateInfo.has_update && (
          <div className="settings-row" style={{ borderBottom: 'none' }}>
            <div className="settings-row-left">
              <div className="settings-row-desc" style={{ color: 'var(--success, #4caf50)' }}>
                ✓ 当前已是最新版本
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralTab;
