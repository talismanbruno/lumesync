import { describe, expect, it } from 'vitest';
import { allowWsConnection, MAX_WS_PAYLOAD_BYTES, wsPayloadBytes } from './limits.js';

describe('WebSocket limits', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(wsPayloadBytes('é')).toBe(2);
    expect(wsPayloadBytes(Buffer.alloc(MAX_WS_PAYLOAD_BYTES + 1))).toBe(MAX_WS_PAYLOAD_BYTES + 1);
  });

  it('limits connection attempts per IP and resets after a minute', () => {
    const ip = '192.0.2.25';
    for (let n = 0; n < 30; n++) expect(allowWsConnection(ip, 1000)).toBe(true);
    expect(allowWsConnection(ip, 1000)).toBe(false);
    expect(allowWsConnection('192.0.2.26', 1000)).toBe(true);
    expect(allowWsConnection(ip, 61_000)).toBe(true);
  });
});
