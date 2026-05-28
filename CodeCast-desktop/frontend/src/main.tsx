import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './utils/sentry';
import globalErrorHandler from './utils/GlobalErrorHandler';
import './styles/index.css';

initSentry();
globalErrorHandler.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
