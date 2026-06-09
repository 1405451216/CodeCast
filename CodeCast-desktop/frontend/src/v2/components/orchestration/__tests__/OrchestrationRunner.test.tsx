// frontend/src/v2/components/orchestration/__tests__/OrchestrationRunner.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../../store';
import { OrchestrationRunner } from '../OrchestrationRunner';

beforeEach(() => {
  vi.mocked(App.RunCodeReviewWorkflow).mockReset();
  vi.mocked(App.RunRefactoringWorkflow).mockReset();
  vi.mocked(App.RunTestPipelineWorkflow).mockReset();
  vi.mocked(App.RunParallelAnalysis).mockReset();
  useAppStore.setState({
    currentSessionId: 's1',
    orchestrationLoading: false,
    lastResult: null,
    errors: {},
  });
});

describe('<OrchestrationRunner />', () => {
  it('renders four workflow cards', () => {
    render(<OrchestrationRunner />);
    expect(screen.getByText('代码审查')).toBeInTheDocument();
    expect(screen.getByText('重构建议')).toBeInTheDocument();
    expect(screen.getByText('生成测试')).toBeInTheDocument();
    expect(screen.getByText('并行分析')).toBeInTheDocument();
  });

  it('runs the codeReview workflow when "运行" is clicked', async () => {
    vi.mocked(App.RunCodeReviewWorkflow).mockResolvedValueOnce({ issues: [], score: 8 } as any);
    render(<OrchestrationRunner />);
    const textarea = screen.getAllByPlaceholderText(/function foo/)[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'const x = 1;' } });
    fireEvent.click(screen.getAllByText('运行')[0]);
    await new Promise((r) => setTimeout(r, 0));
    expect(App.RunCodeReviewWorkflow).toHaveBeenCalledWith('s1', 'const x = 1;');
  });

  it('runs the parallelAnalysis workflow when "运行" is clicked', async () => {
    vi.mocked(App.RunParallelAnalysis).mockResolvedValueOnce({ angles: [] } as any);
    render(<OrchestrationRunner />);
    const textarea = screen.getAllByPlaceholderText(/任意文本/)[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'my input' } });
    // The "运行" buttons are 4 — parallelAnalysis is the 4th
    fireEvent.click(screen.getAllByText('运行')[3]);
    await new Promise((r) => setTimeout(r, 0));
    expect(App.RunParallelAnalysis).toHaveBeenCalledWith('s1', 'my input');
  });

  it('disables "运行" when input is empty or no session', () => {
    useAppStore.setState({ currentSessionId: null });
    render(<OrchestrationRunner />);
    const buttons = screen.getAllByText('运行');
    buttons.forEach((b) => expect(b).toBeDisabled());
  });
});
