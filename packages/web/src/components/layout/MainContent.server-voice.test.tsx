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
import { VoiceChannel } from '../voice/VoiceChannel';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { PermissionBits } from '../../utils/permissions';
import type { ParticipantInfo } from '../../hooks/useLiveKit';
import { handleScreenShareAction } from '../../utils/voiceActions';

const peer = { id: 'other', username: 'other', replicatedInstances: [] } as any;
const participant: ParticipantInfo = {
  identity: 'other:device', userId: 'other', username: 'other', homeUserId: null,
  isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: true, isLocal: false,
  audioTrack: null, videoTrack: null, screenTrack: null, screenAudioTrack: null,
  lkVideoTrack: null, lkScreenTrack: null, cachedUser: peer, screenOwnerIdentity: 'native-screen',
};
const videoPublication = { source: 'screen_share', setSubscribed: vi.fn() };
const audioPublication = { source: 'screen_share_audio', setSubscribed: vi.fn() };
const attach = vi.fn();
const detach = vi.fn();
const screenTrack = { readyState: 'live', getSettings: () => ({ height: 1080 }), addEventListener: vi.fn(), removeEventListener: vi.fn() } as any;
const liveParticipant = { ...participant, screenTrack, lkScreenTrack: { attach, detach } as any };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  getActiveRoom.mockReturnValue({ localParticipant: { publishData: vi.fn().mockResolvedValue(undefined) }, remoteParticipants: new Map([['native-screen', { trackPublications: new Map([['video', videoPublication], ['audio', audioPublication]]) }]]) });
  useAuthStore.setState({ user: { id: 'self', username: 'self', replicatedInstances: [] } as any });
  useUIStore.setState({ showDms: false, voiceFullscreen: false, voiceChatOpen: false, isMobile: false });
  useSpaceStore.setState({ currentSpaceId: 'server', members: [], dmChannels: [], channels: [{ id: 'voice', type: 'voice', name: 'Voz' }, { id: 'text', type: 'text', name: 'Geral' }] as any, channelPermissions: new Map([['voice', String(PermissionBits.SPEAK | PermissionBits.STREAM)]]) });
  useChatStore.setState({ currentChannelId: 'voice' });
  useVoiceStore.setState({ activeDmCall: null, outgoingCall: null, currentVoiceChannelId: 'voice', participants: [participant], isLiveKitConnected: true, connectionError: null, focusedParticipantId: null, watchingStreams: new Set(), speakingParticipantIds: new Set() });
});

function open() {
  return render(<MemoryRouter><VoiceChannel channelId="voice" channelName="Voz" onClick={() => useChatStore.getState().setCurrentChannel('voice')} /><MainContent /></MemoryRouter>);
}

describe('original server voice workspace with the real grid and player', () => {
  it('subscribes to native screen video and audio, then attaches the arriving track', () => {
    const { container } = open();
    expect(container.querySelector('.lume-server-call-layout')).toHaveClass('is-chat-closed');
    expect(container.querySelector('.lume-compact-call')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Watch Stream' }));
    expect(videoPublication.setSubscribed).toHaveBeenCalledWith(true);
    expect(audioPublication.setSubscribed).toHaveBeenCalledWith(true);
    expect(useVoiceStore.getState().watchingStreams.has('other')).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando transmissão');
    act(() => useVoiceStore.setState({ participants: [liveParticipant] }));
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(attach).toHaveBeenCalledWith(video);
  });

  it('keeps the call in the sidebar while reading text, then restores the full player on channel click', () => {
    useVoiceStore.setState({ participants: [liveParticipant], watchingStreams: new Set(['other']) });
    const { container } = open();
    expect(container.querySelector('.lume-server-call-workspace')).not.toBeNull();
    act(() => useChatStore.setState({ currentChannelId: 'text' }));
    expect(container.querySelector('.lume-server-call-workspace')).toBeNull();
    expect(container.querySelector('.lume-compact-call')).toBeNull();
    expect(screen.getByRole('textbox')).toBeVisible();
    expect(useVoiceStore.getState().currentVoiceChannelId).toBe('voice');
    expect(useVoiceStore.getState().watchingStreams.has('other')).toBe(true);
    expect(detach).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Voz' }));
    expect(container.querySelector('.lume-server-call-workspace')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(attach).toHaveBeenLastCalledWith(container.querySelector('video'));
  });

  it('synchronizes fullscreen after entering a room that was initially disconnected', () => {
    useVoiceStore.setState({ currentVoiceChannelId: null });
    const { container, unmount } = open();
    expect(container.querySelector('[data-voice-fullscreen]')).toBeNull();
    act(() => useVoiceStore.setState({ currentVoiceChannelId: 'voice' }));
    const workspace = container.querySelector<HTMLElement>('[data-voice-fullscreen]')!;
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    workspace.requestFullscreen = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: workspace });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Tela cheia' }));
      expect(workspace.requestFullscreen).toHaveBeenCalled();
      expect(useUIStore.getState().voiceFullscreen).toBe(true);
      unmount();
      expect(useUIStore.getState().voiceFullscreen).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(document, 'fullscreenElement', descriptor);
      else Reflect.deleteProperty(document, 'fullscreenElement');
    }
  });

  it('opens the stream from the sidebar participant and keeps server screen-share controls', () => {
    const { container } = open();
    act(() => useChatStore.setState({ currentChannelId: 'text' }));
    fireEvent.doubleClick(screen.getByRole('button', { name: /other/ }));
    expect(useChatStore.getState().currentChannelId).toBe('voice');
    expect(useVoiceStore.getState().focusedParticipantId).toBe('other:device:stream');
    expect(container.querySelector('.lume-server-call-workspace')).not.toBeNull();
    expect(audioPublication.setSubscribed).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTitle('Compartilhar tela'));
    expect(handleScreenShareAction).toHaveBeenCalled();
  });
});
