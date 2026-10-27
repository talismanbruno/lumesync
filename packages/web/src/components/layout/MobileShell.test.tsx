import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import type { TaggedSpace } from '../../stores/spaceStore';

const viewport = vi.hoisted(() => ({ keyboardOpen: false, height: null as number | null }));
vi.mock('../../hooks/useVisualViewportInset', () => ({ useVisualViewportInset: () => viewport }));
vi.mock('./MobileSpacesScreen', () => ({ MobileSpacesScreen: () => <div>Raiz de servidores</div> }));
vi.mock('./MobileDmsScreen', () => ({ MobileDmsScreen: () => <div>Raiz de conversas</div> }));
vi.mock('./MobileYouScreen', () => ({ MobileYouScreen: () => <div>Raiz do perfil</div> }));
vi.mock('./MobileChatScreen', () => ({ MobileChatScreen: () => <header>Conversa aberta</header> }));
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ resumeContext: vi.fn() }) },
}));

import { MobileShell } from './MobileShell';

beforeEach(() => {
  viewport.keyboardOpen = false;
  viewport.height = null;
  useUIStore.setState({ mobileScreen: 'spaces', mobileStack: [] });
  useSpaceStore.setState({ spaces: [], currentSpaceId: null, lastSelectedSpaceId: null });
});

describe('MobileShell safe viewport', () => {
  it('keeps pushed chats inside the same border-box viewport as root screens', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/channels/@me']}><MobileShell /></MemoryRouter>);
    const root = await screen.findByText('Raiz de conversas');
    const shell = root.closest<HTMLElement>('[data-mobile-shell]')!;
    // jsdom does not parse CSS env(). Safe-area geometry must also be checked
    // in a browser/device; here protect the stack ownership and height logic.
    expect(shell.style.boxSizing).toBe('border-box');
    expect(shell.style.height).toBe('100dvh');
    // The nav/composer already reserve the bottom; don't add it twice.
    expect(shell.style.paddingBottom).toBe('');

    act(() => useUIStore.getState().pushMobileScreen('channel-chat', { channelId: 'dm-1', spaceId: '@me' }));
    const chat = await screen.findByText('Conversa aberta');
    expect(chat.closest('[data-mobile-shell]')).toBe(shell);
    expect(container.querySelectorAll('[data-mobile-shell]')).toHaveLength(1);
  });

  it('includes the top safe area within the keyboard-sized viewport and restores full height on close', async () => {
    const view = <MemoryRouter initialEntries={['/channels/@me']}><MobileShell /></MemoryRouter>;
    const { container, rerender } = render(view);
    await screen.findByText('Raiz de conversas');
    viewport.keyboardOpen = true;
    viewport.height = 412;
    rerender(<MemoryRouter initialEntries={['/channels/@me']}><MobileShell /></MemoryRouter>);
    const shell = container.querySelector<HTMLElement>('[data-mobile-shell]')!;
    expect(shell.style.height).toBe('412px');
    expect(shell.style.boxSizing).toBe('border-box');

    viewport.keyboardOpen = false;
    rerender(<MemoryRouter initialEntries={['/channels/@me']}><MobileShell /></MemoryRouter>);
    expect(shell.style.height).toBe('100dvh');
  });
});

function RoutedMobileShell() {
  const location = useLocation();
  return <><MobileShell /><span data-testid="route-path">{location.pathname}</span></>;
}

describe('MobileShell deep links', () => {
  it('opens conversations from a direct DM URL and marks the active tab', async () => {
    render(<MemoryRouter initialEntries={['/channels/@me']}><MobileShell /></MemoryRouter>);
    expect(await screen.findByText('Raiz de conversas')).toBeTruthy();
    expect(useUIStore.getState().mobileScreen).toBe('dms');
    expect(screen.getByRole('button', { name: 'Conversas' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens servers from a direct server URL', async () => {
    useUIStore.setState({ mobileScreen: 'dms' });
    render(<MemoryRouter initialEntries={['/channels/server-1']}><MobileShell /></MemoryRouter>);
    expect(await screen.findByText('Raiz de servidores')).toBeTruthy();
    expect(useUIStore.getState().mobileScreen).toBe('spaces');
  });

  it('opens the server list from conversations when no server is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <Routes>
          <Route path="/channels/:spaceId" element={<RoutedMobileShell />} />
          <Route path="/channels" element={<RoutedMobileShell />} />
          <Route path="/" element={<Navigate to="/channels/@me" replace />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Raiz de conversas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Servidores' }));
    expect(await screen.findByText('Raiz de servidores')).toBeTruthy();
    expect(screen.getByTestId('route-path').textContent).toBe('/channels');
    expect(screen.getByRole('button', { name: 'Servidores' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens the first available server when none was selected before', async () => {
    useSpaceStore.setState({ spaces: [{ id: 'server-1', name: 'Primeiro' } as TaggedSpace] });
    render(
      <MemoryRouter initialEntries={['/channels/@me']}>
        <Routes>
          <Route path="/channels/:spaceId" element={<RoutedMobileShell />} />
          <Route path="/channels" element={<RoutedMobileShell />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Raiz de conversas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Servidores' }));
    expect(await screen.findByText('Raiz de servidores')).toBeTruthy();
    expect(screen.getByTestId('route-path').textContent).toBe('/channels/server-1');
  });
});
