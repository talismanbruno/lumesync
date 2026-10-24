import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), open: vi.fn(), state: { token: 'browser-session' as string | null, user: { id: 'demo', username: 'demo' } as any }, load: vi.fn() }));
vi.mock('../../api/client', () => ({ api: { auth: { authorizeDesktop: mocks.authorize } } }));
vi.mock('../../platform/platform', () => ({ isElectron: () => false }));
vi.mock('../../utils/desktopLogin', () => ({ openDesktopLoginCallback: mocks.open }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: Object.assign((selector: any) => selector(mocks.state), { getState: () => ({ ...mocks.state, loadUser: mocks.load }) }) }));
import { DesktopLoginPage } from './DesktopLoginPage';

const hash = '#challenge=' + 'c'.repeat(43) + '&state=' + 's'.repeat(43);
function LoginTarget() { const location = useLocation(); return <p>{location.search}</p>; }
function page(fragment = hash) { return render(<MemoryRouter initialEntries={['/desktop-login' + fragment]}><Routes><Route path="/desktop-login" element={<DesktopLoginPage />} /><Route path="/login" element={<LoginTarget />} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); mocks.state.token = 'browser-session'; mocks.state.user = { id: 'demo', username: 'demo' }; mocks.authorize.mockResolvedValue({ code: 'a'.repeat(64) }); });
afterEach(cleanup);

describe('explicit browser approval', () => {
  it('shows the existing account without minting a session on page load or link preview', () => {
    page(); expect(screen.getByRole('button', { name: 'Continuar como @demo' })).toBeEnabled();
    expect(mocks.authorize).not.toHaveBeenCalled(); expect(mocks.open).not.toHaveBeenCalled();
  });
  it('authorizes only after a click and sends an opaque code and state to the app', async () => {
    page(); fireEvent.click(screen.getByRole('button', { name: 'Continuar como @demo' }));
    await screen.findByRole('heading', { name: 'Tudo pronto para entrar' });
    expect(mocks.authorize).toHaveBeenCalledWith('c'.repeat(43));
    const url = new URL(mocks.open.mock.calls[0]![0]);
    expect(url.protocol).toBe('lume:'); expect(url.hostname).toBe('auth');
    expect(url.searchParams.get('code')).toBe('a'.repeat(64)); expect(url.searchParams.get('state')).toBe('s'.repeat(43));
    expect(url.href).not.toContain('browser-session');
    expect(screen.getByRole('link', { name: 'Abrir Lume' })).toHaveAttribute('href', url.href);
  });
  it('preserves the request through login when the browser is not authenticated', () => {
    mocks.state.token = null; page();
    expect(screen.getByText('?redirect=' + encodeURIComponent('/desktop-login' + hash))).toBeInTheDocument();
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('rejects incomplete and duplicated request fields', () => {
    page(hash + '&challenge=' + 'x'.repeat(43));
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto'); expect(mocks.authorize).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('keeps the confirmation available if the server refuses authorization', async () => {
    mocks.authorize.mockRejectedValue(new Error('Sessão expirada')); page();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar como @demo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sessão expirada'); expect(mocks.open).not.toHaveBeenCalled();
  });
});
