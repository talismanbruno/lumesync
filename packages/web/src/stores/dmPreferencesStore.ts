import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DmChannel } from '@backspace/shared';

export interface DmPreferences { pinned: string[]; muted: string[] }
export const EMPTY_DM_PREFERENCES: DmPreferences = { pinned: [], muted: [] };
export function dmPreferenceKey(dm: DmChannel & { _instanceOrigin?: string }) {
  return dm.federatedId || `${dm._instanceOrigin || ''}:${dm.id}`;
}
export function pinnedConversations<T extends DmChannel>(dms: T[], pinned: string[]): T[] {
  const keys = new Set(pinned);
  return [...dms.filter(dm => keys.has(dmPreferenceKey(dm))), ...dms.filter(dm => !keys.has(dmPreferenceKey(dm)))];
}

interface State {
  accounts: Record<string, DmPreferences>;
  toggle: (account: string, kind: keyof DmPreferences, key: string) => void;
}
export const useDmPreferencesStore = create<State>()(persist((set) => ({
  accounts: {},
  toggle: (account, kind, key) => {
    if (!account) return;
    set(state => {
      const previous = state.accounts[account] || EMPTY_DM_PREFERENCES;
      const values = previous[kind];
      return { accounts: { ...state.accounts, [account]: { ...previous, [kind]: values.includes(key) ? values.filter(value => value !== key) : [...values, key] } } };
    });
  },
}), { name: 'lume:dm-preferences', partialize: state => ({ accounts: state.accounts }) }));
