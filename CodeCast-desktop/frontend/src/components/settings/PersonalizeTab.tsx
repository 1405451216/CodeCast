import React from 'react';
import { TabProps, SettingsData, renderToggle, renderSelect } from './settingsHelpers';
import { S } from '../../settingsKeys';
import * as api from '../../api';

interface PersonalizeTabProps extends TabProps {
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
}

const PersonalizeTab: React.FC<PersonalizeTabProps> = ({ settings, updateAndSave, setSettings }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">个性化</div>

      <div className="settings-group">
        <div className="settings-group-title">个性</div>
        {renderSelect(S.personality, settings.personality || 'friendly', [
          { value: 'friendly', label: '亲和' },
          { value: 'professional', label: '专业' },
          { value: 'concise', label: '简洁' },
          { value: 'detailed', label: '详细' },
        ], '个性风格', updateAndSave)}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">自定义指令</div>
        <div className="form-group">
          <textarea
            className="form-input"
            style={{ minHeight: '100px', resize: 'vertical' }}
            value={settings.custom_instructions || ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, custom_instructions: e.target.value }))}
            placeholder="输入自定义指令，这些指令将附加到每次对话中..."
          />
        </div>
        <button
          className="save-btn"
          onClick={async () => {
            try {
              await api.updateSetting(S.custom_instructions, settings.custom_instructions || '');
              alert('自定义指令已保存');
            } catch (e) {
              alert('保存失败: ' + e);
            }
          }}
        >
          保存
        </button>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">记忆</div>
        {renderToggle(S.auto_memory, settings.memory_self ?? true, '自用记忆', updateAndSave, '记住您的偏好和习惯')}
        {renderToggle(S.tool_memory, settings.memory_tool ?? true, '通过工具辅助对话', updateAndSave, '使用记忆工具增强对话上下文')}
        <div className="settings-row" style={{ marginTop: '8px' }}>
          <div className="settings-row-left">
            <div className="settings-row-title">工作记忆保留条数</div>
            <div className="settings-row-desc">每次发送消息时保留的历史消息数量（越多越占 token）</div>
          </div>
          <input
            type="number"
            min={5}
            max={100}
            defaultValue={settings.message_history_limit ?? 20}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 5 && val <= 100) {
                api.updateSetting(S.message_history_limit, val as any).catch(console.error);
              } else {
                e.target.value = String(settings.message_history_limit ?? 20);
              }
            }}
            style={{
              width: '70px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          />
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            className="save-btn"
            style={{ background: '#e81123', color: 'white' }}
            onClick={async () => {
              if (confirm('确定要重置所有记忆吗？此操作不可撤销。')) {
                try {
                  await api.resetMemory();
                  alert('记忆已重置');
                } catch (e) {
                  alert('重置失败: ' + e);
                }
              }
            }}
          >
            重置记忆
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonalizeTab;
