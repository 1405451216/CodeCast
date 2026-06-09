// components/updater/UpdateBanner.tsx
//
// Global banner at the top of the app when a new version is available.
// Dismissed once per session via sessionStorage.
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Button } from '../primitives/Button';

const DISMISS_KEY = 'codecast_update_banner_dismissed';

export function UpdateBanner() {
  const { updateInfo, currentVersion, downloadUpdate, openReleasePage } = useAppStore();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === 'true'; }
    catch { return false; }
  });

  // Reset dismissed when updateInfo changes (new update detected)
  useEffect(() => {
    if (updateInfo && updateInfo.version !== currentVersion) {
      setDismissed(false);
    }
  }, [updateInfo, currentVersion]);

  if (!updateInfo || updateInfo.version === currentVersion || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, 'true'); }
    catch { /* ignore */ }
  };

  const handleDownload = () => {
    downloadUpdate(updateInfo.downloadURL);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'var(--c-warning-bg, #fef3c7)',
        borderBottom: '1px solid var(--c-warning-border, #f59e0b)',
        fontSize: 13,
        color: 'var(--c-warning-text, #92400e)',
      }}
    >
      <span style={{ flex: 1 }}>
        发现新版本 v{updateInfo.version}: {updateInfo.title}
      </span>
      <Button variant="primary" onClick={handleDownload}>
        下载
      </Button>
      <Button
        variant="secondary"
        onClick={openReleasePage}
        style={{ background: 'transparent', color: 'var(--c-warning-text, #92400e)', borderColor: 'var(--c-warning-border, #f59e0b)', boxShadow: 'none' }}
      >
        查看
      </Button>
      <button
        onClick={handleDismiss}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          background: 'transparent',
          border: 'none',
          borderRadius: '50%',
          color: 'var(--c-warning-text, #92400e)',
          cursor: 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
