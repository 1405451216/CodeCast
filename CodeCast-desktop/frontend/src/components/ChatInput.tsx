import React, { useState, useRef, useEffect } from 'react';
import { useChatSender } from '../hooks/useChatSender';
import * as api from '../api';
import type { ImageAttachment } from '../api/types';

interface ChatInputProps {
  onSend: (msg: string) => void;
  isLoading: boolean;
  onStop: () => void;
  sessionId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop, sessionId }) => {
  const { handleSendMessage } = useChatSender();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const addImageFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachments((prev) => [...prev, { type: 'image', data: dataUrl }]);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImageFromFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      addImageFromFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const msg = text.trim();
    if ((!msg && attachments.length === 0) || isLoading) return;
    setText('');
    const currentAttachments = [...attachments];
    setAttachments([]);

    if (currentAttachments.length > 0 && sessionId) {
      const attachmentsJSON = JSON.stringify(currentAttachments);
      try {
        await api.sendMessageWithAttachments(sessionId, msg, attachmentsJSON);
      } catch (e) {
        console.error('Send message with attachments failed:', e);
      }
    } else {
      onSend(msg);
      await handleSendMessage(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="chat-input"
      style={{
        padding: 12,
        borderTop: '1px solid var(--border, #ddd)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--bg-input, #fafafa)',
      }}
    >
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((att, idx) => (
            <div key={idx} style={{ position: 'relative', width: 60, height: 60 }}>
              <img
                src={att.data}
                alt={`attachment-${idx}`}
                style={{
                  width: 60,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                }}
              />
              <button
                onClick={() => removeAttachment(idx)}
                aria-label="remove attachment"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--danger, #e74c3c)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
          disabled={isLoading}
          style={{
            padding: '6px 10px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'transparent',
            fontSize: 16,
          }}
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息，回车发送（Shift+Enter 换行，可粘贴图片）"
          rows={2}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: 10,
            fontSize: 14,
            resize: 'none',
            fontFamily: 'inherit',
            borderRadius: 4,
            border: '1px solid var(--border, #ccc)',
          }}
        />
        {isLoading ? (
          <button onClick={onStop} style={{ padding: '0 20px', cursor: 'pointer' }}>
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && attachments.length === 0}
            style={{
              padding: '0 20px',
              cursor: text.trim() || attachments.length > 0 ? 'pointer' : 'not-allowed',
              opacity: text.trim() || attachments.length > 0 ? 1 : 0.5,
            }}
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
