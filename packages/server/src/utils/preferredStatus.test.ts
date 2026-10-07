import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPreferredStatus } from './preferredStatus.js';

describe('preferred presence validation', () => {
  it.each(['online', 'idle', 'dnd', 'offline'])('preserves %s for a normal account', preferredStatus => {
    expect(getPreferredStatus({ preferredStatus, isAdmin: 0 })).toBe(preferredStatus);
  });
  it('keeps Working restricted to current admins', () => {
    expect(getPreferredStatus({ preferredStatus: 'working', isAdmin: 1 })).toBe('working');
    expect(getPreferredStatus({ preferredStatus: 'working', isAdmin: 0 })).toBe('online');
  });
  it('handles invalid stored values', () => {
    expect(getPreferredStatus({ preferredStatus: 'invalid', isAdmin: 0 })).toBe('online');
  });
  it('backfills older databases without treating disconnected accounts as Invisible', () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec("CREATE TABLE users (id text, status text, is_admin integer); INSERT INTO users VALUES ('away','idle',0), ('quiet','dnd',0), ('admin','working',1), ('invalid','working',0), ('disconnected','offline',0)");
      const migration = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle/0021_preferred_status.sql');
      sqlite.exec(fs.readFileSync(migration, 'utf8'));
      expect(sqlite.prepare('SELECT id, preferred_status FROM users ORDER BY id').all()).toEqual([
        { id: 'admin', preferred_status: 'working' },
        { id: 'away', preferred_status: 'idle' },
        { id: 'disconnected', preferred_status: 'online' },
        { id: 'invalid', preferred_status: 'online' },
        { id: 'quiet', preferred_status: 'dnd' },
      ]);
    } finally { sqlite.close(); }
  });
});
