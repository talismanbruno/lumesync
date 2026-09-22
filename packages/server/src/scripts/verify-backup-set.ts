import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { type OffsiteBackupManifest, sha256File } from '../utils/offsiteBackup.js';

function tarEntries(archive: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-tzf', archive], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0
      ? resolve(stdout.split(/\r?\n/).filter(Boolean))
      : reject(new Error(`cannot read uploads archive: ${stderr.slice(0, 500)}`)));
  });
}

export async function verifyBackupSet(manifestFile: string, databaseFile: string, uploadsFile: string): Promise<void> {
  const manifest = JSON.parse(await fs.promises.readFile(manifestFile, 'utf8')) as OffsiteBackupManifest;
  if (manifest.version !== 1 || !manifest.backupId || !manifest.database || !manifest.uploads) {
    throw new Error('unsupported or incomplete backup manifest');
  }

  for (const [label, artifact, file] of [
    ['database', manifest.database, databaseFile],
    ['uploads', manifest.uploads, uploadsFile],
  ] as const) {
    const stat = await fs.promises.stat(file);
    if (stat.size !== artifact.bytes) throw new Error(`${label} size does not match manifest`);
    if (await sha256File(file) !== artifact.sha256) throw new Error(`${label} checksum does not match manifest`);
  }

  const db = new Database(databaseFile, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (result.length !== 1 || result[0]?.integrity_check !== 'ok') throw new Error('SQLite integrity_check failed');
  } finally {
    db.close();
  }

  const entries = await tarEntries(uploadsFile);
  if (!entries.length || entries.some(entry => {
    const normalized = entry.replace(/\\/g, '/');
    return normalized.startsWith('/') || normalized.split('/').includes('..') || !normalized.startsWith('uploads/');
  })) {
    throw new Error('uploads archive contains an unsafe or unexpected path');
  }
}

async function main(): Promise<void> {
  const [manifest, database, uploads] = process.argv.slice(2).map(value => value && path.resolve(value));
  if (!manifest || !database || !uploads) {
    throw new Error('usage: verify-backup-set <manifest.json> <database.db> <uploads.tar.gz>');
  }
  await verifyBackupSet(manifest, database, uploads);
  console.log('Backup set verified: checksums, SQLite integrity, and archive paths are valid.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
