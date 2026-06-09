import { describe, it, expect, vi } from 'vitest';

describe('CommandPalette', () => {
  it('module loads', async () => {
    const mod = await import('../CommandPalette');
    expect(mod.CommandPalette || mod.default).toBeDefined();
  });

  it('export is a function', async () => {
    const mod = await import('../CommandPalette');
    const Component = mod.CommandPalette || mod.default;
    expect(typeof Component).toBe('function');
  });
});
