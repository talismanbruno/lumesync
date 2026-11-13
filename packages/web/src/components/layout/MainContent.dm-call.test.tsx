import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';

vi.mock('../../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ setInputVolume: vi.fn(), setOutputDevice: vi.fn(), playSound: vi.fn() }) } }));
vi.mock('../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../utils/voice', () => ({ joinVoiceChannel: vi.fn(), requestMicPermission: vi.fn() }));
vi.mock('../../utils/voiceActions', () => ({ handleMuteAction: vi.fn(), handleDeafenAction: vi.fn(), handleCameraAction: vi.fn(), handleScreenShareAction: vi.fn(), handleDisconnectAction: vi.fn() }));
vi.mock('../../utils/userViewLookup', () => ({ useCanonicalUserView: (user: unknown) => user, getCanonicalUserView: (user: unknown) => user }));
const { getActiveRoom } = vi.hoisted(() => ({ getActiveRoom: vi.fn(() => null as any) }));
vi.mock('../../hooks/useLiveKit', async importOriginal => ({
  ...await importOriginal<typeof import('../../hooks/useLiveKit')>(),
  getActiveRoom,
}));
vi.mock('../voice/VoiceGrid', () => ({ VoiceGrid: () => <div data-testid="voice-grid">Vídeo da chamada</div> }));
vi.mock('../voice/ScreenShareSettingsPopover', () => ({ ScreenShareSettingsPopover: () => null }));
vi.mock('../chat/MessageList', () => ({ MessageList: ({ channelId }: { channelId: string }) => <div>Mensagens de {channelId}</div> }));
vi.mock('../chat/MessageInput', () => ({ MessageInput: () => {
  const [draft, setDraft] = useState('');
  return <input aria-label="Mensagem" value={draft} onChange={event => setDraft(event.target.value)} />;
} }));
vi.mock('../chat/SearchPopover', () => ({ SearchPopover: ({ open, onClose, onJumpToMessage }: { open: boolean; onClose: () => void; onJumpToMessage: (id: string) => void }) => open ? <button onClick={() => { onJumpToMessage('found-message'); onClose(); }}>Resultado da busca</button> : null }));
vi.mock('../chat/FriendsPage', () => ({ FriendsPage: () => null }));
vi.mock('../chat/ExplorePage', () => ({ ExplorePage: () => null }));
vi.mock('./TransferIndicator', () => ({ TransferIndicator: () => null }));

import { MainContent } from './MainContent';
import { MobileChatScreen } from './MobileChatScreen';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import type { ParticipantInfo } from '../../hooks/useLiveKit';
import { handleMuteAction } from '../../utils/voiceActions';

const participant: ParticipantInfo = {
  identity: 'other', userId: 'other', username: 'other', homeUserId: null,
  isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false, isLocal: false,
  audioTrack: null, videoTrack: null, screenTrack: null, screenAudioTrack: null,
  lkVideoTrack: null, lkScreenTrack: null, cachedUser: null,
};

beforeEach(() => {
  getActiveRoom.mockReset();
  getActiveRoom.mockReturnValue(null);
  const self = { id: 'self', username: 'self', replicatedInstances: [] } as any;
  const other = { id: 'other', username: 'other', replicatedInstances: [], customization: { avatarDecorationId: '101' } } as any;
  useAuthStore.setState({ user: self });
  useUIStore.setState({ showDms: true, voiceFullscreen: false, voiceChatOpen: false });
  useChatStore.setState({ currentChannelId: 'call-dm' });
  useSpaceStore.setState({ currentSpaceId: null, channels: [], dmChannels: [
    { id: 'call-dm', members: [self, other] },
    { id: 'other-dm', members: [self, other] },
  ] as any });
  useVoiceStore.setState({ activeDmCall: { dmChannelId: 'call-dm' }, outgoingCall: null, currentVoiceChannelId: null, participants: [participant], speakingParticipantIds: new Set(), watchingStreams: new Set(), focusedParticipantId: null, isLiveKitConnected: true, connectionError: null });
});

const open = () => render(<MemoryRouter><MainContent /></MemoryRouter>);

describe('conversation during private calls', () => {
  it('keeps the same composer and draft through call entry, video expansion and hangup', () => {
    useVoiceStore.setState({ activeDmCall: null });
    open();
    const composer = screen.getByRole('textbox', { name: 'Mensagem' });
    fireEvent.change(composer, { target: { value: 'rascunho' } });

    act(() => useVoiceStore.setState({ activeDmCall: { dmChannelId: 'call-dm' } as any }));
    expect(screen.getByRole('region', { name: 'Chamada' })).toBeVisible();
    expect(screen.queryByTestId('voice-grid')).toBeNull();
    expect(screen.getByText('Mensagens de call-dm')).toBeVisible();
    expect(screen.getByRole('textbox')).toBe(composer);

    act(() => useVoiceStore.setState({ participants: [{ ...participant, isScreenSharing: true }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Expandir vídeos' }));
    expect(screen.getByTestId('voice-grid')).toBeVisible();
    expect(composer).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher vídeos' }));
    expect(screen.queryByTestId('voice-grid')).toBeNull();

    act(() => useVoiceStore.setState({ activeDmCall: null }));
    expect(screen.queryByRole('region', { name: 'Chamada' })).toBeNull();
    expect(screen.getByRole('textbox')).toBe(composer);
    expect(composer).toHaveValue('rascunho');
  });

  it('previews the screen without subscribing to audio, then opens it on click', () => {
    const video = { source: 'screen_share', setSubscribed: vi.fn() };
    const audio = { source: 'screen_share_audio', setSubscribed: vi.fn() };
    getActiveRoom.mockReturnValue({
      on: vi.fn(), off: vi.fn(),
      localParticipant: { publishData: vi.fn().mockResolvedValue(undefined) },
      remoteParticipants: new Map([['native-screen', {
        getTrackPublication: () => video,
        trackPublications: new Map([['video', video], ['audio', audio]]),
      }]]),
    });
    useVoiceStore.setState({ participants: [{ ...participant, isScreenSharing: true, screenOwnerIdentity: 'native-screen' }] });

    open();
    const preview = screen.getByRole('button', { name: 'Assistir à transmissão de other' });
    expect(video.setSubscribed).toHaveBeenCalledWith(true);
    expect(audio.setSubscribed).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().watchingStreams.has('other')).toBe(false);

    fireEvent.click(preview);
    expect(useVoiceStore.getState().watchingStreams.has('other')).toBe(true);
    expect(useVoiceStore.getState().focusedParticipantId).toBe('other:stream');
    expect(audio.setSubscribed).toHaveBeenCalledWith(true);
    expect(video.setSubscribed).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId('voice-grid')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Mensagem' })).toBeVisible();
  });

  it('keeps the decoration visible and animates only while the participant speaks', () => {
    const { container } = open();
    const getDecoration = () => container.querySelector('.lume-call-participant .lume-avatar-decoration');
    expect(getDecoration()).toHaveAttribute('data-decoration-playing', 'false');

    act(() => useVoiceStore.setState({ speakingParticipantIds: new Set(['other']) }));
    expect(screen.getByLabelText('other está falando')).toBeVisible();
    const decoration = getDecoration();
    expect(decoration).toHaveAttribute('data-decoration-playing', 'true');
    expect(decoration?.querySelector('img')).toHaveAttribute('src', '/api/customization/items/101/animated');

    act(() => useVoiceStore.setState({ participants: [{ ...participant }] }));
    expect(getDecoration()).toBe(decoration);
    act(() => useVoiceStore.setState({ speakingParticipantIds: new Set() }));
    expect(getDecoration()).toBe(decoration);
    expect(getDecoration()).toHaveAttribute('data-decoration-playing', 'false');

    act(() => useVoiceStore.setState({ participants: [{ ...participant, isMuted: true }] }));
    expect(screen.getByRole('img', { name: 'Microfone silenciado' })).toBeVisible();
    expect(getDecoration()).toBe(decoration);
    expect(getDecoration()).toHaveAttribute('data-decoration-playing', 'false');
    fireEvent.click(screen.getByTitle('Silenciar microfone (M)'));
    expect(handleMuteAction).toHaveBeenCalledWith(false, false);
  });

  it('keeps the conversation visible when jumping to a search result', () => {
    open();
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.click(screen.getByText('Resultado da busca'));
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('keeps the call active when navigating to another conversation and back', () => {
    open();
    act(() => useChatStore.setState({ currentChannelId: 'other-dm' }));
    expect(screen.getByText('Mensagens de other-dm')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Chamada' })).toBeNull();
    expect(useVoiceStore.getState().activeDmCall?.dmChannelId).toBe('call-dm');
    act(() => useChatStore.setState({ currentChannelId: 'call-dm' }));
    expect(screen.getByRole('region', { name: 'Chamada' })).toBeVisible();
    act(() => useVoiceStore.setState({ activeDmCall: null }));
    expect(screen.queryByRole('region', { name: 'Chamada' })).toBeNull();
    expect(screen.getByText('Mensagens de call-dm')).toBeVisible();
  });
});


describe('private call panel stays exclusive to conversations', () => {
  const enterServer = () => {
    useUIStore.setState({ showDms: false });
    useChatStore.setState({ currentChannelId: 'server-voice' });
    useSpaceStore.setState({ currentSpaceId: 'server', channels: [{ id: 'server-voice', type: 'voice', name: 'Voz' }] as any });
    useVoiceStore.setState({ activeDmCall: null, currentVoiceChannelId: 'server-voice' });
  };

  it('uses the full server grid with working controls and optional chat', () => {
    enterServer();
    const { container } = open();
    expect(container.querySelector('.lume-compact-call')).toBeNull();
    expect(screen.getByTestId('voice-grid')).toBeVisible();
    fireEvent.click(screen.getByTitle('Silenciar microfone (M)'));
    expect(handleMuteAction).toHaveBeenCalledWith(false, false);
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText('Mensagens de server-voice')).toBeVisible();
    const composer = screen.getByRole('textbox');
    fireEvent.change(composer, { target: { value: 'rascunho do servidor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByRole('textbox')).toBe(composer);
    expect(composer).toHaveValue('rascunho do servidor');
  });

  it('does not show the private panel before joining a server voice room', () => {
    enterServer();
    useVoiceStore.setState({ currentVoiceChannelId: null });
    const { container } = open();
    expect(container.querySelector('.lume-compact-call')).toBeNull();
    expect(screen.queryByTestId('voice-grid')).toBeNull();
    expect(screen.getByRole('button', { name: 'Join Voice' })).toBeVisible();
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('keeps the mobile panel only in private and group conversations', () => {
    useChatStore.setState({ loadMessages: vi.fn() });
    const { container, rerender } = render(<MobileChatScreen params={{ channelId: 'call-dm', spaceId: '@me' }} />);
    expect(screen.getByRole('region', { name: 'Chamada' })).toBeVisible();
    act(() => enterServer());
    rerender(<MobileChatScreen params={{ channelId: 'server-voice', spaceId: 'server' }} />);
    expect(container.querySelector('.lume-compact-call')).toBeNull();
    expect(screen.getByRole('textbox')).toBeVisible();
  });
});
