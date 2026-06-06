// frontend/src/v2/lib/sentry.ts
import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  initialized = true;
  const dsn = (window as any).CODECAST_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: (window as any).CODECAST_ENV || 'production',
    release: `codecast-frontend@${(window as any).CODECAST_VERSION || 'dev'}`,
  });
}

export function captureError(e: unknown, context?: Record<string, any>) {
  Sentry.captureException(e, { extra: context });
}

export function addBreadcrumb(category: string, data: Record<string, any>) {
  Sentry.addBreadcrumb({ category, data, level: 'info' });
}
