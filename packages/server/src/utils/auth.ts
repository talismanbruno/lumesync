import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { and, eq, isNull, lte, ne, or } from 'drizzle-orm';
import { config } from '../config.js';
import { getDb, schema } from '../db/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

const SALT_ROUNDS = 12;
const MEDIA_AUTH_COOKIE = 'lume_media_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
}

export function signJwt(payload: JwtPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: config.jwtExpiresIn as unknown as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  return decoded;
}

/**
 * Browser media elements cannot attach the Authorization header used by the
 * JSON API. Keep the same JWT in an HttpOnly cookie scoped exclusively to the
 * upload reader so <img>, <video>, and <audio> can load protected attachments
 * without putting credentials in URLs.
 */
export function setMediaAuthCookie(reply: FastifyReply, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `${MEDIA_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/api/uploads; HttpOnly; SameSite=Strict${secure}`,
  );
}

export function clearMediaAuthCookie(reply: FastifyReply): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'Set-Cookie',
    `${MEDIA_AUTH_COOKIE}=; Path=/api/uploads; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}

/** Resolve the normal Bearer token first, then the upload-only media cookie. */
export function getRequestAuthToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName !== MEDIA_AUTH_COOKIE) continue;
    try {
      return decodeURIComponent(rawValue.join('='));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * AuthError carries an HTTP status code so raw-IncomingMessage paths
 * (e.g. tus hooks) can re-throw with a status the caller maps onto
 * its own response object.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Verify a JWT token AND confirm the user still exists, isn't deleted,
 * and the token hasn't been revoked by a password change. Returns the
 * resolved user identity. Throws AuthError (statusCode = 401) on any
 * failure.
 *
 * Used by Fastify's `authenticate` preHandler AND by raw-IncomingMessage
 * paths (tus hooks) that can't go through the preHandler pipeline.
 */
export async function verifyJwtAndUser(token: string): Promise<{
  userId: string;
  username: string;
  homeInstance: string | null;
}> {
  let payload: JwtPayload;
  try {
    payload = verifyJwt(token);
  } catch {
    throw new AuthError('Invalid or expired token', 401);
  }

  const db = getDb();
  const user = db.select({
    id: schema.users.id,
    isDeleted: schema.users.isDeleted,
    isSuspended: schema.users.isSuspended,
    suspensionReason: schema.users.suspensionReason,
    passwordChangedAt: schema.users.passwordChangedAt,
    homeInstance: schema.users.homeInstance,
  }).from(schema.users).where(eq(schema.users.id, payload.userId)).get();

  if (!user || user.isDeleted === 1) {
    throw new AuthError('This account has been deleted', 401);
  }

  if (user.isSuspended === 1) {
    throw new AuthError(user.suspensionReason
      ? `Account suspended: ${user.suspensionReason}`
      : 'This account has been suspended', 403);
  }

  // Reject tokens issued before the last password change (token revocation).
  // JWT `iat` is in seconds; passwordChangedAt is in milliseconds.
  if (user.passwordChangedAt && payload.iat) {
    if (payload.iat < Math.floor(user.passwordChangedAt / 1000)) {
      throw new AuthError('Token has been revoked — please log in again', 401);
    }
  }

  return {
    userId: payload.userId,
    username: payload.username,
    homeInstance: user.homeInstance ?? null,
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid authorization header', statusCode: 401 });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const identity = await verifyJwtAndUser(token);
    (request as FastifyRequest & { userId: string; username: string }).userId = identity.userId;
    (request as FastifyRequest & { userId: string; username: string }).username = identity.username;
    (request as FastifyRequest & { userId: string; username: string }).homeInstance = identity.homeInstance;

    // Keep a single, current moderation signal instead of retaining IP history.
    // Fastify trusts only loopback/private infrastructure proxies at the app
    // boundary, so request.ip resolves the client supplied by Caddy without
    // accepting a forged X-Forwarded-For from a direct public connection.
    const clientIp = request.ip.replace(/^::ffff:/, '').slice(0, 64);
    const seenAt = Date.now();
    getDb().update(schema.users).set({ lastIp: clientIp, lastSeenAt: seenAt }).where(and(
      eq(schema.users.id, identity.userId),
      or(
        isNull(schema.users.lastIp),
        ne(schema.users.lastIp, clientIp),
        isNull(schema.users.lastSeenAt),
        lte(schema.users.lastSeenAt, seenAt - 15 * 60_000),
      ),
    )).run();

    // Backfill coarse signup-region metadata for existing native accounts on
    // their next authenticated request. This makes the dashboard useful for
    // the current community without retaining or exposing IP addresses.
    if (!identity.homeInstance) {
      const rawLocale = request.headers['x-lume-locale'];
      const rawTimezone = request.headers['x-lume-timezone'];
      const locale = typeof rawLocale === 'string' ? rawLocale.trim().slice(0, 35) : null;
      const timeZone = typeof rawTimezone === 'string' && /^[A-Za-z0-9_+./-]{1,64}$/.test(rawTimezone) ? rawTimezone : null;
      const localeParts = locale?.replace('_', '-').split('-') ?? [];
      const possibleRegion = localeParts.length > 1
        ? [...localeParts].reverse().find((part: string) => /^[A-Za-z]{2}$/.test(part))
        : undefined;
      if (locale || timeZone) {
        getDb().update(schema.users).set({
          registrationLocale: locale,
          registrationTimezone: timeZone,
          registrationCountryCode: possibleRegion?.toUpperCase() ?? null,
        }).where(and(
          eq(schema.users.id, identity.userId),
          or(isNull(schema.users.registrationLocale), isNull(schema.users.registrationTimezone)),
        )).run();
      }
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return reply.code(err.statusCode).send({ error: err.message, statusCode: err.statusCode });
    }
    return reply.code(401).send({ error: 'Invalid or expired token', statusCode: 401 });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const db = getDb();
  const caller = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
  if (!caller || caller.isAdmin !== 1) {
    return reply.code(403).send({ error: 'Only instance admins can perform this action', statusCode: 403 });
  }
}

export async function requireLocalUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.homeInstance) {
    return reply.code(403).send({
      error: 'Federated users must use their home instance for DM operations',
      statusCode: 403,
    });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    username: string;
    homeInstance: string | null;
  }
}
