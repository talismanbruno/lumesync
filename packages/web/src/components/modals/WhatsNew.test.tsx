import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@backspace/shared';
import { create } from 'zustand';

const stores = vi.hoisted(() => ({ auth: null as unknown, ui: null as unknown }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: (...args: unknown[]) => (stores.auth as (...args: unknown[]) => unknown)(...args) }));
vi.mock('../../stores/uiStore', () => ({ useUIStore: (...args: unknown[]) => (stores.ui as (...args: unknown[]) => unknown)(...args) }));
vi.mock('../../hooks/usePortalContainer', () => ({ usePortalContainer: () => document.body }));
import { WhatsNew, WHATS_NEW_RELEASE } from './WhatsNew';

const user = { id: 'release-reader', username: 'reader', homeInstance: null } as User;
const auth = create(() => ({ user: user as User | null, hasAuthenticatedSession: false }));
const ui = create<{ activeModal: string | null; openModal: (modal: string) => void; closeModal: () => void }>((set) => ({
  activeModal: null, openModal: (activeModal) => set({ activeModal }), closeModal: () => set({ activeModal: null }),
}));
stores.auth = auth;
stores.ui = ui;

beforeEach(() => {
  localStorage.clear();
  auth.setState({ user, hasAuthenticatedSession: false });
  ui.setState({ activeModal: null });
});
afterEach(cleanup);

describe('release highlights', () => {
  it('waits for authentication, supports manual reopening and remembers dismissal across a new login', () => {
    render(<WhatsNew />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => auth.setState({ hasAuthenticatedSession: true }));
    expect(screen.getByRole('dialog', { name: 'O que há de novo' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Bora usar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(`lume:whats-new::release-reader:${WHATS_NEW_RELEASE}`)).toBe('seen');
    act(() => auth.setState({ hasAuthenticatedSession: false }));
    act(() => auth.setState({ hasAuthenticatedSession: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => ui.getState().openModal('whatsNew'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves an existing modal and does not share dismissal between accounts', () => {
    auth.setState({ user: { ...user, id: 'second-reader' }, hasAuthenticatedSession: true });
    ui.setState({ activeModal: 'invite' });
    render(<WhatsNew />);
    expect(ui.getState().activeModal).toBe('invite');
    act(() => ui.getState().closeModal());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar novidades' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
