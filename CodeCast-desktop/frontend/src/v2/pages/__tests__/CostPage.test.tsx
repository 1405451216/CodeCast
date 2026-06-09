// frontend/src/v2/pages/__tests__/CostPage.test.tsx
//
// Smoke test: ensures the page renders without throwing, shows cost
// figures from the store, and that the "Apply" button dispatches the
// budget limit action. Detailed interaction testing is left for future
// component-level coverage.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../store';
import { CostPage } from '../CostPage';

beforeEach(() => {
  vi.mocked(App.GetCostSummary).mockReset();
  vi.mocked(App.GetBudgetConfig).mockReset();
  vi.mocked(App.SetBudgetLimit).mockReset();
  vi.mocked(App.SetBudgetConfig).mockReset();
  vi.mocked(App.CheckBudgetExceeded).mockReset();
  vi.mocked(App.ResetCostTracker).mockReset();
  useAppStore.setState({
    costSummary: {
      totalCostUSD: 0.1234,
      sessionCostUSD: 0.05,
      tokenUsage: { 'gpt-4': 1234, 'claude-sonnet': 567 },
      budgetExceeded: false,
    },
    budgetConfig: {
      maxCostUSD: 10,
      alertThreshold: 0.8,
      enforcementEnabled: true,
    },
    costLoading: false,
    errors: {},
  });
});

describe('<CostPage />', () => {
  it('renders total + per-session cost figures from the store', () => {
    render(
      <MemoryRouter>
        <CostPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('成本概览')).toBeInTheDocument();
    // Use the formatted USD strings
    expect(screen.getAllByText(/\$0\.1234/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$0\.0500/).length).toBeGreaterThanOrEqual(1);
  });

  it('lists per-model token usage', () => {
    render(
      <MemoryRouter>
        <CostPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('567')).toBeInTheDocument();
  });

  it('applies the budget limit when "Apply" is clicked', async () => {
    vi.mocked(App.GetCostSummary).mockResolvedValue({
      totalCostUSD: 0, sessionCostUSD: 0, tokenUsage: {}, budgetExceeded: false,
    } as any);
    vi.mocked(App.GetBudgetConfig).mockResolvedValue({
      maxCostUSD: 10, alertThreshold: 0.8, enforcementEnabled: true,
    } as any);
    render(
      <MemoryRouter>
        <CostPage />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText(/预算上限/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25.5' } });
    // Wait for React to commit the new value before clicking.
    await new Promise((r) => setTimeout(r, 0));
    expect(input.value).toBe('25.5');
    fireEvent.click(screen.getByText('应用'));
    await new Promise((r) => setTimeout(r, 0));
    expect(App.SetBudgetLimit).toHaveBeenCalledWith(25.5);
  });

  it('toggles enforcement when the secondary button is clicked', () => {
    render(
      <MemoryRouter>
        <CostPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('关闭'));
    expect(App.SetBudgetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementEnabled: false }),
    );
  });

  it('triggers reset when "重置成本" is clicked', () => {
    render(
      <MemoryRouter>
        <CostPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('重置成本'));
    // ConfirmDialog 弹出后点击"重置"确认按钮
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(App.ResetCostTracker).toHaveBeenCalled();
  });
});
