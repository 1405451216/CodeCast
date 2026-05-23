import React from 'react';
import { TabProps, renderSelect, renderRadioGroup } from './settingsHelpers';
import { S } from '../../settingsKeys';

const AppearanceTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">外观</div>

      <div className="settings-group">
        <div className="settings-group-title">主题</div>
        {renderRadioGroup('theme', settings.theme || 'dark', [
          { value: 'dark', title: '深色', desc: '深色主题，适合夜间使用' },
          { value: 'light', title: '浅色', desc: '浅色主题，适合白天使用' },
        ], updateAndSave)}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">字体大小</div>
        {renderSelect(S.font_size, settings.font_size || 'medium', [
          { value: 'small', label: '小' },
          { value: 'medium', label: '中' },
          { value: 'large', label: '大' },
        ], '字体大小', updateAndSave)}
      </div>
    </div>
  );
};

export default AppearanceTab;
