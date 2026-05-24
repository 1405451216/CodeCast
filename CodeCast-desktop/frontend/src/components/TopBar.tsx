import React from 'react';
import { useAppStore } from '../store';
import type { SessionMode } from '../store/types';

const TopBar: React.FC = () => {
  const view = useAppStore((s: any) => s.view);
  const activePanel = useAppStore((s: any) => s.activePanel);
  const pendingMode = useAppStore((s: any) => s.pendingMode) as SessionMode | null;
  const setPendingMode = useAppStore((s: any) => s.setPendingMode) as (mode: SessionMode | null) => void;

  const effectiveMode: SessionMode = pendingMode || 'daily';

  return (
    <div className="topbar">
      <div className="topbar-left">
      </div>
      <div className="topbar-right">
        {view === 'welcome' && !activePanel && (
          <div className="welcome-mode-switch">
            <button
              className={`mode-btn ${effectiveMode === 'coding' ? 'active' : ''}`}
              onClick={() => setPendingMode('coding')}
            >
              <span className="mode-btn-icon">💻</span>
              <span>Code</span>
            </button>
            <button
              className={`mode-btn ${effectiveMode === 'daily' ? 'active' : ''}`}
              onClick={() => setPendingMode('daily')}
            >
              <span className="mode-btn-icon">💬</span>
              <span>Cast</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TopBar);
