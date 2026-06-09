// frontend/src/v2/store/slices/securitySlice.ts
import type { StateCreator } from 'zustand';
import type { SecurityStatus } from '../../wails/types';
import { Security } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SecuritySlice {
  securityStatus: SecurityStatus | null;
  securityLoading: boolean;
  antivirusResult: Record<string, unknown> | null;
  refreshSecurity: () => Promise<void>;
  rotateKey: () => Promise<void>;
  checkAntivirus: () => Promise<Record<string, unknown>>;
}

export const createSecuritySlice: StateCreator<SecuritySlice, [], [], SecuritySlice> = (set, get) => ({
  securityStatus: null,
  securityLoading: false,
  antivirusResult: null,

  refreshSecurity: async () => {
    set({ securityLoading: true });
    try {
      set({ securityStatus: await Security.status(), securityLoading: false });
    } catch (e) {
      set({ securityLoading: false });
      reportError('security', e);
    }
  },

  rotateKey: async () => {
    try {
      await Security.rotateKey();
      await get().refreshSecurity();
    } catch (e) {
      reportError('security', e);
    }
  },

  checkAntivirus: async () => {
    try {
      const result = await Security.checkAntivirus();
      set({ antivirusResult: result });
      return result;
    } catch (e) {
      reportError('security', e);
      return {};
    }
  },
});
