import React from 'react';
import { TabProps, renderToggle, renderSelect, renderRadioGroup } from './settingsHelpers';
import { S } from '../../settingsKeys';

const GeneralTab: React.FC<TabProps> = ({ settings, updateAndSave, isDarwin, modKey }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">常规</div>

      <div className="settings-group">
        <div className="settings-group-title">工作模式</div>
        {renderRadioGroup('work_mode', settings.work_mode || 'coding', [
          { value: 'coding', title: '编码', desc: '专注于代码编写和项目开发' },
          { value: 'daily', title: '日常', desc: '通用对话和日常任务' },
        ], updateAndSave)}
      </div>

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
    </div>
  );
};

export default GeneralTab;
