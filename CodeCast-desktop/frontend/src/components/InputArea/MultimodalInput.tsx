import React, { useRef, useState } from 'react';
import { useMultimodal } from '../../utils/multimodal/useMultimodal';

interface MultimodalInputProps {
  onTextSubmit: (text: string) => void;
  onImageSubmit?: (result: any) => void;
  onVideoSubmit?: (result: any) => void;
  placeholder?: string;
  disabled?: boolean;
  maxFileSize?: number; // in MB
}

const MultimodalInput: React.FC<MultimodalInputProps> = ({
  onTextSubmit,
  onImageSubmit,
  onVideoSubmit,
  placeholder = '输入消息或使用语音/图像/视频...',
  disabled = false,
  maxFileSize = 50
}) => {
  const [inputValue, setInputValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const {
    speech,
    image,
    video,
    
    startSpeechRecognition,
    stopSpeechRecognition,
    clearTranscript,
    
    analyzeImage,
    extractCodeFromImage,
    
    analyzeVideo,
    extractScreenshots,
    
    clearAllCaches
  } = useMultimodal();

  const handleSubmit = () => {
    const finalText = inputValue.trim() || speech.transcript.trim();
    
    if (!finalText) return;

    if (speech.transcript) {
      clearTranscript();
    }

    onTextSubmit(finalText);
    setInputValue('');
  };

  const handleSpeechToggle = async () => {
    if (speech.isListening) {
      stopSpeechRecognition();
      
      if (speech.transcript) {
        setInputValue(prev => prev + (prev ? ' ' : '') + speech.transcript);
        clearTranscript();
      }
    } else {
      try {
        await startSpeechRecognition('zh-CN');
      } catch (error) {
        console.error('Speech recognition failed:', error);
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`文件大小超过限制 (${maxFileSize}MB)`);
      return;
    }

    if (file.type.startsWith('image/')) {
      try {
        const result = await analyzeImage(file);
        
        if (onImageSubmit) {
          onImageSubmit(result);
        }
        
        if (result.text) {
          setInputValue(prev => prev + (prev ? '\n' : '') + `[图像识别]: ${result.text}`);
        }
        
        if (result.code) {
          setInputValue(prev => prev + '\n\n' + result.code);
        }

      } catch (error) {
        console.error('Image analysis failed:', error);
        alert('图像分析失败，请重试');
      }
    } else if (file.type.startsWith('video/')) {
      try {
        const result = await analyzeVideo(file);
        
        if (onVideoSubmit) {
          onVideoSubmit(result);
        }
        
        if (result.summary) {
          setInputValue(prev => prev + (prev ? '\n\n' : '') + `[视频分析]: ${result.summary}`);
        }

        if (result.extractedCode.length > 0) {
          setInputValue(prev => prev + '\n\n' + result.extractedCode.join('\n\n'));
        }

      } catch (error) {
        console.error('Video analysis failed:', error);
        alert('视频分析失败，请重试');
      }
    }

    event.target.value = '';
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        event.preventDefault();
        
        const file = items[i].getAsFile();
        if (file) {
          try {
            const result = await analyzeImage(file);
            
            if (onImageSubmit) {
              onImageSubmit(result);
            }
            
            if (result.text) {
              setInputValue(prev => prev + (prev ? '\n' : '') + `[粘贴图像]: ${result.text}`);
            }

          } catch (error) {
            console.error('Pasted image analysis failed:', error);
          }
        }
        break;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="multimodal-input-container">
      <div className="multimodal-input-wrapper">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            resize: 'vertical',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />

        {speech.transcript && (
          <div style={{
            padding: '8px 12px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            marginTop: '8px',
            fontSize: '13px',
            color: '#0369a1'
          }}>
            <span>🎤 语音输入：</span>
            {speech.transcript}
            <button
              onClick={() => {
                setInputValue(prev => prev + (prev ? ' ' : '') + speech.transcript);
                clearTranscript();
              }}
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              插入
            </button>
          </div>
        )}

        {image.lastResult && (
          <div style={{
            padding: '8px 12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            marginTop: '8px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px', color: '#15803d' }}>
              🖼️ 图像分析结果：
            </div>
            <div style={{ color: '#166534' }}>{image.lastResult.description}</div>
            
            {image.lastResult.tags.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {image.lastResult.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '2px 8px',
                    background: '#dcfce7',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#166534'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {video.lastResult && (
          <div style={{
            padding: '8px 12px',
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '6px',
            marginTop: '8px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: 500, marginBottom: '4px', color: '#7c3aed' }}>
              🎬 视频分析结果：
            </div>
            <div style={{ color: '#6b21a8' }}>{video.lastResult.summary}</div>
            
            {video.lastResult.detectedScenes.length > 0 && (
              <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
                检测到 {video.lastResult.detectedScenes.length} 个场景变化
              </div>
            )}
          </div>
        )}

        <div className="multimodal-toolbar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          gap: '8px'
        }}>
          <div className="multimodal-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSpeechToggle}
              disabled={!speech.isSupported || disabled}
              title={speech.isListening ? '停止语音输入' : '开始语音输入'}
              style={{
                padding: '8px 16px',
                background: speech.isListening ? '#ef4444' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: speech.isSupported && !disabled ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                opacity: !speech.isSupported ? 0.5 : 1
              }}
            >
              🎤
              {speech.isListening ? '停止' : '语音'}
              
              {speech.isListening && (
                <span style={{
                  width: '8px',
                  height: '8px',
                  background: 'white',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite'
                }} />
              )}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="上传图像或视频"
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px'
              }}
            >
              📷 图像/视频
            </button>

            <button
              onClick={clearAllCaches}
              disabled={disabled}
              title="清除缓存"
              style={{
                padding: '8px 12px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              🗑️
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={(!inputValue.trim() && !speech.transcript.trim()) || disabled}
            style={{
              padding: '10px 24px',
              background: (!inputValue.trim() && !speech.transcript.trim()) || disabled 
                ? '#d1d5db' 
                : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!inputValue.trim() && !speech.transcript.trim()) || disabled 
                ? 'not-allowed' 
                : 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            发送
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {!speech.isSupported && (
          <div style={{
            padding: '8px 12px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            marginTop: '8px',
            fontSize: '12px',
            color: '#92400e'
          }}>
            ⚠️ 当前浏览器不支持语音识别，建议使用 Chrome 或 Edge 浏览器
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default MultimodalInput;