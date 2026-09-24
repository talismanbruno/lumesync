import { beforeEach, describe, expect, it } from 'vitest';
import { canRecoverStaleChunk, isStaleChunkError } from './staleChunkRecovery';

describe('stale chunk recovery', () => {
  beforeEach(() => sessionStorage.clear());

  it('recognizes the Safari MIME error caused by a missing hashed chunk', () => {
    expect(isStaleChunkError(new TypeError("'text/html' is not a valid JavaScript MIME type for module script"))).toBe(true);
  });

  it('recognizes failed Vite dynamic imports', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true);
  });

  it('does not classify unrelated application errors as stale chunks', () => {
    expect(isStaleChunkError(new Error('WebSocket disconnected'))).toBe(false);
  });

  it('allows only one automatic reload during the cooldown', () => {
    expect(canRecoverStaleChunk(sessionStorage, 100_000)).toBe(true);
    expect(canRecoverStaleChunk(sessionStorage, 100_001)).toBe(false);
    expect(canRecoverStaleChunk(sessionStorage, 131_000)).toBe(true);
  });
});
