import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store';
import type { SessionMode } from '../store/types';
import '../styles/mode-selector.css';

interface ModeSelectorProps {
  onSelect: (mode: SessionMode) => void;
  onClose: () => void;
}

const MODES: { key: SessionMode; icon: string; title: string; desc: string }[] = [
  {
    key: 'coding',
    icon: '💻',
    title: '编程模式',
    desc: '代码生成、调试、文件操作、Git',
  },
  {
    key: 'daily',
    icon: '💬',
    title: '日常对话',
    desc: '写作、问答、翻译、分析',
  },
];

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelect, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(MODES[activeIndex].key);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % MODES.length);
      }
    },
    [activeIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="mode-selector-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="mode-selector-box">
        <div className="mode-selector-header">
          <span className="mode-selector-title">选择对话模式</span>
          <button className="mode-selector-close" onClick={onClose}>✕</button>
        </div>
        <div className="mode-selector-grid">
          {MODES.map((mode, i) => (
            <div
              key={mode.key}
              className={`mode-card ${i === activeIndex ? 'active' : ''}`}
              onClick={() => onSelect(mode.key)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="mode-card-icon">{mode.icon}</span>
              <span className="mode-card-title">{mode.title}</span>
              <span className="mode-card-desc">{mode.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ModeSelector);
