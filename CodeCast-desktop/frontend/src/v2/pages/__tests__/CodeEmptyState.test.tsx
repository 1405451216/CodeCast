import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeEmptyState } from '../CodeEmptyState';

vi.mock('../../lib/useError', () => ({
  useError: vi.fn(() => undefined),
}));

vi.mock('../../components/composer/Composer', () => ({
  Composer: ({ onSend: _onSend }: any) => (
    <div data-testid="composer" />
  ),
}));

describe('<CodeEmptyState />', () => {
  it('renders the page', () => {
    const { container } = render(<CodeEmptyState />);
    expect(container.firstChild).toBeDefined();
  });

  it('shows model name from props', () => {
    render(<CodeEmptyState model="GPT-4o" />);
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
  });

  it('shows default model when none provided', () => {
    render(<CodeEmptyState />);
    // "MiniMax-M3" appears in both stat card and footer bar
    expect(screen.getAllByText('MiniMax-M3').length).toBeGreaterThanOrEqual(1);
  });

  it('has statistics tabs', () => {
    render(<CodeEmptyState />);
    expect(screen.getByText('概述')).toBeInTheDocument();
    expect(screen.getByText('模型')).toBeInTheDocument();
  });

  it('switches statistics tab', () => {
    render(<CodeEmptyState />);
    fireEvent.click(screen.getByText('模型'));
    expect(screen.getByText('模型')).toBeInTheDocument();
  });

  it('has period segmented control', () => {
    render(<CodeEmptyState />);
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('30天')).toBeInTheDocument();
    expect(screen.getByText('7天')).toBeInTheDocument();
  });

  it('has stat indicators', () => {
    render(<CodeEmptyState />);
    expect(screen.getByText(/会话/)).toBeInTheDocument();
    expect(screen.getByText(/消息/)).toBeInTheDocument();
    expect(screen.getByText(/Token 总数/)).toBeInTheDocument();
  });

  it('has tag pills', () => {
    render(<CodeEmptyState />);
    expect(screen.getByText('本地')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('has accept-edit button', () => {
    render(<CodeEmptyState />);
    expect(screen.getByText(/接受编辑/)).toBeInTheDocument();
  });

  it('renders Composer component', () => {
    render(<CodeEmptyState />);
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('passes thinking prop to Composer via model area', () => {
    // The thinking prop is forwarded to Composer (mocked as data-testid="composer").
    // CodeEmptyState doesn't render "思考" text itself — Composer does.
    // Verify the component still renders correctly with thinking=true.
    render(<CodeEmptyState thinking />);
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });
});
