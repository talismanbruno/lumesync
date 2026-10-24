import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), initSession: vi.fn(), listener: null as null | ((url: string) => Promise<void>), off: vi.fn(), auth: { token: null as string | null },
  attempt: { verifier: 'private'.repeat(8), challenge: 'c'.repeat(43), state: 's'.repeat(43), expiresAt: Date.now() + 300000 },
}));
vi.mock('../../platform/platform', () => ({ isElectron: () => true }));
vi.mock('../../api/client', () => ({ api: { auth: { exchangeDesktop: mocks.exchange } } }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: { getState: () => ({ ...mocks.auth, initSession: mocks.initSession }) } }));
vi.mock('../../utils/desktopLogin', async importOriginal => ({ ...await importOriginal<typeof import('../../utils/desktopLogin')>(), createDesktopLoginAttempt: async () => mocks.attempt }));
import { DesktopBrowserLogin } from './DesktopBrowserLogin';

const code = 'a'.repeat(64);
const callback = `lume://auth/callback?code=${code}&state=${mocks.attempt.state}`;
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.token = null; mocks.listener = null;
  sessionStorage.clear(); sessionStorage.setItem('lume_browser_login_attempted', '1');
  window.backspace = { onDeepLink: (listener: any) => { mocks.listener = listener; return mocks.off; } } as any;
  vi.spyOn(window, 'open').mockReturnValue(null);
  mocks.exchange.mockResolvedValue({ token: 'new-app-token', user: { id: 'demo', username: 'demo' } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete window.backspace; });
function page() { return render(<MemoryRouter><DesktopBrowserLogin /></MemoryRouter>); }
async function start() { fireEvent.click(screen.getByRole('button', { name: 'Continuar pelo navegador' })); await screen.findByText(/Estamos verificando sua sessão/); }

describe('desktop browser-session handoff', () => {
  it('opens only the approval URL, keeps the proof private and waits for a matching callback', async () => {
    page(); await start();
    const opened = vi.mocked(window.open).mock.calls[0]![0] as string;
    expect(opened).toContain('/app/desktop-login#'); expect(opened).not.toContain(mocks.attempt.verifier);
    await act(async () => { await mocks.listener!(callback.replace(mocks.attempt.state, 'x'.repeat(43))); });
    expect(mocks.exchange).not.toHaveBeenCalled();
    await act(async () => { await mocks.listener!(callback); });
    expect(mocks.exchange).toHaveBeenCalledWith(code, mocks.attempt.verifier);
    expect(mocks.initSession).toHaveBeenCalledWith('new-app-token', expect.objectContaining({ username: 'demo' }));
    await act(async () => { await mocks.listener!(callback); });
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
  });
  it('does not authorize a canceled attempt or leave listeners mounted', async () => {
    const view = page(); await start();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com usuário e senha' }));
    await act(async () => { await mocks.listener!(callback); });
    expect(mocks.exchange).not.toHaveBeenCalled(); view.unmount(); expect(mocks.off).toHaveBeenCalled();
  });
  it('does not replace an account that was signed in manually while exchange was pending', async () => {
    page(); await start();
    let finish!: (value: unknown) => void;
    mocks.exchange.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = mocks.listener!(callback); });
    mocks.auth.token = 'manual-login-token';
    await act(async () => { finish({ token: 'late-token', user: {} }); await pending; });
    expect(mocks.initSession).not.toHaveBeenCalled();
  });
  it('automatically starts only once per window under StrictMode', async () => {
    vi.useFakeTimers(); sessionStorage.clear();
    const view = render(<React.StrictMode><MemoryRouter><DesktopBrowserLogin /></MemoryRouter></React.StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(window.open).toHaveBeenCalledTimes(1);
    view.unmount(); page();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(window.open).toHaveBeenCalledTimes(1);
  });
  it('shows an actionable retry when the authorization expires or is rejected', async () => {
    page(); await start(); mocks.exchange.mockRejectedValue(new Error('Expired'));
    await act(async () => { await mocks.listener!(callback); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('expirou'));
    expect(mocks.initSession).not.toHaveBeenCalled();
  });
});
