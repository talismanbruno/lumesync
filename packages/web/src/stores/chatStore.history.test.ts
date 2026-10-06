import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { MessageWithUser } from '@backspace/shared';
import { useChatStore } from './chatStore';

const mocks = vi.hoisted(() => ({
  messages: vi.fn(), wsSend: vi.fn(),
  spaceState: { channelOriginMap: new Map([['a', ''], ['b', '']]) },
}));
vi.mock('../hooks/useWebSocket', () => ({ wsSend: mocks.wsSend }));
vi.mock('./spaceStore', () => ({
  isDmChannel: () => false,
  getChannelOrigin: () => '',
  getApiForOrigin: () => ({ channels: { messages: mocks.messages } }),
  useSpaceStore: { getState: () => mocks.spaceState },
}));
vi.mock('./authStore', () => ({ useAuthStore: { getState: () => ({ user: null }) } }));
vi.mock('./pendingMessageStore', () => ({ usePendingMessageStore: { getState: () => ({ matchAndRemove: vi.fn() }) } }));

const message = (index: number, channelId = 'a'): MessageWithUser => ({
  id: String(index).padStart(8, '0'), channelId, userId: 'user', content: String(index), createdAt: index,
  user: { id: 'user', username: 'user' } as any, attachments: [], embeds: [], reactions: [],
});
const archive = (count: number, channelId = 'a') => Array.from({ length: count }, (_, index) => message(index + 1, channelId));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useChatStore.getState().clearAllMessages();
});
afterEach(() => vi.useRealTimers());

describe('complete community history', () => {
  it('loads every page of every channel and retains more than 200 messages when new ones arrive', async () => {
    const archives = new Map([['a', archive(260)], ['b', archive(81, 'b')]]);
    mocks.messages.mockImplementation(async (id: string, before?: string, limit = 50) => {
      const candidates = archives.get(id)!.filter(item => !before || item.id < before);
      return candidates.slice(-limit);
    });
    useChatStore.setState({ currentChannelId: 'a', isLoading: true, loadError: 'foreground error' });
    const preload = useChatStore.getState().preloadSpaceHistory(['a', 'b'], new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await preload).toBe(true);
    expect(useChatStore.getState().messages.get('a')).toHaveLength(260);
    expect(useChatStore.getState().messages.get('b')).toHaveLength(81);
    expect(useChatStore.getState().hasMore.get('a')).toBe(false);
    expect(mocks.messages.mock.calls.slice(0, 2).map(call => call[0])).toEqual(['a', 'b']);
    expect(useChatStore.getState().isLoading).toBe(true);
    expect(useChatStore.getState().loadError).toBe('foreground error');
    expect(mocks.wsSend).not.toHaveBeenCalled();
    useChatStore.getState().addRealtimeMessage('a', message(261));
    useChatStore.getState().addMessage('a', message(262));
    expect(useChatStore.getState().messages.get('a')).toHaveLength(262);
    expect(useChatStore.getState().messages.get('a')?.[0].id).toBe(message(1).id);
  });

  it('does not reload a completed archive on another visit', async () => {
    mocks.messages.mockResolvedValue([message(1)]);
    await useChatStore.getState().preloadSpaceHistory(['a'], new AbortController().signal);
    await useChatStore.getState().preloadSpaceHistory(['a'], new AbortController().signal);
    expect(mocks.messages).toHaveBeenCalledOnce();
  });

  it('reports a partial failure and continues loading the other channels', async () => {
    mocks.messages.mockImplementation(async (id: string) => {
      if (id === 'a') throw new Error('network');
      return [message(1, 'b')];
    });
    const preload = useChatStore.getState().preloadSpaceHistory(['a', 'b'], new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await preload).toBe(false);
    expect(useChatStore.getState().messages.get('b')).toHaveLength(1);
  });

  it('stops requesting channels after cancellation', async () => {
    const controller = new AbortController();
    mocks.messages.mockImplementation(async () => { controller.abort(); return archive(50); });
    expect(await useChatStore.getState().preloadSpaceHistory(['a', 'b'], controller.signal)).toBe(false);
    expect(mocks.messages).toHaveBeenCalledOnce();
  });

  it('does not restore message data after logout or cache reset', async () => {
    let finish!: (messages: MessageWithUser[]) => void;
    mocks.messages.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = useChatStore.getState().preloadSpaceHistory(['a'], new AbortController().signal);
    await vi.waitFor(() => expect(mocks.messages).toHaveBeenCalledOnce());
    useChatStore.getState().clearAllMessages();
    finish(archive(50));
    expect(await pending).toBe(false);
    expect(useChatStore.getState().messages.size).toBe(0);
    expect(useChatStore.getState().hasMore.size).toBe(0);
  });

  it('keeps all channels of the active community when switching between them', () => {
    const ids = Array.from({ length: 25 }, (_, index) => String(index));
    useChatStore.setState({
      historyChannels: new Set(ids),
      messages: new Map(ids.map(id => [id, [message(1, id)]])),
      channelAccessTimes: new Map(ids.map((id, index) => [id, index])),
    });
    useChatStore.getState().setCurrentChannel('24');
    expect(useChatStore.getState().messages.size).toBe(25);
  });
});
