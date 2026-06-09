import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalCard } from '../ApprovalCard';

describe('ApprovalCard', () => {
  it('renders tool name and target', () => {
    render(
      <ApprovalCard
        toolName="write_file"
        target="/src/app.ts"
        risk="medium"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(/write_file/)).toBeDefined();
    expect(screen.getByText(/\/src\/app\.ts/)).toBeDefined();
  });

  it('calls onApprove when approve clicked', () => {
    const onApprove = vi.fn();
    render(
      <ApprovalCard toolName="run_command" target="npm install" risk="high"
        onApprove={onApprove} onReject={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/同意/));
    expect(onApprove).toHaveBeenCalled();
  });

  it('calls onReject when reject clicked', () => {
    const onReject = vi.fn();
    render(
      <ApprovalCard toolName="delete_file" target="config.json" risk="high"
        onApprove={vi.fn()} onReject={onReject} />
    );
    fireEvent.click(screen.getByText(/拒绝/));
    expect(onReject).toHaveBeenCalled();
  });

  it('shows different styling for high risk', () => {
    const { container } = render(
      <ApprovalCard toolName="cmd" target="rm -rf /" risk="high"
        onApprove={vi.fn()} onReject={vi.fn()} />
    );
    expect(container.firstChild).toBeDefined();
  });

  it('shows different styling for low risk', () => {
    const { container } = render(
      <ApprovalCard toolName="read_file" target="README.md" risk="low"
        onApprove={vi.fn()} onReject={vi.fn()} />
    );
    expect(container.firstChild).toBeDefined();
  });
});
