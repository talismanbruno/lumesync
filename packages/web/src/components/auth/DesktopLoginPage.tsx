import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const automaticStarted = useRef(false);
  const authorizing = useRef(false);
  useEffect(() => {
    if (valid && token && !user) void useAuthStore.getState().loadUser();
  }, [valid, token, user]);

  const approve = useCallback(async () => {
    if (authorizing.current || callback || !valid || !token || !user || isElectron()) return;
    authorizing.current = true;
    setBusy(true); setError('');
    try {
      const { code } = await api.auth.authorizeDesktop(challenge);
      const url = new URL('lume://auth/callback');
      url.search = new URLSearchParams({ code, state }).toString();
      setCallback(url.href);
      openDesktopLoginCallback(url.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autorizar. Tente novamente pelo aplicativo.');
    } finally { authorizing.current = false; setBusy(false); }
  }, [callback, valid, token, user, challenge, state]);

  useEffect(() => {
    if (automaticStarted.current || !valid || !token || !user || isElectron()) return;
    // This first-party handoff returns only a short-lived code to a fixed local
    // protocol. The desktop still needs its in-memory state and private proof;
    // visiting this page alone cannot create a usable desktop session.
    automaticStarted.current = true;
    void approve();
  }, [valid, token, user, approve]);

  if (isElectron()) return <Navigate to="/login" replace />;
  if (valid && !token) return <Navigate to={'/login?redirect=' + encodeURIComponent('/desktop-login' + location.hash)} replace />;

  return <main className="min-h-screen bg-surface-base flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-surface-elevated p-8 shadow-elevation-high">
      <img src="/icons/logo-wordmark.png" alt="Lume" className="h-9 w-auto mb-8 object-contain" />
      <h1 className="text-2xl font-bold tracking-tight text-txt-primary">{callback ? 'Sua conta está pronta no aplicativo.' : 'Conectando você ao Lume…'}</h1>
      {!valid ? <p role="alert" className="mt-4 text-sm leading-6 text-txt-secondary">Este pedido está incompleto. Abra o aplicativo e escolha “Continuar pelo navegador”.</p>
        : callback ? <><p className="mt-4 text-sm leading-6 text-txt-secondary">Permita abrir o Lume para concluir. Se ele não abriu, use o botão abaixo. Depois de entrar, você pode fechar esta aba.</p>
          <a href={callback} className="mt-6 block rounded-xl bg-accent-primary px-4 py-3 text-center font-semibold text-black">Abrir Lume</a></>
        : <><p role="status" className="mt-4 text-sm leading-6 text-txt-secondary">{user ? `Encontramos sua sessão como @${user.username}. Estamos conectando sua conta ao aplicativo, sem pedir a senha de novo.` : 'Estamos conferindo sua sessão neste navegador…'}</p>
          {error && <button type="button" onClick={() => void approve()} disabled={busy} className="mt-6 w-full rounded-xl bg-accent-primary px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? 'Tentando novamente…' : 'Tentar novamente'}</button>}</>}
      {error && <p role="alert" className="mt-4 text-sm text-txt-danger">{error}</p>}
      <Link to="/channels/@me" className="mt-6 block text-center text-sm text-txt-tertiary hover:underline">Continuar no navegador</Link>
    </section>
  </main>;
}
