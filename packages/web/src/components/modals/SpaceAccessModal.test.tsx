import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: vi.fn().mockReturnValue({ setOutputDevice: vi.fn(), setVolume: vi.fn() }) },
}));

import { SpaceAccessModal } from './SpaceAccessModal';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore, NotConnectedError } from '../../stores/spaceStore';
import { useInstanceStore, DifferentPasswordError } from '../../stores/instanceStore';
import { useExploreStore } from '../../stores/exploreStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'), useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ activeModal: 'joinSpace', isMobile: false });
  useSpaceStore.setState({
    spaces: [], currentSpaceId: null,
    joinByCode: vi.fn().mockResolvedValue({ id: 'joined-space' }),
    createSpace: vi.fn().mockResolvedValue({ id: 'created-space' }),
  });
  useInstanceStore.setState({
    connectToRemote: vi.fn().mockResolvedValue(undefined),
    loginToRemote: vi.fn().mockResolvedValue(undefined),
  });
  useExploreStore.setState({ fetchSpaces: vi.fn(), fetchMyRequests: vi.fn() });
});

function renderModal() {
  return render(<MemoryRouter><SpaceAccessModal /></MemoryRouter>);
}

describe('SpaceAccessModal', () => {
  it('stays closed for unrelated modals', () => {
    useUIStore.setState({ activeModal: null });
    renderModal();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens the invite tab for existing join shortcuts without fetching discovery', () => {
    renderModal();
    expect(screen.getByRole('tab', { name: 'Entrar por convite' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Link ou código do convite')).toHaveFocus();
    expect(useExploreStore.getState().fetchSpaces).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar no servidor' })).toBeDisabled();
  });

  it('switches both ways with keyboard focus on the selected tab', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ activeModal: 'createSpace' });
    renderModal();
    const createTab = screen.getByRole('tab', { name: 'Criar servidor' });
    createTab.focus();
    await user.keyboard('{ArrowRight}');
    const joinTab = screen.getByRole('tab', { name: 'Entrar por convite' });
    expect(joinTab).toHaveAttribute('aria-selected', 'true');
    expect(joinTab).toHaveFocus();
    expect(screen.queryByLabelText('Nome do servidor')).not.toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(createTab).toHaveFocus();
    expect(screen.getByLabelText('Nome do servidor')).toBeInTheDocument();
  });

  it.each([
    ['my-code', undefined],
    ['https://remote.example/join/my-code', 'https://remote.example'],
    ['my-code@remote.example', 'https://remote.example'],
  ])('joins using %s and navigates on success', async (input, origin) => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText('Link ou código do convite'), input!);
    await user.click(screen.getByRole('button', { name: 'Entrar no servidor' }));
    expect(useSpaceStore.getState().joinByCode).toHaveBeenCalledWith('my-code', origin);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/channels/joined-space'));
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('shows invite failures and keeps the tabs usable for retry', async () => {
    const user = userEvent.setup();
    useSpaceStore.setState({ joinByCode: vi.fn().mockRejectedValue(new Error('Invalid invite code')) });
    renderModal();
    await user.type(screen.getByLabelText('Link ou código do convite'), 'bad-code');
    await user.click(screen.getByRole('button', { name: 'Entrar no servidor' }));
    expect(await screen.findByText('Invalid invite code')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Criar servidor' })).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('locks the tabs during a request and unlocks after failure', async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    useSpaceStore.setState({ joinByCode: vi.fn(() => new Promise((_, fail) => { reject = fail; })) });
    renderModal();
    await user.type(screen.getByLabelText('Link ou código do convite'), 'my-code');
    await user.click(screen.getByRole('button', { name: 'Entrar no servidor' }));
    expect(screen.getByRole('tab', { name: 'Criar servidor' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Criar servidor' }));
    expect(useUIStore.getState().activeModal).toBe('joinSpace');
    await act(async () => reject(new Error('Try again')));
    expect(await screen.findByText('Try again')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Criar servidor' })).toBeEnabled();
  });

  it('creates a server with trimmed name and existing defaults', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ activeModal: 'createSpace' });
    renderModal();
    await user.type(screen.getByLabelText('Nome do servidor'), '  Meu servidor  ');
    await user.click(screen.getByRole('button', { name: 'Criar servidor' }));
    expect(useSpaceStore.getState().createSpace).toHaveBeenCalledWith(expect.objectContaining({ name: 'Meu servidor', visibility: 'private' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/channels/created-space'));
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('requires a name and shows creation failures without closing', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ activeModal: 'createSpace' });
    useSpaceStore.setState({ createSpace: vi.fn().mockRejectedValue(new Error('Creation failed')) });
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Criar servidor' }));
    expect(screen.getByText('Space name is required')).toBeInTheDocument();
    expect(useSpaceStore.getState().createSpace).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Nome do servidor'), 'Meu servidor');
    await user.click(screen.getByRole('button', { name: 'Criar servidor' }));
    expect(await screen.findByText('Creation failed')).toBeInTheDocument();
    expect(useUIStore.getState().activeModal).toBe('createSpace');
  });

  it('preserves remote connection and fallback login before joining', async () => {
    const user = userEvent.setup();
    const join = vi.fn().mockRejectedValueOnce(new NotConnectedError('https://remote.example')).mockResolvedValue({ id: 'remote-space' });
    useSpaceStore.setState({ joinByCode: join });
    useInstanceStore.setState({ connectToRemote: vi.fn().mockRejectedValue(new DifferentPasswordError('remote-user')) });
    renderModal();
    await user.type(screen.getByLabelText('Link ou código do convite'), 'https://remote.example/join/code');
    await user.click(screen.getByRole('button', { name: 'Entrar no servidor' }));
    await user.type(await screen.findByPlaceholderText('Your account password'), 'local-password');
    await user.click(screen.getByRole('button', { name: 'Connect & Join' }));
    await user.type(await screen.findByPlaceholderText('Password on the remote instance'), 'remote-password');
    await user.click(screen.getByRole('button', { name: 'Login & Join' }));
    expect(useInstanceStore.getState().loginToRemote).toHaveBeenCalledWith('https://remote.example', 'remote-user', 'remote-password');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/channels/remote-space'));
  });

  it('opens on mobile and clears the invite after closing and reopening', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ isMobile: true });
    renderModal();
    await user.type(screen.getByLabelText('Link ou código do convite'), 'draft');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    act(() => useUIStore.getState().openModal('joinSpace'));
    expect(await screen.findByLabelText('Link ou código do convite')).toHaveValue('');
  });
});
