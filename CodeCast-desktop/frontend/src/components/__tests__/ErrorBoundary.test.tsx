import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ErrorBoundary from '../ErrorBoundary';

function ThrowComponent(): never {
  throw new Error('Test error');
}

function NormalComponent() {
  return <div data-testid="normal-content">Normal content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('normal-content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('catches render errors and displays fallback UI', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowComponent />
      </ErrorBoundary>
    );

    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveClass('error-boundary');

    spy.mockRestore();
  });

  it('displays error icon', () => {
    render(
      <ErrorBoundary>
        <ThrowComponent />
      </ErrorBoundary>
    );

    const errorIcon = screen.getByText('⚠️');
    expect(errorIcon).toBeInTheDocument();
  });
});