import type { Activity } from './types.js';
export interface SpotifyConnectionStatus { available: boolean; connected: boolean; showListening: boolean; }
export function getSpotifyListeningActivity(activities: readonly Activity[] | undefined, now = Date.now()): Activity | undefined {
  return activities?.find(activity => activity.type === 'listening' && activity.name === 'Spotify'
    && !!activity.details && /^https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+$/.test(activity.url ?? '')
    && Number.isFinite(activity.timestamps?.end) && activity.timestamps!.end! > now);
}
