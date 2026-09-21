import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';

vi.mock('./MobileSpacesScreen', () => ({ MobileSpacesScreen: () => <div>Raiz de servidores</div> }));
vi.mock('./MobileDmsScreen', () => ({ MobileDmsScreen: () => <div>Raiz de conversas</div> }));
vi.mock('./MobileYouScreen', () => ({ MobileYouScreen: () => <div>Raiz do perfil</div> }));
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ resumeContext: vi.fn() }) },
}));

import { MobileShell } from './MobileShell';

beforeEach(() => {
  useUIStore.setState({ mobileScreen: 'spaces', mobileStack: [] });
});

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
});
