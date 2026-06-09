import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentList } from '../AttachmentList';

describe('AttachmentList', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<AttachmentList items={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders file names', () => {
    const items = [
      { id: '1', name: 'app.tsx', size: 1024 },
      { id: '2', name: 'utils.ts', size: 512 },
    ];
    render(<AttachmentList items={items} onRemove={vi.fn()} />);
    expect(screen.getByText(/app\.tsx/)).toBeDefined();
    expect(screen.getByText(/utils\.ts/)).toBeDefined();
  });

  it('calls onRemove when remove button clicked', () => {
    const items = [{ id: '1', name: 'test.ts', size: 256 }];
    const onRemove = vi.fn();
    render(<AttachmentList items={items} onRemove={onRemove} />);

    const removeBtn = screen.getByText('×');
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('renders multiple attachments', () => {
    const items = [
      { id: 'a', name: 'one.ts', size: 100 },
      { id: 'b', name: 'two.tsx', size: 200 },
      { id: 'c', name: 'three.json', size: 300 },
    ];
    const { container } = render(<AttachmentList items={items} onRemove={vi.fn()} />);
    const removeButtons = container.querySelectorAll('button');
    expect(removeButtons.length).toBe(3);
  });
});
