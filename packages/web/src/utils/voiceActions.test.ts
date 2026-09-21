import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  room: { localParticipant: {} },
  screenSharing: false,
  start: vi.fn(),
  stop: vi.fn(),
  toast: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('../hooks/useLiveKit', () => ({ getActiveRoom: () => fixtures.room }));
vi.mock('../stores/voiceStore', () => ({
  useVoiceStore: { getState: () => ({ isScreenSharing: fixtures.screenSharing }) },
}));
vi.mock('../stores/uiStore', () => ({
  useUIStore: { getState: () => ({ addToast: fixtures.toast }) },
}));
vi.mock('../hooks/useWebSocket', () => ({ wsSend: vi.fn() }));
vi.mock('./voice', () => ({
  broadcastVoiceStatus: fixtures.broadcast,
  broadcastDeafenViaLiveKit: vi.fn(),
}));
vi.mock('./screenShare', () => ({
  CAMERA_PRESET: {},
  startScreenShare: fixtures.start,
  stopScreenShare: fixtures.stop,
}));
vi.mock('../platform/platform', () => ({ isElectron: () => false }));

import { handleScreenShareAction } from './voiceActions';

beforeEach(() => {
  fixtures.screenSharing = false;
  fixtures.start.mockReset();
  fixtures.stop.mockReset();
  fixtures.toast.mockReset();
  fixtures.broadcast.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia: vi.fn() },
  });
});

describe('handleScreenShareAction', () => {
  it('explains unsupported browser capture without starting a stream', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await handleScreenShareAction();
    expect(fixtures.start).not.toHaveBeenCalled();
    expect(fixtures.toast).toHaveBeenCalledWith(
      expect.stringContaining('Este navegador não permite compartilhar'),
      'warning',
      7000,
    );
  });

  it('ignores repeated taps while a screen picker is pending', async () => {
    let finish!: (value: boolean) => void;
    fixtures.start.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
    const first = handleScreenShareAction();
    await handleScreenShareAction();
    expect(fixtures.start).toHaveBeenCalledTimes(1);
    finish(true);
    await first;
    expect(fixtures.broadcast).toHaveBeenCalledTimes(1);
  });
});
