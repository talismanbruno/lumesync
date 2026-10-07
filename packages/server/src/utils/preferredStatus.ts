import type { UserStatus } from '@backspace/shared';

export function getPreferredStatus(user: { preferredStatus: string | null; isAdmin: number | null }): UserStatus {
  const status = user.preferredStatus;
  if (status === 'working') return user.isAdmin === 1 ? 'working' : 'online';
  if (status === 'online' || status === 'idle' || status === 'dnd' || status === 'offline') return status;
  return 'online';
}
