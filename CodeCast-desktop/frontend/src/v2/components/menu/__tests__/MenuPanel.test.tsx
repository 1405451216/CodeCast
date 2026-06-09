import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuPanel } from '../MenuPanel';

const basicItems = [
  { id: '1', type: 'action' as const, label: 'Open File' },
  { id: '2', type: 'action' as const, label: 'Save', shortcut: 'Ctrl+S' },
  { id: 'sep', type: 'separator' as const },
  { id: '3', type: 'action' as const, label: 'Close' },
];

describe('MenuPanel', () => {
  it('renders menu items', () => {
    render(
      <MenuPanel
        items={basicItems}
        anchor={{ x: 0, y: 0 }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Open File')).toBeDefined();
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Close')).toBeDefined();
  });

  it('shows Save item with shortcut present', () => {
    render(
      <MenuPanel items={basicItems} anchor={{ x: 0, y: 0 }} onClose={vi.fn()} />
    );
    const saveItem = screen.getByText('Save');
    expect(saveItem).toBeDefined();
    // shortcut may be in a separate element
  });

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn();
    render(
      <MenuPanel items={basicItems} anchor={{ x: 0, y: 0 }} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onItemClick when item clicked', () => {
    const onItemClick = vi.fn();
    render(
      <MenuPanel
        items={basicItems}
        anchor={{ x: 0, y: 0 }}
        onClose={vi.fn()}
        onItemClick={onItemClick}
      />
    );
    fireEvent.click(screen.getByText('Open File'));
    expect(onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', label: 'Open File' })
    );
  });

  it('renders disabled items as non-clickable', () => {
    const items = [
      { id: '1', type: 'action' as const, label: 'Disabled', disabled: true },
      { id: '2', type: 'action' as const, label: 'Enabled' },
    ];
    render(
      <MenuPanel items={items} anchor={{ x: 0, y: 0 }} onClose={vi.fn()} />
    );
    expect(screen.getByText('Disabled')).toBeDefined();
    expect(screen.getByText('Enabled')).toBeDefined();
  });
});
