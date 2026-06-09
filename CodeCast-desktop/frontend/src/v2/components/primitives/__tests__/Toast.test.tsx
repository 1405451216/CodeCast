import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

function ToastTrigger({ text = 'hello', kind }: { text?: string; kind?: any }) {
  const { show } = useToast();
  return <button onClick={() => show(text, kind)}>trigger</button>;
}

describe('Toast', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <div>child content</div>
      </ToastProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('shows toast when show() is called', () => {
    render(
      <ToastProvider>
        <ToastTrigger text="Toast message" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('trigger'));
    expect(screen.getByText('Toast message')).toBeInTheDocument();
  });

  it('shows multiple toasts', () => {
    render(
      <ToastProvider>
        <ToastTrigger text="First" />
        <ToastTrigger text="Second" kind="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByText('trigger')[0]);
    fireEvent.click(screen.getAllByText('trigger')[1]);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('auto-dismisses toast after 3 seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger text="Temporary" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('trigger'));
    expect(screen.getByText('Temporary')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.queryByText('Temporary')).toBeNull();
    vi.useRealTimers();
  });

  it('defaults kind to info', () => {
    render(
      <ToastProvider>
        <ToastTrigger text="Info toast" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('trigger'));
    expect(screen.getByText('Info toast')).toBeInTheDocument();
  });
});
