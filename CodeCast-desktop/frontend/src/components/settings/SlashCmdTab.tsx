import React, { useState, useEffect } from 'react';
import { SlashCommandItem } from './settingsHelpers';
import * as api from '../../api';

const BUILTIN_COMMANDS = [
  { name: '/help', description: '显示帮助信息' },
  { name: '/clear', description: '清空当前对话' },
  { name: '/compact', description: '压缩对话上下文' },
  { name: '/model', description: '切换模型' },
  { name: '/theme', description: '切换主题' },
];

const SlashCmdTab: React.FC = () => {
  const [slashCommands, setSlashCommands] = useState<SlashCommandItem[]>([]);
  const [cmdName, setCmdName] = useState('');
  const [cmdDesc, setCmdDesc] = useState('');
  const [cmdFillText, setCmdFillText] = useState('');

  const loadSlashCommands = async () => {
    try {
      const cmds = await api.getSlashCommands();
      if (Array.isArray(cmds)) setSlashCommands(cmds);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    loadSlashCommands();
  }, []);

  return (
    <div className="stab-panel">
      <div className="settings-section-title">斜杠命令</div>

      <div className="settings-group">
        <div className="settings-group-title">自定义命令</div>
        <div className="domain-list">
          {slashCommands.length === 0 ? (
            <div className="empty-hint">暂无自定义命令</div>
          ) : (
            slashCommands.map((cmd) => (
              <div className="domain-item" key={cmd.id || cmd.name}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 500 }}>/{cmd.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.description}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.removeSlashCommand(cmd.id);
                      await loadSlashCommands();
                    } catch (e) {
                      console.error('Remove slash command failed:', e);
                    }
                  }}
                  title="删除"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="命令名称"
            value={cmdName}
            onChange={(e) => setCmdName(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
          <input
            className="form-input"
            placeholder="描述"
            value={cmdDesc}
            onChange={(e) => setCmdDesc(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            className="form-input"
            placeholder="填充文本"
            value={cmdFillText}
            onChange={(e) => setCmdFillText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="settings-add-btn"
            onClick={async () => {
              if (!cmdName) return;
              try {
                await api.addSlashCommand(cmdName, cmdDesc, cmdFillText);
                await loadSlashCommands();
                setCmdName('');
                setCmdDesc('');
                setCmdFillText('');
              } catch (e) {
                alert('添加失败: ' + e);
              }
            }}
          >
            添加
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">内置命令</div>
        <div className="domain-list">
          {BUILTIN_COMMANDS.map((cmd) => (
            <div className="domain-item" key={cmd.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 500 }}>{cmd.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cmd.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SlashCmdTab;
