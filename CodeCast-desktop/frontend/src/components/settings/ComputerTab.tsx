import React from 'react';
import { TabProps, renderToggle } from './settingsHelpers';
import { S } from '../../settingsKeys';

const ComputerTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">电脑操控</div>

      <div className="settings-group">
        {renderToggle(
          S.computer_control,
          settings.computer_control ?? false,
          '允许鼠标和键盘控制',
          updateAndSave,
          '允许 AI 直接控制鼠标和键盘操作',
        )}
      </div>
    </div>
  );
};

export default ComputerTab;
