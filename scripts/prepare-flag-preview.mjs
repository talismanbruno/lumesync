import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'packages/web/public/previews/flags');
const base = 'https://raw.githubusercontent.com/lipis/flag-icons/v7.3.2/';
const get = async file => {
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return response.text();
};
await fs.mkdir(destination, { recursive: true });
const countries = JSON.parse(await get('country.json')).filter(country => country.iso || ['gb-eng', 'gb-sct', 'gb-wls', 'xk'].includes(country.code));
const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const extra = { 'gb-eng': 'Inglaterra', 'gb-sct': 'Escócia', 'gb-wls': 'País de Gales', xk: 'Kosovo' };
let cursor = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < countries.length) {
    const country = countries[cursor++];
    await fs.writeFile(path.join(destination, country.code + '.svg'), await get(country.flag_4x3));
  }
}));
await fs.writeFile(path.join(destination, 'countries.json'), JSON.stringify(countries.map(country => ({ code: country.code, name: extra[country.code] || names.of(country.code.toUpperCase()) || country.name, iso: country.iso })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))));
await fs.writeFile(path.join(destination, 'LICENSE.txt'), await get('LICENSE'));
console.log(JSON.stringify({ flags: countries.length, iso: countries.filter(country => country.iso).length, destination }));
