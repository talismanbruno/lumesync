import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
vi.mock('../../stores/transferStore', () => ({
  useTransferStore: (selector: (state: unknown) => unknown) => selector({ transfers: new Map() }),
}));
import { TransferIndicator } from './TransferIndicator';
const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

afterEach(() => {
  vi.restoreAllMocks();
  if (fullscreenDescriptor) Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor);
  else Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('transfer overlay', () => {
  it('renders outside the clipped header and keeps clicks inside the panel open', () => {
    const { container } = render(<div style={{ overflow: 'hidden', transform: 'translateZ(0)' }}><TransferIndicator /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    const panel = screen.getByRole('dialog', { name: 'Transfers' });
    expect(panel.parentElement).toBe(document.body);
    expect(container.contains(panel)).toBe(false);
    fireEvent.mouseDown(panel);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('closes with Escape and restores trigger focus', () => {
    render(<TransferIndicator />);
    const button = screen.getByRole('button', { name: 'Transfers' });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
  it('stays inside a fullscreen surface', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => host });
    const { unmount } = render(<TransferIndicator />);
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    expect(screen.getByRole('dialog').parentElement).toBe(host);
    unmount();
    host.remove();
  });
});
