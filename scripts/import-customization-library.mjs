import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] && path.resolve(process.argv[2]);
if (!source) throw new Error('Usage: node scripts/import-customization-library.mjs <library-directory> [destination-directory]');
const destination = path.resolve(process.argv[3] || path.join(project, 'data/customization'));
const library = JSON.parse(await fs.readFile(path.join(source, 'biblioteca.json'), 'utf8'));
const resources = JSON.parse(await fs.readFile(path.join(source, 'recursos.json'), 'utf8'));
const byUrl = new Map();
const urlFor = resource => `/api/customization/assets/${resource.path.replace(/^recursos\//, '')}`;
await fs.mkdir(path.join(destination, 'assets'), { recursive: true });
let copied = 0;
for (const resource of Object.values(resources)) {
  if (resource.status !== 'ok') continue;
  const input = path.resolve(source, resource.path);
  if (!input.startsWith(source + path.sep)) throw new Error('Resource escapes source directory');
  const relative = resource.path.replace(/^recursos\//, '');
  const output = path.resolve(destination, 'assets', relative);
  if (!output.startsWith(path.join(destination, 'assets') + path.sep)) throw new Error('Resource escapes asset directory');
  await fs.mkdir(path.dirname(output), { recursive: true });
  try { await fs.access(output); } catch {
    try { await fs.link(input, output); } catch { await fs.copyFile(input, output); }
  }
  byUrl.set(resource.url, urlFor(resource));
  copied++;
}
const catalog = { items: library.items.map(item => {
  const media = role => item.media.filter(entry => entry.role === role).map(entry => ({ ...entry, resource: resources[entry.resource] })).filter(entry => entry.resource?.status === 'ok');
  const src = role => { const entry = media(role)[0]; return entry && urlFor(entry.resource); };
  return {
    id: item.id, type: item.type, name: item.name, category: item.category, categoryId: item.category_id, description: item.description,
    staticSrc: src('static') || src('thumbnailPreviewSrc') || src('reducedMotionSrc') || src('frame-layer'),
    animatedSrc: src('animated'),
    ...(item.type === 1 ? { layers: media('effect').map(entry => ({ src: urlFor(entry.resource), duration: entry.timing.duration, start: entry.timing.start, loop: entry.timing.loop, loopDelay: entry.timing.loopDelay, zIndex: entry.timing.zIndex, randomizedSources: (entry.timing.randomizedSources || []).map(url => byUrl.get(url)).filter(Boolean) })) } : {}),
    ...(item.type === 3 ? { frameLayers: media('frame-layer').map(entry => ({ ...entry.layer, src: urlFor(entry.resource) })), frameWidth: item.data.inner_width, overflowTop: item.data.overflow_top, overflowBottom: item.data.overflow_bottom, overflowHorizontal: item.data.overflow_horizontal } : {}),
  };
}) };
await fs.writeFile(path.join(destination, 'catalog.json'), JSON.stringify(catalog));
const faces = JSON.parse(await fs.readFile(path.join(source, 'estilos-de-nome/fontes-css.json'), 'utf8'));
const css = faces.map(entry => entry.rule.replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
  const resolved = new URL(url, entry.source || 'https://discord.com/').href;
  return byUrl.has(resolved) ? `url("${byUrl.get(resolved)}")` : match;
})).join('\n');
await fs.writeFile(path.join(project, 'packages/web/src/styles/customization-fonts.css'), css + '\n');
console.log(JSON.stringify({ directory: destination, resources: copied, items: catalog.items.length }));
