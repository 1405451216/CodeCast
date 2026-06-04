import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './utils/sentry';
import globalErrorHandler from './utils/GlobalErrorHandler';
import './styles/index.css';

initSentry();
globalErrorHandler.init();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found. Cannot mount CodeCast application.');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
