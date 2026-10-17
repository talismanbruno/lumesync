import { describe, expect, it } from 'vitest';
import { appPath, appRelativePath, migrateAppLocation } from './appRoutes';
import { parseInviteInput } from './inviteParser';

describe('application routes', () => {
  it('adds the prefix once and exposes logical routes', () => {
    expect(appPath('/login')).toBe('/app/login');
    expect(appPath('/app/login')).toBe('/app/login');
    expect(appRelativePath('/app/channels/@me')).toBe('/channels/@me');
    expect(appRelativePath('/apple')).toBe('/apple');
  });
  it('migrates cached legacy navigation without losing query or fragment', () => {
    history.replaceState(null, '', '/login?redirect=demo#token');
    migrateAppLocation();
    expect(location.pathname + location.search + location.hash).toBe('/app/login?redirect=demo#token');
    migrateAppLocation();
    expect(location.pathname).toBe('/app/login');
    history.replaceState(null, '', '/');
  });
  it('accepts both existing and new invitation links', () => {
    expect(parseInviteInput('https://remote.example/join/demo')).toEqual({ code: 'demo', origin: 'https://remote.example' });
    expect(parseInviteInput('https://remote.example/app/join/demo')).toEqual({ code: 'demo', origin: 'https://remote.example' });
  });
});
