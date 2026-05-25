import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingFallback from '../LoadingFallback';

describe('LoadingFallback', () => {
  it('renders with default message', () => {
    render(<LoadingFallback />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingFallback message="正在加载..." />);
    
    expect(screen.getByText('正在加载...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingFallback className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('loading-fallback');
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has correct ARIA attributes', () => {
    render(<LoadingFallback />);
    
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveAttribute('aria-live', 'polite');
  });

  it('contains loading spinner element', () => {
    render(<LoadingFallback />);
    
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});