import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@backspace/shared';
import { useCustomizationStore } from '../../stores/customizationStore';
import { SelfProfileMenu } from './SelfProfileMenu';

const mocks = vi.hoisted(() => ({ update: vi.fn(), openModal: vi.fn(), addToast: vi.fn() }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: (select: (state: { user: null; updateProfile: typeof mocks.update }) => unknown) => select({ user: null, updateProfile: mocks.update }) }));
vi.mock('../../stores/spaceStore', () => ({ useSpaceStore: (select: (state: { userViews: Map<string, never> }) => unknown) => select({ userViews: new Map() }) }));
vi.mock('../../stores/activityStore', () => ({ useActivityStore: (select: (state: { myActivities: null }) => unknown) => select({ myActivities: null }) }));
vi.mock('../../stores/uiStore', () => ({ useUIStore: Object.assign((select: (state: { openUserProfile: () => void; isMobile: boolean }) => unknown) => select({ openUserProfile: vi.fn(), isMobile: false }), { getState: () => ({ openModal: mocks.openModal, addToast: mocks.addToast }) }) }));
vi.mock('../../utils/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }));

const user: User = {
  id: 'self-style', username: 'lume_studio', displayName: 'Lume Studio', avatar: 'avatar.gif', banner: 'banner.gif',
  bio: 'Minha órbita.', customStatus: 'Criando no Lume', status: 'online', preferredStatus: 'online',
  accentColor: '#67d9f2', avatarColor: 'sky', createdAt: 1000, isAdmin: true, isPioneer: true,
  homeInstance: null, homeUserId: null, replicatedInstances: [],
  customization: { avatarDecorationId: '101', nameplateId: '103', profileFrameId: '104', nameFont: 'Tempo', themeColor: '#121824' },
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.update.mockResolvedValue(undefined);
  const items = [{ id: '104', type: 3 as const, name: 'Moldura grande', category: 'Test', categoryId: '1', description: '', frameWidth: 1200, overflowTop: 300, overflowBottom: 240, overflowHorizontal: 60, frameLayers: [] }];
  useCustomizationStore.setState({ loaded: true, loading: false, error: null, items, byId: new Map(items.map(item => [item.id, item])) });
});

describe('self profile menu', () => {
  it('shows the personalized profile, badges and GIF banner, with space reserved for large frames', () => {
    const { container } = render(<SelfProfileMenu user={user} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Meu perfil e presença' })).toBeInTheDocument();
    expect(screen.getByText('Minha órbita.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Administrador verificado do Lume' })).toBeInTheDocument();
    expect(container.querySelector('.lume-self-profile-banner')).toHaveStyle({ backgroundImage: 'url("/api/uploads/banner.gif")' });
    expect(container.querySelector('.lume-avatar-decoration')).toHaveAttribute('src', '/api/customization/items/101/animated');
    expect(container.querySelector('.lume-nameplate')).not.toBeInTheDocument();
    expect(container.querySelector('.lume-self-profile-card')).toHaveStyle({ backgroundColor: '#121824' });
    const frame = container.querySelector<HTMLElement>('.lume-profile-frame-space')!;
    expect(parseFloat(frame.style.paddingTop)).toBeGreaterThan(80);
    expect(parseFloat(frame.style.paddingBottom)).toBeGreaterThan(60);
  });
  it('opens the presence choices and saves the manual preference', async () => {
    render(<SelfProfileMenu user={user} onClose={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Seu status: Disponível' }));
    fireEvent.click(screen.getByRole('button', { name: /Não perturbe/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: 'dnd' }));
    expect(screen.queryByRole('group', { name: 'Escolher presença' })).not.toBeInTheDocument();
  });
  it('edits a custom status and keeps a server failure visible for retry', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Falha local de teste'));
    render(<SelfProfileMenu user={user} onClose={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar status personalizado' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Status personalizado' }), { target: { value: 'Na minha órbita' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falha local de teste'));
    expect(mocks.update).toHaveBeenCalledWith({ customStatus: 'Na minha órbita' });
    expect(screen.getByRole('textbox', { name: 'Status personalizado' })).toHaveValue('Na minha órbita');
  });
  it('opens editing and closes on Escape', () => {
    const close = vi.fn(), edit = vi.fn();
    render(<SelfProfileMenu user={user} onClose={close} onEdit={edit} />);
    fireEvent.click(screen.getByRole('button', { name: /Editar perfil/ }));
    expect(edit).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});
