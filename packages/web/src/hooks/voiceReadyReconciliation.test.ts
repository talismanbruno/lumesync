import { describe, expect, it, vi } from 'vitest';

vi.mock('../audio/AudioManager', () => ({
  AudioManager: { getInstance: () => ({}) },
}));
vi.mock('./useLiveKit', () => ({
  getActiveRoom: () => null,
}));

import { decideVoiceReadyReconciliation } from './useWebSocket';

describe('voice ready reconciliation', () => {
  it('keeps a voice session already known by the signalling server', () => {
    expect(decideVoiceReadyReconciliation(true, 'connected')).toBe('none');
  });

  it.each(['connected', 'reconnecting', 'connecting'])(
    're-registers a still-live LiveKit session when signalling returns (%s)',
    (state) => {
      expect(decideVoiceReadyReconciliation(false, state)).toBe('reregister');
    },
  );

  it('disconnects stale UI intent when no LiveKit session survived', () => {
    expect(decideVoiceReadyReconciliation(false, 'disconnected')).toBe('disconnect');
    expect(decideVoiceReadyReconciliation(false, undefined)).toBe('disconnect');
  });
});
