import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type OffsiteBackupStatus =
  | { status: 'success'; completedAt: string; backupId: string; objects: string[] }
  | { status: 'error'; completedAt: string; backupId?: string; error: string };

export interface BackupArtifact {
  objectName: string;
  fileName: string;
  bytes: number;
  sha256: string;
}

export interface OffsiteBackupManifest {
  version: 1;
  backupId: string;
  createdAt: string;
  database: BackupArtifact;
  uploads: BackupArtifact;
}

export function offsiteStatusPath(backupDir: string): string {
  return path.join(backupDir, '.offsite-status.json');
}

export function writeOffsiteStatus(backupDir: string, status: OffsiteBackupStatus): void {
  fs.mkdirSync(backupDir, { recursive: true });
  const target = offsiteStatusPath(backupDir);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(status)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

export async function sha256File(file: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = fs.createReadStream(file);
    input.on('error', reject);
    input.on('data', chunk => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

export function objectUrl(parUrl: string, objectName: string): URL {
  const url = new URL(parUrl);
  if (url.protocol !== 'https:') throw new Error('BACKUP_OBJECT_STORAGE_PAR_URL must use HTTPS');
  if (!url.pathname.endsWith('/o/') && !url.pathname.endsWith('/o')) {
    throw new Error('BACKUP_OBJECT_STORAGE_PAR_URL must be an Object Storage bucket write URL ending in /o/');
  }
  url.pathname = `${url.pathname.replace(/\/?$/, '/')}${objectName.split('/').map(encodeURIComponent).join('/')}`;
  return url;
}

export function safeBackupPrefix(value: string): string {
  const prefix = value.replace(/^\/+|\/+$/g, '');
  if (!prefix || prefix.split('/').some(part => part === '.' || part === '..' || !part)) {
    throw new Error('BACKUP_OBJECT_STORAGE_PREFIX must be a non-empty object prefix');
  }
  return prefix;
}

export async function uploadFile(
  parUrl: string,
  objectName: string,
  file: string,
  attempts = 3,
): Promise<void> {
  const stat = await fs.promises.stat(file);
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(objectUrl(parUrl, objectName), {
        method: 'PUT',
        headers: { 'Content-Length': String(stat.size), 'Content-Type': 'application/octet-stream' },
        body: fs.createReadStream(file) as unknown,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`Object Storage returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError ?? new Error('Object Storage upload failed');
}
