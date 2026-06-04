import type { SliceSet } from './storeTypes';
import type { CostSummary, BudgetConfig } from '../api/types';

export interface CostSlice {
  costSummary: CostSummary | null;
  budgetConfig: BudgetConfig | null;
  budgetExceeded: boolean;
  setCostSummary: (summary: CostSummary) => void;
  setBudgetConfig: (config: BudgetConfig) => void;
  setBudgetExceeded: (exceeded: boolean) => void;
  handleCostEvent: (summary: CostSummary) => void;
}

export const createCostSlice = (set: SliceSet): CostSlice => ({
  costSummary: null,
  budgetConfig: null,
  budgetExceeded: false,

  setCostSummary: (summary) => set({ costSummary: summary }),
  setBudgetConfig: (config) => set({ budgetConfig: config }),
  setBudgetExceeded: (exceeded) => set({ budgetExceeded: exceeded }),

  handleCostEvent: (summary) => set({ costSummary: summary }),
});
