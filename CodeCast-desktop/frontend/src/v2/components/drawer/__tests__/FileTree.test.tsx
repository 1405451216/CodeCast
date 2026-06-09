import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree } from '../FileTree';
import { useAppStore } from '../../../store';
import { Files } from '../../../wails/adapter';

/* Mock the adapter Files module */
vi.mock('../../../wails/adapter', () => ({
  Files: {
    list: vi.fn(async () => []),
    readContent: vi.fn(async () => ''),
  },
  SlashCommands: { list: vi.fn(async () => []) },
}));

/* Mock FilePreviewModal to avoid deep rendering */
vi.mock('../FilePreviewModal', () => ({
  FilePreviewModal: ({ path, onClose }: { path: string; onClose: () => void }) => (
    <div data-testid="preview-modal">
      <span>{path}</span>
      <button onClick={onClose}>close-preview</button>
    </div>
  ),
}));

vi.mock('../../../lib/useError', () => ({
  useError: vi.fn(() => undefined),
}));

const mockFilesList = vi.mocked(Files.list);

beforeEach(() => {
  vi.clearAllMocks();
  mockFilesList.mockResolvedValue([]);
  useAppStore.setState({
    currentProject: null,
    errors: {},
  } as any);
});

describe('<FileTree />', () => {
  it('shows no-project message when no project selected', () => {
    render(<FileTree />);
    expect(screen.getByText('No project selected')).toBeInTheDocument();
  });

  it('shows empty directory when tree is empty', async () => {
    useAppStore.setState({
      currentProject: { path: '/test/project', name: 'Test' },
    } as any);
    render(<FileTree />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Empty directory')).toBeInTheDocument();
  });

  it('renders file list', async () => {
    mockFilesList.mockResolvedValueOnce(['src', 'README.md', 'package.json']);

    useAppStore.setState({
      currentProject: { path: '/test/project', name: 'Test' },
    } as any);
    render(<FileTree />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText(/src/)).toBeInTheDocument();
    expect(screen.getByText(/README.md/)).toBeInTheDocument();
    expect(screen.getByText(/package.json/)).toBeInTheDocument();
  });

  it('shows project path', async () => {
    useAppStore.setState({
      currentProject: { path: '/my/workspace', name: 'WS' },
    } as any);
    render(<FileTree />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('/my/workspace')).toBeInTheDocument();
  });

  it('opens preview on file click', async () => {
    mockFilesList.mockResolvedValueOnce(['index.ts']);

    useAppStore.setState({
      currentProject: { path: '/test/project', name: 'Test' },
    } as any);
    render(<FileTree />);
    await new Promise((r) => setTimeout(r, 30));
    // Text may be split by emoji span, use regex matcher
    const fileItem = screen.getByText(/index\.ts/);
    fireEvent.click(fileItem);
    expect(screen.getByTestId('preview-modal')).toBeInTheDocument();
  });

  it('shows header "Project Files"', async () => {
    useAppStore.setState({
      currentProject: { path: '/test', name: 'T' },
    } as any);
    render(<FileTree />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Project Files')).toBeInTheDocument();
  });
});
