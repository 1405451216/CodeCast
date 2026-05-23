import React from 'react';
import { TabProps, renderToggle } from './settingsHelpers';
import { S } from '../../settingsKeys';

const WorktreeTab: React.FC<TabProps> = ({ settings, updateAndSave }) => {
  return (
    <div className="stab-panel">
      <div className="settings-section-title">工作树</div>

      <div className="settings-group">
        {renderToggle(
          S.use_worktree,
          settings.worktree_enabled ?? false,
          '在独立工作树中运行',
          updateAndSave,
          '在独立的 git worktree 中执行任务，避免修改当前工作目录',
        )}
      </div>
    </div>
  );
};

export default WorktreeTab;
