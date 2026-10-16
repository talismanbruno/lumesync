import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'landing');
const destination = resolve(root, 'packages/web/dist/site');
const html = await readFile(resolve(source, 'index.html'), 'utf8');
if (!html.includes('Suas conversas') || html.includes('PRÉVIA EM CONSTRUÇÃO')) throw new Error('Landing is not ready for publication');
await mkdir(destination, { recursive: true });
// Only published website assets belong in the application image.
await cp(source, destination, { recursive: true, filter: file => !file.endsWith('README.md') && !file.endsWith('vercel.json') && !file.includes('profile-source') });
console.log('Landing packaged at /site/');
