import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MessageList } from './MessageList';
import { useChatStore } from '../../stores/chatStore';

const mocks = vi.hoisted(() => ({ loadAround: vi.fn(), toast: vi.fn(), scroll: vi.fn(), bubbles: new Map() }));
vi.mock('../../stores/chatStore', async () => {
  const { create } = await import('zustand');
  return { useChatStore: create<any>(() => ({
    messages: new Map(), hasMore: new Map(), scrollPositions: new Map(), isLoading: false,
    loadMessages: vi.fn(), loadMoreMessages: vi.fn(), loadMessagesAround: mocks.loadAround,
    ackChannel: vi.fn(), saveScrollPosition: vi.fn(),
  })) };
});
vi.mock('../../stores/spaceStore', () => ({
  useSpaceStore: (select: (s: any) => unknown) => select({ channelPermissions: new Map(), dmChannels: [] }),
  isDmChannel: (id: string) => id.startsWith('dm'),
}));
vi.mock('../../stores/authStore', () => ({ useAuthStore: (select: (s: any) => unknown) => select({ user: null }) }));
vi.mock('../../stores/socialStore', () => ({ useSocialStore: (select: (s: any) => unknown) => select({ friends: [] }) }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: Object.assign((select: (s: any) => unknown) => select({}), { getState: () => ({ addToast: mocks.toast }) }),
}));
vi.mock('../../stores/pendingMessageStore', () => ({
  usePendingMessageStore: (select: (s: any) => unknown) => select({ bubbles: mocks.bubbles }),
  isPendingMessage: () => false,
}));
vi.mock('../../utils/permissions', () => ({ hasPermissionBit: () => true, PermissionBits: {} }));
vi.mock('../../api/client', () => ({ api: {} }));
vi.mock('../ui/ProfileName', () => ({ ProfileName: () => null }));
vi.mock('../ui/Avatar', () => ({ Avatar: () => null }));
vi.mock('../ui/AvatarStack', () => ({ AvatarStack: () => null }));
vi.mock('./SystemMessage', () => ({ SystemMessage: () => null }));
vi.mock('./Message', () => ({
  Message: ({ message, onJumpToMessage }: any) => <div id={`msg-${message.id}`}>
    {message.content}
    {message.replyToId && <button onClick={() => onJumpToMessage(message.replyToId)}>Ir para a mensagem original</button>}
  </div>,
}));

const original = { id: 'original', userId: 'user', createdAt: 1, content: 'Mensagem original' } as any;
const reply = { id: 'reply', userId: 'user', createdAt: 2, content: 'Resposta', replyToId: 'original' } as any;
function seed(channel: string, messages: any[]) {
  useChatStore.setState({ messages: new Map([[channel, messages]]), hasMore: new Map([[channel, true]]), scrollPositions: new Map() });
}
function view(channel: string) { return <MemoryRouter><MessageList channelId={channel} /></MemoryRouter>; }
beforeEach(() => {
  mocks.loadAround.mockReset(); mocks.toast.mockReset(); mocks.scroll.mockReset();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Element.prototype.scrollIntoView = mocks.scroll;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('jumps and highlights a quoted message already loaded, including repeated clicks', async () => {
  seed('server', [original, reply]); render(view('server'));
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a mensagem original' }));
  expect(document.getElementById('msg-original')?.classList.contains('search-highlight')).toBe(true);
  expect(mocks.loadAround).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a mensagem original' }));
  expect(mocks.scroll.mock.calls.filter(([options]) => options?.block === 'center')).toHaveLength(2);
});

it.each(['server', 'dm-group'])('loads older quoted history before scrolling in %s', async channel => {
  seed(channel, [reply]);
  mocks.loadAround.mockImplementation(async () => { seed(channel, [original, reply]); });
  render(view(channel));
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a mensagem original' }));
  await waitFor(() => expect(document.getElementById('msg-original')?.classList.contains('search-highlight')).toBe(true));
  expect(mocks.loadAround).toHaveBeenCalledWith(channel, 'original', expect.any(AbortSignal));
  expect(mocks.toast).not.toHaveBeenCalled();
});

it('does not jump into another conversation when an old request finishes', async () => {
  let finish!: () => void;
  mocks.loadAround.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  seed('server', [reply]); const { rerender } = render(view('server'));
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a mensagem original' }));
  seed('dm-other', [original]); rerender(view('dm-other'));
  await act(async () => { finish(); });
  expect(document.getElementById('msg-original')?.classList.contains('search-highlight')).toBe(false);
  expect(mocks.toast).not.toHaveBeenCalled();
});

it('explains when the original message is unavailable', async () => {
  seed('dm-group', [reply]); mocks.loadAround.mockResolvedValue(undefined);
  render(view('dm-group'));
  fireEvent.click(screen.getByRole('button', { name: 'Ir para a mensagem original' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('A mensagem original não está disponível.', 'info'));
});

it('reloads the latest window when jumping to the present from an old reply', async () => {
  const channel = 'dm-group';
  seed(channel, [original]);
  const loadMessages = vi.fn().mockImplementation(async (_channel, force) => {
    if (force) {
      seed(channel, [reply]);
      useChatStore.setState({ aroundChannels: new Set() });
    }
  });
  useChatStore.setState({ aroundChannels: new Set([channel]), loadMessages });
  render(view(channel));
  fireEvent.click(screen.getByRole('button', { name: 'Jump to Present' }));
  await waitFor(() => expect(screen.getByText('Resposta')).toBeVisible());
  expect(loadMessages).toHaveBeenCalledWith(channel, true, true);
});
