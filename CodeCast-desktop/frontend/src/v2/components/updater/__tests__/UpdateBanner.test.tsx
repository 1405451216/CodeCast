// components/updater/__tests__/UpdateBanner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from '../UpdateBanner';
import { useAppStore } from '../../../store';

vi.mock('../../../store', () => ({
  useAppStore: vi.fn(),
}));

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing when no update available', () => {
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: null,
      currentVersion: '1.0.0',
      downloadUpdate: vi.fn(),
      openReleasePage: vi.fn(),
    });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when version matches', () => {
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: { version: '1.0.0', title: 'Test' },
      currentVersion: '1.0.0',
      downloadUpdate: vi.fn(),
      openReleasePage: vi.fn(),
    });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when new version available', () => {
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: { version: '2.0.0', title: 'New Version', downloadURL: 'http://example.com' },
      currentVersion: '1.0.0',
      downloadUpdate: vi.fn(),
      openReleasePage: vi.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.getByText(/发现新版本 v2.0.0/)).toBeDefined();
  });

  it('calls downloadUpdate when download button clicked', () => {
    const downloadUpdate = vi.fn();
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: { version: '2.0.0', title: 'New Version', downloadURL: 'http://example.com' },
      currentVersion: '1.0.0',
      downloadUpdate,
      openReleasePage: vi.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('下载'));
    expect(downloadUpdate).toHaveBeenCalledWith('http://example.com');
  });

  it('calls openReleasePage when view button clicked', () => {
    const openReleasePage = vi.fn();
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: { version: '2.0.0', title: 'New Version', downloadURL: 'http://example.com' },
      currentVersion: '1.0.0',
      downloadUpdate: vi.fn(),
      openReleasePage,
    });
    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('查看'));
    expect(openReleasePage).toHaveBeenCalled();
  });

  it('dismisses banner when close button clicked', () => {
    vi.mocked(useAppStore).mockReturnValue({
      updateInfo: { version: '2.0.0', title: 'New Version', downloadURL: 'http://example.com' },
      currentVersion: '1.0.0',
      downloadUpdate: vi.fn(),
      openReleasePage: vi.fn(),
    });
    render(<UpdateBanner />);
    const closeBtn = screen.getByRole('button', { name: '' }); // close button has no text
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/发现新版本/)).toBeNull();
  });
});
