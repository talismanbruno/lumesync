import dns from 'node:dns';
import net from 'node:net';
import { Agent } from 'undici';

type ResolvedAddress = { address: string; family: 4 | 6 };

function expandIpv6(input: string): number[] | null {
  let value = input.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  const dottedTail = value.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dottedTail) {
    if (net.isIP(dottedTail) !== 4) return null;
    const [o0 = 0, o1 = 0, o2 = 0, o3 = 0] = dottedTail.split('.').map(Number);
    value = value.slice(0, value.length - dottedTail.length)
      + `${((o0 << 8) | o1).toString(16)}:${((o2 << 8) | o3).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return groups.map((part) => Number.parseInt(part, 16));
}

export function isPrivateIp(input: string): boolean {
  const ip = input.replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  const family = net.isIP(ip);

  if (family === 4) {
    const [a = 0, b = 0, c = 0] = ip.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 88 && c === 99)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
      || a >= 224;
  }

  if (family === 6) {
    const groups = expandIpv6(ip);
    if (!groups) return true;

    if (groups.slice(0, 5).every((part) => part === 0) && groups[5] === 0xffff) {
      const sixth = groups[6] ?? 0;
      const seventh = groups[7] ?? 0;
      const mapped = `${sixth >> 8}.${sixth & 0xff}.${seventh >> 8}.${seventh & 0xff}`;
      return isPrivateIp(mapped);
    }

    const first = groups[0] ?? 0;
    return first < 0x2000
      || first > 0x3fff
      || (first === 0x2001 && (groups[1] === 0 || groups[1] === 0x0db8))
      || first === 0x2002;
  }

  return true;
}

function allowPrivateTestAddress(): boolean {
  return process.env.NODE_ENV === 'test'
    && process.env.ALLOW_PRIVATE_OUTBOUND_FOR_TESTS === '1';
}

function parseExternalUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid URL scheme');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }

  const literalHost = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literalHost) && isPrivateIp(literalHost) && !allowPrivateTestAddress()) {
    throw new Error('Private IP not allowed');
  }
  return parsed;
}

async function resolvePublicAddresses(hostname: string): Promise<ResolvedAddress[]> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(literal);
  const addresses: ResolvedAddress[] = literalFamily
    ? [{ address: literal, family: literalFamily as 4 | 6 }]
    : (await dns.promises.lookup(literal, { all: true, verbatim: true }))
      .filter((item) => item.family === 4 || item.family === 6)
      .map((item) => ({ address: item.address, family: item.family as 4 | 6 }));

  if (addresses.length === 0) throw new Error('DNS lookup returned no addresses');
  if (!allowPrivateTestAddress() && addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private IP not allowed');
  }
  return addresses;
}

/** Validate an outbound URL and every address currently returned by DNS. */
export async function validateExternalUrl(url: string): Promise<void> {
  const parsed = parseExternalUrl(url);
  try {
    await resolvePublicAddresses(parsed.hostname);
  } catch (error) {
    if (error instanceof Error && error.message === 'Private IP not allowed') throw error;
    throw new Error('DNS lookup failed');
  }
}

// Validate and select the address inside the HTTP client's own DNS lookup. The
// connection therefore cannot resolve a second, attacker-controlled address.
const safeDispatcher = new Agent({
  connect: {
    lookup(hostname, _options, callback) {
      resolvePublicAddresses(hostname)
        .then((addresses) => {
          const selected = addresses[0];
          if (!selected) throw new Error('DNS lookup returned no addresses');
          callback(null, selected.address, selected.family);
        })
        .catch((cause: unknown) => {
          const error = new Error(
            cause instanceof Error ? cause.message : 'Unsafe DNS resolution',
          ) as NodeJS.ErrnoException;
          error.code = 'EACCES';
          callback(error, '', 4);
        });
    },
  },
});

const MAX_REDIRECTS = 5;

/**
 * SSRF-safe fetch. The socket is pinned to a DNS address validated at connection
 * time, and every redirect is parsed and re-validated before it is followed.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    parseExternalUrl(currentUrl);
    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
      dispatcher: safeDispatcher,
    } as RequestInit & { dispatcher: Agent });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }
  throw new Error('Too many redirects');
}
