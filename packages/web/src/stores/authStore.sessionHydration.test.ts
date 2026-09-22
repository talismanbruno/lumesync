import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue({ success: true }),
  me: vi.fn(),
  reloadDmsForOrigin: vi.fn().mockResolvedValue(undefined),
  resetSpace: vi.fn(),
  autoConnectAll: vi.fn().mockResolvedValue(undefined),
  resetInstance: vi.fn(),
  resetChat: vi.fn(),
  resetSocial: vi.fn(),
  resetVoice: vi.fn(),
  resetActivity: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: {
    auth: { login: mocks.login, logout: mocks.logout, register: vi.fn() },
    users: { me: mocks.me },
  },
}));

vi.mock('./chatStore', () => ({
  useChatStore: { getState: () => ({ clearAllMessages: mocks.resetChat }) },
}));

vi.mock('./spaceStore', () => ({
  useSpaceStore: {
    getState: () => ({
      reset: mocks.resetSpace,
      reloadDmsForOrigin: mocks.reloadDmsForOrigin,
    }),
  },
}));

vi.mock('./socialStore', () => ({
  useSocialStore: { getState: () => ({ reset: mocks.resetSocial }) },
}));

vi.mock('./voiceStore', () => ({
  useVoiceStore: { getState: () => ({ resetSession: mocks.resetVoice }) },
}));

vi.mock('./instanceStore', () => ({
  useInstanceStore: {
    getState: () => ({
      reset: mocks.resetInstance,
      autoConnectAll: mocks.autoConnectAll,
    }),
  },
}));

vi.mock('./activityStore', () => ({
  useActivityStore: { getState: () => ({ reset: mocks.resetActivity }) },
}));

vi.mock('../utils/identity', () => ({ clearSelfIds: vi.fn() }));
vi.mock('../utils/federationOps', () => ({
  changePasswordOnRemotes: vi.fn(),
  deleteAccountOnRemotes: vi.fn(),
}));

import { useAuthStore } from './authStore';

const user = { id: 'user-1', username: 'talisman' } as never;

describe('auth session conversation hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, isLoading: false, error: null });
  });

  it('restores home conversations immediately after login', async () => {
    mocks.login.mockResolvedValue({ token: 'fresh-token', user });

    await useAuthStore.getState().login('talisman', 'secret');

    expect(mocks.reloadDmsForOrigin).toHaveBeenCalledOnce();
    const [origin, shouldApply] = mocks.reloadDmsForOrigin.mock.calls[0];
    expect(origin).toBe('');
    expect(shouldApply()).toBe(true);
  });

  it('rejects a late conversation response after logout', async () => {
    mocks.login.mockResolvedValue({ token: 'old-token', user });
    await useAuthStore.getState().login('talisman', 'secret');
    const shouldApply = mocks.reloadDmsForOrigin.mock.calls[0][1] as () => boolean;

    useAuthStore.getState().logout();

    expect(shouldApply()).toBe(false);
    expect(mocks.logout).toHaveBeenCalledOnce();
  });

  it('restores conversations when an existing saved session boots', async () => {
    localStorage.setItem('backspace_token', 'saved-token');
    useAuthStore.setState({ token: 'saved-token', user: null });
    mocks.me.mockResolvedValue(user);

    await useAuthStore.getState().loadUser();

    expect(mocks.reloadDmsForOrigin).toHaveBeenCalledOnce();
    expect(mocks.reloadDmsForOrigin.mock.calls[0][0]).toBe('');
  });
});
