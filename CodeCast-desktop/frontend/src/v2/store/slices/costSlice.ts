// frontend/src/v2/store/slices/costSlice.ts
import type { StateCreator } from 'zustand';
import type { CostSummaryData, BudgetConfig } from '../../wails/types';
import { Cost } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface CostSlice {
  costSummary: CostSummaryData | null;
  budgetConfig: BudgetConfig | null;
  costLoading: boolean;
  refreshCost: () => Promise<void>;
  resetCost: () => Promise<void>;
  checkBudget: () => Promise<boolean>;
  refreshBudget: () => Promise<void>;
  updateBudget: (config: BudgetConfig) => Promise<void>;
  setLimit: (maxUSD: number) => void;
  setCostSummary: (summary: CostSummaryData) => void;
}

export const createCostSlice: StateCreator<CostSlice, [], [], CostSlice> = (set, get) => ({
  costSummary: null,
  budgetConfig: null,
  costLoading: false,

  refreshCost: async () => {
    set({ costLoading: true });
    try {
      set({ costSummary: await Cost.summary(), costLoading: false });
    } catch (e) {
      set({ costLoading: false });
      reportError('cost', e);
    }
  },

  resetCost: async () => {
    try {
      Cost.reset();
      await get().refreshCost();
    } catch (e) {
      reportError('cost', e);
    }
  },

  checkBudget: async () => {
    try {
      return await Cost.budgetExceeded();
    } catch (e) {
      reportError('cost', e);
      return false;
    }
  },

  refreshBudget: async () => {
    set({ costLoading: true });
    try {
      set({ budgetConfig: await Cost.getBudget(), costLoading: false });
    } catch (e) {
      set({ costLoading: false });
      reportError('cost', e);
    }
  },

  updateBudget: async (config) => {
    try {
      Cost.setBudget(config);
      await get().refreshBudget();
    } catch (e) {
      reportError('cost', e);
    }
  },

  setLimit: (maxUSD) => {
    Cost.setLimit(maxUSD);
  },

  setCostSummary: (summary) => {
    set({ costSummary: summary });
  },
});
