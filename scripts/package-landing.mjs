import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
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
const rootHtml = html.replace(/\b(src|href)="(?![a-z]+:|\/|#)([^"]+)"/gi, '$1="/site/$2"')
  .replace('<head>', `<head><script>if(matchMedia('(display-mode: standalone)').matches||navigator.standalone||window.backspace)location.replace('/app/'+location.search+location.hash);</script>`);
await writeFile(resolve(destination, 'root.html'), rootHtml);
console.log('Landing packaged for / with assets at /site/');
