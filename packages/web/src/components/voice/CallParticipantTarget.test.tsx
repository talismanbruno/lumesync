import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@backspace/shared';
import type { ParticipantInfo } from '../../hooks/useLiveKit';
const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), sound: vi.fn(), publish: vi.fn() }));
vi.mock('../../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('../../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ playSound: mocks.sound }) } }));
vi.mock('../../hooks/useLiveKit', async actual => ({
  ...await actual<typeof import('../../hooks/useLiveKit')>(),
  getActiveRoom: () => ({ localParticipant: { publishData: mocks.publish } }),
  setStreamSubscription: mocks.subscribe,
}));
import { CallParticipantTarget } from './CallParticipantTarget';
import { VoiceGrid } from './VoiceGrid';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useChatStore } from '../../stores/chatStore';
import { DmRosterPanel } from '../layout/DmRosterPanel';
import { parseStreamWatch } from '../../utils/streamWatchProtocol';

const user = { id: 'peer', username: 'peer', displayName: 'Pessoa' } as User;
const participant: ParticipantInfo = {
  identity: 'peer:device', userId: 'peer', username: 'peer', homeUserId: null,
  isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: true, isLocal: false,
  audioTrack: null, videoTrack: null, screenTrack: null, screenAudioTrack: null,
  lkVideoTrack: null, lkScreenTrack: null, cachedUser: user, screenOwnerIdentity: 'dedicated-screen',
};
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); mocks.publish.mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useUIStore.setState({ isMobile: false, activeModal: null, userProfilePopout: { user: null, position: null }, mobileStack: [] });
  useSpaceStore.setState({ userViews: new Map(), members: [] });
  useVoiceStore.setState({ currentVoiceChannelId: 'room', activeDmCall: null, isLiveKitConnected: true,
    participants: [participant], focusedParticipantId: null, watchingStreams: new Set(), streamMutes: new Map(), streamVolumes: new Map() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function target(onOpenCall = vi.fn()) {
  const view = render(<CallParticipantTarget userId="peer" roomId="room" user={user} onOpenCall={onOpenCall}><span>Pessoa</span></CallParticipantTarget>);
  return { ...view, row: screen.getByRole('button', { name: 'Pessoa' }), onOpenCall };
}
function doubleClick(row: HTMLElement) {
  fireEvent.click(row, { detail: 1 }); fireEvent.click(row, { detail: 2 }); fireEvent.doubleClick(row);
}
describe('voice-list single and double click', () => {
  it('keeps a single click for the profile without subscribing to the screen', () => {
    const { row } = target();
    fireEvent.click(row, { detail: 1 });
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(useUIStore.getState().userProfilePopout.user?.id).toBe('peer');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('starts watching and focuses the stream on double click without opening a profile', () => {
    const { row, onOpenCall } = target();
    doubleClick(row); act(() => vi.advanceTimersByTime(1000));
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    expect(useVoiceStore.getState().watchingStreams.has('peer')).toBe(true);
    expect(useVoiceStore.getState().focusedParticipantId).toBe('peer:device:stream');
    expect(mocks.subscribe).toHaveBeenCalledWith(expect.anything(), 'dedicated-screen', true);
    expect(onOpenCall).toHaveBeenCalledTimes(1);
    expect(parseStreamWatch(mocks.publish.mock.calls[0][0])).toMatchObject({ target: 'peer', watching: true });
  });
  it('does not repeat the watch cue when opening an already watched stream', () => {
    useVoiceStore.setState({ watchingStreams: new Set(['peer']), streamVolumes: new Map([['peer', 65]]), streamMutes: new Map([['peer', true]]) });
    const { row } = target(); doubleClick(row);
    expect(mocks.sound).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().streamVolumes.get('peer')).toBe(65);
    expect(useVoiceStore.getState().streamMutes.get('peer')).toBe(true);
  });
  it('opens the profile immediately when the person is not streaming', () => {
    useVoiceStore.setState({ participants: [{ ...participant, isScreenSharing: false }] });
    const { row } = target(); fireEvent.click(row, { detail: 1 });
    expect(useUIStore.getState().userProfilePopout.user?.id).toBe('peer');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it.each(['stopped', 'left', 'other-room'])('does not open a stale stream if the person %s before the second click', reason => {
    const { row } = target(); fireEvent.click(row, { detail: 1 });
    act(() => useVoiceStore.setState(reason === 'stopped' ? { participants: [{ ...participant, isScreenSharing: false }] } : reason === 'left' ? { participants: [] } : { currentVoiceChannelId: 'another-room' }));
    fireEvent.doubleClick(row); act(() => vi.advanceTimersByTime(1000));
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().focusedParticipantId).toBeNull();
  });
  it.each(['contextMenu', 'dragStart'])('cancels the pending profile on %s', action => {
    const { row } = target(); fireEvent.click(row, { detail: 1 });
    if (action === 'contextMenu') fireEvent.contextMenu(row); else fireEvent.dragStart(row);
    act(() => vi.advanceTimersByTime(1000));
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
  });
  it('cancels the pending profile on unmount', () => {
    const { row, unmount } = target(); fireEvent.click(row, { detail: 1 }); unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
  });
  it('supports the profile with Enter and the stream with Alt+Enter', () => {
    const { row } = target(); fireEvent.keyDown(row, { key: 'Enter' });
    expect(useUIStore.getState().userProfilePopout.user?.id).toBe('peer');
    fireEvent.keyDown(row, { key: 'Enter', altKey: true });
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
    expect(useVoiceStore.getState().focusedParticipantId).toBe('peer:device:stream');
  });
  it('opens the active DM stream without switching to a voice channel', () => {
    useVoiceStore.setState({ currentVoiceChannelId: null, activeDmCall: { dmChannelId: 'room' } as any });
    const { row } = target(); doubleClick(row);
    expect(useVoiceStore.getState().currentVoiceChannelId).toBeNull();
    expect(useVoiceStore.getState().focusedParticipantId).toBe('peer:device:stream');
  });
  it('preserves focus while the subscription is loading, then clears it when sharing stops', () => {
    useVoiceStore.setState({ watchingStreams: new Set(['peer']), focusedParticipantId: 'peer:device:stream' });
    const view = render(<VoiceGrid participants={[participant]} />);
    expect(useVoiceStore.getState().focusedParticipantId).toBe('peer:device:stream');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando transmissão');
    view.rerender(<VoiceGrid participants={[{ ...participant, isScreenSharing: false }]} />);
    expect(useVoiceStore.getState().focusedParticipantId).toBeNull();
  });
  it('clears focus if the viewer stops watching a pending subscription', () => {
    useVoiceStore.setState({ watchingStreams: new Set(['peer']), focusedParticipantId: 'peer:device:stream' });
    render(<VoiceGrid participants={[participant]} />);
    act(() => useVoiceStore.getState().unwatchStream('peer'));
    expect(useVoiceStore.getState().focusedParticipantId).toBeNull();
  });
  it('preserves nested participant menu controls instead of treating them as watch clicks', () => {
    const menu = vi.fn();
    render(<CallParticipantTarget userId="peer" roomId="room" user={user}><span>Pessoa</span><button onClick={menu}>Ações</button></CallParticipantTarget>);
    const button = screen.getByRole('button', { name: 'Ações' });
    fireEvent.click(screen.getByText('Pessoa'), { detail: 1 });
    fireEvent.click(button, { detail: 1 }); fireEvent.doubleClick(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(menu).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
  });
  it('wires the same double click through the active group DM participant roster', () => {
    useUIStore.setState({ memberListOpen: true, showDms: true });
    useChatStore.setState({ currentChannelId: 'room' });
    useSpaceStore.setState({ currentSpaceId: null, dmChannels: [{ id: 'room', ownerId: 'peer', members: [user] }] as any });
    useVoiceStore.setState({ currentVoiceChannelId: null, activeDmCall: { dmChannelId: 'room' } as any });
    const { container } = render(<DmRosterPanel />);
    const row = container.querySelector('[role="button"]')!;
    doubleClick(row as HTMLElement);
    expect(useVoiceStore.getState().focusedParticipantId).toBe('peer:device:stream');
    expect(useUIStore.getState().userProfilePopout.user).toBeNull();
  });
});
