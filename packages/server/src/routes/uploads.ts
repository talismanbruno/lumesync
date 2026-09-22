import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getDb, schema } from '../db/index.js';
import { eq, or } from 'drizzle-orm';
import { AuthError, getRequestAuthToken, verifyJwtAndUser } from '../utils/auth.js';
import { getChannelSpaceId, hasPermission, isDmMember, PermissionBits } from '../utils/permissions.js';
import fs from 'fs';
import path from 'path';

const EXT_MIMETYPES: Record<string, string> = {
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.aac': 'audio/aac', '.opus': 'audio/opus',
  '.pdf': 'application/pdf',
};

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // Ensure upload directory exists
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  // GET /api/uploads/:filename - Serve uploaded file
  app.get<{ Params: { filename: string } }>('/api/uploads/:filename', async (request, reply) => {
    const { filename } = request.params;

    // Prevent directory traversal
    const safeName = path.basename(filename);
    const filepath = path.join(config.uploadDir, safeName);

    if (!fs.existsSync(filepath)) {
      return reply.code(404).send({ error: 'File not found', statusCode: 404 });
    }

    // Get mimetype from DB, falling back to extension-based lookup for thumbnails/orphans
    const db = getDb();
    const attachment = db.select().from(schema.attachments).where(or(
      eq(schema.attachments.filename, safeName),
      eq(schema.attachments.thumbnailFilename, safeName),
    )).get();

    // Profile/space assets and legacy orphan files retain their existing public
    // behavior. Once an attachment belongs to a message, access follows the
    // same authorization rule as reading that message.
    if (attachment?.messageId || attachment?.dmMessageId) {
      const token = getRequestAuthToken(request);
      if (!token) {
        return reply.code(401).send({ error: 'Authentication required', statusCode: 401 });
      }

      let userId: string;
      try {
        userId = (await verifyJwtAndUser(token)).userId;
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ error: err.message, statusCode: err.statusCode });
        }
        return reply.code(401).send({ error: 'Invalid or expired token', statusCode: 401 });
      }

      let allowed = false;
      if (attachment.messageId) {
        const message = db.select({ channelId: schema.messages.channelId })
          .from(schema.messages).where(eq(schema.messages.id, attachment.messageId)).get();
        const spaceId = message ? getChannelSpaceId(message.channelId) : null;
        allowed = !!message && !!spaceId && hasPermission(
          userId,
          spaceId,
          PermissionBits.VIEW_CHANNEL | PermissionBits.READ_MESSAGE_HISTORY,
          message.channelId,
        );
      } else if (attachment.dmMessageId) {
        const message = db.select({ dmChannelId: schema.dmMessages.dmChannelId })
          .from(schema.dmMessages).where(eq(schema.dmMessages.id, attachment.dmMessageId)).get();
        allowed = !!message && isDmMember(message.dmChannelId, userId);
      }

      if (!allowed) {
        return reply.code(403).send({ error: 'You do not have access to this attachment', statusCode: 403 });
      }
    }
    const isThumbnail = attachment?.thumbnailFilename === safeName;
    const originalName = isThumbnail ? safeName : (attachment?.originalName ?? safeName);
    const mimetype = (!isThumbnail ? attachment?.mimetype : undefined)
      ?? EXT_MIMETYPES[path.extname(safeName).toLowerCase()]
      ?? 'application/octet-stream';

    // Set caching and security headers
    reply.header(
      'Cache-Control',
      attachment?.messageId || attachment?.dmMessageId
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
    );
    reply.header('Content-Type', mimetype);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'");
    reply.header('X-Frame-Options', 'DENY');

    // For non-media files and SVGs, force download instead of inline rendering
    const isSvg = mimetype === 'image/svg+xml';
    if (isSvg || (!mimetype.startsWith('image/') && !mimetype.startsWith('video/') && !mimetype.startsWith('audio/'))) {
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    }

    // Support Range requests for audio/video seeking
    const stat = fs.statSync(filepath);
    const fileSize = stat.size;
    const rangeHeader = request.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] ?? '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', chunkSize);
      reply.code(206);

      const stream = fs.createReadStream(filepath, { start, end });
      return reply.send(stream);
    }

    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Length', fileSize);
    const stream = fs.createReadStream(filepath);
    return reply.send(stream);
  });
}
