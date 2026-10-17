import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';

const legacyApp = /^\/(?:login|register|reset-password|verify-email|channels|join|explore|download)(?:\/|$)/;
const installedClient = /(?:Electron\/|LumeAndroid\/)/i;

/** Keep marketing and application navigation separate while preserving old app links. */
export async function registerWebHosting(app: FastifyInstance, webDistPath: string): Promise<void> {
  if (!fs.existsSync(webDistPath)) return;
  const hasLanding = fs.existsSync(path.join(webDistPath, 'site/root.html'));
  app.get('/', async (request, reply) => {
    reply.header('Cache-Control', 'no-cache').header('Vary', 'User-Agent');
    if (installedClient.test(request.headers['user-agent'] ?? '')) return reply.redirect('/app/' + new URL(request.url, 'http://localhost').search);
    return reply.sendFile(hasLanding ? 'site/root.html' : 'index.html');
  });
  for (const route of ['/site', '/site/', '/site/index.html']) app.get(route, async (request, reply) =>
    reply.redirect('/' + new URL(request.url, 'http://localhost').search));
  app.get('/app', async (request, reply) => reply.redirect('/app/' + new URL(request.url, 'http://localhost').search));
  app.get('/app/', async (_request, reply) => reply.header('Cache-Control', 'no-cache').sendFile('index.html'));
  await app.register(fastifyStatic, {
    root: webDistPath, prefix: '/', wildcard: false, index: false,
    // root.html is delivered explicitly above; /site/index.html redirects to the canonical root.
    globIgnore: ['site/index.html', 'site/root.html'],
    setHeaders(response, filePath) {
      if (filePath.includes(`${path.sep}site${path.sep}`) || path.extname(filePath) === '.html') response.header('Cache-Control', 'no-cache');
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) response.header('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });
  app.setNotFoundHandler((request, reply) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (legacyApp.test(pathname)) return reply.redirect('/app' + request.url);
    if (pathname.startsWith('/app/') && !pathname.startsWith('/app/assets/')) return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    return reply.code(404).send({ error: 'Not found', statusCode: 404 });
  });
}
