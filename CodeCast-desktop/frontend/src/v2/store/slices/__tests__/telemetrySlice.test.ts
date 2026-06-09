// frontend/src/v2/store/slices/__tests__/telemetrySlice.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../index';
import { Telemetry } from '../../../wails/adapter';

vi.mock('../../../wails/adapter', () => ({
  Telemetry: {
    status: vi.fn(),
    toggle: vi.fn(),
    setEndpoint: vi.fn(),
  },
}));

describe('telemetrySlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshTelemetry loads status from adapter', async () => {
    const mockStatus = { enabled: true, endpoint: 'http://example.com', eventsSent: 100, lastSentAt: '2026-01-01' };
    vi.mocked(Telemetry.status).mockResolvedValueOnce(mockStatus as any);

    await useAppStore.getState().refreshTelemetry();

    expect(Telemetry.status).toHaveBeenCalled();
    expect(useAppStore.getState().telemetryStatus).toEqual(mockStatus);
    expect(useAppStore.getState().telemetryLoading).toBe(false);
  });

  it('toggleEnabled calls adapter and refreshes', async () => {
    vi.mocked(Telemetry.toggle).mockResolvedValueOnce(undefined);
    vi.mocked(Telemetry.status).mockResolvedValueOnce({ enabled: false } as any);

    await useAppStore.getState().toggleEnabled(false);

    expect(Telemetry.toggle).toHaveBeenCalledWith(false);
    expect(Telemetry.status).toHaveBeenCalled();
  });

  it('setEndpoint calls adapter and refreshes', async () => {
    vi.mocked(Telemetry.setEndpoint).mockResolvedValueOnce(undefined);
    vi.mocked(Telemetry.status).mockResolvedValueOnce({ endpoint: 'http://new.com' } as any);

    await useAppStore.getState().setEndpoint('http://new.com');

    expect(Telemetry.setEndpoint).toHaveBeenCalledWith('http://new.com');
    expect(Telemetry.status).toHaveBeenCalled();
  });
});
