import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
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
              animation: 'shake 0.5s ease-in-out',
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
                查看错误详情
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
            @keyframes shake {
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
