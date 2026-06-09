import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover } from '../Popover';

describe('Popover', () => {
  it('renders trigger', () => {
    render(
      <Popover trigger={<span>Click me</span>}>
        <div>Popover content</div>
      </Popover>,
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('does not show content initially', () => {
    render(
      <Popover trigger={<span>Click me</span>}>
        <div>Popover content</div>
      </Popover>,
    );
    expect(screen.queryByText('Popover content')).toBeNull();
  });

  it('shows content on trigger click', () => {
    render(
      <Popover trigger={<span>Click me</span>}>
        <div>Popover content</div>
      </Popover>,
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(screen.getByText('Popover content')).toBeInTheDocument();
  });

  it('hides content on second trigger click', () => {
    render(
      <Popover trigger={<span>Click me</span>}>
        <div>Popover content</div>
      </Popover>,
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(screen.getByText('Popover content')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Click me'));
    expect(screen.queryByText('Popover content')).toBeNull();
  });

  it('hides content on outside click', () => {
    render(
      <div>
        <Popover trigger={<span>Click me</span>}>
          <div>Popover content</div>
        </Popover>
        <span>outside</span>
      </div>,
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(screen.getByText('Popover content')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Popover content')).toBeNull();
  });
});
