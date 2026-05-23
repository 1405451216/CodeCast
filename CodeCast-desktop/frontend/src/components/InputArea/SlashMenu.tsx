import React from 'react';
import { SlashCommand } from '../../store';

interface SlashMenuProps {
  visible: boolean;
  filter: string;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

const SlashMenu: React.FC<SlashMenuProps> = ({
  visible,
  commands,
  selectedIndex,
  onSelect,
  onHover,
  menuRef,
}) => {
  if (!visible) return null;

  return (
    <div className="slash-menu visible" ref={menuRef}>
      {commands.length > 0 ? (
        commands.map((cmd, idx) => (
          <div
            key={cmd.id}
            className={`slash-menu-item ${idx === selectedIndex ? 'selected' : ''}`}
            onMouseEnter={() => onHover(idx)}
            onClick={() => onSelect(cmd)}
          >
            <div className="slash-menu-item-icon">{cmd.icon || '/'}</div>
            <div className="slash-menu-item-content">
              <div className="slash-menu-item-name">/{cmd.name}</div>
              <div className="slash-menu-item-desc">{cmd.description}</div>
            </div>
          </div>
        ))
      ) : (
        <div className="slash-menu-empty">没有匹配的命令</div>
      )}
    </div>
  );
};

export default SlashMenu;
