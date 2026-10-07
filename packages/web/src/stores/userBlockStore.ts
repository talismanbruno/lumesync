import { create } from 'zustand';
import type { User } from '@backspace/shared';
import { getApiForOrigin } from '../utils/crossStoreResolvers';
import { canonicalUserMatch } from '../utils/identity';

interface BlockState {
  accounts: Record<string, Record<string, User[]>>;
  load: (account: string, origin: string) => Promise<void>;
  setBlocked: (account: string, origin: string, user: User, blocked: boolean) => Promise<void>;
}
export const useUserBlockStore = create<BlockState>((set, get) => ({
  accounts: {},
  load: async (account, origin) => {
    if (!account) return;
    const users = await getApiForOrigin(origin).social.blocks();
    set(state => ({ accounts: { ...state.accounts, [account]: { ...state.accounts[account], [origin]: users } } }));
  },
  setBlocked: async (account, origin, user, blocked) => {
    const client = getApiForOrigin(origin);
    if (blocked) {
      await client.social.block(user.id);
      set(state => ({ accounts: { ...state.accounts, [account]: { ...state.accounts[account], [origin]: [...(state.accounts[account]?.[origin] || []).filter(target => !canonicalUserMatch(target, user)), user] } } }));
    } else {
      const records = Object.entries(get().accounts[account] || {}).flatMap(([source, users]) => users.filter(target => canonicalUserMatch(target, user)).map(target => ({ source, target })));
      if (!records.length) records.push({ source: origin, target: user });
      await Promise.all(records.map(async ({ source, target }) => {
        await getApiForOrigin(source).social.unblock(target.id);
        set(state => ({ accounts: { ...state.accounts, [account]: { ...state.accounts[account], [source]: (state.accounts[account]?.[source] || []).filter(value => !canonicalUserMatch(value, user)) } } }));
      }));
    }
  },
}));
export function contactIsBlocked(account: string, user: User | null | undefined): boolean {
  return !!user && Object.values(useUserBlockStore.getState().accounts[account] || {}).some(users => users.some(target => canonicalUserMatch(target, user)));
}
