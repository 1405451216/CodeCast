import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../theme-toggle';
import { getStoredTheme, setStoredTheme } from '../../design/theme';

vi.mock('../../design/theme', () => ({
  getStoredTheme: vi.fn(() => 'light'),
  setStoredTheme: vi.fn(),
}));

const mockedGetStoredTheme = vi.mocked(getStoredTheme);
const mockedSetStoredTheme = vi.mocked(setStoredTheme);

describe('ThemeToggle', () => {
  it('renders a button with aria-label', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('切换主题')).toBeInTheDocument();
  });

  it('shows moon icon when theme is light', () => {
    mockedGetStoredTheme.mockReturnValue('light');
    render(<ThemeToggle />);
    const btn = screen.getByLabelText('切换主题');
    const svg = btn.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('toggles theme from light to dark on click', () => {
    mockedGetStoredTheme.mockReturnValue('light');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('切换主题'));
    expect(mockedSetStoredTheme).toHaveBeenCalledWith('dark');
  });

  it('toggles theme from dark back to light', () => {
    mockedGetStoredTheme.mockReturnValue('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('切换主题'));
    expect(mockedSetStoredTheme).toHaveBeenCalledWith('light');
  });
});
