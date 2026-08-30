import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ParticipantInfo } from '../../hooks/useLiveKit';
vi.mock('../../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({ setInputVolume: vi.fn(), setOutputDevice: vi.fn() }) },
}));
vi.mock('../../hooks/useAudioTrackPlayer', () => ({
  useAudioTrackPlayer: vi.fn(() => ({ current: null })),
}));
import { useAudioTrackPlayer } from '../../hooks/useAudioTrackPlayer';
import { useVoiceStore } from '../../stores/voiceStore';
import { GlobalAudioRenderer } from './GlobalAudioRenderer';

const mic = {} as MediaStreamTrack;
const screen = {} as MediaStreamTrack;
const remote = {
  userId: 'other', identity: 'other:name', isLocal: false, audioTrack: mic, screenAudioTrack: screen,
} as ParticipantInfo;
const screenPlayback = () => vi.mocked(useAudioTrackPlayer).mock.calls.find(([o]) => o.track === screen)![0];

beforeEach(() => {
  vi.clearAllMocks();
  useVoiceStore.getState().reset();
  useVoiceStore.setState({
    participants: [remote], watchingStreams: new Set(['other']),
    streamAttenuationEnabled: false, streamAttenuationStrength: 50,
  });
});

describe('screen audio volume', () => {
  it('boosts screen audio independently from microphones', () => {
    render(<GlobalAudioRenderer />);
    expect(screenPlayback().volume).toBe(2);
    expect(vi.mocked(useAudioTrackPlayer).mock.calls.find(([o]) => o.track === mic)![0].volume).toBe(1);
  });
  it('keeps explicit zero volume and deafen effective', () => {
    useVoiceStore.getState().setStreamVolume('other', 0);
    useVoiceStore.setState({ isDeafened: true });
    render(<GlobalAudioRenderer />);
    expect(screenPlayback()).toMatchObject({ volume: 0, muted: true });
  });
  it('supports boosted slider values and clamps out-of-range values', () => {
    useVoiceStore.getState().setStreamVolume('other', 500);
    expect(useVoiceStore.getState().streamVolumes.get('other')).toBe(200);
    render(<GlobalAudioRenderer />);
    expect(screenPlayback().volume).toBe(4);
  });
  it('preserves optional attenuation', () => {
    useVoiceStore.setState({ streamAttenuationEnabled: true, speakingParticipantIds: new Set(['other:name']) });
    render(<GlobalAudioRenderer />);
    expect(screenPlayback().volume).toBe(1);
  });
  it('does not silence screen audio because of a stale speaking flag on a muted mic', () => {
    useVoiceStore.setState({
      participants: [remote, { userId: 'me', identity: 'me:name', isLocal: true, isMuted: true } as ParticipantInfo],
      speakingParticipantIds: new Set(['me:name']),
    });
    render(<GlobalAudioRenderer />);
    expect(screenPlayback().muted).toBe(false);
  });
  it('keeps echo protection while the local microphone is actually speaking', () => {
    useVoiceStore.setState({
      participants: [remote, { userId: 'me', identity: 'me:name', isLocal: true, isMuted: false } as ParticipantInfo],
      speakingParticipantIds: new Set(['me:name']),
    });
    render(<GlobalAudioRenderer />);
    expect(screenPlayback().muted).toBe(true);
  });
});
