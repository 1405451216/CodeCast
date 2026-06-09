import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock store
const mockStore = {
  appMode: 'chat',
  setAppMode: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleRightPanel: vi.fn(),
  sidebarExpanded: true,
  rightPanelOpen: false,
  currentSession: { id: 's-1', name: 'Test Session', mode: 'daily' },
  sessions: [{ id: 's-1', name: 'Test Session', mode: 'daily' }],
  hasPrevSession: false,
  hasNextSession: false,
  goToPrevSession: vi.fn(),
  goToNextSession: vi.fn(),
};

vi.mock('../../store', () => ({
  useAppStore: (selector?: any) => {
    if (typeof selector === 'function') return selector(mockStore);
    return mockStore;
  },
}));

// Mock TopBar — component exists check + import verification
describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('module loads and exports correctly', async () => {
    const mod = await import('../TopBar');
    expect(mod.default || mod.TopBar).toBeDefined();
  });

  it('import path is resolvable', async () => {
    // Verify the component file can be resolved by the module system
    await expect(import('../TopBar')).resolves.toBeDefined();
  });
});
