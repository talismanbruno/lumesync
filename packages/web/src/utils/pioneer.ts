import type { User } from '@backspace/shared';

/**
 * Every native account belongs to Lume's current pioneer phase. Checking the
 * origin as well keeps older sessions eligible even when they cached the old
 * `isPioneer: false` default before this field existed on the server.
 */
export function isPioneer(user: Pick<User, 'isPioneer' | 'homeInstance'> | null | undefined): boolean {
  return user?.isPioneer === true || user?.homeInstance === null;
}
