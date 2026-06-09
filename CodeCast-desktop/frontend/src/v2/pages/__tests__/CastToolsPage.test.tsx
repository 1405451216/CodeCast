import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastToolsPage } from '../CastToolsPage';
import { useAppStore } from '../../store';

// Mock paths must be relative to THIS test file: pages/__tests__/ → ../../
vi.mock('../../components/orchestration/OrchestrationRunner', () => ({
  OrchestrationRunner: () => <div data-testid="orchestration-runner" />,
}));

vi.mock('../../layout/TopBar', () => ({
  TopBar: ({ backLabel }: any) => <div data-testid="top-bar">{backLabel}</div>,
}));

/* Mock react-router-dom */
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

beforeEach(() => {
  mockNavigate.mockReset();
  useAppStore.setState({
    castTools: [
      { name: 'code-review', category: 'review', description: 'Review code quality' },
      { name: 'gen-tests', category: 'test', description: 'Generate unit tests' },
      { name: 'refactor', category: 'refactor', description: 'Smart refactoring' },
    ],
    castToolByCategory: {
      review: [{ name: 'code-review', category: 'review', description: 'Review code quality' }],
      test: [{ name: 'gen-tests', category: 'test', description: 'Generate unit tests' }],
      refactor: [{ name: 'refactor', category: 'refactor', description: 'Smart refactoring' }],
    },
    castToolHistory: [],
    castToolInvoking: false,
    castToolLoading: false,
    loadCastTools: vi.fn(),
    invokeCastTool: vi.fn(async () => '{"result":"ok"}'),
    refreshCastToolHistory: vi.fn(),
    currentSessionId: 'sess-1',
    errors: {},
  } as any);
});

describe('<CastToolsPage />', () => {
  it('renders header and search input', () => {
    const { container } = render(<CastToolsPage />);
    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toContain('工具箱');
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });

  it('displays all tools by default', () => {
    render(<CastToolsPage />);
    // Tool names appear in both card badges and card name divs
    expect(screen.getAllByText('code-review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('gen-tests').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('refactor').length).toBeGreaterThanOrEqual(1);
  });

  it('shows category chips', () => {
    render(<CastToolsPage />);
    expect(screen.getByText('全部')).toBeInTheDocument();
    // Category names appear both as chips and as card badges
    expect(screen.getAllByText('review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('test').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('refactor').length).toBeGreaterThanOrEqual(1);
  });

  it('filters tools by category', () => {
    const { container } = render(<CastToolsPage />);
    // Find the chip row (first flex container with chip spans)
    const allSpans = container.querySelectorAll('span');
    const testChip = Array.from(allSpans).find(
      (el) => el.textContent === 'test' && el.style.padding?.includes('5px 14px'),
    );
    expect(testChip).toBeDefined();
    fireEvent.click(testChip!);
    // gen-tests card should still be visible
    expect(screen.getAllByText('gen-tests').length).toBeGreaterThanOrEqual(1);
    // code-review should be filtered out (only test category shown)
    const grid = container.querySelector('[style*="grid-template-columns"]');
    const cardTexts = grid?.textContent || '';
    expect(cardTexts).not.toContain('code-review');
  });

  it('filters tools by search query', () => {
    render(<CastToolsPage />);
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: 'Smart refactoring' } });
    // refactor tool should still be visible
    expect(screen.getAllByText('refactor').length).toBeGreaterThanOrEqual(1);
    // code-review should be filtered out
    expect(screen.queryByText('code-review')).toBeNull();
  });

  it('shows no-results message when filter yields nothing', () => {
    render(<CastToolsPage />);
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });
    expect(screen.getByText(/没有找到匹配的工具/)).toBeInTheDocument();
  });

  it('opens detail panel on tool card click', () => {
    render(<CastToolsPage />);
    // Click on the code-review card name (font-weight: 600 div)
    const toolElements = screen.getAllByText('code-review');
    const cardName = toolElements.find((el) => el.style?.fontWeight === '600') || toolElements[0];
    fireEvent.click(cardName.closest('[style*="cursor: pointer"]') || cardName);
    // Detail panel shows "参数" label and at least one "运行" button
    expect(screen.getByText(/参数/)).toBeInTheDocument();
    expect(screen.getAllByText('运行').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    useAppStore.setState({ castToolLoading: true } as any);
    render(<CastToolsPage />);
    expect(screen.getByText(/正在加载工具列表/)).toBeInTheDocument();
  });

  it('renders orchestration runner', () => {
    render(<CastToolsPage />);
    expect(screen.getByTestId('orchestration-runner')).toBeInTheDocument();
  });
});
