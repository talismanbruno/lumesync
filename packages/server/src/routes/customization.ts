import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getCustomizationCatalog } from '../utils/customizationCatalog.js';

export async function customizationRoutes(app: FastifyInstance): Promise<void> {
  const root = path.join(config.customizationDir, 'assets');
  if (fs.existsSync(root)) {
    await app.register(fastifyStatic, { root, prefix: '/api/customization/assets/', decorateReply: false, maxAge: '1y', immutable: true, index: false });
  }
  app.get('/api/customization/catalog', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return getCustomizationCatalog();
  });
  app.get<{ Params: { id: string; format: string } }>('/api/customization/items/:id/:format', async (request, reply) => {
    const { id, format } = request.params;
    const item = /^\d{1,24}$/.test(id) ? getCustomizationCatalog().items.find(entry => entry.id === id) : undefined;
    const url = format === 'animated' ? item?.animatedSrc ?? item?.staticSrc : format === 'static' ? item?.staticSrc : undefined;
    if (!url) return reply.code(404).send({ error: 'Cosmetic asset not found', statusCode: 404 });
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.redirect(url);
  });
}
