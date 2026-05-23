import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

const isDev = import.meta.env?.DEV ?? import.meta.env?.MODE !== 'production';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isWailsError = this.state.error?.name === 'WailsBridgeError';

      return (
        <div style={{
          padding: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8f9fa'
        }}>
          <div style={{
            maxWidth: 500,
            background: '#fff',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ margin: '0 0 16px', color: '#dc3545' }}>
              ⚠️ 出现了一些问题
            </h2>
            <p style={{ color: '#666', marginTop: 8, lineHeight: 1.6 }}>
              {isWailsError
                ? '当前功能需要桌面应用环境支持，请在 CodeCast 桌面应用中使用此功能。'
                : (this.state.error?.message || '未知错误')}
            </p>
            <button
              onClick={this.handleRetry}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                cursor: 'pointer',
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.background = '#007bff'}
            >
              重试
            </button>
            {isDev && this.state.error && (
              <details style={{ marginTop: 20, textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: '#666', marginBottom: 8 }}>
                  开发者信息 (Dev Only)
                </summary>
                <pre style={{
                  background: '#f4f4f4',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 200,
                  color: '#333'
                }}>
                  {this.state.error.stack || this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}