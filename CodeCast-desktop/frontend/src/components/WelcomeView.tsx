import React, { useState } from 'react';
import { useChatSender } from '../hooks/useChatSender';

interface WelcomeViewProps {
  onSend: (msg: string) => void;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onSend }) => {
  const { handleSendMessage } = useChatSender();
  const [text, setText] = useState('');

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText('');
    onSend(msg);
    await handleSendMessage(msg);
  };

  const suggestions = [
    { icon: '✍️', title: '写作', prompt: '帮我写一份本周项目进展周报' },
    { icon: '🌐', title: '翻译', prompt: '把"Hello World"翻译成中文' },
    { icon: '📚', title: '笔记', prompt: '在笔记里搜索 React Hooks 最佳实践' },
    { icon: '📅', title: '日程', prompt: '每天 9 点提醒我备份' },
    { icon: '🧠', title: '记忆', prompt: '回忆我们上次聊的项目' },
    { icon: '🔌', title: '插件', prompt: '安装 weather 插件' },
  ];

  return (
    <div className="welcome-view" style={{
      padding: 40, textAlign: 'center', maxWidth: 800, margin: '0 auto',
    }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>欢迎使用 CodeCast</h1>
      <p style={{ color: 'var(--text-secondary, #666)', marginBottom: 32 }}>
        AI 驱动的智能助手 · 43 个 Cast 工具随时待命
      </p>

      <div style={{ marginBottom: 32 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="描述你的需求，或选择下方面板中的工具..."
          rows={3}
          disabled={false}
          style={{
            width: '100%', padding: 14, fontSize: 15, resize: 'none',
            fontFamily: 'inherit', borderRadius: 8,
            border: '1px solid var(--border, #ddd)',
            background: 'var(--bg-input, #fff)',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{
            marginTop: 12, padding: '10px 32px', fontSize: 14,
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            opacity: text.trim() ? 1 : 0.5,
            borderRadius: 6, border: 'none',
            background: 'var(--primary, #1890ff)', color: '#fff',
          }}
        >
          发送
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginTop: 40,
      }}>
        {suggestions.map((s) => (
          <div
            key={s.title}
            onClick={() => { setText(s.prompt); }}
            style={{
              padding: 16, borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border, #eee)',
              background: 'var(--bg-card, #fafafa)',
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #f0f0f0)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card, #fafafa)'; }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>{s.prompt}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WelcomeView;
