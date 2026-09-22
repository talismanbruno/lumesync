import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { objectUrl, safeBackupPrefix, sha256File, uploadFile, writeOffsiteStatus } from './offsiteBackup.js';

afterEach(() => vi.unstubAllGlobals());

describe('Oracle Object Storage backup helpers', () => {
  it('builds an encoded object URL without exposing the PAR elsewhere', () => {
    const url = objectUrl(
      'https://objectstorage.sa-saopaulo-1.oraclecloud.com/p/secret/n/ns/b/bucket/o/',
      'lume production/backups/a/database.db',
    );
    expect(url.href).toContain('/lume%20production/backups/a/database.db');
    expect(url.href).toContain('/p/secret/');
  });

  it('rejects insecure URLs and traversal-like prefixes', () => {
    expect(() => objectUrl('http://example.test/o/', 'a')).toThrow(/HTTPS/);
    expect(() => safeBackupPrefix('../outside')).toThrow(/prefix/);
  });

  it('uploads the complete file with PUT', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-'));
    const file = path.join(dir, 'snapshot.db');
    fs.writeFileSync(file, 'backup');
    const fetchMock = vi.fn().mockImplementation(async (_url: URL, init: { body: AsyncIterable<Uint8Array> }) => {
      for await (const _chunk of init.body) { /* consume the stream like a real request */ }
      return new Response('', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await uploadFile('https://objectstorage.example/p/token/n/ns/b/b/o/', 'prefix/database.db', file, 1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', headers: { 'Content-Length': '6' } });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes status atomically and computes a stable checksum', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offsite-status-'));
    const file = path.join(dir, 'value');
    fs.writeFileSync(file, 'abc');
    expect(await sha256File(file)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    writeOffsiteStatus(dir, { status: 'error', completedAt: '2026-09-22T00:00:00.000Z', error: 'network unavailable' });
    expect(JSON.parse(fs.readFileSync(path.join(dir, '.offsite-status.json'), 'utf8'))).toMatchObject({ status: 'error' });
    expect(fs.readdirSync(dir).some(name => name.endsWith('.tmp'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
