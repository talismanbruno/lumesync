import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from 'undici';
import { isPrivateIp, safeFetch } from './ssrf.js';

describe('SSRF-safe outbound requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('blocks non-public address %s', (address) => {
    expect(isPrivateIp(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPrivateIp(address)).toBe(false);
  });

  it('pins the validated DNS lookup into the HTTP dispatcher', async () => {
    const response = new Response('ok');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(safeFetch('https://example.com/data')).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { dispatcher?: unknown };
    expect(init.redirect).toBe('manual');
    expect(init.dispatcher).toBeInstanceOf(Agent);
  });

  it('does not follow a redirect to a private literal address', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
    }));

    const previousNodeEnv = process.env.NODE_ENV;
    const previousTestOptIn = process.env.ALLOW_PRIVATE_OUTBOUND_FOR_TESTS;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PRIVATE_OUTBOUND_FOR_TESTS;
    try {
      await expect(safeFetch('https://example.com/start')).rejects.toThrow('Private IP not allowed');
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousTestOptIn === undefined) delete process.env.ALLOW_PRIVATE_OUTBOUND_FOR_TESTS;
      else process.env.ALLOW_PRIVATE_OUTBOUND_FOR_TESTS = previousTestOptIn;
    }
  });
});
