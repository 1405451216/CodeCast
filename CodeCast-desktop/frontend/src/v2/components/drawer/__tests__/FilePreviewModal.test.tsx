// components/drawer/__tests__/FilePreviewModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilePreviewModal } from '../FilePreviewModal';
import { Files } from '../../../wails/adapter';

vi.mock('../../../wails/adapter', () => ({
  Files: {
    readContent: vi.fn(),
  },
}));

describe('FilePreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(Files.readContent).mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<FilePreviewModal path="/test/file.ts" onClose={() => {}} />);
    expect(screen.getByText('加载中…')).toBeDefined();
  });

  it('renders file content after load', async () => {
    vi.mocked(Files.readContent).mockResolvedValueOnce('const x = 1;');
    render(<FilePreviewModal path="/test/file.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('const x = 1;')).toBeDefined();
    });
  });

  it('renders error on failure', async () => {
    vi.mocked(Files.readContent).mockRejectedValueOnce(new Error('Read failed'));
    render(<FilePreviewModal path="/test/file.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Read failed')).toBeDefined();
    });
  });

  it('calls onClose when close button clicked', async () => {
    vi.mocked(Files.readContent).mockResolvedValueOnce('content');
    const onClose = vi.fn();
    render(<FilePreviewModal path="/test/file.ts" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('content')).toBeDefined();
    });

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows file name in header', async () => {
    vi.mocked(Files.readContent).mockResolvedValueOnce('content');
    render(<FilePreviewModal path="/test/myfile.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('myfile.ts')).toBeDefined();
    });
  });
});
