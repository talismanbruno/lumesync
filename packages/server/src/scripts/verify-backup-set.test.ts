import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256File, type OffsiteBackupManifest } from '../utils/offsiteBackup.js';
import { verifyBackupSet } from './verify-backup-set.js';

let dir: string;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-backup-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

async function fixture(): Promise<[string, string, string]> {
  const database = path.join(dir, 'database.db');
  const db = new Database(database);
  db.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, content TEXT); INSERT INTO messages (content) VALUES (\'preserved\')');
  db.close();

  const uploadsDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadsDir);
  fs.writeFileSync(path.join(uploadsDir, 'attachment.txt'), 'preserved');
  const uploads = path.join(dir, 'uploads.tar.gz');
  execFileSync('tar', ['-czf', uploads, '-C', dir, 'uploads']);

  const manifest: OffsiteBackupManifest = {
    version: 1,
    backupId: 'test-backup',
    createdAt: new Date().toISOString(),
    database: {
      objectName: 'test/database.db', fileName: 'database.db',
      bytes: fs.statSync(database).size, sha256: await sha256File(database),
    },
    uploads: {
      objectName: 'test/uploads.tar.gz', fileName: 'uploads.tar.gz',
      bytes: fs.statSync(uploads).size, sha256: await sha256File(uploads),
    },
  };
  const manifestFile = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  return [manifestFile, database, uploads];
}

describe('verifyBackupSet', () => {
  it('accepts a complete set with valid checksums, SQLite, and uploads archive', async () => {
    await expect(verifyBackupSet(...await fixture())).resolves.toBeUndefined();
  });

  it('rejects a payload changed after the manifest was written', async () => {
    const files = await fixture();
    fs.appendFileSync(files[1], 'tampered');
    await expect(verifyBackupSet(...files)).rejects.toThrow(/size does not match/);
  });
});
