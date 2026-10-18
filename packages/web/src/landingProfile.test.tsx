import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReducedMotion } from './hooks/useReducedMotion';
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: vi.fn() }) }));
vi.mock('./stores/customizationStore', () => ({ useCustomizationStore: { setState: vi.fn() } }));
vi.mock('./components/modals/settingsPanels/ProfileCustomizationEditor', () => ({
  CustomizationProfilePreview: ({ bannerSrc, effectReplayKey }: { bannerSrc: string; effectReplayKey: number }) => <article data-testid="profile" data-paused={useReducedMotion()} data-replay={effectReplayKey}><img alt="Banner" src={bannerSrc} /></article>,
}));
import { Showcase } from '../../../landing/profile-source/profile';
beforeEach(() => {
  const root = document.createElement('div'); root.id = 'root'; document.body.append(root);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});
afterEach(() => { cleanup(); document.getElementById('root')?.remove(); vi.unstubAllGlobals(); });
function showcase() { return render(<Showcase />, { container: document.getElementById('root')! }); }
function control(animated: boolean, replay = false) {
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: window, origin: location.origin, data: { type: 'lume-profile-control', animated, replay },
  })));
}
it('keeps the same profile mounted across repeated scroll visibility changes', () => {
  showcase();
  const profile = screen.getByTestId('profile');
  for (let cycle = 0; cycle < 5; cycle++) {
    control(false);
    expect(screen.getByTestId('profile')).toBe(profile);
    expect(profile).toHaveAttribute('data-paused', 'true');
    expect(screen.getByAltText('Banner')).toHaveAttribute('src', expect.stringContaining('banner-still.webp'));
    control(true);
    expect(screen.getByTestId('profile')).toBe(profile);
    expect(profile).toHaveAttribute('data-paused', 'false');
    expect(screen.getByAltText('Banner')).toHaveAttribute('src', expect.stringContaining('banner.gif'));
  }
});
it('replays only the effect without rebuilding the profile', () => {
  showcase();
  const profile = screen.getByTestId('profile');
  control(true, true);
  expect(screen.getByTestId('profile')).toBe(profile);
  expect(profile).toHaveAttribute('data-replay', '1');
});
it('ignores control messages from another origin', () => {
  showcase();
  const profile = screen.getByTestId('profile');
  act(() => window.dispatchEvent(new MessageEvent('message', {
    source: window, origin: 'https://untrusted.example', data: { type: 'lume-profile-control', animated: false, replay: true },
  })));
  expect(screen.getByTestId('profile')).toBe(profile);
});
