import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const IS_PRODUCTION = import.meta.env.PROD;
const SENTRY_SAMPLE_RATE = parseFloat(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '0.2');
const TRACES_SAMPLE_RATE = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1');

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN 未配置，跳过初始化');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `codecast@${import.meta.env.PACKAGE_VERSION || '1.0.0'}`,
    
    tracesSampleRate: IS_PRODUCTION ? TRACES_SAMPLE_RATE : 1.0,

    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
      }

      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }

      const errorMessage = event.exception?.values?.[0]?.value;
      if (errorMessage && shouldIgnoreError(errorMessage)) {
        return null;
      }

      event.tags = {
        ...event.tags,
        appVersion: import.meta.env.PACKAGE_VERSION || '1.0.0',
        platform: navigator.platform,
        language: navigator.language,
      };

      return event;
    },

    ignoreErrors: [
      /Non-Error promise rejection captured/,
      /ResizeObserver loop limit exceeded/,
      /Loading chunk \d+ failed/,
      /Network error/,
      /Failed to fetch dynamically imported module/,
      /QuotaExceededError/,
      /The operation is insecure/,
      /Can't reach the server/,
    ],

    denyUrls: [
      /extensions\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  console.log(`[Sentry] 初始化成功 | 环境: ${import.meta.env.MODE} | 采样率: ${SENTRY_SAMPLE_RATE}`);
}

function shouldIgnoreError(message: string): boolean {
  const ignoredPatterns = [
    /NetworkError/i,
    /Failed to fetch/i,
    /Load failed/i,
    /AbortError/i,
    /cancelled/i,
    /user cancelled/i,
  ];

  return ignoredPatterns.some(pattern => pattern.test(message));
}

export function captureException(error: Error, context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: Sentry.SeverityLevel;
}) {
  if (!SENTRY_DSN) {
    console.error('[Sentry]', error, context);
    return;
  }

  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}) {
  if (!SENTRY_DSN) {
    console.log(`[Sentry][${level}]`, message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

export function setUser(user: { id?: string; email?: string; username?: string }) {
  if (!SENTRY_DSN) return;

  Sentry.setUser(user);
}

export function setContext(key: string, context: any) {
  if (!SENTRY_DSN) return;

  Sentry.setContext(key, context);
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb(breadcrumb);
}

export { Sentry };
