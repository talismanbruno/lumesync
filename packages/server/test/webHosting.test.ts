import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWebHosting } from '../src/webHosting.js';

describe('landing and app hosting', () => {
  let directory: string;
  let app: ReturnType<typeof Fastify>;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lume-hosting-'));
    await mkdir(join(directory, 'site'));
    await writeFile(join(directory, 'index.html'), '<html>application</html>');
    await writeFile(join(directory, 'site/root.html'), '<html>landing</html>');
    await writeFile(join(directory, 'site/index.html'), '<html>old landing</html>');
    await writeFile(join(directory, 'site/lume.js'), '/* landing script */');
    app = Fastify();
    await registerWebHosting(app, directory);
    app.get('/api/health', () => ({ ok: true }));
    await app.ready();
  });
  afterEach(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  it('serves the landing only at the browser root', async () => {
    expect((await app.inject('/')).body).toContain('landing');
    for (const url of ['/app/', '/app/login', '/app/channels/@me']) expect((await app.inject(url)).body).toContain('application');
  });
  it('preserves old links and their query strings', async () => {
    for (const url of ['/login?redirect=%2Fjoin%2Fdemo', '/join/demo', '/channels/@me']) {
      expect((await app.inject(url)).headers.location).toBe('/app' + url);
    }
    for (const url of ['/site', '/site/', '/site/index.html']) expect((await app.inject(url)).headers.location).toBe('/');
  });
  it('keeps installed native clients in the application', async () => {
    for (const agent of ['Mozilla/5.0 Electron/42.0', 'Mozilla/5.0 LumeAndroid/23']) {
      expect((await app.inject({ url: '/?token=demo', headers: { 'user-agent': agent } })).headers.location).toBe('/app/?token=demo');
    }
  });
  it('preserves API and marketing assets without masking missing resources', async () => {
    expect((await app.inject('/api/health')).json()).toEqual({ ok: true });
    expect((await app.inject('/site/lume.js')).body).toContain('landing script');
    for (const url of ['/api/missing', '/assets/missing.js', '/app/assets/missing.js', '/unknown']) expect((await app.inject(url)).statusCode).toBe(404);
  });
});
