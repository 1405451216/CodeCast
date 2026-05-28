import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';
import LoadingFallback from '../LoadingFallback';

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should catch errors and display error UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    expect(document.querySelector('.error-boundary')).toBeInTheDocument();
  });

  it('should call componentDidCatch when error occurs', () => {
    const ThrowError = () => {
      throw new Error('Component error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('LoadingFallback', () => {
  it('should render with default message', () => {
    render(<LoadingFallback />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LoadingFallback message="正在加载..." />);

    expect(screen.getByText('正在加载...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingFallback className="custom-class" />);

    expect(container.firstChild).toHaveClass('loading-fallback');
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should have proper accessibility attributes', () => {
    render(<LoadingFallback />);

    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toHaveAttribute('aria-live', 'polite');
  });

  it('should contain spinner element', () => {
    render(<LoadingFallback />);

    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});
