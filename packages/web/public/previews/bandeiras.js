import { FlagCloth, renderFlagThumbnail } from './flag-cloth.js';

const banner = new FlagCloth(document.querySelector('#banner-canvas'), { speed: .75 });
const plate = new FlagCloth(document.querySelector('#plate-canvas'), { speed: .75 });
const renderers = [banner, plate];
const list = document.querySelector('#country-list');
const error = document.querySelector('#error');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compact = matchMedia('(max-width: 650px)');
const featured = ['br', 'pt', 'us', 'jp', 'gb', 'gi'];
let countries = [], filtered = [];
let selected = 'br', format = 'banner', page = 0;
const pageSize = () => compact.matches ? 8 : 12;

function updateSelection() {
  const country = countries.find(item => item.code === selected);
  if (!country) return;
  document.querySelector('#selected-name').textContent = country.name;
  document.querySelector('#selected-format').textContent = format === 'banner' ? 'Banner de perfil' : 'Placa de identificação';
  document.querySelector('#selected-description').textContent = `Bandeira: ${country.name}. Tecido animado com ondulação, luz e sombra.`;
  list.querySelectorAll('[data-country]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.country === selected)));
}
async function choose(code) {
  selected = code; error.hidden = true; updateSelection();
  try { await Promise.all(renderers.map(renderer => renderer.setCountry(code))); }
  catch (failure) { error.hidden = false; error.textContent = failure.message; }
}
function buttonFor(country) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'country-card'; button.dataset.country = country.code;
  button.setAttribute('aria-pressed', String(country.code === selected)); button.setAttribute('aria-label', country.name);
  const art = document.createElement('div'); art.className = 'country-card-art';
  const image = document.createElement('img'); image.alt = ''; image.loading = 'lazy';
  renderFlagThumbnail(country.code).then(source => { image.src = source; }).catch(() => { image.src = `./flags/${country.code}.svg`; });
  const check = document.createElement('span'); check.className = 'selection-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
  art.append(image, check);
  const name = document.createElement('span'); name.className = 'country-card-name'; name.textContent = country.name;
  button.append(art, name); button.addEventListener('click', () => void choose(country.code));
  return button;
}
function renderPage() {
  const size = pageSize(), count = Math.max(1, Math.ceil(filtered.length / size));
  page = Math.min(Math.max(0, page), count - 1);
  const start = page * size;
  list.replaceChildren(...filtered.slice(start, start + size).map(buttonFor));
  if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Nenhuma bandeira encontrada.'; list.append(empty); }
  document.querySelector('#total').textContent = `${filtered.length} ${filtered.length === 1 ? 'opção' : 'opções'}`;
  document.querySelector('#item-range').textContent = filtered.length ? `${start + 1}–${Math.min(start + size, filtered.length)} de ${filtered.length}` : '0 opções';
  document.querySelector('#page-number').textContent = `${page + 1} / ${count}`;
  document.querySelector('#previous').disabled = page === 0; document.querySelector('#next').disabled = page === count - 1;
}
function filterCountries(query = '') {
  const match = normalize(query);
  filtered = countries.filter(country => normalize(`${country.name} ${country.code}`).includes(match));
  page = 0; renderPage();
}
document.querySelector('#search').addEventListener('input', event => filterCountries(event.target.value));
document.querySelector('#previous').addEventListener('click', () => { page--; renderPage(); });
document.querySelector('#next').addEventListener('click', () => { page++; renderPage(); });
compact.addEventListener('change', () => renderPage());
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
  format = button.dataset.format;
  document.querySelectorAll('[data-format]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.format === format)));
  document.querySelector('#banner-preview').hidden = format !== 'banner'; document.querySelector('#plate-preview').hidden = format !== 'plate';
  banner.paused = format !== 'banner' || document.querySelector('#pause').getAttribute('aria-pressed') === 'true';
  plate.paused = format !== 'plate' || document.querySelector('#pause').getAttribute('aria-pressed') === 'true';
  updateSelection(); renderers.forEach(renderer => renderer.draw());
}));
document.querySelector('#pause').addEventListener('click', event => {
  const button = event.currentTarget, paused = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(paused)); button.setAttribute('aria-label', paused ? 'Retomar movimento' : 'Pausar movimento');
  button.textContent = paused ? '▷' : 'Ⅱ'; banner.paused = paused || format !== 'banner'; plate.paused = paused || format !== 'plate';
});
window.addEventListener('pagehide', () => renderers.forEach(renderer => renderer.dispose()), { once: true });
try {
  const response = await fetch('./flags/countries.json');
  if (!response.ok) throw new Error('Não foi possível carregar as bandeiras.');
  const all = await response.json();
  countries = [...featured.map(code => all.find(country => country.code === code)).filter(Boolean), ...all.filter(country => !featured.includes(country.code))];
  filterCountries(); plate.paused = true; await choose('br');
} catch (failure) { error.hidden = false; error.textContent = failure.message; }
