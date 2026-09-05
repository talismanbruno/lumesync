import { isIP } from 'node:net';

/**
 * Only infrastructure addresses may supply Forwarded/X-Forwarded-* headers.
 *
 * Production traffic reaches Fastify through Caddy on Docker's private bridge.
 * Treating every direct peer as trusted would let a client that can reach port
 * 3000 forge request.ip, bypass IP rate limits, and poison moderation metadata.
 */
export function isTrustedProxyAddress(rawAddress: string): boolean {
  const withoutZone = rawAddress.split('%', 1)[0] ?? rawAddress;
  const address = withoutZone.toLowerCase().startsWith('::ffff:')
    ? withoutZone.slice(7)
    : withoutZone;

  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return first === 127
      || first === 10
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }

  if (isIP(address) === 6) {
    if (address === '::1') return true;
    const firstHextet = Number.parseInt(address.split(':', 1)[0] ?? '', 16);
    // RFC 4193 unique-local (fc00::/7) and RFC 4291 link-local (fe80::/10).
    return (firstHextet >= 0xfc00 && firstHextet <= 0xfdff)
      || (firstHextet >= 0xfe80 && firstHextet <= 0xfebf);
  }

  return false;
}
