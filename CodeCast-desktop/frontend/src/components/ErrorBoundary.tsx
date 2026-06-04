import React from 'react';
import { cacheManager, performanceMonitor } from '../utils/performance';
import { captureException, addBreadcrumb, setContext } from '../utils/sentry';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorCount: number;
  lastErrorTime?: number;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  private maxErrorsBeforeRecovery = 3;
  private recoveryCooldown = 30000;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, lastErrorTime: Date.now() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1
    }));

    const metrics = performanceMonitor.getCurrentMetrics();
    console.error('[ErrorBoundary] Performance context:', {
      fps: metrics.fps,
      memoryUsage: metrics.memoryUsage,
      renderTime: metrics.renderTime,
      componentCount: metrics.componentCount
    });

    addBreadcrumb({
      category: 'error',
      message: `ErrorBoundary caught error #${this.state.errorCount + 1}`,
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack,
        timestamp: Date.now()
      }
    });

    setContext('error_boundary', {
      errorCount: this.state.errorCount + 1,
      performance: metrics,
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    captureException(error, {
      tags: {
        source: 'ErrorBoundary',
        errorCount: String(this.state.errorCount + 1),
        hasRecoveryOption: String(this.shouldAttemptAutoRecovery())
      },
      extra: {
        componentStack: errorInfo.componentStack,
        performanceContext: metrics
      },
      level: this.shouldAttemptAutoRecovery() ? 'fatal' : 'error'
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleRecoverAndReset = async () => {
    console.log('[ErrorBoundary] Starting recovery process...');

    try {
      const cleaned = await cacheManager.cleanup();
      if (cleaned > 0) {
        console.log(`[ErrorBoundary] Cleaned ${cleaned} cache entries`);
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes('codecast') || name.includes('workbox')) {
            await caches.delete(name);
            console.log(`[ErrorBoundary] Deleted cache: ${name}`);
          }
        }
      }

      performanceMonitor.clearHistory();

      console.log('[ErrorBoundary] Recovery complete');
    } catch (error) {
      console.error('[ErrorBoundary] Recovery failed:', error);
    } finally {
      this.handleReset();
    }
  };

  shouldAttemptAutoRecovery = (): boolean => {
    const { errorCount, lastErrorTime } = this.state;

    if (errorCount < this.maxErrorsBeforeRecovery) return false;

    if (!lastErrorTime) return false;

    const timeSinceLastError = Date.now() - lastErrorTime;
    return timeSinceLastError < this.recoveryCooldown;
  };

  render() {
    if (this.state.hasError) {
      const showRecoveryOption = this.shouldAttemptAutoRecovery();

      return (
        <div
          className="error-boundary"
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '40px',
            textAlign: 'center',
            background: 'var(--bg-primary, var(--bg))',
            color: 'var(--text-primary, var(--text))',
            fontFamily: 'var(--font-body, sans-serif)',
          }}
        >
          <div
            className="error-icon"
            style={{
              fontSize: '48px',
              marginBottom: '16px',
              animation: 'error-boundary-shake 0.5s ease-in-out',
            }}
            aria-hidden="true"
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: 'var(--text-xl, 1.25rem)',
              fontWeight: 600,
              marginBottom: '8px',
              fontFamily: 'var(--font-display, inherit)',
            }}
          >
            出现了一些问题
          </h1>

          <p
            style={{
              fontSize: 'var(--text-sm, 0.875rem)',
              color: 'var(--text-secondary, var(--text-dim))',
              maxWidth: '400px',
              marginBottom: '24px',
              lineHeight: 'var(--line-height-relaxed, 1.625)',
            }}
          >
            应用程序遇到了意外错误。请尝试刷新页面或点击下方按钮重置。
            {showRecoveryOption && (
              <>
                {' '}检测到多次错误，建议使用<strong style={{ color: 'var(--accent)' }}>性能恢复</strong>模式。
              </>
            )}
          </p>

          {this.state.error && (
            <details
              style={{
                marginBottom: '24px',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: 'var(--bg2)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: 'var(--text-sm, 0.875rem)',
                  color: 'var(--text-muted)',
                  userSelect: 'all',
                  transition: 'background-color 0.2s ease',
                }}
              >
                查看错误详情 ({this.state.errorCount} 次)
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'var(--code-bg)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: 'var(--text-xs, 0.75rem)',
                  color: 'var(--error, #f87171)',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontFamily: 'var(--font-mono, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md, 10px)',
                fontSize: 'var(--text-sm, 0.875rem)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'var(--shadow-glow, 0 0 20px rgba(124,124,255,0.3))',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(124,124,255,0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow, 0 0 20px rgba(124,124,255,0.3))';
              }}
            >
              重试
            </button>

            {showRecoveryOption && (
              <button
                onClick={this.handleRecoverAndReset}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md, 10px)',
                  fontSize: 'var(--text-sm, 0.875rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(245,158,11,0.3)';
                }}
              >
                🔧 性能恢复 + 重试
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: 'var(--text-primary, var(--text))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md, 10px)',
                fontSize: 'var(--text-sm, 0.875rem)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--glass-hover, rgba(255,255,255,0.06))';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              刷新页面
            </button>
          </div>

          <style>{`
            .error-boundary-shake {
              animation: error-boundary-shake 0.5s ease-in-out;
            }
            @keyframes error-boundary-shake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-10px); }
              40% { transform: translateX(10px); }
              60% { transform: translateX(-5px); }
              80% { transform: translateX(5px); }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export default ErrorBoundary;
