import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@backspace/shared';
import type { ParticipantInfo } from '../../hooks/useLiveKit';
vi.mock('../../hooks/useWebSocket', () => ({ wsSend: vi.fn(), getRejectedPeerOrigins: () => new Set(), getAwaitingApprovalPeerOrigins: () => new Set() }));
vi.mock('../../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ setOutputDevice() {}, setVolume() {} }) } }));
import { VoiceGrid } from './VoiceGrid';
import { VoiceChannel } from './VoiceChannel';
import { buildVoiceParticipantMenuItems } from './voiceMenuItems';
import { ContextMenuRenderer } from '../ui/ContextMenuRenderer';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore, setMyUserIdForOrigin } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useComposerStore } from '../../stores/composerStore';
import { useContextMenuStore } from '../../stores/contextMenuStore';
import { PermissionBits } from '../../utils/permissions';
import { wsSend } from '../../hooks/useWebSocket';

const self = { id: 'self', username: 'self', displayName: 'Eu' } as User;
const peer = { id: 'peer', username: 'peer', displayName: 'Pessoa' } as User;
const participant: ParticipantInfo = {
  identity: 'peer:peer', userId: 'peer', username: 'peer', homeUserId: null,
  isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false, isLocal: false,
  audioTrack: null, videoTrack: null, screenTrack: null, screenAudioTrack: null,
  lkVideoTrack: null, lkScreenTrack: null, cachedUser: peer,
};
const perms = (PermissionBits.MUTE_MEMBERS | PermissionBits.DEAFEN_MEMBERS | PermissionBits.MOVE_MEMBERS | PermissionBits.DISCONNECT_MEMBERS).toString();
const position = { x: 40, y: 80 };
const menu = () => useContextMenuStore.getState().menu!.items;
const item = (key: string) => menu().find(i => i.key === key)!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useAuthStore.setState({ user: self });
  useUIStore.setState({ isMobile: false, userProfilePopout: { user: null, position: null }, activeModal: null, voiceChatOpen: false });
  useVoiceStore.setState({
    currentVoiceChannelId: 'voice', activeDmCall: null, participants: [participant], focusedParticipantId: null,
    isMuted: false, isDeafened: false, isLiveKitConnected: true,
    participantMutes: new Map(), participantVolumes: new Map(), unwatchedCameras: new Set(),
    voiceUsers: new Map([['voice', ['self', 'peer']]]), spaceMutedUserIds: new Set(), spaceDeafenedUserIds: new Set(), permissionMutedUserIds: new Set(),
  });
  useSpaceStore.setState({
    members: [{ userId: 'peer', user: peer }, { userId: 'self', user: self }] as any,
    userViews: new Map(), dmChannels: [], spacePermissions: new Map([['space', perms]]),
    channels: [{ id: 'voice', name: 'Voz', type: 'voice' }, { id: 'next', name: 'Outra sala', type: 'voice' }, { id: 'foreign', name: 'Outro servidor', type: 'voice' }] as any,
    channelToSpaceMap: new Map([['voice', 'space'], ['next', 'space'], ['foreign', 'other']]),
    channelOriginMap: new Map(), voiceChannelIds: new Set(['voice', 'next', 'foreign']),
  });
  useChatStore.setState({ currentChannelId: 'voice' });
  useComposerStore.setState({ states: new Map() });
  useContextMenuStore.getState().close();
});

describe('call participant interactions', () => {
  it('left-clicking a participant or their avatar focuses without opening their profile, and removes only the Grid button', () => {
    const { container } = render(<VoiceGrid participants={[participant]} />);
    fireEvent.click(container.querySelector('[data-avatar]')!);
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    expect(useVoiceStore.getState().focusedParticipantId).toBe(participant.identity);
    expect(screen.queryByText('Grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pessoa'));
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    expect(useVoiceStore.getState().focusedParticipantId).toBeNull();
  });

  it('uses the same menu in the call and the server voice list, without a right-click also focusing', () => {
    const { unmount } = render(<VoiceGrid participants={[participant]} />);
    fireEvent.contextMenu(screen.getByLabelText('Pessoa'), { clientX: 40, clientY: 80 });
    const keys = menu().map(i => i.key);
    expect(keys).toEqual(expect.arrayContaining(['profile', 'mention', 'mute-user', 'volume', 'space-mute', 'space-deafen', 'move-to', 'disconnect', 'copy-id']));
    expect(useVoiceStore.getState().focusedParticipantId).toBeNull();
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    unmount();
    render(<VoiceChannel channelId="voice" channelName="Voz" onClick={() => {}} />);
    fireEvent.contextMenu(screen.getByText('Pessoa'), { clientX: 40, clientY: 80 });
    expect(menu().map(i => i.key)).toEqual(keys);
  });

  it('opens a profile only through the explicit menu action and inserts a mention without losing the draft', () => {
    render(<VoiceGrid participants={[participant]} />);
    fireEvent.contextMenu(screen.getByLabelText('Pessoa'));
    const profile = item('profile');
    if (profile.type !== 'action') throw new Error('missing profile');
    act(() => profile.onClick());
    expect(useUIStore.getState().userProfilePopout.user?.id).toBe('peer');
    useComposerStore.getState().setDraft('voice', 'Olá');
    const mention = item('mention');
    if (mention.type !== 'action') throw new Error('missing mention');
    act(() => mention.onClick());
    expect(useComposerStore.getState().get('voice').draftText).toBe('Olá <@peer> ');
    expect(useUIStore.getState().voiceChatOpen).toBe(true);
  });

  it('local mute and volume controls update independently without invoking moderation', () => {
    render(<><VoiceGrid participants={[participant]} /><ContextMenuRenderer /></>);
    fireEvent.contextMenu(screen.getByLabelText('Pessoa'));
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar para mim' }));
    expect(useVoiceStore.getState().participantMutes.get('peer')).toBe(true);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume da pessoa' }), { target: { value: '65' } });
    expect(useVoiceStore.getState().participantVolumes.get('peer')).toBe(65);
    expect(wsSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar para mim' }));
    expect(useVoiceStore.getState().participantMutes.get('peer')).toBe(false);
  });

  it('supports self controls, respects server restrictions and allows the keyboard menu', () => {
    const me = { ...participant, userId: 'self', identity: 'self:self', username: 'self', cachedUser: self, isLocal: true };
    render(<VoiceGrid participants={[me]} />);
    fireEvent.keyDown(screen.getByLabelText('Eu'), { shiftKey: true, key: 'F10' });
    expect(menu().map(i => i.key)).toEqual(expect.arrayContaining(['profile', 'self-mute', 'self-deafen', 'edit-profile', 'copy-id']));
    expect(item('mute-user')).toBeUndefined();
    const deaf = item('self-deafen');
    const mic = item('self-mute');
    if (deaf.type !== 'checkbox' || mic.type !== 'checkbox') throw new Error('missing self controls');
    act(() => deaf.onChange(true));
    expect(useVoiceStore.getState().isDeafened).toBe(true);
    act(() => mic.onChange(false));
    expect(useVoiceStore.getState().isDeafened).toBe(false);
    useVoiceStore.setState({ spaceMutedUserIds: new Set(['space:self']) });
    expect(mic.getChecked()).toBe(true);
    act(() => mic.onChange(false));
    expect(useVoiceStore.getState().spaceMutedUserIds.has('space:self')).toBe(true);
    expect(useVoiceStore.getState().isMuted).toBe(false);
  });

  it('works in DM calls without server moderation or a space voice channel', () => {
    useVoiceStore.setState({ currentVoiceChannelId: null, activeDmCall: { dmChannelId: 'dm' } as any });
    useSpaceStore.setState({ dmChannels: [{ id: 'dm', members: [self, peer] }] as any });
    useChatStore.setState({ currentChannelId: 'dm' });
    render(<VoiceGrid participants={[participant]} />);
    fireEvent.contextMenu(screen.getByLabelText('Pessoa'));
    expect(menu().map(i => i.key)).toContain('mute-user');
    expect(menu().map(i => i.key)).not.toContain('space-mute');
  });

  it('restricts movement to the same server and routes moderation to the voice origin', () => {
    useSpaceStore.setState({ channelOriginMap: new Map([['voice', 'https://voice.example']]) });
    const items = buildVoiceParticipantMenuItems('peer', 'voice', position);
    const move = items.find(i => i.key === 'move-to');
    if (move?.type !== 'submenu') throw new Error('missing move');
    expect(move.children.map(i => i.key)).toEqual(['next']);
    const mute = items.find(i => i.key === 'space-mute');
    if (mute?.type !== 'checkbox') throw new Error('missing moderator control');
    mute.onChange(true);
    expect(wsSend).toHaveBeenCalledWith({ type: 'voice_space_mute', userId: 'peer', muted: true }, 'https://voice.example');
    useVoiceStore.setState({ spaceMutedUserIds: new Set(['space:peer']) });
    expect(mute.getChecked()).toBe(true);
    useSpaceStore.setState({ spacePermissions: new Map() });
    expect(buildVoiceParticipantMenuItems('peer', 'voice', position).map(i => i.key)).not.toContain('disconnect');
  });

  it('recognizes self using the voice instance ID while viewing another instance', () => {
    useSpaceStore.setState({ channelOriginMap: new Map([['voice', 'https://remote.example']]) });
    setMyUserIdForOrigin('https://remote.example', 'remote-self');
    const items = buildVoiceParticipantMenuItems('remote-self', 'voice', position);
    expect(items.map(i => i.key)).toContain('self-mute');
    expect(items.map(i => i.key)).not.toContain('mute-user');
  });
});
