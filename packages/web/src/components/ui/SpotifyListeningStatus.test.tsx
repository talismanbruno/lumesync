import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@backspace/shared';
import { getSpotifyListeningActivity } from '@backspace/shared';
import { useActivityStore } from '../../stores/activityStore';
import { SpotifyListeningStatus } from './SpotifyListeningStatus';
import { ProfileSocialLinks } from './ProfileSocialLinks';
vi.mock('../../hooks/useWebSocket', () => ({ wsSendAll: vi.fn() }));
const user = { id: 'listener', homeUserId: null, status: 'online' as const };
const song = (): Activity => ({ type: 'listening', name: 'Spotify', details: 'Faixa atual', state: 'Artista', url: 'https://open.spotify.com/track/abc123', timestamps: { end: Date.now() + 1000 } });
afterEach(() => { cleanup(); useActivityStore.getState().reset(); vi.useRealTimers(); });
describe('music on appropriate profile surfaces', () => {
  it('keeps the song visible alongside a game and updates without reopening the profile', () => {
    useActivityStore.setState({ userActivities: new Map([[user.id, [{ type: 'playing', name: 'Jogo' }, song()]]]) });
    render(<SpotifyListeningStatus user={user} />);
    expect(screen.getByText('Faixa atual')).toBeInTheDocument();
    act(() => useActivityStore.getState().setUserActivities(user.id, [{ ...song(), details: 'Outra faixa' }]));
    expect(screen.getByText('Outra faixa')).toBeInTheDocument();
    act(() => useActivityStore.getState().setUserActivities(user.id, []));
    expect(screen.queryByText('Outra faixa')).not.toBeInTheDocument();
  });
  it('clears expired tracks locally and hides invisible users', () => {
    vi.useFakeTimers();
    useActivityStore.setState({ userActivities: new Map([[user.id, [song()]]]) });
    const view = render(<SpotifyListeningStatus user={user} />);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText('Faixa atual')).not.toBeInTheDocument();
    act(() => useActivityStore.getState().setUserActivities(user.id, [song()]));
    view.rerender(<SpotifyListeningStatus user={{ ...user, status: 'offline' }} />);
    expect(screen.queryByText('Faixa atual')).not.toBeInTheDocument();
  });
  it('ignores stale, unbounded or unsafe listening data', () => {
    expect(getSpotifyListeningActivity([{ ...song(), timestamps: undefined }])).toBeUndefined();
    expect(getSpotifyListeningActivity([{ ...song(), url: 'javascript:bad' }])).toBeUndefined();
    expect(getSpotifyListeningActivity([{ ...song(), timestamps: { end: Date.now() - 1 } }])).toBeUndefined();
  });
  it('renders safe public links and a non-clickable Epic display name', () => {
    render(<ProfileSocialLinks user={{ socialLinks: [{ platform: 'x', value: 'https://x.com/lume' }, { platform: 'epicgames', value: 'Player Lume' }] }} />);
    expect(screen.getByRole('link', { name: 'X: lume' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Player Lume').closest('a')).toBeNull();
  });
});
