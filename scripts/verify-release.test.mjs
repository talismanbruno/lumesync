import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkVersions, verifyFeed } from './verify-release.mjs';

test('rejects stale desktop, APK and tag versions', () => {
  const android = 'versionName = "1.0.0-beta.20"';
  assert.equal(checkVersions('1.0.0-beta.20', '1.0.0-beta.20', android, 'refs/heads/main'), '1.0.0-beta.20');
  assert.throws(() => checkVersions('1.0.0-beta.20', '1.0.0-beta.16', android));
  assert.throws(() => checkVersions('1.0.0-beta.20', '1.0.0-beta.20', 'versionName = "0.8.1"'));
  assert.throws(() => checkVersions('1.0.0-beta.20', '1.0.0-beta.20', android, 'refs/tags/v1.0.0-beta.19'));
});

test('rejects update feeds with missing or corrupt downloads', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lume-release-'));
  try {
    const file = Buffer.from('installer bytes');
    const name = 'Lume-1.0.0-beta.20-x64.exe';
    const feed = `version: 1.0.0-beta.20\nfiles:\n  - url: ${name}\n    sha512: ${createHash('sha512').update(file).digest('base64')}\n    size: ${file.length}\n`;
    assert.throws(() => verifyFeed(feed, directory, '1.0.0-beta.20'));
    writeFileSync(join(directory, name), file);
    verifyFeed(feed, directory, '1.0.0-beta.20');
    writeFileSync(join(directory, name), 'corrupt');
    assert.throws(() => verifyFeed(feed, directory, '1.0.0-beta.20'));
    assert.throws(() => verifyFeed(feed, directory, '1.0.0-beta.19'));
  } finally { rmSync(directory, { recursive: true }); }
});
