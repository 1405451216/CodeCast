import React, { useEffect, useState, useRef } from 'react';

interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ServiceWorkerRegistration: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const ANALYTICS_KEY = 'pwa-install-analytics';

  const trackInstallEvent = (event: string, data?: Record<string, unknown>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{}');
      
      if (!existing.events) existing.events = [];
      if (!existing.summary) {
        existing.summary = {
          totalPrompts: 0,
          totalAccepted: 0,
          totalDismissed: 0,
          conversionRate: 0
        };
      }

      const eventData = {
        event,
        timestamp: Date.now(),
        ...data
      };

      existing.events.push(eventData);

      switch (event) {
        case 'prompt_shown':
          existing.summary.totalPrompts++;
          break;
        case 'install_accepted':
          existing.summary.totalAccepted++;
          break;
        case 'install_dismissed':
          existing.summary.totalDismissed++;
          break;
      }

      if (existing.summary.totalPrompts > 0) {
        existing.summary.conversionRate = (
          (existing.summary.totalAccepted / existing.summary.totalPrompts) * 100
        ).toFixed(2);
      }

      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(existing));

      if (import.meta.env.DEV) {
        console.log('[PWA Analytics]', eventData);
      }
    } catch (error) {
      console.warn('[PWA] Failed to track install event:', error);
    }
  };

  const getInstallAnalytics = () => {
    try {
      return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{}');
    } catch {
      return {};
    }
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }

    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as PWAInstallPrompt);
      
      const hasDismissed = localStorage.getItem('pwa-install-dismissed');
      if (!hasDismissed) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    });

    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && 
                navigator.serviceWorker.controller) {
              showUpdateNotification(registration);
            }
          };
        }
      };

      console.log('[PWA] SW registered:', registration.scope);
    } catch (error) {
      console.error('[PWA] SW registration failed:', error);
    }
  };

  const showUpdateNotification = (registration: ServiceWorkerRegistration) => {
    registrationRef.current = registration;
    setShowUpdateModal(true);
  };

  const handleUpdateConfirm = () => {
    if (registrationRef.current?.waiting) {
      registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdateModal(false);
    window.location.reload();
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    trackInstallEvent('install_prompt_triggered');

    await installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === 'accepted') {
      console.log('[PWA] App installed');
      trackInstallEvent('install_accepted', {
        outcome: result.outcome,
        method: 'banner'
      });
    } else {
      trackInstallEvent('install_dismissed', {
        outcome: result.outcome,
        method: 'banner'
      });
    }

    setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    trackInstallEvent('install_dismissed', {
      method: 'banner_dismiss'
    });
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <>
      {!isOnline && (
        <div
          className="pwa-offline-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#f59e0b',
            color: '#000',
            textAlign: 'center',
            padding: '8px 16px',
            fontSize: 'var(--text-sm, 14px)',
            fontWeight: 600,
            zIndex: 9999,
            animation: 'slideDown 0.3s ease-out'
          }}
          role="alert"
        >
          ⚠️ 当前处于离线模式，部分功能可能受限
        </div>
      )}

      {showInstallBanner && installPrompt && (
        <div
          className="pwa-install-banner"
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--glass-bg, rgba(30,30,35,0.95))',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
            borderRadius: '16px',
            padding: '20px 24px',
            maxWidth: '400px',
            width: '90%',
            zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          role="dialog"
          aria-label="安装应用"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7c7cff, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0
              }}
            >
              🚀
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--text-base, 16px)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display, sans-serif)',
                  color: 'var(--text-primary, var(--text))'
                }}
              >
                安装 CodeCast
              </h3>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 'var(--text-sm, 14px)',
                  color: 'var(--text-secondary, var(--text-dim))',
                  lineHeight: 1.4
                }}
              >
                添加到主屏幕，获得更好的体验
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #7c7cff, #a78bfa)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: 'var(--text-sm, 14px)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,124,255,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              立即安装
            </button>

            <button
              onClick={handleDismissInstall}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: 'var(--text-secondary, var(--text-dim))',
                border: '1px solid var(--border-color, var(--border))',
                borderRadius: '8px',
                fontSize: 'var(--text-sm, 14px)',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-hover, rgba(255,255,255,0.05))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              稍后
            </button>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <>
          <div
            className="update-modal-backdrop"
            onClick={() => setShowUpdateModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 10000
            }}
          />
          <div
            className="update-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="update-title"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--glass-bg, rgba(30,30,35,0.98))',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.1))',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              zIndex: 10001,
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
            <h2 id="update-title" style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600 }}>
              发现新版本
            </h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              CodeCast有新版本可用，更新后将获得更好的功能和性能体验。
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleUpdateConfirm}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #7c7cff, #a78bfa)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
              >
                立即更新
              </button>

              <button
                onClick={() => setShowUpdateModal(false)}
                style={{
                  padding: '12px 28px',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                稍后提醒
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ServiceWorkerRegistration;
