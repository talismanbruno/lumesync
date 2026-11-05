import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const audio = vi.hoisted(() => ({
  resumeContext: vi.fn(() => new Promise<void>(() => {})),
  releaseInput: vi.fn(),
}));

vi.mock('../audio/AudioManager', () => ({ AudioManager: { getInstance: () => audio } }));

import { api } from '../api/client';
import { useLiveKit } from './useLiveKit';

it('requests a room token while audio is still resuming and releases capture on failure', async () => {
  const token = vi.spyOn(api.livekit, 'token').mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useLiveKit());

  try {
    await act(() => result.current.connect('voice-channel'));
    expect(audio.resumeContext).toHaveBeenCalledOnce();
    expect(token).toHaveBeenCalledWith('voice-channel');
    expect(audio.releaseInput).toHaveBeenCalledOnce();
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectionError).toBeTruthy();
  } finally {
    token.mockRestore();
  }
});
