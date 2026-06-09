import { describe, it, expect } from 'vitest';
import { registerHotkey, unregisterHotkey, unregisterAll } from '../hotkeys';

describe('hotkeys', () => {
  afterEach(() => {
    unregisterAll();
  });

  it('registers and triggers a hotkey handler', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+k', handler);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();
  });

  it('does not trigger when modifier is missing', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+k', handler);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: false, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it('unregisters a specific hotkey', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+k', handler);
    unregisterHotkey('ctrl+k');
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it('unregisters all hotkeys', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    registerHotkey('ctrl+a', h1);
    registerHotkey('ctrl+b', h2);
    unregisterAll();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('triggers shift modifier', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+shift+s', handler);
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();
  });

  it('does not trigger shift modifier when shift not pressed', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+shift+s', handler);
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: false, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it('triggers alt modifier', () => {
    const handler = vi.fn();
    registerHotkey('alt+d', handler);
    const event = new KeyboardEvent('keydown', { key: 'd', altKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();
  });

  it('calls preventDefault on matched hotkey', () => {
    const handler = vi.fn();
    registerHotkey('ctrl+p', handler);
    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true });
    const spy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });
});
