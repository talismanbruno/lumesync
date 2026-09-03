import type { FastifyInstance } from 'fastify';
import { lt } from 'drizzle-orm';
import type { CreateBugReportRequest, VoiceDiagnosticRequest } from '@backspace/shared';
import { authenticate } from '../utils/auth.js';
import { getDb, schema } from '../db/index.js';
import { generateSnowflake } from '../utils/snowflake.js';

const BUG_CATEGORIES = new Set(['call', 'audio', 'screen_share', 'messages', 'interface', 'other']);
const VOICE_EVENTS = new Set(['reconnecting', 'recovered', 'disconnected']);
const SAFE_DIAGNOSTICS = new Set(['appVersion', 'platform', 'connectionQuality', 'participantCount', 'channelKind']);

function cleanDiagnostics(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_DIAGNOSTICS.has(key)) continue;
    if (typeof raw === 'string') result[key] = raw.slice(0, 100);
    else if (typeof raw === 'number' && Number.isFinite(raw)) result[key] = raw;
    else if (typeof raw === 'boolean' || raw === null) result[key] = raw;
  }
  return Object.keys(result).length ? result : null;
}

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateBugReportRequest }>('/api/feedback/bug-report', {
    preHandler: authenticate,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const category = request.body?.category;
    const description = typeof request.body?.description === 'string' ? request.body.description.trim() : '';
    if (!BUG_CATEGORIES.has(category) || description.length < 10 || description.length > 2000) {
      return reply.code(400).send({ error: 'Choose a category and write between 10 and 2000 characters', statusCode: 400 });
    }
    const diagnostics = cleanDiagnostics(request.body.diagnostics);
    const id = generateSnowflake();
    getDb().insert(schema.bugReports).values({
      id,
      userId: request.userId,
      category,
      description,
      diagnostics: diagnostics ? JSON.stringify(diagnostics) : null,
      status: 'open',
      createdAt: Date.now(),
    }).run();
    return reply.code(201).send({ id, success: true });
  });

  app.post<{ Body: VoiceDiagnosticRequest }>('/api/feedback/voice-diagnostic', {
    preHandler: authenticate,
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const body = request.body;
    if (!body || !VOICE_EVENTS.has(body.event)) {
      return reply.code(400).send({ error: 'Invalid voice event', statusCode: 400 });
    }
    const now = Date.now();
    getDb().insert(schema.voiceDiagnostics).values({
      id: generateSnowflake(),
      userId: request.userId,
      event: body.event,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 80) : null,
      channelKind: body.channelKind === 'dm' ? 'dm' : 'server',
      participantCount: Number.isInteger(body.participantCount) ? Math.max(0, Math.min(500, body.participantCount!)) : null,
      connectionQuality: typeof body.connectionQuality === 'string' ? body.connectionQuality.slice(0, 30) : null,
      recoveryMs: Number.isFinite(body.recoveryMs) ? Math.max(0, Math.min(600_000, Math.round(body.recoveryMs!))) : null,
      createdAt: now,
    }).run();
    // Bounded retention: health telemetry older than 30 days is not useful.
    getDb().delete(schema.voiceDiagnostics).where(lt(schema.voiceDiagnostics.createdAt, now - 30 * 86_400_000)).run();
    return reply.code(202).send({ success: true });
  });
}
