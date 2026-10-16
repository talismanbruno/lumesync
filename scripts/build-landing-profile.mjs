import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(repo, 'packages/web');
const entry = path.join(repo, 'landing/profile-source');
const output = path.join(repo, '.deploy-local/landing-profile-build');
const published = path.join(repo, 'landing/assets/profile');
const require = createRequire(path.join(web, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
process.chdir(web);
await build({ configFile: false, root: entry, publicDir: false, base: './', plugins: [{
  name: 'landing-local-nameplate', enforce: 'pre',
  transform(code, id) {
    if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/ProfileCosmetics.tsx')) return;
    const original = "`/api/customization/items/${id}/${reducedMotion ? 'static' : 'animated'}`";
    if (!code.includes(original)) throw new Error('Review the landing media adapter after changing ProfileCosmetics');
    return code.replace(original, "`./media/${id}-${reducedMotion ? 'static' : 'animated'}.png`");
  },
}, react()], css: { postcss: web }, resolve: { alias: { '@': path.join(web, 'src'), react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) } }, build: { outDir: output, emptyOutDir: true, assetsDir: 'bundle', rollupOptions: { input: path.join(entry, 'index.html') } } });
for (const name of fs.readdirSync(path.join(output, 'bundle'))) {
  const source = path.join(output, 'bundle', name);
  const target = path.join(published, 'bundle', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (name.endsWith('.css')) fs.writeFileSync(target, fs.readFileSync(source, 'utf8').replaceAll('/fonts/', '../fonts/').replace(/\/api\/customization\/assets\/[a-f0-9]{2}\//g, '../media/'));
  else fs.copyFileSync(source, target);
}
fs.copyFileSync(path.join(output, 'index.html'), path.join(published, 'index.html'));
const current = new Set(fs.readdirSync(path.join(output, 'bundle')));
for (const name of fs.readdirSync(path.join(published, 'bundle'))) {
  if (!current.has(name) && fs.statSync(path.join(published, 'bundle', name)).isFile()) fs.unlinkSync(path.join(published, 'bundle', name));
}
console.log('Real profile rebuilt; existing demo media and poster preserved.');
