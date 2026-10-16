const root = document.documentElement;
const nav = document.querySelector('.site-nav');
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const motionButton = document.querySelector('.motion-control');
const dialog = document.querySelector('.screenshot-dialog');
const dialogImage = dialog.querySelector('img');
const tabs = [...document.querySelectorAll('[data-capture]')];
const captureImage = document.querySelector('#main-capture');
const panel = document.querySelector('#capture-panel');
const captures = {
  conversas: { src: 'assets/lume-demo-conversas.webp', alt: 'Captura real do Lume mostrando o Espaço Demo, canais, perfis fictícios e mensagens de demonstração.', description: 'Canais, mensagens e presença em uma tela real do Lume.' },
  editor: { src: 'assets/lume-demo-editor.webp', alt: 'Captura real do editor de perfil do Lume, com opções de banner, decoração de avatar e prévia ao vivo da conta fictícia Demo.', description: 'O editor de perfil do próprio aplicativo, com a prévia da conta Demo.' },
};

function setMenu(open, restoreFocus = false) {
  mobileMenu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  menuButton.querySelector('path').setAttribute('d', open ? 'm6 6 12 12M6 18 18 6' : 'M4 8h16M4 16h16');
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => setMenu(mobileMenu.hidden));
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('click', event => { if (!mobileMenu.hidden && !nav.contains(event.target)) setMenu(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileMenu.hidden) setMenu(false, true); });
const desktop = matchMedia('(min-width:941px)');
desktop.addEventListener('change', () => { if (desktop.matches) setMenu(false); });
function updateNav() { nav.classList.toggle('scrolled', scrollY > 25); }
addEventListener('scroll', updateNav, { passive: true });
updateNav();
const sectionLinks = [...document.querySelectorAll('[data-section]')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) sectionLinks.forEach(link => { if (link.dataset.section === entry.target.id) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); });
    }
  }, { rootMargin: '-18% 0px -55% 0px', threshold: 0 });
  document.querySelectorAll('main>section[id]:not(#inicio)').forEach(section => observer.observe(section));
}
function selectCapture(value, focus = false) {
  const selected = captures[value];
  if (!selected) return;
  captureImage.src = selected.src;
  captureImage.alt = selected.alt;
  panel.setAttribute('aria-labelledby', 'tab-' + value);
  document.querySelector('#capture-description').textContent = selected.description;
  tabs.forEach(tab => {
    const active = tab.dataset.capture === value;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectCapture(tab.dataset.capture));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectCapture(tabs[next].dataset.capture, true); }
  });
});
function showCapture(src, alt, portrait) {
  dialogImage.src = src;
  dialogImage.alt = alt;
  dialog.classList.toggle('portrait-dialog', portrait);
  dialog.showModal();
}
document.querySelector('.expand-capture').addEventListener('click', () => showCapture(captureImage.src, captureImage.alt, false));
dialog.querySelector('button').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target !== dialog) return; const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); });
motionButton.addEventListener('click', () => {
  const paused = root.dataset.paused !== 'true';
  root.dataset.paused = String(paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', paused ? 'Retomar animações' : 'Pausar animações');
  motionButton.querySelector('span').textContent = paused ? 'Retomar movimento' : 'Pausar movimento';
  motionButton.querySelector('path').setAttribute('d', paused ? 'm5 3 7 5-7 5z' : 'M5 3v10M11 3v10');
});
