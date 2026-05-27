import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../api';
import { logger } from '../../utils/logger';

interface StreamingCompletionProps {
  visible: boolean;
  position: { top: number; left: number };
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  filePath?: string;
  language?: string;
  onAccept: (text: string) => void;
  onDismiss: () => void;
}

const StreamingCompletion: React.FC<StreamingCompletionProps> = ({
  visible,
  position,
  textareaRef,
  filePath = '',
  language = 'typescript',
  onAccept,
  onDismiss
}) => {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showGhostText, setShowGhostText] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Start streaming when visible
  useEffect(() => {
    if (visible && textareaRef.current) {
      startStreaming();
    }

    return () => {
      cleanup();
    };
  }, [visible]);

  // Handle keyboard events for accept/dismiss
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && streamingText) {
        e.preventDefault();
        e.stopPropagation();
        
        // Accept the ghost text
        onAccept(streamingText);
        logger.info('StreamingCompletion', '✅ User accepted completion', { 
          length: streamingText.length 
        });
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Dismiss the suggestion
        onDismiss();
        logger.info('StreamingCompletion', '❌ User dismissed completion');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, streamingText, onAccept, onDismiss]);

  const startStreaming = useCallback(async () => {
    if (!textareaRef.current || isStreaming) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.slice(0, cursorPos);
    const textAfterCursor = textarea.value.slice(cursorPos);
    
    // Get current line context
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    
    // Extract prefix (last word or partial code)
    const prefixMatch = currentLine.match(/[\w.]*$/);
    const prefix = prefixMatch ? prefixMatch[0] : '';

    logger.info('StreamingCompletion', '🚀 Starting stream...', { 
      filePath, 
      language, 
      prefixLength: prefix.length,
      cursorPos
    });

    setIsStreaming(true);
    setStreamingText('');
    setShowGhostText(true);

    // Create new AbortController for this stream
    abortControllerRef.current = new AbortController();

    try {
      // Call backend streaming API
      await api.StreamCodeCompletions(
        {
          filepath: filePath,
          language: language,
          line: lines.length,
          column: currentLine.length + 1,
          line_content: currentLine,
          prefix: prefix,
          context: textBeforeCursor.slice(-500), // Last 500 chars as context
          max_results: 3,
          model: 'openai' // Will use configured model
        },
        (event) => {
          if (abortControllerRef.current?.signal.aborted) return;

          switch (event.type) {
            case 'start':
              logger.debug('StreamingCompletion', '⏳ Stream started');
              break;

            case 'delta':
              if (event.delta) {
                setStreamingText(prev => prev + event.delta);
                setShowGhostText(true);
                
                // Auto-scroll to show more content
                adjustTextareaHeight();
              }
              break;

            case 'done':
              logger.info('StreamingCompletion', '✅ Stream completed', {
                totalLength: streamingText.length + (event.delta?.length || 0),
                latency: event.metadata?.latency_ms
              });
              setIsStreaming(false);
              
              // Auto-accept after short delay if user doesn't interact
              streamTimeoutRef.current = setTimeout(() => {
                if (streamingText.length > 5) {
                  // Don't auto-accept, just show ghost text
                  logger.debug('StreamingCompletion', '👻 Ghost text ready for review');
                }
              }, 2000);
              break;

            case 'error':
              logger.error('StreamingCompletion', '❌ Stream error', event.error);
              setIsStreaming(false);
              setShowGhostText(false);
              break;
          }
        }
      );

    } catch (error) {
      logger.error('StreamingCompletion', '💥 Stream failed', error);
      setIsStreaming(false);
      setShowGhostText(false);
    }
  }, [filePath, language, isStreaming, textareaRef]);

  const cleanup = useCallback(() => {
    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear any pending timeout
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = undefined;
    }

    // Reset state
    setIsStreaming(false);
    setStreamingText('');
    setShowGhostText(false);
  }, []);

  const adjustTextareaHeight = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const originalHeight = textarea.style.height;
    
    // Temporarily expand height to show ghost text
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const estimatedLines = Math.ceil(streamingText.length / 40); // Rough estimate
    
    if (estimatedLines > 2) {
      textarea.style.height = `${Math.min(textarea.scrollHeight + lineHeight * estimatedLines, 300)}px`;
    }
  };

  if (!visible) return null;

  return (
    <div 
      className="streaming-completion-container"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        right: 0,
        zIndex: 1000,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Ghost Text Overlay */}
      <div 
        className="ghost-text-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          color: '#9ca3af', // Gray color like Copilot
          opacity: showGhostText ? 0.6 : 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          transition: 'opacity 0.15s ease-in-out',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      >
        {isStreaming ? (
          <>
            {streamingText}
            <span style={{ 
              animation: 'blink 1s infinite',
              marginLeft: '2px'
            }}>|</span>
          </>
        ) : (
          streamingText
        )}
      </div>

      {/* Status Indicator */}
      {(isStreaming || streamingText) && (
        <div style={{
          position: 'absolute',
          bottom: '-24px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#6b7280',
          background: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          pointerEvents: 'auto'
        }}>
          {isStreaming ? (
            <>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                background: '#3b82f6', 
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }}></span>
              <span>AI 生成中...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>{streamingText.length} 字符</span>
              <kbd style={{
                padding: '1px 4px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                fontFamily: 'monospace',
                fontSize: '10px'
              }}>Tab</kbd>
              <span>接受</span>
              <kbd style={{
                padding: '1px 4px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                fontFamily: 'monospace',
                fontSize: '10px'
              }}>Esc</kbd>
              <span>忽略</span>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default StreamingCompletion;