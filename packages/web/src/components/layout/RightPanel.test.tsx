import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RightPanel } from './RightPanel';

const state = vi.hoisted(() => ({
  ui: { showDms: true, memberListOpen: true },
  space: { currentSpaceId: null as string | null, dmChannels: [] as { id: string; ownerId: string | null; members: object[] }[] },
  chat: { currentChannelId: null as string | null },
}));
vi.mock('../../stores/uiStore', () => ({ useUIStore: (select: (s: typeof state.ui) => unknown) => select(state.ui) }));
vi.mock('../../stores/spaceStore', () => ({ useSpaceStore: (select: (s: typeof state.space) => unknown) => select(state.space) }));
vi.mock('../../stores/chatStore', () => ({ useChatStore: (select: (s: typeof state.chat) => unknown) => select(state.chat) }));
vi.mock('./ActivityPanel', () => ({ ActivityPanel: () => <aside>Presença Amigos</aside> }));
vi.mock('./DmRosterPanel', () => ({ DmRosterPanel: () => <aside>Participantes do grupo</aside> }));
vi.mock('./MemberSidebar', () => ({ MemberSidebar: () => <aside>Membros do servidor</aside> }));

beforeEach(() => {
  cleanup();
  state.ui = { showDms: true, memberListOpen: true };
  state.space = { currentSpaceId: null, dmChannels: [] };
  state.chat = { currentChannelId: null };
});
const view = (path = '/channels/@me') => render(<MemoryRouter initialEntries={[path]}><RightPanel /></MemoryRouter>);

describe('right column follows the current conversation', () => {
  it('shows friend presence on Friends', () => {
    view();
    expect(screen.getByText('Presença Amigos')).toBeTruthy();
  });
  it('removes friend presence as soon as a private conversation opens', () => {
    const { rerender } = view();
    state.chat.currentChannelId = 'dm';
    state.space.dmChannels = [{ id: 'dm', ownerId: null, members: [{}, {}] }];
    rerender(<MemoryRouter><RightPanel /></MemoryRouter>);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
  it('only shows group participants for a group of three or more', () => {
    state.chat.currentChannelId = 'group';
    state.space.dmChannels = [{ id: 'group', ownerId: 'owner', members: [{}, {}, {}] }];
    const { rerender } = view();
    expect(screen.getByText('Participantes do grupo')).toBeTruthy();
    expect(screen.queryByText('Presença Amigos')).toBeNull();
    state.space.dmChannels[0]!.members.pop();
    rerender(<MemoryRouter><RightPanel /></MemoryRouter>);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
  it('does not fall back to friends when the group roster is hidden', () => {
    state.chat.currentChannelId = 'group';
    state.space.dmChannels = [{ id: 'group', ownerId: 'owner', members: [{}, {}, {}] }];
    state.ui.memberListOpen = false;
    view();
    expect(screen.queryByRole('complementary')).toBeNull();
  });
  it('keeps server members instead of friend presence in a server', () => {
    state.ui.showDms = false;
    state.space.currentSpaceId = 'space';
    state.chat.currentChannelId = 'channel';
    view('/channels/space/channel');
    expect(screen.getByText('Membros do servidor')).toBeTruthy();
    expect(screen.queryByText('Presença Amigos')).toBeNull();
  });
  it('does not show friend presence in Explore', () => {
    view('/explore');
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
