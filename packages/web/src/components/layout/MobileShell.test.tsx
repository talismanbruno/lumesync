import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import type { TaggedSpace } from '../../stores/spaceStore';

vi.mock('./MobileSpacesScreen', () => ({ MobileSpacesScreen: () => <div>Raiz de servidores</div> }));
vi.mock('./MobileDmsScreen', () => ({ MobileDmsScreen: () => <div>Raiz de conversas</div> }));
vi.mock('./MobileYouScreen', () => ({ MobileYouScreen: () => <div>Raiz do perfil</div> }));
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ resumeContext: vi.fn() }) },
}));

import { MobileShell } from './MobileShell';

beforeEach(() => {
  useUIStore.setState({ mobileScreen: 'spaces', mobileStack: [] });
  useSpaceStore.setState({ spaces: [], currentSpaceId: null, lastSelectedSpaceId: null });
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
