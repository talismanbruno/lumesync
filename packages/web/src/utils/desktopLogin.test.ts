import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { createDesktopLoginAttempt, desktopApprovalUrl, desktopCallbackCode, type DesktopLoginAttempt } from './desktopLogin';

afterEach(() => vi.unstubAllGlobals());
const pending: DesktopLoginAttempt = { verifier: 'secret'.repeat(8), state: 's'.repeat(43), challenge: 'c'.repeat(43), expiresAt: Date.now() + 300000 };
const code = 'a'.repeat(64);
const callback = `lume://auth/callback?code=${code}&state=${pending.state}`;
describe('native browser login binding', () => {
  it('creates independent random state and S256 proof without exposing the verifier', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const attempt = await createDesktopLoginAttempt();
    expect(attempt.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(attempt.challenge).toBe(createHash('sha256').update(attempt.verifier).digest('base64url'));
    expect(attempt.state).not.toBe(attempt.verifier);
    const url = new URL(desktopApprovalUrl(attempt));
    expect(url.origin).toBe(location.origin); expect(url.pathname).toBe('/app/desktop-login');
    expect(url.search).toBe(''); expect(url.hash).not.toContain(attempt.verifier);
    expect(url.hash).toContain(attempt.challenge);
  });
  it('accepts only the expected callback and state while the request is pending', () => {
    expect(desktopCallbackCode(callback, pending)).toBe(code);
    for (const url of [callback.replace('lume:', 'https:'), callback.replace('auth/', 'evil/'), callback.replace('/callback', '/other'), callback.replace(pending.state, 'x'.repeat(43)), callback + '&state=other', callback + '#extra', callback.replace(code, 'short'), 'invalid']) {
      expect(desktopCallbackCode(url, pending)).toBeNull();
    }
    expect(desktopCallbackCode(callback, { ...pending, expiresAt: Date.now() - 1 })).toBeNull();
  });
});
