import React, { useState, useRef, useEffect } from 'react';
import { useChatSender } from '../hooks/useChatSender';

interface ChatInputProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop }) => {
  const { handleSendMessage } = useChatSender();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setText('');
    onSend(msg);
    await handleSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input" style={{
      padding: 12, borderTop: '1px solid var(--border, #ddd)',
      display: 'flex', gap: 8, background: 'var(--bg-input, #fafafa)',
    }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息，回车发送（Shift+Enter 换行）"
        rows={2}
        disabled={isLoading}
        style={{
          flex: 1, padding: 10, fontSize: 14, resize: 'none',
          fontFamily: 'inherit', borderRadius: 4,
          border: '1px solid var(--border, #ccc)',
        }}
      />
      {isLoading ? (
        <button onClick={onStop} style={{ padding: '0 20px', cursor: 'pointer' }}>停止</button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{
            padding: '0 20px', cursor: text.trim() ? 'pointer' : 'not-allowed',
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          发送
        </button>
      )}
    </div>
  );
};

export default ChatInput;
