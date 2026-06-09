// components/drawer/FilePreviewModal.tsx
//
// Modal for previewing file contents. Uses Files.readContent() to fetch text.
// Large files (>100KB) are truncated with a "Load full" button.
import { useState, useEffect } from 'react';
import { Files } from '../../wails/adapter';

const TRUNCATE_THRESHOLD = 100 * 1024; // 100KB

interface FilePreviewModalProps {
  path: string;
  onClose: () => void;
}

export function FilePreviewModal({ path, onClose }: FilePreviewModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const fileName = path.split(/[/\\]/).pop() || path;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTruncated(false);
    setShowFull(false);

    Files.readContent(path)
      .then((text) => {
        if (cancelled) return;
        if (text.length > TRUNCATE_THRESHOLD && !showFull) {
          setContent(text.slice(0, TRUNCATE_THRESHOLD));
          setTruncated(true);
        } else {
          setContent(text);
          setTruncated(false);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to read file');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, showFull]);

  const handleLoadFull = () => {
    setShowFull(true);
    setLoading(true);
    Files.readContent(path)
      .then((text) => {
        setContent(text);
        setTruncated(false);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'Failed to read file');
        setLoading(false);
      });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '80vw',
          maxWidth: 800,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--c-divider)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', fontFamily: 'var(--font-mono)' }}>
            {fileName}
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              color: 'var(--c-textMute)',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ color: 'var(--c-textMute)', fontSize: 13 }}>加载中…</div>
          ) : error ? (
            <div style={{ color: 'var(--c-error, #ef4444)', fontSize: 13 }}>{error}</div>
          ) : (
            <>
              <pre
                style={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  color: 'var(--c-text)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {content}
              </pre>
              {truncated && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button
                    onClick={handleLoadFull}
                    style={{
                      padding: '6px 16px',
                      background: 'var(--c-accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--r-md)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    加载完整文件
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
