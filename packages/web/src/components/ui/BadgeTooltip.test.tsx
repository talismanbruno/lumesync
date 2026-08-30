import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BetaContributorBadge } from './BetaContributorBadge';
import { PioneerBadge } from './PioneerBadge';
import { VerifiedBadge } from './VerifiedBadge';

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('badge nameplates', () => {
  it.each([
    [BetaContributorBadge, 'Colaborador Beta'],
    [PioneerBadge, 'Pioneiro do Lume'],
    [VerifiedBadge, 'Administrador do Lume'],
  ] as const)('shows a custom name for %s without a native title', (Badge, name) => {
    const { container } = render(<div style={{ overflow: 'hidden' }}><Badge /></div>);
    const badge = screen.getByRole('img');
    expect(container.querySelector('[title]')).toBeNull();
    fireEvent.mouseEnter(badge);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    advance(120);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(name);
    expect(tooltip.parentElement).toBe(document.body);
    expect(container.contains(tooltip)).toBe(false);
    expect(badge).toHaveAttribute('aria-describedby', tooltip.id);
    fireEvent.mouseLeave(badge);
    advance(100);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('supports focus and Escape without dismissing a parent profile', () => {
    const parentKey = vi.fn();
    render(<div onKeyDown={parentKey}><BetaContributorBadge /></div>);
    const badge = screen.getByRole('img');
    fireEvent.focus(badge);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Colaborador Beta');
    fireEvent.keyDown(badge, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(parentKey).not.toHaveBeenCalled();
    fireEvent.blur(badge);
    advance(100);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('stays visible while hovering its nameplate', () => {
    render(<PioneerBadge />);
    fireEvent.mouseEnter(screen.getByRole('img'));
    advance(120);
    fireEvent.mouseLeave(screen.getByRole('img'));
    fireEvent.mouseEnter(screen.getByRole('tooltip'));
    advance(500);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('tooltip'));
    advance(100);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('cancels delayed display on quick leave or unmount', () => {
    const { unmount } = render(<VerifiedBadge />);
    fireEvent.mouseEnter(screen.getByRole('img'));
    fireEvent.mouseLeave(screen.getByRole('img'));
    advance(500);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('img'));
    unmount();
    advance(500);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('flips below the badge at the top of the viewport and clamps horizontally', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return (this.getAttribute('role') === 'tooltip'
        ? { top: 0, bottom: 32, left: 0, right: 180, width: 180, height: 32 }
        : { top: 2, bottom: 18, left: 2, right: 18, width: 16, height: 16 }) as DOMRect;
    });
    render(<BetaContributorBadge />);
    fireEvent.mouseEnter(screen.getByRole('img'));
    advance(120);
    expect(screen.getByRole('tooltip')).toHaveStyle({ top: '28px', left: '8px' });
  });
  it('uses the fullscreen overlay host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => host });
    try {
      const { unmount } = render(<BetaContributorBadge />);
      fireEvent.focus(screen.getByRole('img'));
      expect(screen.getByRole('tooltip').parentElement).toBe(host);
      unmount();
    } finally {
      if (descriptor) Object.defineProperty(document, 'fullscreenElement', descriptor);
      else Reflect.deleteProperty(document, 'fullscreenElement');
      host.remove();
    }
  });
});
