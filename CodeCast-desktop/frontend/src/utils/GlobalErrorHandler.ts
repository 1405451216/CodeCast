import { captureException, addBreadcrumb, setContext, Sentry } from './sentry';

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private isInitialized = false;

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.setupUnhandledRejectionHandler();
    this.setupGlobalErrorHandler();
    this.setupResourceErrorHandler();

    console.log('[GlobalErrorHandler] 全局错误处理器已初始化');
  }

  private setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;

      addBreadcrumb({
        category: 'promise',
        message: '未处理的 Promise 拒绝',
        level: 'warning',
        data: {
          reason: error?.message || error,
          stack: error?.stack
        }
      });

      setContext('unhandled_rejection', {
        type: typeof error,
        message: error?.message,
        url: window.location.href
      });

      if (error instanceof Error) {
        captureException(error, {
          tags: { source: 'unhandledrejection' },
          level: 'warning'
        });
      } else {
        captureException(new Error(String(error)), {
          tags: { source: 'unhandledrejection' },
          level: 'warning'
        });
      }

      console.error('[GlobalErrorHandler] Unhandled rejection:', error);
    });
  }

  private setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      if (event.error) {
        addBreadcrumb({
          category: 'error',
          message: `全局错误: ${event.message}`,
          level: 'error',
          data: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });

        setContext('global_error', {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        });

        captureException(event.error, {
          tags: { source: 'global_error' },
          extra: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });

        console.error('[GlobalErrorHandler] Global error:', event.error);
      }
    });
  }

  private setupResourceErrorHandler() {
    window.addEventListener('error', (event) => {
      if (!event.error && (event.target as any)?.tagName) {
        const target = event.target as HTMLElement;

        addBreadcrumb({
          category: 'resource',
          message: `资源加载失败: ${target.tagName}`,
          level: 'warning',
          data: {
            tagName: target.tagName,
            src: (target as HTMLImageElement).src || 
                 (target as HTMLScriptElement).src || '',
            id: target.id || '',
            className: target.className || ''
          }
        });

        console.warn(
          '[GlobalErrorHandler] Resource loading error:', 
          `${(target as any).src || target.tagName}`
        );
      }
    }, true);
  }
}

export default GlobalErrorHandler.getInstance();
