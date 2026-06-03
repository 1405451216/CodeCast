import React from 'react';
import { useAppStore } from '../store';

const TopBar: React.FC = () => {
  const view = useAppStore((s: any) => s.view);
  const activePanel = useAppStore((s: any) => s.activePanel);

  return (
    <div className="topbar">
      <div className="topbar-left">
      </div>
      <div className="topbar-right">
        {view === 'welcome' && !activePanel && (
          <div className="welcome-prompt">
            <span>开始与 AI 对话 —— 工具会自动出现在右侧面板</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TopBar);
