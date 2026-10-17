import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../landing/root-entry.js', import.meta.url), 'utf8');
function entry(token: string | null, response: Promise<{ ok: boolean; status: number }>, standalone = false) {
  const storage = new Map(token ? [['backspace_token', token]] : []);
  const attributes = new Set<string>();
  const redirect = vi.fn();
  const fetch = vi.fn(() => response);
  runInNewContext(source, {
    location: { search: '?source=home', hash: '#demo', replace: redirect },
    matchMedia: () => ({ matches: standalone }), navigator: {}, window: {},
    localStorage: { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) },
    document: { documentElement: { setAttribute: (key: string) => attributes.add(key), removeAttribute: (key: string) => attributes.delete(key) } },
    fetch, AbortController, setTimeout, clearTimeout,
  });
  return { storage, attributes, redirect, fetch };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
describe('root session routing', () => {
  it('shows the landing immediately to visitors without a saved session', () => {
    const result = entry(null, Promise.resolve({ ok: false, status: 401 }));
    expect(result.fetch).not.toHaveBeenCalled();
    expect(result.redirect).not.toHaveBeenCalled();
    expect(result.attributes.size).toBe(0);
  });
  it('confirms the session with the API before opening the app', async () => {
    const result = entry('test-session', Promise.resolve({ ok: true, status: 200 }));
    await flush();
    expect(result.fetch).toHaveBeenCalledWith('/api/users/@me', expect.objectContaining({ headers: { Authorization: 'Bearer test-session' }, cache: 'no-store' }));
    expect(result.redirect).toHaveBeenCalledWith('/app/?source=home#demo');
  });
  it('shows the landing and removes an expired session', async () => {
    const result = entry('expired-session', Promise.resolve({ ok: false, status: 401 }));
    await flush();
    expect(result.storage.has('backspace_token')).toBe(false);
    expect(result.redirect).not.toHaveBeenCalled();
    expect(result.attributes.size).toBe(0);
  });
  it.each(['network', 'server'])('preserves the session during a %s failure', async failure => {
    const response = failure === 'network' ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: false, status: 503 });
    const result = entry('saved-session', response);
    await flush();
    expect(result.storage.get('backspace_token')).toBe('saved-session');
    expect(result.redirect).not.toHaveBeenCalled();
    expect(result.attributes.size).toBe(0);
  });
  it('respects logout in another tab while the session check was pending', async () => {
    let complete!: (value: { ok: boolean; status: number }) => void;
    const result = entry('saved-session', new Promise(resolve => { complete = resolve; }));
    result.storage.delete('backspace_token');
    complete({ ok: true, status: 200 });
    await flush();
    expect(result.redirect).not.toHaveBeenCalled();
  });
  it('keeps installed PWAs opening the app', () => {
    const result = entry(null, Promise.resolve({ ok: false, status: 401 }), true);
    expect(result.redirect).toHaveBeenCalledWith('/app/?source=home#demo');
    expect(result.fetch).not.toHaveBeenCalled();
  });
});
