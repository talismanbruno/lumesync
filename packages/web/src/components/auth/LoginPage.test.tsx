import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({ login: vi.fn(), status: vi.fn(), forgot: vi.fn(), reset: vi.fn(), verify: vi.fn() }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ login: mocks.login }) }));
vi.mock('../../api/client', () => ({ api: { auth: { emailStatus: mocks.status, forgotPassword: mocks.forgot, resetPassword: mocks.reset, verifyEmail: mocks.verify } }, HttpError: class extends Error { status = 500; }, RateLimitError: class extends Error { retryAfter = 30; } }));
vi.mock('./DesktopDownloadLink', () => ({ DesktopDownloadLink: () => null }));
beforeEach(() => { vi.resetAllMocks(); mocks.status.mockResolvedValue({ available: true }); mocks.forgot.mockResolvedValue({ success: true }); mocks.verify.mockResolvedValue({ success: true }); mocks.reset.mockResolvedValue({ success: true }); });
afterEach(cleanup);
function page(path = '/login') { return render(<MemoryRouter initialEntries={[path]}><LoginPage /></MemoryRouter>); }

describe('simple account access', () => {
  it('shows a clean login, reveals the password on request, and logs in with the chosen credentials', async () => {
    page();
    expect(screen.queryByRole('button', { name: /Ajuda sobre/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: ' demo_user ' } });
    fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: 'my-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar', exact: true }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('demo_user', 'my-password'));
    expect(screen.queryByText(/Orbital|comunicação em órbita|Source Code/i)).not.toBeInTheDocument();
  });
  it('requests recovery with only an email, without asking for an emergency code', async () => {
    page(); fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    await waitFor(() => expect(mocks.status).toHaveBeenCalled());
    expect(screen.queryByLabelText('Senha', { exact: true })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-mail de recuperação'), { target: { value: 'demo@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));
    await screen.findByRole('heading', { name: 'Confira seu e-mail' });
    expect(mocks.forgot).toHaveBeenCalledWith('demo@example.com');
    expect(screen.getByText(/Se este endereço estiver confirmado/)).toBeInTheDocument();
  });
  it('does not pretend to send when the email service is unavailable', async () => {
    mocks.status.mockResolvedValue({ available: false }); page();
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    await screen.findByRole('status');
    expect(screen.getByRole('button', { name: 'Enviar link de recuperação' })).toBeDisabled();
    expect(mocks.forgot).not.toHaveBeenCalled();
  });
  it('requires an explicit click to confirm an email, protecting against automatic link previews', async () => {
    page('/verify-email#token=' + 'a'.repeat(64));
    expect(mocks.verify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }));
    await screen.findByRole('heading', { name: 'E-mail confirmado' });
    expect(mocks.verify).toHaveBeenCalledWith('a'.repeat(64));
  });
  it('keeps the reset form open on mismatched passwords and submits matching passwords', async () => {
    page('/reset-password#token=' + 'b'.repeat(64));
    fireEvent.change(screen.getByLabelText('Nova senha', { exact: true }), { target: { value: 'my-new-password' } });
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('iguais'); expect(mocks.reset).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'my-new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    await screen.findByRole('heading', { name: 'Senha atualizada' });
    expect(mocks.reset).toHaveBeenCalledWith('b'.repeat(64), 'my-new-password');
  });
});
