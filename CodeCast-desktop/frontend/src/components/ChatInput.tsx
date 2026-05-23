import React from 'react';
import { InputArea } from './InputArea';

const ChatInput: React.FC<{ onSend: (text: string) => void; isLoading?: boolean; onStop?: () => void }> = ({ onSend, isLoading, onStop }) => {
  return (
    <InputArea
      onSend={onSend}
      placeholder="继续对话..."
      autoFocus={false}
      isLoading={isLoading}
      onStop={onStop}
    />
  );
};

export default React.memo(ChatInput);
