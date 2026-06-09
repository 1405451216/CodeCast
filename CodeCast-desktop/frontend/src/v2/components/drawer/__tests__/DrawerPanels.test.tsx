import { describe, it, expect } from 'vitest';

describe('GitPanel', () => {
  it('module loads', async () => {
    const mod = await import('../GitPanel');
    expect(mod.GitPanel || mod.default).toBeDefined();
  });
});

describe('MCPPanel', () => {
  it('module loads', async () => {
    const mod = await import('../MCPPanel');
    expect(mod.MCPPanel || mod.default).toBeDefined();
  });
});

describe('MemoryPanel', () => {
  it('module loads', async () => {
    const mod = await import('../MemoryPanel');
    expect(mod.MemoryPanel || mod.default).toBeDefined();
  });
});

describe('FileTree', () => {
  it('module loads', async () => {
    const mod = await import('../FileTree');
    expect(mod.FileTree || mod.default).toBeDefined();
  });
});
