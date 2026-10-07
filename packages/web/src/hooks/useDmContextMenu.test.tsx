import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DmChannel, User } from '@backspace/shared';
vi.mock('../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ setOutputDevice() {}, setVolume() {} }) } }));
vi.mock('./useWebSocket', () => ({ wsSend: vi.fn(), getRejectedPeerOrigins: () => new Set(), getAwaitingApprovalPeerOrigins: () => new Set() }));
import { useDmContextMenu } from './useDmContextMenu';
import { DmListItem } from '../components/layout/DmListItem';
import { useContextMenuStore } from '../stores/contextMenuStore';
import { useSpaceStore } from '../stores/spaceStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useDmPreferencesStore, pinnedConversations } from '../stores/dmPreferencesStore';
import { useUserBlockStore } from '../stores/userBlockStore';
import { dmAccountKey, dmAlertsSilenced } from '../utils/dmActions';
import { api } from '../api/client';
import { useUIStore } from '../stores/uiStore';
import { wsSend } from './useWebSocket';

const self = { id: 'self', username: 'self' } as User;
const peer = { id: 'peer', username: 'peer', displayName: 'Peer', status: 'online' } as User;
const dm: DmChannel = { id: 'dm', createdAt: 1, members: [self, peer] };
const select = vi.fn();
const leave = vi.fn();
function Harness({ conversation = dm }: { conversation?: DmChannel }) {
  const { handleDmContextMenu, dmMenuConfirmation } = useDmContextMenu(select, leave);
  return <><DmListItem dm={conversation} user={self} isActive={false} isUnread={false} onSelect={select} onClose={() => {}} onLeave={leave} onContextMenu={handleDmContextMenu} />{dmMenuConfirmation}</>;
}
function openMenu(name = 'Peer') {
  fireEvent.contextMenu(screen.getByText(name), { clientX: 50, clientY: 80 });
  return useContextMenuStore.getState().menu!.items;
}
function action(key: string) {
  const item = useContextMenuStore.getState().menu!.items.find(item => item.key === key);
  if (!item || item.type !== 'action') throw new Error('Menu action missing: ' + key);
  return item;
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: self });
  useSpaceStore.setState({ dmChannels: [dm], userViews: new Map() });
  useVoiceStore.setState({ activeDmCall: null, incomingCall: null, outgoingCall: null });
  useSocialStore.setState({ friends: [], requests: [], sendFriendRequest: vi.fn().mockResolvedValue('request'), removeFriend: vi.fn().mockResolvedValue(undefined) });
  useDmPreferencesStore.setState({ accounts: {} });
  useUserBlockStore.setState({ accounts: {} });
  useContextMenuStore.getState().close();
  vi.spyOn(api.social, 'block').mockResolvedValue({ success: true });
  vi.spyOn(api.social, 'unblock').mockResolvedValue({ success: true });
});

describe('DM contact menu', () => {
  it('opens for individual conversations and shows the requested conditional actions', () => {
    render(<Harness />);
    const labels = openMenu().filter(item => item.type === 'action').map(item => item.label);
    expect(labels).toEqual(['Ver perfil', 'Fixar', 'Iniciar chamada', 'Adicionar amigo', 'Bloquear', 'Silenciar']);
    expect(useContextMenuStore.getState().menu!.position).toEqual({ x: 50, y: 80 });
    expect(select).not.toHaveBeenCalled();
  });
  it('opens the contact profile without navigating to or starting a call', () => {
    render(<Harness />); openMenu(); action('profile').onClick();
    expect(useUIStore.getState().activeModal).toBe('userProfile');
    expect(useUIStore.getState().modalData).toMatchObject({ userId: peer.id, user: peer, origin: '' });
    expect(select).not.toHaveBeenCalled();
    expect(wsSend).not.toHaveBeenCalled();
  });
  it('pins above newer and unread conversations, toggles back and isolates accounts', () => {
    render(<Harness />); openMenu(); action('pin').onClick();
    expect(pinnedConversations([{ id: 'newer', createdAt: 99, members: [] }, dm], useDmPreferencesStore.getState().accounts[dmAccountKey()].pinned)[0]).toBe(dm);
    openMenu(); expect(action('pin').label).toBe('Desafixar'); action('pin').onClick();
    expect(useDmPreferencesStore.getState().accounts[dmAccountKey()].pinned).toEqual([]);
    useAuthStore.setState({ user: { ...self, id: 'other-account' } });
    expect(useDmPreferencesStore.getState().accounts[dmAccountKey()]).toBeUndefined();
  });
  it('starts a call in the correct conversation and disables duplicate calls', () => {
    render(<Harness />); openMenu(); action('call').onClick();
    expect(useVoiceStore.getState().outgoingCall).toEqual({ dmChannelId: 'dm' });
    expect(wsSend).toHaveBeenCalledWith({ type: 'dm_call_start', dmChannelId: 'dm' }, '');
    expect(select).toHaveBeenCalledWith('dm');
    openMenu(); expect(action('call').disabled).toBe(true);
  });
  it('sends friend requests and hides add when already friends', async () => {
    render(<Harness />); openMenu(); action('friend').onClick();
    await waitFor(() => expect(useSocialStore.getState().sendFriendRequest).toHaveBeenCalledWith('peer'));
    useSocialStore.setState({ friends: [{ ...peer, _instanceOrigin: '' }] as any });
    const labels = openMenu().filter(item => item.type === 'action').map(item => item.label);
    expect(labels).toContain('Desfazer amizade');
    expect(labels).not.toContain('Adicionar amigo');
  });
  it('shows pending requests without sending duplicates', () => {
    useSocialStore.setState({ requests: [{ id: 'request', user: peer, status: 'pending' }] as any });
    render(<Harness />); openMenu();
    expect(action('friend').label).toBe('Pedido de amizade pendente');
    expect(action('friend').disabled).toBe(true);
  });
  it('asks to confirm removing an existing friendship and uses the friend record ID', async () => {
    const user = userEvent.setup();
    useSocialStore.setState({ friends: [{ ...peer, id: 'local-alias', homeUserId: peer.id, _instanceOrigin: '' }] as any });
    render(<Harness />); openMenu();
    fireEvent.click(document.body); // menu is held in the store in this harness
    await user.click(screen.getByText('Peer')); // ordinary left click still selects
    const item = action('unfriend');
    await import('@testing-library/react').then(({ act }) => act(() => item.onClick()));
    expect(useSocialStore.getState().removeFriend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Desfazer amizade' }));
    await waitFor(() => expect(useSocialStore.getState().removeFriend).toHaveBeenCalledWith('local-alias'));
  });
  it('persists blocking through the API and offers unblock', async () => {
    render(<Harness />); openMenu(); action('block').onClick();
    await waitFor(() => expect(api.social.block).toHaveBeenCalledWith('peer'));
    await waitFor(() => expect(useUserBlockStore.getState().accounts[dmAccountKey()]?.['']).toHaveLength(1));
    openMenu(); expect(action('block').label).toBe('Desbloquear'); expect(action('call').disabled).toBe(true);
    action('block').onClick();
    await waitFor(() => expect(api.social.unblock).toHaveBeenCalledWith('peer'));
    await waitFor(() => expect(useUserBlockStore.getState().accounts[dmAccountKey()]?.['']).toEqual([]));
  });
  it('mutes alerts while retaining the conversation and supports unmute', () => {
    render(<Harness />); openMenu(); action('mute').onClick();
    expect(dmAlertsSilenced('dm')).toBe(true);
    expect(useSpaceStore.getState().dmChannels).toHaveLength(1);
    openMenu(); expect(action('mute').label).toBe('Ativar notificações'); action('mute').onClick();
    expect(dmAlertsSilenced('dm')).toBe(false);
  });
  it('preserves group actions without applying friendship actions to the group', () => {
    const group = { ...dm, ownerId: self.id, name: 'Grupo' };
    useSpaceStore.setState({ dmChannels: [group] });
    render(<Harness conversation={group} />);
    const labels = openMenu('Grupo').filter(item => item.type === 'action').map(item => item.label);
    expect(labels).toContain('Sair do grupo');
    expect(labels).not.toContain('Bloquear');
    action('leave-group').onClick(); expect(leave).toHaveBeenCalledWith('dm');
  });
});
