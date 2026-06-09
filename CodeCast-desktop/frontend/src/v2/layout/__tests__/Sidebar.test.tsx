import { describe, it, expect } from 'vitest';

describe('Sidebar', () => {
  it('module loads', async () => {
    const mod = await import('../Sidebar');
    expect(mod.Sidebar || mod.default).toBeDefined();
  });

  it('export is a function', async () => {
    const mod = await import('../Sidebar');
    const Component = mod.Sidebar || mod.default;
    expect(typeof Component).toBe('function');
  });
});

describe('BottomBar', () => {
  it('module loads', async () => {
    const mod = await import('../BottomBar');
    expect(mod.BottomBar || mod.default).toBeDefined();
  });
});

describe('ChatArea', () => {
  it('module loads', async () => {
    const mod = await import('../ChatArea');
    expect(mod.ChatArea || mod.default).toBeDefined();
  });
});

describe('WorkspaceFrame', () => {
  it('module loads', async () => {
    const mod = await import('../WorkspaceFrame');
    expect(mod.WorkspaceFrame || mod.default).toBeDefined();
  });
});

describe('RightPanel', () => {
  it('module loads', async () => {
    const mod = await import('../RightPanel');
    expect(mod.RightPanel || mod.default).toBeDefined();
  });
});

describe('Drawer', () => {
  it('module loads', async () => {
    const mod = await import('../Drawer');
    expect(mod.Drawer || mod.default).toBeDefined();
  });
});
