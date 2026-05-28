import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  moduleName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

class CastErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    console.error(`[CastErrorBoundary:${errorId}]`, error);
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, moduleName } = this.props;

    const errorReport = {
      id: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      module: moduleName || 'unknown',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    try {
      const existing = JSON.parse(localStorage.getItem('cast_error_log') || '[]');
      existing.unshift(errorReport);
      if (existing.length > 50) existing.length = 50;
      localStorage.setItem('cast_error_log', JSON.stringify(existing));
    } catch {}

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
  };

  handleReport = () => {
    const report = {
      errors: JSON.parse(localStorage.getItem('cast_error_log') || '[]'),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cast-error-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    const { children, fallback, moduleName } = this.props;
    const { hasError, error, errorId } = this.state;

    if (!hasError) return children;

    if (typeof fallback === 'function') {
      return fallback(error!, this.handleReset);
    }

    if (fallback) return fallback;

    return (
      <div className="cast-error-boundary-fallback">
        <div className="cast-error-icon">⚠️</div>
        <h3>组件运行出错</h3>
        {moduleName && <p className="error-module">模块: {moduleName}</p>}
        <p className="error-message">{error?.message || '未知错误'}</p>
        <p className="error-id">错误ID: {errorId}</p>

        <div className="cast-error-actions">
          <button className="cast-error-btn primary" onClick={this.handleReset}>
            🔄 重试
          </button>
          <button className="cast-error-btn secondary" onClick={this.handleReport}>
            📋 导出错误报告
          </button>
        </div>
      </div>
    );
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { moduleName?: string; fallback?: ReactNode }
): React.FC<P & { key?: string }> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const Wrapper: React.FC<P & { key?: string }> = (props) => (
    <CastErrorBoundary
      moduleName={options?.moduleName || displayName}
      fallback={options?.fallback}
    >
      <WrappedComponent {...props} />
    </CastErrorBoundary>
  );

  Wrapper.displayName = `withErrorBoundary(${displayName})`;
  return Wrapper;
}

export function createSafeCallback<T extends (...args: any[]) => any>(
  fn: T,
  fallback?: (...args: Parameters<T>) => ReturnType<T>
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((err) => {
          console.error('[SafeCallback] Promise error:', err);
          return fallback ? fallback(...args) : undefined as ReturnType<T>;
        });
      }
      return result;
    } catch (err) {
      console.error('[SafeCallback] Sync error:', err);
      return (fallback ? fallback(...args) : undefined) as ReturnType<T>;
    }
  }) as T;
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[SafeAsync${context ? ':' + context : ''}]`, err);
    return fallbackValue;
  }
}

export { CastErrorBoundary };
export default CastErrorBoundary;
