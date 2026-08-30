import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantInfo } from '../hooks/useLiveKit';
vi.mock('../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ setInputVolume: vi.fn(), setOutputDevice: vi.fn() }) },
}));
import { useVoiceStore } from './voiceStore';
import { useAuthStore } from './authStore';

const participant = (userId: string, isLocal = false) =>
  ({ userId, identity: userId + ':name', isLocal } as ParticipantInfo);

beforeEach(() => {
  useVoiceStore.getState().reset();
  useAuthStore.setState({ user: null });
});

describe('server voice departure', () => {
  it('removes a departed user immediately and ignores late SDK updates until rejoin', () => {
    const voice = useVoiceStore.getState();
    voice.setCurrentVoiceChannel('server-call');
    voice.setVoiceUsers('server-call', ['me', 'other']);
    voice.setParticipants([participant('me', true), participant('other')]);
    voice.removeVoiceUser('server-call', 'other');
    expect(useVoiceStore.getState().participants.map(p => p.userId)).toEqual(['me']);
    voice.setParticipants([participant('me', true), participant('other')]);
    expect(useVoiceStore.getState().participants.map(p => p.userId)).toEqual(['me']);
    voice.addVoiceUser('server-call', 'other');
    voice.setParticipants([participant('me', true), participant('other')]);
    expect(useVoiceStore.getState().participants).toHaveLength(2);
  });

  it('accepts a confirmed rejoin in a server snapshot', () => {
    const voice = useVoiceStore.getState();
    voice.setCurrentVoiceChannel('server-call');
    voice.removeVoiceUser('server-call', 'other');
    voice.setVoiceUsers('server-call', ['other']);
    voice.setParticipants([participant('other')]);
    expect(useVoiceStore.getState().participants).toHaveLength(1);
  });

  it('does not remove participants when the leave belongs to another channel', () => {
    const voice = useVoiceStore.getState();
    voice.setCurrentVoiceChannel('new-call');
    voice.setParticipants([participant('other')]);
    voice.removeVoiceUser('old-call', 'other');
    expect(useVoiceStore.getState().participants).toHaveLength(1);
  });

  it('does not change DM participant semantics', () => {
    const voice = useVoiceStore.getState();
    voice.setActiveDmCall({ dmChannelId: 'dm' });
    voice.setParticipants([participant('other')]);
    voice.removeVoiceUser('server-call', 'other');
    expect(useVoiceStore.getState().participants).toHaveLength(1);
  });

  it('removes self locally using the actual media identity even without an auth cache', () => {
    const voice = useVoiceStore.getState();
    voice.setCurrentVoiceChannel('server-call');
    voice.setVoiceUsers('server-call', ['me', 'other']);
    voice.setParticipants([participant('me', true), participant('other')]);
    voice.leaveVoice();
    const state = useVoiceStore.getState();
    expect(state.currentVoiceChannelId).toBeNull();
    expect(state.participants).toEqual([]);
    expect(state.voiceUsers.get('server-call')).toEqual(['other']);
    expect(state.departedVoiceUserIds.size).toBe(0);
  });

  it('clears departure guards on channel change', () => {
    const voice = useVoiceStore.getState();
    voice.setCurrentVoiceChannel('old-call');
    voice.removeVoiceUser('old-call', 'other');
    voice.setCurrentVoiceChannel('new-call');
    voice.setParticipants([participant('other')]);
    expect(useVoiceStore.getState().participants).toHaveLength(1);
  });
});
