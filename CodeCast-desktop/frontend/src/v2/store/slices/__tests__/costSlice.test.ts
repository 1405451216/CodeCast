// frontend/src/v2/store/slices/__tests__/costSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('costSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetCostSummary).mockReset();
    vi.mocked(App.ResetCostTracker).mockReset();
    vi.mocked(App.CheckBudgetExceeded).mockReset();
    vi.mocked(App.GetBudgetConfig).mockReset();
    vi.mocked(App.SetBudgetConfig).mockReset();
    vi.mocked(App.SetBudgetLimit).mockReset();
    useAppStore.setState({ costSummary: null, budgetConfig: null, costLoading: false, errors: {} });
  });

  it('refreshCost: success sets costSummary', async () => {
    vi.mocked(App.GetCostSummary).mockResolvedValueOnce({
      totalCostUSD: 1.5, sessionCostUSD: 0.5, tokenUsage: {}, budgetExceeded: false,
    } as any);
    await useAppStore.getState().refreshCost();
    expect(useAppStore.getState().costSummary).toBeTruthy();
    expect(useAppStore.getState().costSummary!.totalCostUSD).toBe(1.5);
  });

  it('refreshCost: failure sets cost error', async () => {
    vi.mocked(App.GetCostSummary).mockRejectedValueOnce(new Error('cost-err'));
    await useAppStore.getState().refreshCost();
    expect(useAppStore.getState().errors.cost).toBe('cost-err');
  });

  it('resetCost: calls App.ResetCostTracker and refreshes', async () => {
    vi.mocked(App.GetCostSummary).mockResolvedValueOnce({
      totalCostUSD: 0, sessionCostUSD: 0, tokenUsage: {}, budgetExceeded: false,
    } as any);
    await useAppStore.getState().resetCost();
    expect(App.ResetCostTracker).toHaveBeenCalled();
    expect(App.GetCostSummary).toHaveBeenCalled();
  });

  it('refreshBudget: sets budgetConfig', async () => {
    vi.mocked(App.GetBudgetConfig).mockResolvedValueOnce({
      maxCostUSD: 10, alertThreshold: 0.8, enforcementEnabled: true,
    } as any);
    await useAppStore.getState().refreshBudget();
    expect(useAppStore.getState().budgetConfig).toBeTruthy();
    expect(useAppStore.getState().budgetConfig!.maxCostUSD).toBe(10);
  });

  it('setLimit: calls App.SetBudgetLimit with correct arg', () => {
    useAppStore.getState().setLimit(25);
    expect(App.SetBudgetLimit).toHaveBeenCalledWith(25);
  });
});
