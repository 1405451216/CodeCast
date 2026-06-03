import React from 'react';

interface ChatInputProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop }) => {
  const [text, setText] = React.useState('');
  return (
    <div className="chat-input" style={{ padding: 12, borderTop: '1px solid #ddd', display: 'flex', gap: 8 }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && text) { onSend(text); setText(''); } }}
        placeholder="输入消息，回车发送"
        style={{ flex: 1, padding: 10, fontSize: 14 }}
        disabled={isLoading}
      />
      {isLoading ? (
        <button onClick={onStop} style={{ padding: '0 20px' }}>停止</button>
      ) : (
        <button onClick={() => { if (text) { onSend(text); setText(''); } }} style={{ padding: '0 20px' }}>发送</button>
      )}
    </div>
  );
};

export default ChatInput;
