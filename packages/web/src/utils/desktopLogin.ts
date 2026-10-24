const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
export interface DesktopLoginAttempt { verifier: string; state: string; challenge: string; expiresAt: number }

export async function createDesktopLoginAttempt(): Promise<DesktopLoginAttempt> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, state, challenge, expiresAt: Date.now() + 5 * 60_000 };
}

export function desktopApprovalUrl(attempt: DesktopLoginAttempt): string {
  const url = new URL('/app/desktop-login', location.origin);
  url.hash = new URLSearchParams({ challenge: attempt.challenge, state: attempt.state }).toString();
  return url.href;
}

export function desktopCallbackCode(url: string, attempt: DesktopLoginAttempt): string | null {
  try {
    const callback = new URL(url);
    if (Date.now() >= attempt.expiresAt || callback.protocol !== 'lume:' || callback.hostname !== 'auth' || callback.pathname !== '/callback'
      || callback.username || callback.password || callback.port || callback.hash
      || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== attempt.state
      || callback.searchParams.getAll('code').length !== 1) return null;
    const code = callback.searchParams.get('code');
    return code && /^[a-f0-9]{64}$/.test(code) ? code : null;
  } catch { return null; }
}

/** The browser hands the one-time code to the OS-registered Lume application. */
export function openDesktopLoginCallback(url: string): void {
  window.location.assign(url);
}
