import type { User } from '@backspace/shared';

/**
 * New server responses always carry `isPioneer`. The fallback only covers
 * sessions created before the field existed, while Lume's pioneer phase is
 * active for native accounts.
 */
export function isPioneer(user: Pick<User, 'isPioneer' | 'homeInstance'> | null | undefined): boolean {
  return user?.isPioneer === true || (user?.isPioneer === undefined && user?.homeInstance === null);
}
