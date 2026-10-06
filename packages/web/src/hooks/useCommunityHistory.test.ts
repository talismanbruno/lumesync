import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCommunityHistory } from './useCommunityHistory';
import { PermissionBits } from '../utils/permissions';

const mocks = vi.hoisted(() => ({
  preload: vi.fn().mockResolvedValue(true),
  setState: vi.fn(), toast: vi.fn(),
  state: {
    channels: [] as any[], channelPermissions: new Map<string, string>(),
    spacePermissions: new Map<string, string>(), channelOriginMap: new Map<string, string>(),
  },
}));
vi.mock('../stores/spaceStore', () => ({ useSpaceStore: (select: (state: any) => any) => select(mocks.state) }));
vi.mock('../stores/chatStore', () => ({ useChatStore: Object.assign(
  (select: (state: any) => any) => select({ preloadSpaceHistory: mocks.preload }),
  { getState: () => ({ currentChannelId: 'b' }), setState: mocks.setState },
) }));
vi.mock('../stores/uiStore', () => ({ useUIStore: { getState: () => ({ addToast: mocks.toast }) } }));

beforeEach(() => {
  vi.clearAllMocks();
  const readable = String(PermissionBits.VIEW_CHANNEL | PermissionBits.READ_MESSAGE_HISTORY);
  mocks.state.channels = [
    { id: 'a', spaceId: 'community' }, { id: 'b', spaceId: 'community', type: 'voice' },
    { id: 'locked', spaceId: 'community' }, { id: 'no-history', spaceId: 'community' },
    { id: 'elsewhere', spaceId: 'other' },
  ];
  mocks.state.channelPermissions = new Map([['a', readable], ['b', readable], ['locked', '0'], ['no-history', String(PermissionBits.VIEW_CHANNEL)]]);
  mocks.state.spacePermissions = new Map([['community', readable], ['other', readable]]);
  mocks.state.channelOriginMap = new Map(mocks.state.channels.map(channel => [channel.id, '']));
});

describe('community history routing', () => {
  it('preloads every readable channel, prioritizes the open one and cancels on exit', async () => {
    const { unmount } = renderHook(() => useCommunityHistory('community'));
    await waitFor(() => expect(mocks.preload).toHaveBeenCalledOnce());
    expect(mocks.preload.mock.calls[0][0]).toEqual(['b', 'a']);
    const signal = mocks.preload.mock.calls[0][1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('does not preload communities while viewing direct messages', () => {
    renderHook(() => useCommunityHistory('@me'));
    expect(mocks.preload).not.toHaveBeenCalled();
  });
});
