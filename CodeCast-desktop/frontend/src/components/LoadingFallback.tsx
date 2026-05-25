import React from 'react';

interface LoadingFallbackProps {
  message?: string;
  className?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ 
  message = '加载中...', 
  className = '' 
}) => (
  <div className={`loading-fallback ${className}`} role="status" aria-live="polite">
    <div className="loading-spinner" aria-hidden="true" data-testid="spinner" />
    <span className="loading-message">{message}</span>
  </div>
);

export default LoadingFallback;