import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';

vi.mock('../../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ setInputVolume: vi.fn(), setOutputDevice: vi.fn() }) } }));
vi.mock('../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../utils/voice', () => ({ joinVoiceChannel: vi.fn(), requestMicPermission: vi.fn() }));
vi.mock('../../utils/voiceActions', () => ({ handleMuteAction: vi.fn(), handleDeafenAction: vi.fn(), handleCameraAction: vi.fn(), handleScreenShareAction: vi.fn(), handleDisconnectAction: vi.fn() }));
vi.mock('../../utils/userViewLookup', () => ({ useCanonicalUserView: (user: unknown) => user }));
vi.mock('../voice/VoiceGrid', () => ({ VoiceGrid: () => <div data-testid="voice-grid">Vídeo da chamada</div> }));
vi.mock('../voice/VoiceChatPanel', () => ({ VoiceChatPanel: () => null }));
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
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';

beforeEach(() => {
  const self = { id: 'self', username: 'self', replicatedInstances: [] } as any;
  const other = { id: 'other', username: 'other', replicatedInstances: [] } as any;
  useAuthStore.setState({ user: self });
  useUIStore.setState({ showDms: true, voiceFullscreen: false, voiceChatOpen: false });
  useChatStore.setState({ currentChannelId: 'call-dm' });
  useSpaceStore.setState({ currentSpaceId: null, channels: [], dmChannels: [
    { id: 'call-dm', members: [self, other] },
    { id: 'other-dm', members: [self, other] },
  ] as any });
  useVoiceStore.setState({ activeDmCall: { dmChannelId: 'call-dm' }, outgoingCall: null, currentVoiceChannelId: null, participants: [], isLiveKitConnected: true, connectionError: null });
});

const open = () => render(<MemoryRouter><MainContent /></MemoryRouter>);

describe('conversation during private calls', () => {
  it('shows messages by default and preserves the draft when collapsed', () => {
    open();
    expect(screen.getByText('Mensagens de call-dm')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), { target: { value: 'rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar conversa' }));
    expect(screen.getByTestId('voice-grid')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar conversa' }));
    expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('rascunho');
  });

  it('opens the conversation when jumping to a search result', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar conversa' }));
    fireEvent.click(screen.getByTitle('Search'));
    fireEvent.click(screen.getByText('Resultado da busca'));
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('keeps the call active when navigating to another conversation and back', () => {
    open();
    act(() => useChatStore.setState({ currentChannelId: 'other-dm' }));
    expect(screen.getByText('Mensagens de other-dm')).toBeVisible();
    expect(screen.queryByTestId('voice-grid')).toBeNull();
    expect(useVoiceStore.getState().activeDmCall?.dmChannelId).toBe('call-dm');
    act(() => useChatStore.setState({ currentChannelId: 'call-dm' }));
    expect(screen.getByTestId('voice-grid')).toBeVisible();
    act(() => useVoiceStore.setState({ activeDmCall: null }));
    expect(screen.queryByTestId('voice-grid')).toBeNull();
    expect(screen.getByText('Mensagens de call-dm')).toBeVisible();
  });
});
