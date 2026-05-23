import React from 'react';
import { TabProps, renderToggle } from './settingsHelpers';
import { S } from '../../settingsKeys';

const GitTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">Git</div>

      <div className="settings-group">
        <div className="settings-group-title">Git 设置</div>
        {renderToggle(S.auto_commit, settings.auto_commit ?? false, '自动提交', updateAndSave, '在代码修改后自动提交更改')}
        {renderToggle(S.confirm_before_commit, settings.confirm_before_commit ?? true, '提交前确认', updateAndSave, '在提交前显示确认对话框')}
      </div>
    </div>
  );
};

export default GitTab;
