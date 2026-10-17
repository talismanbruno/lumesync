/** Browser URLs include /app; React Router continues using paths relative to it. */
export function appRelativePath(path: string): string {
  return path === '/app' ? '/' : path.startsWith('/app/') ? path.slice(4) : path;
}

export function appPath(path: string): string {
  const relative = appRelativePath(path);
  return '/app' + (relative.startsWith('/') ? relative : '/' + relative);
}

/** Upgrade bookmarked URLs and older installed clients without losing query or token fragments. */
export function migrateAppLocation(): void {
  if (/^\/app(?:\/|$)/.test(window.location.pathname)) return;
  const path = window.location.pathname === '/index.html' ? '/' : window.location.pathname;
  window.history.replaceState(window.history.state, '', appPath(path) + window.location.search + window.location.hash);
}
