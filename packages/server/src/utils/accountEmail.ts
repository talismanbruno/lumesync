import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, lt } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb, schema } from '../db/index.js';

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(email) ? email : null;
}

function publicUrl(): URL | null {
  try {
    const url = new URL(config.mail?.publicUrl ?? '');
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return !url.username && !url.password && (url.protocol === 'https:' || (local && url.protocol === 'http:')) ? url : null;
  } catch { return null; }
}

export function emailDeliveryReady(): boolean {
  return !!publicUrl() && (!!(config.mail?.resendApiKey && config.mail?.from)
    || (process.env.NODE_ENV !== 'production' && !!config.mail?.previewDir));
}

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Returns false when not configured or throttled. No raw token is stored in the database. */
export async function sendAccountEmail(userId: string, email: string, purpose: 'verify' | 'reset'): Promise<boolean> {
  if (!emailDeliveryReady()) return false;
  const db = getDb();
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user || user.isDeleted || user.isSuspended || user.homeInstance) return false;
  const now = Date.now();
  db.delete(schema.accountEmailTokens).where(lt(schema.accountEmailTokens.expiresAt, now)).run();
  const recent = db.select().from(schema.accountEmailTokens).where(and(
    eq(schema.accountEmailTokens.userId, userId), eq(schema.accountEmailTokens.purpose, purpose),
  )).all().some(row => row.createdAt > now - 60_000);
  if (recent) return false;
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashEmailToken(token);
  db.insert(schema.accountEmailTokens).values({
    tokenHash, userId, purpose, email, passwordEpoch: user.passwordChangedAt ?? 0,
    createdAt: now, expiresAt: now + (purpose === 'reset' ? 15 * 60_000 : 24 * 60 * 60_000),
  }).run();
  const url = new URL(purpose === 'reset' ? '/app/reset-password' : '/app/verify-email', publicUrl()!);
  // Fragments stay out of HTTP access logs and Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  const subject = purpose === 'reset' ? 'Redefina sua senha do Lume' : 'Confirme seu e-mail no Lume';
  const text = `${subject}\n\n${purpose === 'reset' ? 'O link vale por 15 minutos e só pode ser usado uma vez.' : 'Confirme este endereço para recuperar sua conta se esquecer a senha. O link vale por 24 horas.'}\n\n${url.href}\n\nSe você não pediu isso, ignore este e-mail.`;
  try {
    if (process.env.NODE_ENV !== 'production' && config.mail?.previewDir) {
      await mkdir(config.mail.previewDir, { recursive: true });
      await writeFile(resolve(config.mail.previewDir, `${now}-${randomBytes(6).toString('hex')}.json`),
        JSON.stringify({ to: email, subject, text, url: url.href }, null, 2), { mode: 0o600, flag: 'wx' });
    } else {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(6000),
        headers: { Authorization: `Bearer ${config.mail!.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.mail!.from, to: [email], subject, text }),
      });
      if (!response.ok) throw new Error('Mail delivery failed');
    }
    return true;
  } catch {
    db.delete(schema.accountEmailTokens).where(eq(schema.accountEmailTokens.tokenHash, tokenHash)).run();
    throw new Error('Mail delivery failed');
  }
}

export function setPendingEmail(userId: string, email: string): void {
  getDb().insert(schema.accountEmails).values({ userId, pendingEmail: email })
    .onConflictDoUpdate({ target: schema.accountEmails.userId, set: { pendingEmail: email } }).run();
}
