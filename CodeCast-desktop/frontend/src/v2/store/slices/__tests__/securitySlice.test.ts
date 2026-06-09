// frontend/src/v2/store/slices/__tests__/securitySlice.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../index';
import { Security } from '../../../wails/adapter';

vi.mock('../../../wails/adapter', () => ({
  Security: {
    status: vi.fn(),
    rotateKey: vi.fn(),
    checkAntivirus: vi.fn(),
  },
}));

describe('securitySlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshSecurity loads status from adapter', async () => {
    const mockStatus = { encryptionEnabled: true, keyRotationDue: false, lastKeyRotation: '2026-01-01', sandboxEnabled: true, aclEntries: 5 };
    vi.mocked(Security.status).mockResolvedValueOnce(mockStatus as any);

    await useAppStore.getState().refreshSecurity();

    expect(Security.status).toHaveBeenCalled();
    expect(useAppStore.getState().securityStatus).toEqual(mockStatus);
    expect(useAppStore.getState().securityLoading).toBe(false);
  });

  it('rotateKey calls adapter and refreshes', async () => {
    vi.mocked(Security.rotateKey).mockResolvedValueOnce(undefined);
    vi.mocked(Security.status).mockResolvedValueOnce({ encryptionEnabled: true } as any);

    await useAppStore.getState().rotateKey();

    expect(Security.rotateKey).toHaveBeenCalled();
    expect(Security.status).toHaveBeenCalled();
  });

  it('checkAntivirus calls adapter and caches result', async () => {
    const mockResult = { compatible: true, details: 'ok' };
    vi.mocked(Security.checkAntivirus).mockResolvedValueOnce(mockResult as any);

    const result = await useAppStore.getState().checkAntivirus();

    expect(Security.checkAntivirus).toHaveBeenCalled();
    expect(result).toEqual(mockResult);
    expect(useAppStore.getState().antivirusResult).toEqual(mockResult);
  });
});
