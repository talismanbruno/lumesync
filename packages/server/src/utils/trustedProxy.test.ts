import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { isTrustedProxyAddress } from './trustedProxy.js';

describe('isTrustedProxyAddress', () => {
  it.each([
    '127.0.0.1',
    '127.42.0.1',
    '10.0.0.2',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.50.10',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1%eth0',
    '::ffff:172.18.0.3',
  ])('trusts infrastructure address %s', (address) => {
    expect(isTrustedProxyAddress(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '8.8.8.8',
    '11.0.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '192.169.0.1',
    '203.0.113.9',
    '2001:4860:4860::8888',
    'not-an-ip',
    '',
  ])('rejects public or malformed address %s', (address) => {
    expect(isTrustedProxyAddress(address)).toBe(false);
  });

  it('uses the client address forwarded by the private Caddy hop', async () => {
    const app = Fastify({ trustProxy: isTrustedProxyAddress });
    app.get('/', async (request) => ({ ip: request.ip }));

    const response = await app.inject({
      method: 'GET',
      url: '/',
      remoteAddress: '172.18.0.3',
      headers: { 'x-forwarded-for': '198.51.100.24' },
    });

    expect(response.json()).toEqual({ ip: '198.51.100.24' });
    await app.close();
  });

  it('ignores a forged forwarded address from a public direct peer', async () => {
    const app = Fastify({ trustProxy: isTrustedProxyAddress });
    app.get('/', async (request) => ({ ip: request.ip }));

    const response = await app.inject({
      method: 'GET',
      url: '/',
      remoteAddress: '203.0.113.9',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    expect(response.json()).toEqual({ ip: '203.0.113.9' });
    await app.close();
  });
});
