import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('automatic browser-session handoff', () => {
  it('automatically hands off the existing session only once under StrictMode', async () => {
    render(<React.StrictMode><MemoryRouter initialEntries={['/desktop-login' + hash]}><DesktopLoginPage /></MemoryRouter></React.StrictMode>);
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
    expect(mocks.authorize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Continuar como/ })).not.toBeInTheDocument();
  });
  it('sends only an opaque code and state to the local app, never the browser token', async () => {
    page();
    await screen.findByRole('link', { name: 'Abrir Lume' });
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
  it('waits until the browser account is loaded before starting', async () => {
    mocks.state.user = null;
    const view = page();
    expect(mocks.load).toHaveBeenCalled(); expect(mocks.authorize).not.toHaveBeenCalled();
    mocks.state.user = { id: 'demo', username: 'demo' };
    view.rerender(<MemoryRouter initialEntries={['/desktop-login' + hash]}><Routes><Route path="/desktop-login" element={<DesktopLoginPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
  });
  it('offers an explicit retry after failure without an automatic retry loop', async () => {
    mocks.authorize.mockRejectedValue(new Error('Sessão expirada')); page();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sessão expirada'); expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.authorize).toHaveBeenCalledTimes(1);
    mocks.authorize.mockResolvedValue({ code: 'b'.repeat(64) });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
  });
});
