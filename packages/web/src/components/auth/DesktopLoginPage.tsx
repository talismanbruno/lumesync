import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { isElectron } from '../../platform/platform';
import { openDesktopLoginCallback } from '../../utils/desktopLogin';

export function DesktopLoginPage() {
  const location = useLocation();
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const [params] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const challenge = params.get('challenge') ?? '';
  const state = params.get('state') ?? '';
  const valid = /^[A-Za-z0-9_-]{43}$/.test(challenge) && /^[A-Za-z0-9_-]{43}$/.test(state)
    && params.getAll('challenge').length === 1 && params.getAll('state').length === 1;
  const [busy, setBusy] = useState(false);
  const [callback, setCallback] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (valid && token && !user) void useAuthStore.getState().loadUser();
  }, [valid, token, user]);

  if (isElectron()) return <Navigate to="/login" replace />;
  if (valid && !token) return <Navigate to={'/login?redirect=' + encodeURIComponent('/desktop-login' + location.hash)} replace />;

  async function approve() {
    if (busy || callback || !valid || !user) return;
    setBusy(true); setError('');
    try {
      const { code } = await api.auth.authorizeDesktop(challenge);
      const url = new URL('lume://auth/callback');
      url.search = new URLSearchParams({ code, state }).toString();
      setCallback(url.href);
      openDesktopLoginCallback(url.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autorizar. Tente novamente pelo aplicativo.');
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-surface-base flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-surface-elevated p-8 shadow-elevation-high">
      <img src="/icons/logo-wordmark.png" alt="Lume" className="h-9 w-auto mb-8 object-contain" />
      <h1 className="text-2xl font-bold tracking-tight text-txt-primary">{callback ? 'Tudo pronto para entrar' : 'Sua conta, agora no aplicativo.'}</h1>
      {!valid ? <p role="alert" className="mt-4 text-sm leading-6 text-txt-secondary">Este pedido está incompleto. Abra o aplicativo e escolha “Continuar pelo navegador”.</p>
        : callback ? <><p className="mt-4 text-sm leading-6 text-txt-secondary">Permita abrir o Lume para concluir. Se ele não abriu, use o botão abaixo. Depois de entrar, você pode fechar esta aba.</p>
          <a href={callback} className="mt-6 block rounded-xl bg-accent-primary px-4 py-3 text-center font-semibold text-black">Abrir Lume</a></>
        : <><p className="mt-4 text-sm leading-6 text-txt-secondary">Você já está conectado{user ? ` como @${user.username}` : ''}. Confirme para continuar no aplicativo sem digitar sua senha.</p>
          <p className="mt-4 rounded-lg bg-white/[0.04] p-3 text-xs leading-5 text-txt-secondary">Continue apenas se você acabou de iniciar este pedido no aplicativo Lume neste computador.</p>
          <button type="button" onClick={() => void approve()} disabled={busy || !user} className="mt-6 w-full rounded-xl bg-accent-primary px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? 'Autorizando…' : user ? `Continuar como @${user.username}` : 'Conferindo sua conta…'}</button></>}
      {error && <p role="alert" className="mt-4 text-sm text-txt-danger">{error}</p>}
      <Link to="/channels/@me" className="mt-6 block text-center text-sm text-txt-tertiary hover:underline">Continuar no navegador</Link>
    </section>
  </main>;
}
