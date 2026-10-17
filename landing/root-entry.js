// Only injected into the production root. GitHub Pages has no access to app sessions.
(() => {
  const destination = '/app/' + location.search + location.hash;
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone || window.backspace) {
    location.replace(destination);
    return;
  }
  let token;
  try { token = localStorage.getItem('backspace_token'); } catch { return; }
  if (!token) return;
  const controller = new AbortController();
  document.documentElement.setAttribute('data-lume-session-check', '');
  const reveal = () => document.documentElement.removeAttribute('data-lume-session-check');
  const timer = setTimeout(() => { controller.abort(); reveal(); }, 3000);
  fetch('/api/users/@me', {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
    credentials: 'same-origin',
    signal: controller.signal,
  }).then(response => {
    // A logout in another tab while this request was pending must win.
    if (localStorage.getItem('backspace_token') !== token) return;
    if (response.ok) location.replace(destination);
    else if (response.status === 401 || response.status === 403) localStorage.removeItem('backspace_token');
  }).catch(() => {
    // A temporary connection failure must not erase a saved session.
  }).finally(() => { clearTimeout(timer); reveal(); });
})();
