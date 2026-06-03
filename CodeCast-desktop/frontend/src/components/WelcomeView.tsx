import React from 'react';

interface WelcomeViewProps {
  onSend: (msg: string) => void;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onSend }) => {
  const [text, setText] = React.useState('');
  return (
    <div className="welcome-view" style={{ padding: 40, textAlign: 'center' }}>
      <h2>欢迎使用 CodeCast</h2>
      <p>开始与 AI 对话 —— 工具会自动出现在右侧面板</p>
      <div style={{ marginTop: 20 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text) { onSend(text); setText(''); } }}
          placeholder="输入消息，回车发送"
          style={{ width: '60%', padding: 10, fontSize: 14 }}
        />
      </div>
    </div>
  );
};

export default WelcomeView;
