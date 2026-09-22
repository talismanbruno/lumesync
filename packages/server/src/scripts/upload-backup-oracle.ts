import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import {
  type BackupArtifact,
  type OffsiteBackupManifest,
  safeBackupPrefix,
  sha256File,
  uploadFile,
  writeOffsiteStatus,
} from '../utils/offsiteBackup.js';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 500)}`)));
  });
}

async function artifact(file: string, objectName: string): Promise<BackupArtifact> {
  const stat = await fs.promises.stat(file);
  return { objectName, fileName: path.basename(file), bytes: stat.size, sha256: await sha256File(file) };
}

async function main(): Promise<void> {
  const snapshotArg = process.argv[2];
  const parUrl = process.env.BACKUP_OBJECT_STORAGE_PAR_URL;
  const backupId = snapshotArg ? path.basename(snapshotArg, '.db') : undefined;

  try {
    if (!snapshotArg) throw new Error('snapshot path argument is required');
    if (!parUrl) throw new Error('BACKUP_OBJECT_STORAGE_PAR_URL is not configured');

    const snapshot = path.resolve(snapshotArg);
    const backupDir = path.resolve(config.backup.dir);
    if (path.dirname(snapshot) !== backupDir || path.extname(snapshot) !== '.db') {
      throw new Error('snapshot must be a .db file directly inside BACKUP_DIR');
    }
    await fs.promises.access(snapshot, fs.constants.R_OK);

    const prefix = safeBackupPrefix(process.env.BACKUP_OBJECT_STORAGE_PREFIX ?? 'lume-production');
    const id = path.basename(snapshot, '.db');
    const base = `${prefix}/backups/${id}`;
    const uploadsArchive = path.join(backupDir, `.${id}.uploads.tar.gz`);
    const manifestFile = path.join(backupDir, `.${id}.manifest.json`);

    try {
      await fs.promises.mkdir(config.uploadDir, { recursive: true });
      await run('tar', ['-czf', uploadsArchive, '-C', path.dirname(config.uploadDir), path.basename(config.uploadDir)]);

      const database = await artifact(snapshot, `${base}/database.db`);
      const uploads = await artifact(uploadsArchive, `${base}/uploads.tar.gz`);
      const manifest: OffsiteBackupManifest = {
        version: 1,
        backupId: id,
        createdAt: new Date().toISOString(),
        database,
        uploads,
      };
      await fs.promises.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

      // The manifest is uploaded last and is therefore the completion marker for a set.
      await uploadFile(parUrl, database.objectName, snapshot);
      await uploadFile(parUrl, uploads.objectName, uploadsArchive);
      const manifestObject = `${base}/manifest.json`;
      await uploadFile(parUrl, manifestObject, manifestFile);

      writeOffsiteStatus(backupDir, {
        status: 'success', completedAt: new Date().toISOString(), backupId: id,
        objects: [database.objectName, uploads.objectName, manifestObject],
      });
      console.log(`[backup] Oracle Object Storage copy completed: ${id}`);
    } finally {
      await Promise.allSettled([fs.promises.rm(uploadsArchive, { force: true }), fs.promises.rm(manifestFile, { force: true })]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOffsiteStatus(config.backup.dir, {
      status: 'error', completedAt: new Date().toISOString(), backupId, error: message,
    });
    console.error(`[backup] Oracle Object Storage copy failed: ${message}`);
    process.exitCode = 1;
  }
}

await main();
