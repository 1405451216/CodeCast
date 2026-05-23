import React from 'react';
import { useAppStore, AVAILABLE_MODELS, AppState, AvailableModel } from '../../store';

const MODEL_DESCRIPTIONS: Record<string, string> = {
  'deepseek-v4-flash': '快速响应',
  'deepseek-v4-pro': '高质量推理',
};

interface ModelSelectorProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ open, onToggle, onClose, dropdownRef }) => {
  const selectedModel = useAppStore((s: AppState) => s.selectedModel);
  const setSelectedModel = useAppStore((s: AppState) => s.setSelectedModel);

  const handleSelect = (model: string) => {
    setSelectedModel(model as any);
    onClose();
  };

  return (
    <div className="model-dropdown-wrap" ref={dropdownRef}>
      <div className="model-selector" onClick={onToggle}>
        <span>{selectedModel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div className="model-dropdown-menu show">
          {AVAILABLE_MODELS.map((m: AvailableModel) => (
            <div
              key={m}
              className={`model-option ${m === selectedModel ? 'selected' : ''}`}
              onClick={() => handleSelect(m)}
            >
              <span>{m}</span>
              <span className="model-desc">{MODEL_DESCRIPTIONS[m] || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
