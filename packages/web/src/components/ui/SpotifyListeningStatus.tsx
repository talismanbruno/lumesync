import { useEffect, useState } from 'react';
import { getSpotifyListeningActivity } from '@backspace/shared';
import type { User } from '@backspace/shared';
import { useActivityStore } from '../../stores/activityStore';
import { BrandIcon } from './BrandIcon';

// Deliberately mounted only in profile/social surfaces, never shared name or call components.
export function SpotifyListeningStatus({ user }: { user: Pick<User, 'id' | 'homeUserId' | 'status'> }) {
  const activities = useActivityStore(state => state.userActivities.get(user.homeUserId ?? user.id) ?? state.userActivities.get(user.id));
  const [, refresh] = useState(0);
  const track = user.status !== 'offline' ? getSpotifyListeningActivity(activities) : undefined;
  const expires = track?.timestamps?.end;
  useEffect(() => {
    if (!expires) return;
    const timeout = setTimeout(() => refresh(value => value + 1), Math.max(0, expires - Date.now()) + 10);
    return () => clearTimeout(timeout);
  }, [expires]);
  if (!track) return null;
  const description = 'Ouvindo ' + track.details + (track.state ? ' — ' + track.state : '');
  return <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-5 text-emerald-300" title={description} aria-label={description + ' (Spotify)'}>
    <BrandIcon platform="spotify" size={16} />
    <span className="truncate">Ouvindo <strong className="font-medium">{track.details}</strong>{track.state ? ' · ' + track.state : ''}</span>
  </div>;
}
