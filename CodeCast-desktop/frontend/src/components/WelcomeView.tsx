import React, { useRef, useMemo } from 'react';
import InputArea, { type InputAreaHandle } from './InputArea/InputArea';
import { useAppStore } from '../store';
import type { SessionMode } from '../store/types';

interface WelcomeViewProps {
  onSend: (text: string) => void;
}

const codingActions = [
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

const dailyActions = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
        <path d="M2 2l7.586 7.586"></path>
        <circle cx="11" cy="11" r="2"></circle>
      </svg>
    ),
    title: '写作',
    desc: '文案、报告、总结',
    prompt: '帮我写一篇关于',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    title: '问答',
    desc: '知识、分析、建议',
    prompt: '我想了解',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 8 6 6"></path>
        <path d="m4 14 6-6 2-3"></path>
        <path d="M2 5h12"></path>
        <path d="M7 2h1"></path>
        <path d="m22 22-5-10-5 10"></path>
        <path d="M14 18h6"></path>
      </svg>
    ),
    title: '翻译',
    desc: '多语言互译',
    prompt: '翻译以下内容为',
  },
];

const WelcomeView: React.FC<WelcomeViewProps> = ({ onSend }) => {
  const sessions = useAppStore((s) => s.sessions);
  const setCurrentSessionId = useAppStore((s) => s.setCurrentSessionId);
  const pendingMode = useAppStore((s: any) => s.pendingMode) as SessionMode | null;
  const inputRef = useRef<InputAreaHandle>(null);

  const effectiveMode: SessionMode = pendingMode || 'daily';

  const quickActions = effectiveMode === 'coding' ? codingActions : dailyActions;

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
        <p className="welcome-subtitle">
          {effectiveMode === 'coding' ? 'AI 帮你写代码，把想法铸成产物' : 'AI 助手，随时为你解答'}
        </p>
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
