// frontend/src/v2/store/slices/telemetrySlice.ts
import type { StateCreator } from 'zustand';
import type { TelemetryStatus } from '../../wails/types';
import { Telemetry } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface TelemetrySlice {
  telemetryStatus: TelemetryStatus | null;
  telemetryLoading: boolean;
  refreshTelemetry: () => Promise<void>;
  toggleEnabled: (enabled: boolean) => Promise<void>;
  setEndpoint: (endpoint: string) => Promise<void>;
}

export const createTelemetrySlice: StateCreator<TelemetrySlice, [], [], TelemetrySlice> = (set, get) => ({
  telemetryStatus: null,
  telemetryLoading: false,

  refreshTelemetry: async () => {
    set({ telemetryLoading: true });
    try {
      set({ telemetryStatus: await Telemetry.status(), telemetryLoading: false });
    } catch (e) {
      set({ telemetryLoading: false });
      reportError('telemetry', e);
    }
  },

  toggleEnabled: async (enabled) => {
    try {
      await Telemetry.toggle(enabled);
      await get().refreshTelemetry();
    } catch (e) {
      reportError('telemetry', e);
    }
  },

  setEndpoint: async (endpoint) => {
    try {
      await Telemetry.setEndpoint(endpoint);
      await get().refreshTelemetry();
    } catch (e) {
      reportError('telemetry', e);
    }
  },
});
