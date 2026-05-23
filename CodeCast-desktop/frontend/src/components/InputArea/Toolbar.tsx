import React from 'react';
import { useAppStore, AppState } from '../../store';
import ModelSelector from './ModelSelector';

interface ToolbarProps {
  onAttach: () => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading?: boolean;
  modelOpen: boolean;
  onModelToggle: () => void;
  onModelClose: () => void;
  modelDropdownRef: React.RefObject<HTMLDivElement>;
  showRightSide?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAttach,
  onSend,
  onStop,
  isLoading = false,
  modelOpen,
  onModelToggle,
  onModelClose,
  modelDropdownRef,
  showRightSide = true,
}) => {
  const thinkingMode = useAppStore((s: AppState) => s.thinkingMode);
  const toggleThinkingMode = useAppStore((s: AppState) => s.toggleThinkingMode);

  return (
    <div className="input-toolbar">
      <div className="toolbar-left">
        <button className="attach-btn" onClick={onAttach} title="添加附件">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      <div className="toolbar-right">
        {showRightSide && (
          <>
            <ModelSelector
              open={modelOpen}
              onToggle={onModelToggle}
              onClose={onModelClose}
              dropdownRef={modelDropdownRef}
            />
            <button
              className={`thinking-toggle ${thinkingMode ? 'active' : ''}`}
              onClick={toggleThinkingMode}
              title="深度思考模式"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <line x1="9" y1="21" x2="15" y2="21" />
              </svg>
              思考
            </button>
          </>
        )}
        {isLoading ? (
          <button className="send-btn-round stop-btn" onClick={onStop} title="停止生成">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button className="send-btn-round" onClick={onSend} title="发送">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
