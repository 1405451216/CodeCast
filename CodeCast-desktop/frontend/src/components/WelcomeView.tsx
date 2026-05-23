import React, { useRef } from 'react';
import InputArea, { type InputAreaHandle } from './InputArea/InputArea';
import { useAppStore } from '../store';

interface WelcomeViewProps {
  onSend: (text: string) => void;
}

const quickActions = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    ),
    title: '写代码',
    desc: '描述需求',
    prompt: '帮我写一段代码：',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    ),
    title: '改Bug',
    desc: '粘贴报错',
    prompt: '帮我修复这个错误：\n',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    ),
    title: '解释',
    desc: '贴入代码',
    prompt: '请解释这段代码的作用：\n',
  },
];

const WelcomeView: React.FC<WelcomeViewProps> = ({ onSend }) => {
  const sessions = useAppStore((s) => s.sessions);
  const setCurrentSessionId = useAppStore((s) => s.setCurrentSessionId);
  const inputRef = useRef<InputAreaHandle>(null);

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime())
    .slice(0, 5);

  const handleQuickAction = (prompt: string) => {
    if (inputRef.current) {
      inputRef.current.setText(prompt);
      setTimeout(() => inputRef.current?.submit(), 50);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div className="welcome-view">
      <div className="welcome-brand">
        <h1 className="welcome-title">✦ CodeCast</h1>
        <p className="welcome-subtitle">AI 帮你写代码，把想法铸成产物</p>
      </div>

      <div className="welcome-cards">
        {quickActions.map((action) => (
          <div
            key={action.title}
            className="welcome-card"
            onClick={() => handleQuickAction(action.prompt)}
          >
            <div className="welcome-icon-card">{action.icon}</div>
            <h3>{action.title}</h3>
            <p>{action.desc}</p>
          </div>
        ))}
      </div>

      <div className="welcome-input-area">
        <InputArea
          ref={inputRef}
          onSend={onSend}
          placeholder="可向 CodeCast 询问任何事..."
          showProjectBar
        />
      </div>

      {recentSessions.length > 0 && (
        <div className="welcome-recent">
          <h3 className="welcome-recent-title">最近对话</h3>
          <div className="welcome-recent-list">
            {recentSessions.map((session) => (
              <div
                key={session.ID}
                className="welcome-recent-item"
                onClick={() => handleSessionClick(session.ID)}
              >
                <span className="welcome-recent-name">{session.Name}</span>
                <span className="welcome-recent-time">{formatTimeAgo(session.CreatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(WelcomeView);
