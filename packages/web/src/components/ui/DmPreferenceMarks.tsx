import type { DmChannel } from '@backspace/shared';
import { useAuthStore } from '../../stores/authStore';
import { useDmPreferencesStore, EMPTY_DM_PREFERENCES, dmPreferenceKey } from '../../stores/dmPreferencesStore';
import { Tooltip } from './Tooltip';

export function DmPreferenceMarks({ dm }: { dm: DmChannel }) {
  const user = useAuthStore(s => s.user);
  const account = user ? `${window.location.host}:${user.id}` : '';
  const prefs = useDmPreferencesStore(s => s.accounts[account] || EMPTY_DM_PREFERENCES);
  const key = dmPreferenceKey(dm);
  return <>
    {prefs.pinned.includes(key) && <Tooltip content="Conversa fixada"><span className="inline-flex shrink-0 text-accent-primary" role="img" aria-label="Conversa fixada"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3h8l-1 6 4 4v2H5v-2l4-4-1-6ZM12 15v6" /></svg></span></Tooltip>}
    {prefs.muted.includes(key) && <Tooltip content="Notificações silenciadas"><span className="inline-flex shrink-0 text-txt-tertiary" role="img" aria-label="Notificações silenciadas"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 4l16 16M9 5a4 4 0 0 1 7 3v4l3 5H8M5 9v3l-2 5h2M10 21h4" /></svg></span></Tooltip>}
  </>;
}
